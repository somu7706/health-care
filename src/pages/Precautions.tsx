import { AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

export default function Precautions() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { t, locale } = useI18n();
  const langMap: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi" };

  const { data: precautions, isLoading, refetch } = useQuery({
    queryKey: ["precautions"],
    queryFn: async () => {
      const { data } = await supabase.from("precautions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const generatePrecautions = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: diseases } = await supabase.from("disease_stages").select("disease").eq("user_id", user.id);
      const { data: meds } = await supabase.from("medicines").select("name").eq("user_id", user.id);

      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "generate-precautions",
          data: {
            diseases: diseases?.map(d => d.disease) || [],
            medicines: meds?.map(m => m.name) || [],
            language: langMap[locale],
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Generation failed");

      const items = Array.isArray(data) ? data : [];
      const disease = diseases?.[0]?.disease || "General";
      
      // Handle both structured and flat format
      const inserts = items.map((p: any) => ({
        user_id: user.id,
        precaution: typeof p === "string" ? p : `[${p.severity || "medium"}] ${p.category ? p.category + ": " : ""}${p.precaution}`,
        disease,
      }));
      if (inserts.length > 0) await supabase.from("precautions").insert(inserts);
      refetch();
      toast.success(t("precautions.generated"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const getSeverityColor = (text: string) => {
    if (text.includes("[high]")) return "text-destructive";
    if (text.includes("[medium]")) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("precautions.title")}</h1>
          <p className="text-muted-foreground">{t("precautions.description")}</p>
        </div>
        <Button onClick={generatePrecautions} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
          {t("common.generate")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : precautions && precautions.length > 0 ? (
        <div className="border border-border rounded-xl p-6 bg-card space-y-3">
          {precautions.map(p => (
            <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background">
              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${
                p.precaution.includes("[high]") ? "text-destructive" : "text-warning"
              }`} />
              <div>
                <p className={`text-sm ${getSeverityColor(p.precaution)}`}>
                  {p.precaution.replace(/\[(high|medium|low)\]\s*/g, "")}
                </p>
                {p.disease && <p className="text-xs text-muted-foreground mt-1">{t("common.for")}: {p.disease}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-xl p-12 bg-card flex flex-col items-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">{t("precautions.noPrecautions")}</p>
          <p className="text-sm mt-1">{t("precautions.noPrecautionsDesc")}</p>
        </div>
      )}
    </div>
  );
}
