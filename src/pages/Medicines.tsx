import { Pill, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

const pharmacies = [
  { name: "1mg", url: "https://www.1mg.com", color: "bg-success/10 text-success" },
  { name: "PharmEasy", url: "https://pharmeasy.in", color: "bg-info/10 text-info" },
  { name: "Apollo Pharmacy", url: "https://www.apollopharmacy.in", color: "bg-accent text-accent-foreground" },
];

export default function Medicines() {
  const { t } = useI18n();
  const { data: medicines, isLoading } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("medicines.title")}</h1>
        <p className="text-muted-foreground">{t("medicines.description")}</p>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card">
        <div className="flex items-center gap-2 mb-4">
          <Pill className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t("medicines.yourMedicines")} ({medicines?.length || 0})</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : medicines && medicines.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {medicines.map(med => (
              <div key={med.id} className="border border-border rounded-xl p-4 bg-background">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{med.name}</h3>
                  <span className="flex items-center gap-1 text-xs text-success font-medium">
                    <CheckCircle className="h-3 w-3" /> {t("common.available")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{med.dosage}</p>
                <p className="text-xs text-muted-foreground mt-1">{med.frequency} · {med.duration}</p>
                {med.source_report && <p className="text-xs text-muted-foreground mt-2">{t("common.from")}: {med.source_report}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">{t("medicines.noMedicines")}</p>
        )}
      </div>

      <div className="border border-border rounded-xl p-6 bg-card">
        <h2 className="font-semibold mb-4">{t("medicines.orderOnline")}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {pharmacies.map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-between p-4 rounded-xl border border-border ${p.color} hover:opacity-80 transition-opacity`}>
              <span className="font-medium">{p.name}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg bg-warning/10">
        <AlertCircle className="h-4 w-4 text-warning shrink-0" />
        {t("common.verifyMedicine")}
      </div>
    </div>
  );
}
