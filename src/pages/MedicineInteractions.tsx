import { useState } from "react";
import { Pill, AlertTriangle, CheckCircle, Loader2, Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, localeToLanguage } from "@/hooks/useI18n";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type Interaction = {
  medicine_a: string;
  medicine_b: string;
  severity: "safe" | "moderate" | "dangerous";
  description: string;
  recommendation: string;
};

export default function MedicineInteractions() {
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [customMed, setCustomMed] = useState("");
  const [customMeds, setCustomMeds] = useState<string[]>([]);
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

  const addCustomMed = () => {
    if (customMed.trim() && !customMeds.includes(customMed.trim())) {
      setCustomMeds(prev => [...prev, customMed.trim()]);
      setCustomMed("");
    }
  };

  const checkInteractions = async () => {
    const allMeds = [...(medicines?.map(m => m.name) || []), ...customMeds];
    if (allMeds.length < 2) {
      toast.error(t("interactions.needTwo"));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "check-interactions",
          data: { medicines: allMeds, language: localeToLanguage[locale] },
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed");
      setInteractions(data.interactions || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const severityConfig = {
    safe: { color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle, label: t("interactions.safe") },
    moderate: { color: "text-amber-500 bg-amber-500/10 border-amber-500/30", icon: AlertTriangle, label: t("interactions.moderate") },
    dangerous: { color: "text-red-500 bg-red-500/10 border-red-500/30", icon: AlertTriangle, label: t("interactions.dangerous") },
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          {t("interactions.title")}
        </h1>
        <p className="text-muted-foreground">{t("interactions.description")}</p>
      </div>

      {/* Current Medicines */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <h3 className="font-semibold mb-3">{t("interactions.yourMedicines")}</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {medicines?.map((m, i) => (
            <span key={i} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              💊 {m.name} {m.dosage && `(${m.dosage})`}
            </span>
          ))}
          {customMeds.map((m, i) => (
            <span key={`c-${i}`} className="px-3 py-1.5 rounded-full bg-accent text-sm font-medium flex items-center gap-1">
              💊 {m}
              <button onClick={() => setCustomMeds(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          ))}
          {(!medicines || medicines.length === 0) && customMeds.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("interactions.noMedicines")}</p>
          )}
        </div>

        {/* Add custom medicine */}
        <div className="flex gap-2">
          <input
            value={customMed}
            onChange={e => setCustomMed(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomMed()}
            placeholder={t("interactions.addMedicine")}
            className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" onClick={addCustomMed} disabled={!customMed.trim()}>+</Button>
        </div>
      </div>

      <Button className="w-full h-12 text-base gap-2" onClick={checkInteractions} disabled={loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        {t("interactions.checkNow")}
      </Button>

      {/* Results */}
      {interactions && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t("interactions.results")} ({interactions.length})</h3>
          {interactions.map((inter, i) => {
            const config = severityConfig[inter.severity] || severityConfig.moderate;
            const Icon = config.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`border rounded-xl p-4 ${config.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{config.label}</span>
                  <span className="text-xs opacity-70 ml-auto">{inter.medicine_a} ↔ {inter.medicine_b}</span>
                </div>
                <p className="text-sm mb-1">{inter.description}</p>
                <p className="text-xs opacity-80">💡 {inter.recommendation}</p>
              </motion.div>
            );
          })}

          <div className="p-4 rounded-lg bg-warning/10 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning inline mr-2" />
            {t("common.consultPharmacist")}
          </div>
        </div>
      )}
    </div>
  );
}
