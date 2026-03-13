import { ClipboardList, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

export default function CarePlan() {
  const { user, profile } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { t } = useI18n();

  const { data: carePlans, isLoading, refetch } = useQuery({
    queryKey: ["care-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("care_plans").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: diseases } = useQuery({
    queryKey: ["disease-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("disease_stages").select("disease").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const generatePlan = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data: meds } = await supabase.from("medicines").select("*").eq("user_id", user.id);
      const disease = diseases?.[0]?.disease || "General health";

      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "generate-care-plan",
          data: { disease, medicines: meds?.map(m => m.name) || [], age: profile?.age || 30 },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Generation failed");

      await supabase.from("care_plans").insert({ user_id: user.id, plan: data, disease });
      refetch();
      toast.success(t("carePlan.generated"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const renderPlan = (plan: any) => {
    if (!plan || typeof plan !== "object") return <p className="text-sm text-muted-foreground">No plan data</p>;
    const sections = [
      { key: "diet", label: t("carePlan.diet") },
      { key: "exercise", label: t("carePlan.exercise") },
      { key: "sleep", label: t("carePlan.sleep") },
      { key: "medication_schedule", label: t("carePlan.medSchedule") },
      { key: "followups", label: t("carePlan.followups") },
    ];
    return (
      <div className="space-y-4">
        {sections.map(s => {
          const items = plan[s.key];
          if (!items || !Array.isArray(items) || items.length === 0) return null;
          return (
            <div key={s.key}>
              <h4 className="font-semibold mb-2">{s.label}</h4>
              <ul className="space-y-1">
                {items.map((item: string, i: number) => <li key={i} className="text-sm text-muted-foreground">• {item}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("carePlan.title")}</h1>
          <p className="text-muted-foreground">{t("carePlan.description")}</p>
        </div>
        {diseases && diseases.length > 0 && (
          <Button onClick={generatePlan} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
            {t("carePlan.generatePlan")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : carePlans && carePlans.length > 0 ? (
        <div className="space-y-4">
          {carePlans.map(cp => (
            <div key={cp.id} className="border border-border rounded-xl p-6 bg-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{cp.disease || "General"}</h3>
                <span className="text-xs text-muted-foreground">{cp.created_at ? new Date(cp.created_at).toLocaleDateString() : ""}</span>
              </div>
              {renderPlan(cp.plan)}
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-xl p-12 bg-card flex flex-col items-center text-muted-foreground">
          <ClipboardList className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">{t("carePlan.noPlan")}</p>
          <p className="text-sm mt-1">{t("carePlan.noPlanDesc")}</p>
        </div>
      )}
    </div>
  );
}
