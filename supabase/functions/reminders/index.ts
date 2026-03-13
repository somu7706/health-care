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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, data } = await req.json();

    switch (action) {
      case "get-reminders": {
        const { data: reminders, error } = await supabase
          .from("reminders")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("scheduled_time", { ascending: true })
          .limit(50);

        if (error) throw new Error(error.message);
        return json({ reminders: reminders || [] });
      }

      case "create-reminder": {
        const { type, message, scheduled_time, source } = data;
        const { error } = await supabase.from("reminders").insert({
          user_id: userId,
          type: type || "general",
          message,
          scheduled_time: scheduled_time || new Date().toISOString(),
          status: "pending",
          source: source || "manual",
        });
        if (error) throw new Error(error.message);
        return json({ success: true });
      }

      case "complete-reminder": {
        const { id } = data;
        const { error } = await supabase
          .from("reminders")
          .update({ status: "completed" })
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return json({ success: true });
      }

      case "dismiss-reminder": {
        const { id } = data;
        const { error } = await supabase
          .from("reminders")
          .update({ status: "dismissed" })
          .eq("id", id)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return json({ success: true });
      }

      case "generate-auto-reminders": {
        // Generate automatic reminders based on user data
        const now = new Date();
        const remindersToCreate: any[] = [];

        // 1. Hydration reminders - every 2 hours from 8am to 10pm
        const currentHour = now.getHours();
        if (currentHour >= 8 && currentHour <= 22) {
          // Check if there's already a pending water reminder in the last 2 hours
          const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          const { data: existingWater } = await supabase
            .from("reminders")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "water")
            .eq("status", "pending")
            .gte("created_at", twoHoursAgo.toISOString())
            .limit(1);

          if (!existingWater || existingWater.length === 0) {
            remindersToCreate.push({
              user_id: userId,
              type: "water",
              message: "Drink a glass of water",
              scheduled_time: now.toISOString(),
              source: "auto",
              status: "pending",
            });
          }
        }

        // 2. Medicine reminders from user's medicines
        const { data: medicines } = await supabase
          .from("medicines")
          .select("name, frequency, dosage")
          .eq("user_id", userId);

        if (medicines && medicines.length > 0) {
          for (const med of medicines) {
            const freq = (med.frequency || "").toLowerCase();
            const scheduleTimes: number[] = [];

            if (freq.includes("3") || freq.includes("thrice") || freq.includes("three")) {
              scheduleTimes.push(8, 14, 20);
            } else if (freq.includes("2") || freq.includes("twice") || freq.includes("two")) {
              scheduleTimes.push(8, 20);
            } else {
              scheduleTimes.push(8);
            }

            for (const hour of scheduleTimes) {
              if (currentHour === hour || (currentHour === hour + 1 && now.getMinutes() < 15)) {
                const schedTime = new Date(now);
                schedTime.setHours(hour, 0, 0, 0);

                // Check if already exists
                const { data: existingMed } = await supabase
                  .from("reminders")
                  .select("id")
                  .eq("user_id", userId)
                  .eq("type", "medicine")
                  .eq("status", "pending")
                  .ilike("message", `%${med.name}%`)
                  .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
                  .limit(1);

                if (!existingMed || existingMed.length === 0) {
                  remindersToCreate.push({
                    user_id: userId,
                    type: "medicine",
                    message: `Take ${med.name}${med.dosage ? ` (${med.dosage})` : ""}`,
                    scheduled_time: schedTime.toISOString(),
                    source: "auto",
                    status: "pending",
                  });
                }
              }
            }
          }
        }

        // 3. Sleep & activity reminders from wearable data
        const { data: wearableData } = await supabase
          .from("wearable_health_data")
          .select("sleep_hours, steps")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false })
          .limit(24);

        if (wearableData && wearableData.length > 0) {
          const totalSleep = wearableData.reduce((s, r) => s + (Number(r.sleep_hours) || 0), 0);
          const totalSteps = wearableData.reduce((s, r) => s + (r.steps || 0), 0);

          // Check existing sleep/activity reminders today
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          if (totalSleep < 6 && currentHour >= 20) {
            const { data: existingSleep } = await supabase
              .from("reminders")
              .select("id")
              .eq("user_id", userId)
              .eq("type", "sleep")
              .eq("status", "pending")
              .gte("created_at", todayStart.toISOString())
              .limit(1);

            if (!existingSleep || existingSleep.length === 0) {
              remindersToCreate.push({
                user_id: userId,
                type: "sleep",
                message: "Time to prepare for bed — you need more sleep tonight",
                scheduled_time: now.toISOString(),
                source: "auto_wearable",
                status: "pending",
              });
            }
          }

          if (totalSteps < 4000 && currentHour >= 10 && currentHour <= 18) {
            const { data: existingActivity } = await supabase
              .from("reminders")
              .select("id")
              .eq("user_id", userId)
              .eq("type", "activity")
              .eq("status", "pending")
              .gte("created_at", todayStart.toISOString())
              .limit(1);

            if (!existingActivity || existingActivity.length === 0) {
              remindersToCreate.push({
                user_id: userId,
                type: "activity",
                message: "Take a 10-minute walk — your step count is low today",
                scheduled_time: now.toISOString(),
                source: "auto_wearable",
                status: "pending",
              });
            }
          }
        }

        // Insert all new reminders
        if (remindersToCreate.length > 0) {
          const { error } = await supabase.from("reminders").insert(remindersToCreate);
          if (error) throw new Error(error.message);
        }

        return json({ success: true, generated: remindersToCreate.length });
      }

      case "get-notification-count": {
        const { count, error } = await supabase
          .from("reminders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pending")
          .lte("scheduled_time", new Date().toISOString());

        if (error) throw new Error(error.message);
        return json({ count: count || 0 });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("Reminders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: any) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      "Content-Type": "application/json",
    },
  });
}
