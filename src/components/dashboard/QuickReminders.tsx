import { useState, useEffect, useCallback } from "react";
import { Bell, Droplets, Pill, Moon, Footprints, Check, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

type Reminder = {
  id: string;
  type: string;
  message: string;
  scheduled_time: string;
  status: string;
  source: string;
  created_at: string;
};

const typeIcons: Record<string, typeof Droplets> = {
  water: Droplets,
  medicine: Pill,
  sleep: Moon,
  activity: Footprints,
  general: Bell,
};

const typeColors: Record<string, string> = {
  water: "text-info",
  medicine: "text-primary",
  sleep: "text-accent-foreground",
  activity: "text-success",
  general: "text-muted-foreground",
};

export default function QuickReminders() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reminders", {
        body: { action: "get-reminders", data: {} },
      });
      if (error) throw error;
      return (data?.reminders || []) as Reminder[];
    },
    refetchInterval: 60_000,
  });

  // Auto-generate reminders on mount and every 5 minutes
  const generateReminders = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    try {
      await supabase.functions.invoke("reminders", {
        body: { action: "generate-auto-reminders", data: {} },
      });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  }, [user, queryClient]);

  useEffect(() => {
    generateReminders();
    const interval = setInterval(generateReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [generateReminders]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("reminders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["reminders"] });
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Browser notifications
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!reminders.length || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const due = reminders.filter(r => new Date(r.scheduled_time) <= now && r.status === "pending");
    // Show browser notification for the latest one
    if (due.length > 0) {
      const latest = due[0];
      const notifKey = `notified_${latest.id}`;
      if (!sessionStorage.getItem(notifKey)) {
        new Notification("VitalWave Reminder", { body: latest.message, icon: "/logo.webp" });
        sessionStorage.setItem(notifKey, "true");
      }
    }
  }, [reminders]);

  const completeReminder = async (id: string) => {
    try {
      await supabase.functions.invoke("reminders", {
        body: { action: "complete-reminder", data: { id } },
      });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      toast.success(t("reminders.completed"));
    } catch {
      toast.error("Failed to complete reminder");
    }
  };

  const dismissReminder = async (id: string) => {
    try {
      await supabase.functions.invoke("reminders", {
        body: { action: "dismiss-reminder", data: { id } },
      });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    } catch {
      toast.error("Failed to dismiss reminder");
    }
  };

  const addManualReminder = async (type: string, message: string) => {
    if (!user) return;
    try {
      await supabase.functions.invoke("reminders", {
        body: {
          action: "create-reminder",
          data: { type, message, source: "manual" },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      toast.success(t("reminders.added"));
    } catch {
      toast.error("Failed to add reminder");
    }
  };

  const quickAddOptions = [
    { type: "water", message: t("dashboard.drinkWater"), icon: Droplets, color: "text-info" },
    { type: "sleep", message: t("dashboard.sleepReminder"), icon: Moon, color: "text-accent-foreground" },
    { type: "activity", message: t("dashboard.walkReminder"), icon: Footprints, color: "text-success" },
  ];

  const pendingReminders = reminders.filter(r => r.status === "pending");

  return (
    <div className="border border-border rounded-xl p-6 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("dashboard.quickReminders")}</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={generateReminders} disabled={generating} className="text-xs gap-1">
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active reminders */}
          <AnimatePresence mode="popLayout">
            {pendingReminders.length > 0 ? (
              <div className="space-y-2 mb-4">
                {pendingReminders.slice(0, 5).map((r) => {
                  const Icon = typeIcons[r.type] || Bell;
                  const color = typeColors[r.type] || "text-muted-foreground";
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, height: 0 }}
                      layout
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background text-sm group"
                    >
                      <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
                      <span className="flex-1 truncate">{r.message}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => completeReminder(r.id)} className="p-1 rounded hover:bg-accent" title="Complete">
                          <Check className="h-3.5 w-3.5 text-success" />
                        </button>
                        <button onClick={() => dismissReminder(r.id)} className="p-1 rounded hover:bg-accent" title="Dismiss">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4 py-2">{t("reminders.noReminders")}</p>
            )}
          </AnimatePresence>

          {/* Quick add buttons */}
          <div className="space-y-2">
            {quickAddOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => addManualReminder(opt.type, opt.message)}
                className="flex items-center gap-2 w-full p-2 rounded-lg border border-dashed border-border hover:bg-accent/30 transition-colors text-sm text-muted-foreground"
              >
                <opt.icon className={`h-3.5 w-3.5 ${opt.color} shrink-0`} />
                <span className="truncate">+ {opt.message}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
