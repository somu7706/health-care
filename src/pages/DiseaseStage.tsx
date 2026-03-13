import { HeartPulse, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

export default function DiseaseStage() {
  const { user } = useAuth();
  const [predicting, setPredicting] = useState(false);
  const { t } = useI18n();

  const { data: stages, isLoading, refetch } = useQuery({
    queryKey: ["disease-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("disease_stages").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: medicines } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("*");
      return data || [];
    },
  });

  const predictStage = async (disease: string) => {
    if (!user) return;
    setPredicting(true);
    try {
      const { data: symptoms } = await supabase.from("symptoms").select("symptom").eq("user_id", user.id);
      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "predict-disease-stage",
          data: {
            disease,
            medicines: medicines?.map(m => m.name) || [],
            symptoms: symptoms?.map(s => s.symptom) || [],
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Prediction failed");

      await supabase.from("disease_stages").update({
        stage: data.stage,
        confidence: data.confidence,
      }).eq("user_id", user.id).eq("disease", disease);

      refetch();
      toast.success(t("diseaseStage.predicted"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("diseaseStage.title")}</h1>
        <p className="text-muted-foreground">{t("diseaseStage.description")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : stages && stages.length > 0 ? (
        <div className="space-y-4">
          {stages.map(s => (
            <div key={s.id} className="border border-border rounded-xl p-6 bg-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{s.disease}</h3>
                {s.stage !== t("diseaseStage.pendingAnalysis") && s.stage !== "Pending analysis" && (
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">{s.stage}</span>
                )}
              </div>
              {s.confidence ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${s.confidence}%` }} />
                  </div>
                  <span className="text-sm text-muted-foreground">{s.confidence}%</span>
                </div>
              ) : (
                <Button size="sm" onClick={() => predictStage(s.disease)} disabled={predicting}>
                  {predicting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HeartPulse className="h-4 w-4 mr-2" />}
                  {t("diseaseStage.predictStage")}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-xl p-12 bg-card flex flex-col items-center text-muted-foreground">
          <HeartPulse className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">{t("diseaseStage.noData")}</p>
          <p className="text-sm mt-1">{t("diseaseStage.noDataDesc")}</p>
        </div>
      )}
    </div>
  );
}
