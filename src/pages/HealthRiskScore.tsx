import { useState, useEffect } from "react";
import { Activity, TrendingUp, Heart, Moon, Footprints, Pill, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, localeToLanguage } from "@/hooks/useI18n";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type RiskData = {
  overall_score: number;
  risk_level: string;
  factors: { name: string; score: number; status: string; detail: string }[];
  recommendations: string[];
  future_risks: { condition: string; probability: string; timeframe: string }[];
};

function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size / 1.5 }}>
      <svg width={size} height={size / 1.5} viewBox={`0 0 ${size} ${size / 1.5}`}>
        <path
          d={`M 10 ${size / 1.5 - 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 1.5 - 10}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <path
          d={`M 10 ${size / 1.5 - 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 1.5 - 10}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute bottom-0 text-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <p className="text-xs text-muted-foreground">/100</p>
      </div>
    </div>
  );
}

export default function HealthRiskScore() {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { t, locale } = useI18n();

  const { data: medicines } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("name, dosage").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: symptoms } = useQuery({
    queryKey: ["user-symptoms"],
    queryFn: async () => {
      const { data } = await supabase.from("symptoms").select("symptom").eq("user_id", user!.id);
      return data?.map(s => s.symptom) || [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const calculateRisk = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "health-risk-score",
          data: {
            age: profile?.age || 30,
            medicines: medicines?.map(m => m.name) || [],
            symptoms: symptoms || [],
            language: localeToLanguage[locale],
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed");
      setRiskData(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && medicines && symptoms) calculateRisk();
  }, [user, medicines, symptoms]);

  const statusColors: Record<string, string> = {
    good: "text-emerald-500 bg-emerald-500/10",
    moderate: "text-amber-500 bg-amber-500/10",
    poor: "text-red-500 bg-red-500/10",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            {t("healthRisk.title")}
          </h1>
          <p className="text-muted-foreground">{t("healthRisk.description")}</p>
        </div>
        <Button variant="outline" onClick={calculateRisk} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t("healthRisk.recalculate")}
        </Button>
      </div>

      {loading && !riskData ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("healthRisk.calculating")}</p>
        </div>
      ) : riskData ? (
        <>
          {/* Score Gauge */}
          <div className="border border-border rounded-xl p-6 bg-card flex flex-col items-center">
            <ScoreGauge score={riskData.overall_score} />
            <p className={`font-bold text-lg mt-2 ${
              riskData.risk_level === "Low Risk" ? "text-emerald-500" :
              riskData.risk_level === "High Risk" ? "text-red-500" : "text-amber-500"
            }`}>{riskData.risk_level}</p>
          </div>

          {/* Risk Factors */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <h3 className="font-semibold mb-4">{t("healthRisk.factors")}</h3>
            <div className="space-y-3">
              {riskData.factors?.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <div className="w-10 text-center">
                    <span className={`text-lg font-bold ${f.score >= 70 ? "text-emerald-500" : f.score >= 40 ? "text-amber-500" : "text-red-500"}`}>
                      {f.score}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[f.status] || statusColors.moderate}`}>
                    {f.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Future Risks */}
          {riskData.future_risks && riskData.future_risks.length > 0 && (
            <div className="border border-amber-500/30 rounded-xl p-5 bg-amber-500/5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                {t("healthRisk.futureRisks")}
              </h3>
              <div className="space-y-2">
                {riskData.future_risks.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                    <div>
                      <p className="font-medium text-sm">{r.condition}</p>
                      <p className="text-xs text-muted-foreground">{r.timeframe}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      r.probability === "high" ? "bg-red-500/10 text-red-500" :
                      r.probability === "moderate" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                    }`}>{r.probability}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <h3 className="font-semibold mb-3">{t("healthRisk.recommendations")}</h3>
            <ul className="space-y-2">
              {riskData.recommendations?.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning inline mr-2" />
            {t("common.disclaimer")}
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t("healthRisk.noData")}</p>
        </div>
      )}
    </div>
  );
}
