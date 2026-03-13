import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // contains user_id + redirect_url
  const error = url.searchParams.get("error");

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_FIT_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_FIT_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (error || !code || !state) {
    const redirectUrl = state ? JSON.parse(atob(state)).redirect : "/dashboard";
    return Response.redirect(`${redirectUrl}?gfit_error=${error || "missing_code"}`, 302);
  }

  try {
    const { userId, redirect } = JSON.parse(atob(state));

    // Exchange authorization code for tokens
    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-fit-callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) {
      console.error("Token exchange failed:", tokens);
      return Response.redirect(`${redirect}?gfit_error=token_exchange_failed`, 302);
    }

    // Store tokens using service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("wearable_connections")
      .upsert({
        user_id: userId,
        provider: "google_fit",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt,
        scopes: tokens.scope || "",
        is_active: true,
        connected_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return Response.redirect(`${redirect}?gfit_error=storage_failed`, 302);
    }

    // Do an initial sync of Google Fit data
    await syncGoogleFitData(supabase, userId, tokens.access_token);

    return Response.redirect(`${redirect}?gfit_connected=true`, 302);
  } catch (e) {
    console.error("Callback error:", e);
    return Response.redirect(`/dashboard?gfit_error=callback_failed`, 302);
  }
});

async function syncGoogleFitData(supabase: any, userId: string, accessToken: string) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  try {
    // Fetch heart rate
    const heartRate = await fetchGoogleFitData(accessToken, "com.google.heart_rate.bpm", oneDayAgo, now);
    // Fetch steps
    const steps = await fetchGoogleFitData(accessToken, "com.google.step_count.delta", oneDayAgo, now);
    // Fetch calories
    const calories = await fetchGoogleFitData(accessToken, "com.google.calories.expended", oneDayAgo, now);
    // Fetch sleep
    const sleep = await fetchGoogleFitSleep(accessToken, oneDayAgo, now);

    // Aggregate values
    const latestHR = getLatestValue(heartRate);
    const totalSteps = sumValues(steps);
    const totalCalories = Math.round(sumValues(calories));
    const totalSleepHours = sleep;

    // Delete old google_fit data for this user
    await supabase.from("wearable_health_data").delete().eq("user_id", userId).eq("source", "google_fit");

    // Insert aggregated record
    await supabase.from("wearable_health_data").insert({
      user_id: userId,
      heart_rate: latestHR || null,
      steps: totalSteps || 0,
      sleep_hours: totalSleepHours || 0,
      calories: totalCalories || 0,
      distance: 0,
      source: "google_fit",
      recorded_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Google Fit sync error:", e);
  }
}

async function fetchGoogleFitData(accessToken: string, dataType: string, startTime: number, endTime: number) {
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
    console.error(`Google Fit API error for ${dataType}:`, await response.text());
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

function getLatestValue(values: number[]): number | null {
  return values.length > 0 ? Math.round(values[values.length - 1]) : null;
}

function sumValues(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}
