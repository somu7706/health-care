import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { action, data } = await req.json();

    switch (action) {
      case "get-connect-url": {
        const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
        if (!GOOGLE_CLIENT_ID) {
          return new Response(JSON.stringify({ error: "Google Fit not configured", not_configured: true }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const redirectUri = `${SUPABASE_URL}/functions/v1/google-fit-callback`;
        const state = btoa(JSON.stringify({ userId, redirect: data?.redirect || "" }));

        const scopes = [
          "https://www.googleapis.com/auth/fitness.heart_rate.read",
          "https://www.googleapis.com/auth/fitness.activity.read",
          "https://www.googleapis.com/auth/fitness.sleep.read",
          "https://www.googleapis.com/auth/fitness.body.read",
        ].join(" ");

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent(scopes)}&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=${encodeURIComponent(state)}`;

        return new Response(JSON.stringify({ url: authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-connection": {
        const { data: conn } = await supabase
          .from("wearable_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", "google_fit")
          .eq("is_active", true)
          .single();

        return new Response(JSON.stringify({ connected: !!conn, provider: conn?.provider || null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync-googlefit": {
        // Get connection
        const { data: conn } = await supabase
          .from("wearable_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", "google_fit")
          .eq("is_active", true)
          .single();

        if (!conn) {
          return new Response(JSON.stringify({ error: "No Google Fit connection" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let accessToken = conn.access_token;

        // Check if token expired, refresh if needed
        if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
          const refreshed = await refreshGoogleToken(conn.refresh_token);
          if (refreshed.error) {
            // Mark connection as inactive
            await serviceSupabase
              .from("wearable_connections")
              .update({ is_active: false })
              .eq("id", conn.id);
            return new Response(JSON.stringify({ error: "Token expired, reconnect required", reconnect: true }), {
              status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          accessToken = refreshed.access_token;
          // Update tokens
          await serviceSupabase
            .from("wearable_connections")
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", conn.id);
        }

        // Fetch Google Fit data
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        const [heartRateVals, stepsVals, caloriesVals, sleepHours] = await Promise.all([
          fetchGoogleFitData(accessToken, "com.google.heart_rate.bpm", oneDayAgo, now),
          fetchGoogleFitData(accessToken, "com.google.step_count.delta", oneDayAgo, now),
          fetchGoogleFitData(accessToken, "com.google.calories.expended", oneDayAgo, now),
          fetchGoogleFitSleep(accessToken, oneDayAgo, now),
        ]);

        const latestHR = heartRateVals.length > 0 ? Math.round(heartRateVals[heartRateVals.length - 1]) : null;
        const totalSteps = Math.round(stepsVals.reduce((s, v) => s + v, 0));
        const totalCalories = Math.round(caloriesVals.reduce((s, v) => s + v, 0));

        // Delete old and insert new
        await supabase.from("wearable_health_data").delete().eq("user_id", userId).eq("source", "google_fit");
        const { error: insertError } = await supabase.from("wearable_health_data").insert({
          user_id: userId,
          heart_rate: latestHR,
          steps: totalSteps,
          sleep_hours: sleepHours,
          calories: totalCalories,
          distance: 0,
          source: "google_fit",
          recorded_at: new Date().toISOString(),
        });

        if (insertError) throw new Error(insertError.message);

        // Update last_synced
        await serviceSupabase
          .from("wearable_connections")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", conn.id);

        return new Response(JSON.stringify({ success: true, synced_at: new Date().toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-latest": {
        // Check if user has an active connection
        const { data: conn } = await supabase
          .from("wearable_connections")
          .select("provider, is_active, last_synced_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .single();

        const { data: latest, error: fetchError } = await supabase
          .from("wearable_health_data")
          .select("*")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .limit(24);

        if (fetchError) throw new Error(fetchError.message);

        if (!latest || latest.length === 0) {
          return new Response(JSON.stringify({ connected: !!conn, data: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Aggregate data
        const currentHR = latest[0].heart_rate;
        const totalSteps = latest.reduce((sum: number, r: any) => sum + (r.steps || 0), 0);
        const totalSleep = latest.reduce((sum: number, r: any) => sum + (r.sleep_hours || 0), 0);
        const totalCalories = latest.reduce((sum: number, r: any) => sum + (r.calories || 0), 0);
        const totalDistance = latest.reduce((sum: number, r: any) => sum + (r.distance || 0), 0);

        // Generate alerts
        const alerts: string[] = [];
        if (currentHR && currentHR > 110) alerts.push("high_heart_rate");
        if (totalSleep < 6) alerts.push("low_sleep");
        if (totalSteps < 4000) alerts.push("low_activity");

        return new Response(JSON.stringify({
          connected: true,
          source: latest[0].source || "unknown",
          data: {
            heart_rate: currentHR,
            steps: totalSteps,
            sleep_hours: Math.round(totalSleep * 10) / 10,
            calories: totalCalories,
            distance: Math.round(totalDistance * 100) / 100,
            last_synced: latest[0].recorded_at,
            alerts,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        // Deactivate connection
        await supabase
          .from("wearable_connections")
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("provider", "google_fit");
        // Delete wearable data
        await supabase.from("wearable_health_data").delete().eq("user_id", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync-demo": {
        // Generate demo data (fallback when Google Fit not configured)
        const now = new Date();
        const records = [];
        for (let i = 0; i < 24; i++) {
          const time = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hour = time.getHours();
          const isSleeping = hour >= 0 && hour < 7;
          const isActive = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
          records.push({
            user_id: userId,
            heart_rate: isSleeping ? 55 + Math.floor(Math.random() * 10) : isActive ? 90 + Math.floor(Math.random() * 30) : 68 + Math.floor(Math.random() * 15),
            steps: isSleeping ? 0 : isActive ? 800 + Math.floor(Math.random() * 400) : 100 + Math.floor(Math.random() * 200),
            sleep_hours: isSleeping ? 1.0 : 0,
            calories: isSleeping ? 30 + Math.floor(Math.random() * 10) : isActive ? 150 + Math.floor(Math.random() * 100) : 60 + Math.floor(Math.random() * 30),
            distance: isSleeping ? 0 : isActive ? 0.5 + Math.random() * 0.5 : 0.05 + Math.random() * 0.1,
            source: "demo_smartwatch",
            recorded_at: time.toISOString(),
          });
        }
        await supabase.from("wearable_health_data").delete().eq("user_id", userId).eq("source", "demo_smartwatch");
        const { error: insertError } = await supabase.from("wearable_health_data").insert(records);
        if (insertError) throw new Error(insertError.message);
        return new Response(JSON.stringify({ success: true, records_synced: records.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ai-insights": {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) throw new Error("AI not configured");
        const lang = data?.language || "English";
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are an AI health coach analyzing wearable device data. Generate 3-4 personalized insights based on the health metrics. IMPORTANT: Respond in ${lang} language (except JSON keys).\n\nReturn ONLY valid JSON:\n{\n  "insights": [\n    { "type": "warning|tip|achievement", "title": "short title", "description": "detailed insight", "icon": "heart|steps|sleep|calories" }\n  ]\n}`,
              },
              { role: "user", content: JSON.stringify(data?.metrics) },
            ],
          }),
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error("Rate limited. Try again later.");
          if (response.status === 402) throw new Error("AI usage limit reached.");
          throw new Error("AI gateway error");
        }
        const aiResult = await response.json();
        const text = aiResult.choices?.[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: [] };
        return new Response(JSON.stringify(insights), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("Wearable sync error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshGoogleToken(refreshToken: string | null): Promise<any> {
  if (!refreshToken) return { error: "No refresh token" };
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok) return { error: data.error || "refresh_failed" };
  return data;
}

async function fetchGoogleFitData(accessToken: string, dataType: string, startTime: number, endTime: number): Promise<number[]> {
  const response = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aggregateBy: [{ dataTypeName: dataType }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    }),
  });
  if (!response.ok) {
    console.error(`Google Fit error for ${dataType}:`, await response.text());
    return [];
  }
  const data = await response.json();
  const points: number[] = [];
  for (const bucket of data.bucket || []) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        for (const val of point.value || []) {
          if (val.fpVal !== undefined) points.push(val.fpVal);
          if (val.intVal !== undefined) points.push(val.intVal);
        }
      }
    }
  }
  return points;
}

async function fetchGoogleFitSleep(accessToken: string, startTime: number, endTime: number): Promise<number> {
  try {
    const response = await fetch("https://www.googleapis.com/fitness/v1/users/me/sessions?activityType=72", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return 0;
    const data = await response.json();
    let totalMs = 0;
    for (const session of data.session || []) {
      const start = parseInt(session.startTimeMillis);
      const end = parseInt(session.endTimeMillis);
      if (end > startTime && start < endTime) {
        totalMs += Math.min(end, endTime) - Math.max(start, startTime);
      }
    }
    return Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;
  } catch {
    return 0;
  }
}
