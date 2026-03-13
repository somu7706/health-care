import { useState } from "react";
import { Shield, Search, AlertCircle, Loader2, CheckCircle2, AlertTriangle, XCircle, Package, Factory, Hash, Calendar, MapPin, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { motion, AnimatePresence } from "framer-motion";
import { verifyMedicineLocally, AuthenticityResult } from "@/lib/medicineEngine";

type PipelineStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "done";
};

export default function MedicineSafety() {
  const [medicineName, setMedicineName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [purchaseSource, setPurchaseSource] = useState("Licensed Pharmacy / Medical Store");
  const [packagingText, setPackagingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthenticityResult | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const { t } = useI18n();

  const canSubmit = medicineName.trim() && manufacturer.trim();

  const advanceStep = (steps: PipelineStep[], idx: number): PipelineStep[] =>
    steps.map((s, i) => ({
      ...s,
      status: i < idx ? "done" : i === idx ? "running" : "pending",
    }));

  const verifyAuthenticity = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);

    const steps: PipelineStep[] = [
      { key: "validate", label: t("medicineSafety.pipeline.validate"), status: "pending" },
      { key: "manufacturer", label: t("medicineSafety.pipeline.manufacturer"), status: "pending" },
      { key: "batch", label: t("medicineSafety.pipeline.batch"), status: "pending" },
      { key: "expiry", label: t("medicineSafety.pipeline.expiry"), status: "pending" },
      { key: "packaging", label: t("medicineSafety.pipeline.packaging"), status: "pending" },
      { key: "result", label: t("medicineSafety.pipeline.result"), status: "pending" },
    ];
    setPipelineSteps(steps);

    try {
      // Small delays for premium feel and logic processing
      for (let i = 0; i < steps.length - 1; i++) {
        setPipelineSteps(prev => advanceStep(prev, i));
        await new Promise(r => setTimeout(r, 600));
      }

      const localResult = verifyMedicineLocally({
        medicineName,
        manufacturer,
        batchNumber,
        expiryDate,
        purchaseSource,
        packagingText,
      });

      setPipelineSteps(prev => prev.map(s => ({ ...s, status: "done" as const })));
      setResult(localResult);
      toast.success(t("medicineSafety.verificationComplete"));
    } catch (err: any) {
      toast.error("Verification error occurred locally.");
      setPipelineSteps([]);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    if (level.toLowerCase().includes("low")) return "text-green-600 dark:text-green-400";
    if (level.toLowerCase().includes("medium") || level.toLowerCase().includes("moderate") || level.toLowerCase().includes("suspicious")) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRiskBg = (level: string) => {
    if (level.toLowerCase().includes("low")) return "bg-green-500/10 border-green-500/30";
    if (level.toLowerCase().includes("medium") || level.toLowerCase().includes("moderate") || level.toLowerCase().includes("suspicious")) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-red-500/10 border-red-500/30";
  };

  const getRiskIcon = (level: string) => {
    if (level.toLowerCase().includes("low")) return <CheckCircle2 className="h-8 w-8 text-green-500" />;
    if (level.toLowerCase().includes("medium") || level.toLowerCase().includes("moderate") || level.toLowerCase().includes("suspicious")) return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
    return <XCircle className="h-8 w-8 text-red-500" />;
  };

  const getCheckIcon = (status: string) => {
    if (status === "pass" || status === "genuine") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === "warning" || status === "suspicious") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("medicineSafety.title")}</h1>
        <p className="text-muted-foreground">{t("medicineSafety.description")}</p>
      </div>

      {/* Form */}
      <div className="border border-border rounded-xl p-6 bg-card space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t("medicineSafety.authenticityChecker")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("medicineSafety.authenticityDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.medicineName")}</label>
            <div className="relative mt-1">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={medicineName} onChange={e => setMedicineName(e.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.manufacturer")}</label>
            <div className="relative mt-1">
              <Factory className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                placeholder="e.g. Cipla / GSK"
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.batchNumber")}</label>
            <div className="relative mt-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)}
                placeholder="e.g. BN12345"
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.expiryDate")}</label>
            <div className="relative mt-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.purchaseSource")}</label>
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select value={purchaseSource} onChange={e => setPurchaseSource(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none">
              <option>Licensed Pharmacy / Medical Store</option>
              <option>Online Pharmacy</option>
              <option>General Store / Supermarket</option>
              <option>Street Vendor / Unknown Source</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{t("medicineSafety.fields.packagingText")} ({t("medicineSafety.fields.optional")})</label>
          <textarea value={packagingText} onChange={e => setPackagingText(e.target.value)}
            placeholder={t("medicineSafety.fields.packagingPlaceholder")}
            rows={3}
            className="w-full mt-1 p-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
        </div>

        <Button className="w-full gap-2 h-11" onClick={verifyAuthenticity} disabled={loading || !canSubmit}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          {t("medicineSafety.verifyAuthenticity")}
        </Button>
      </div>

      {/* Pipeline Animation */}
      <AnimatePresence>
        {pipelineSteps.length > 0 && !result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="border border-border rounded-xl p-6 bg-card space-y-3">
            {pipelineSteps.map((step, i) => (
              <motion.div key={step.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3">
                {step.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : step.status === "running" ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted" />
                )}
                <span className={`text-sm ${step.status === "running" ? "text-primary font-medium" : step.status === "done" ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                  {step.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Status Card */}
            <div className={`border rounded-xl p-6 ${getRiskBg(result.risk_level)}`}>
              <div className="flex items-center gap-4">
                {getRiskIcon(result.risk_level)}
                <div>
                  <h3 className={`text-xl font-bold ${getRiskColor(result.risk_level)}`}>{result.authenticity}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("medicineSafety.confidence")}: {result.confidence}% · {t("medicineSafety.riskLevel")}: {result.risk_level}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail Checks */}
            <div className="border border-border rounded-xl p-6 bg-card space-y-3">
              <h3 className="font-semibold mb-3">{t("medicineSafety.verificationDetails")}</h3>
              {result.details && Object.entries(result.details).map(([key, check]) => (
                <div key={key} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  {getCheckIcon(check.status)}
                  <div>
                    <p className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {result.warnings?.length > 0 && result.warnings[0] !== "No issues detected" && (
              <div className="border border-destructive/30 rounded-xl p-6 bg-destructive/5 space-y-2">
                <h3 className="font-semibold text-destructive">⚠️ {t("medicineSafety.warnings")}</h3>
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div className="border border-border rounded-xl p-6 bg-card space-y-2">
                <h3 className="font-semibold">{t("medicineSafety.recommendations")}</h3>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety info footer */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground p-4 rounded-lg bg-warning/10">
        <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p>{t("medicineSafety.safetyInfo")}</p>
      </div>
    </div>
  );
}
