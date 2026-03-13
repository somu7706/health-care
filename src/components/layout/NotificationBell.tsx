import { useState, useEffect } from "react";
import { Bell, Check, X, Droplets, Pill, Moon, Footprints, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { motion, AnimatePresence } from "framer-motion";

const typeIcons: Record<string, typeof Bell> = {
  water: Droplets,
  medicine: Pill,
  sleep: Moon,
  activity: Footprints,
  general: Bell,
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ["notification-count"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reminders", {
        body: { action: "get-notification-count", data: {} },
      });
      if (error) throw error;
      return data?.count || 0;
    },
    refetchInterval: 30_000,
  });

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["notification-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reminders", {
        body: { action: "get-reminders", data: {} },
      });
      if (error) throw error;
      return data?.reminders || [];
    },
    enabled: open,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notification-count"] });
        if (open) queryClient.invalidateQueries({ queryKey: ["notification-reminders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, open, queryClient]);

  const count = countData || 0;

  const handleAction = async (action: string, id: string) => {
    await supabase.functions.invoke("reminders", {
      body: { action, data: { id } },
    });
    queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    queryClient.invalidateQueries({ queryKey: ["notification-reminders"] });
    queryClient.invalidateQueries({ queryKey: ["reminders"] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Notifications">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">{t("reminders.notifications")}</h3>
          <p className="text-xs text-muted-foreground">{t("reminders.activeReminders")}</p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("reminders.noReminders")}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {reminders.slice(0, 10).map((r: any) => {
                const Icon = typeIcons[r.type] || Bell;
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/30 transition-colors group"
                  >
                    <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{r.message}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{r.type} · {r.source === "auto" || r.source === "auto_wearable" ? t("reminders.auto") : t("reminders.manual")}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => handleAction("complete-reminder", r.id)} className="p-1 rounded hover:bg-accent">
                        <Check className="h-3.5 w-3.5 text-success" />
                      </button>
                      <button onClick={() => handleAction("dismiss-reminder", r.id)} className="p-1 rounded hover:bg-accent">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
