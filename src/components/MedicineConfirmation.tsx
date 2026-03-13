import { useState } from "react";
import { CheckCircle, Edit2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { useI18n } from "@/hooks/useI18n";

export type ExtractedMedicine = {
  name: string;
  original_text?: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration: string;
  drug_class?: string;
  confidence: number;
  needs_review: boolean;
};

interface MedicineConfirmationProps {
  medicines: ExtractedMedicine[];
  onConfirm: (medicines: ExtractedMedicine[]) => void;
  onCancel: () => void;
}

export default function MedicineConfirmation({ medicines, onConfirm, onCancel }: MedicineConfirmationProps) {
  const [editableMeds, setEditableMeds] = useState<ExtractedMedicine[]>(medicines);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { t } = useI18n();

  const needsReview = editableMeds.some(m => m.needs_review || m.confidence < 90);

  const updateMed = (index: number, field: keyof ExtractedMedicine, value: string | number | boolean) => {
    setEditableMeds(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const removeMed = (index: number) => {
    setEditableMeds(prev => prev.filter((_, i) => i !== index));
  };

  const confirmMed = (index: number) => {
    updateMed(index, "needs_review", false);
    updateMed(index, "confidence", 100);
    setEditingIndex(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-success";
    if (confidence >= 70) return "text-warning";
    return "text-destructive";
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 90) return "bg-success/10";
    if (confidence >= 70) return "bg-warning/10";
    return "bg-destructive/10";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t("upload.confirmMedicines")}</h3>
          <p className="text-sm text-muted-foreground">{t("upload.reviewExtracted")}</p>
        </div>
        {needsReview && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            {t("upload.needsReview")}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {editableMeds.map((med, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl border p-4 ${
              med.needs_review || med.confidence < 90
                ? "border-warning/50 bg-warning/5"
                : "border-border bg-background"
            }`}
          >
            {editingIndex === i ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">{t("upload.medicineName")}</label>
                    <Input
                      value={med.name}
                      onChange={e => updateMed(i, "name", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t("upload.dosageLabel")}</label>
                    <Input
                      value={med.dosage}
                      onChange={e => updateMed(i, "dosage", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t("upload.frequencyLabel")}</label>
                    <Input
                      value={med.frequency}
                      onChange={e => updateMed(i, "frequency", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t("upload.durationLabel")}</label>
                    <Input
                      value={med.duration}
                      onChange={e => updateMed(i, "duration", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => confirmMed(i)} className="gap-1">
                    <CheckCircle className="h-3 w-3" /> {t("common.confirm")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">💊</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{med.name}</p>
                      {med.generic_name && med.generic_name !== med.name && (
                        <span className="text-xs text-muted-foreground">({med.generic_name})</span>
                      )}
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getConfidenceBg(med.confidence)} ${getConfidenceColor(med.confidence)}`}>
                        {med.confidence}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {med.dosage} · {med.frequency} · {med.duration}
                      {med.drug_class && ` · ${med.drug_class}`}
                    </p>
                    {med.original_text && med.original_text !== med.name && (
                      <p className="text-xs text-warning mt-0.5">
                        OCR: "{med.original_text}" → {med.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditingIndex(i)} className="p-1.5 rounded hover:bg-accent transition-colors">
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => removeMed(i)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={() => onConfirm(editableMeds)} className="flex-1 gap-2">
          <CheckCircle className="h-4 w-4" />
          {t("upload.confirmAll")} ({editableMeds.length})
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
