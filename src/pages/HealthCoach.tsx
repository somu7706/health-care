import { useState, useEffect } from "react";
import { Lightbulb, RefreshCw, Loader2, Heart, Droplets, Moon, Footprints, Apple, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, localeToLanguage } from "@/hooks/useI18n";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type Tip = {
  category: string;
  tip: string;
  icon: string;
  priority: string;
};

const iconMap: Record<string, React.ElementType> = {
  hydration: Droplets,
  sleep: Moon,
  activity: Footprints,
  nutrition: Apple,
  medication: Pill,
  heart: Heart,
};

export default function HealthCoach() {
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t, locale } = useI18n();

  const { data: medicines } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("name").eq("user_id", user!.id);
      return data?.map(m => m.name) || [];
    },
    enabled: !!user,
  });

  const { data: diseases } = useQuery({
    queryKey: ["diseases-coach"],
    queryFn: async () => {
      const { data } = await supabase.from("disease_stages").select("disease").eq("user_id", user!.id);
      return data?.map(d => d.disease) || [];
    },
    enabled: !!user,
  });

  const generateTips = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "health-coach",
          data: {
            medicines: medicines || [],
            diseases: diseases || [],
            language: localeToLanguage[locale],
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed");
      setTips(data.tips || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) generateTips();
  }, [user]);

  const priorityColors: Record<string, string> = {
    high: "border-l-red-500",
    medium: "border-l-amber-500",
    low: "border-l-emerald-500",
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Lightbulb className="h-8 w-8 text-amber-500" />
            {t("coach.title")}
          </h1>
          <p className="text-muted-foreground">{t("coach.description")}</p>
        </div>
        <Button variant="outline" onClick={generateTips} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t("coach.refresh")}
        </Button>
      </div>

      {loading && !tips ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("coach.generating")}</p>
        </div>
      ) : tips && tips.length > 0 ? (
        <div className="space-y-3">
          {tips.map((tip, i) => {
            const Icon = iconMap[tip.icon] || Lightbulb;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className={`border border-border border-l-4 ${priorityColors[tip.priority] || priorityColors.low} rounded-xl p-4 bg-card flex items-start gap-4`}>
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{tip.category}</p>
                  <p className="text-sm">{tip.tip}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t("coach.noTips")}</p>
        </div>
      )}
    </div>
  );
}
