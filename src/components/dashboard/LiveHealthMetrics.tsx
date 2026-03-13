import { useState, useEffect } from "react";
import { Heart, Footprints, Moon, Flame, AlertTriangle, Loader2, Lightbulb, TrendingUp, Trophy, Wifi, WifiOff, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

type WearableData = {
  heart_rate: number;
  steps: number;
  sleep_hours: number;
  calories: number;
  distance: number;
  last_synced: string;
  alerts: string[];
};

type Insight = {
  type: "warning" | "tip" | "achievement";
  title: string;
  description: string;
  icon: string;
};

export default function LiveHealthMetrics() {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Google Fit OAuth callback params
  useEffect(() => {
    if (searchParams.get("gfit_connected") === "true") {
      toast.success(t("wearable.connected"));
      queryClient.invalidateQueries({ queryKey: ["wearable-data"] });
      searchParams.delete("gfit_connected");
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get("gfit_error")) {
      toast.error(`Google Fit connection failed: ${searchParams.get("gfit_error")}`);
      searchParams.delete("gfit_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const { data: wearableResult, isLoading } = useQuery({
    queryKey: ["wearable-data"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("wearable-sync", {
        body: { action: "get-latest", data: {} },
      });
      if (error) throw error;
      return data as { connected: boolean; source?: string; data: WearableData | null };
    },
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });

  const connected = wearableResult?.connected;
  const metrics = wearableResult?.data;
  const source = wearableResult?.source || "unknown";

  const handleConnectGoogleFit = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wearable-sync", {
        body: { action: "get-connect-url", data: { redirect: window.location.origin + "/dashboard" } },
      });
      if (error) throw error;
      if (data?.not_configured) {
        // Fall back to demo mode
        toast.error("Google Fit API not configured. Using demo mode.");
        await handleConnectDemo();
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectDemo = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("wearable-sync", {
        body: { action: "sync-demo", data: {} },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["wearable-data"] });
      toast.success(t("wearable.connected"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const syncAction = source === "google_fit" ? "sync-googlefit" : "sync-demo";
      const { data, error } = await supabase.functions.invoke("wearable-sync", {
        body: { action: syncAction, data: {} },
      });
      if (error) throw error;
      if (data?.reconnect) {
        toast.error("Google Fit session expired. Please reconnect.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["wearable-data"] });
      toast.success("Data synced!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke("wearable-sync", {
        body: { action: "disconnect", data: {} },
      });
      await queryClient.invalidateQueries({ queryKey: ["wearable-data"] });
      setInsights([]);
      toast.success(t("wearable.disconnected"));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchInsights = async () => {
    if (!metrics) return;
    setLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("wearable-sync", {
        body: { action: "ai-insights", data: { metrics, language } },
      });
      if (error) throw error;
      setInsights(data?.insights || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingInsights(false);
    }
  };

  const getInsightIcon = (type: string) => {
    if (type === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (type === "achievement") return <Trophy className="h-4 w-4 text-green-500" />;
    return <Lightbulb className="h-4 w-4 text-blue-500" />;
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-xl p-6 bg-card flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!connected || !metrics) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="border border-dashed border-primary/30 rounded-xl p-8 bg-primary/5 text-center">
        <Watch className="h-12 w-12 mx-auto mb-4 text-primary/40" />
        <h3 className="font-semibold text-lg">{t("wearable.notConnected")}</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("wearable.connectDesc")}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleConnectGoogleFit} disabled={connecting || syncing} className="gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
            {t("wearable.connectSmartwatch")}
          </Button>
          <Button variant="outline" onClick={handleConnectDemo} disabled={syncing || connecting} className="gap-2 text-xs">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Demo Mode
          </Button>
        </div>
      </motion.div>
    );
  }

  const hrWarning = metrics.heart_rate > 110;
  const sleepWarning = metrics.sleep_hours < 6;
  const stepsLow = metrics.steps < 4000;
  const stepsGoal = 10000;
  const stepsPercent = Math.min((metrics.steps / stepsGoal) * 100, 100);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("wearable.liveMetrics")}</h2>
          {source === "google_fit" && (
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">Google Fit</span>
          )}
          {source === "demo_smartwatch" && (
            <span className="text-[10px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchInsights} disabled={loadingInsights} className="gap-1 text-xs">
            {loadingInsights ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
            {t("wearable.aiInsights")}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSync} disabled={syncing} className="gap-1 text-xs">
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            {t("wearable.sync")}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDisconnect} className="text-xs text-destructive">
            <WifiOff className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {metrics.alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2">
            {metrics.alerts.includes("high_heart_rate") && (
              <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> {t("wearable.alerts.highHR")}
              </div>
            )}
            {metrics.alerts.includes("low_sleep") && (
              <div className="flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-1.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> {t("wearable.alerts.lowSleep")}
              </div>
            )}
            {metrics.alerts.includes("low_activity") && (
              <div className="flex items-center gap-2 text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> {t("wearable.alerts.lowActivity")}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Heart Rate */}
        <div className={`p-4 rounded-xl border ${hrWarning ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"} transition-all`}>
          <div className="flex items-center gap-2 mb-2">
            <Heart className={`h-4 w-4 ${hrWarning ? "text-red-500 animate-pulse" : "text-red-400"}`} />
            <span className="text-xs font-medium text-muted-foreground">{t("wearable.heartRate")}</span>
          </div>
          <p className={`text-2xl font-bold ${hrWarning ? "text-red-500" : ""}`}>{metrics.heart_rate}</p>
          <p className="text-xs text-muted-foreground">bpm</p>
          {hrWarning && <p className="text-[10px] text-red-500 mt-1">{t("wearable.hrWarning")}</p>}
        </div>

        {/* Steps */}
        <div className={`p-4 rounded-xl border ${stepsLow ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Footprints className={`h-4 w-4 ${stepsLow ? "text-orange-500" : "text-green-500"}`} />
            <span className="text-xs font-medium text-muted-foreground">{t("wearable.steps")}</span>
          </div>
          <p className="text-2xl font-bold">{metrics.steps.toLocaleString()}</p>
          <div className="mt-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${stepsPercent}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t("wearable.goal")}: {stepsGoal.toLocaleString()}</p>
          </div>
          {stepsLow && <p className="text-[10px] text-orange-500 mt-1">{t("wearable.alerts.lowActivity")}</p>}
        </div>

        {/* Sleep */}
        <div className={`p-4 rounded-xl border ${sleepWarning ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-card"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Moon className={`h-4 w-4 ${sleepWarning ? "text-yellow-500" : "text-indigo-400"}`} />
            <span className="text-xs font-medium text-muted-foreground">{t("wearable.sleep")}</span>
          </div>
          <p className={`text-2xl font-bold ${sleepWarning ? "text-yellow-600 dark:text-yellow-400" : ""}`}>{metrics.sleep_hours}</p>
          <p className="text-xs text-muted-foreground">{t("wearable.hours")}</p>
          {sleepWarning && <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1">{t("wearable.sleepWarning")}</p>}
        </div>

        {/* Calories */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">{t("wearable.calories")}</span>
          </div>
          <p className="text-2xl font-bold">{metrics.calories.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">kcal</p>
        </div>
      </div>

      {/* AI Insights */}
      <AnimatePresence>
        {insights.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-xl p-4 bg-card space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" /> {t("wearable.aiInsights")}
            </h3>
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background">
                {getInsightIcon(insight.type)}
                <div>
                  <p className="text-xs font-medium">{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
