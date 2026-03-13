import { useState, useCallback } from "react";
import { Upload, FileText, Camera, Type, LinkIcon, X, CheckCircle, Loader2, AlertTriangle, HeartPulse, ClipboardList, Salad, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/hooks/useI18n";
import MedicineConfirmation, { type ExtractedMedicine } from "@/components/MedicineConfirmation";

type AnalysisResult = {
  disease?: string;
  medicines?: ExtractedMedicine[];
  summary?: string;
  report_type?: string;
  warnings?: string[];
  diet_recommendations?: string[];
  contraindications?: string[];
};

type PipelineStep = {
  id: string;
  label: string;
  icon: any;
  status: "pending" | "active" | "done" | "error";
};

async function runOCR(file: File): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text;
  } catch {
    return "";
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PIPELINE_STEPS: (t: (k: string) => string) => PipelineStep[] = (t) => [
  { id: "ocr", label: t("pipeline.extractingText"), icon: FileText, status: "pending" },
  { id: "analyze", label: t("pipeline.analyzingPrescription"), icon: Loader2, status: "pending" },
  { id: "medicines", label: t("pipeline.extractingMedicines"), icon: ClipboardList, status: "pending" },
  { id: "stage", label: t("pipeline.predictingStage"), icon: HeartPulse, status: "pending" },
  { id: "careplan", label: t("pipeline.generatingCarePlan"), icon: Salad, status: "pending" },
  { id: "precautions", label: t("pipeline.generatingPrecautions"), icon: ShieldAlert, status: "pending" },
  { id: "saving", label: t("pipeline.savingResults"), icon: CheckCircle, status: "pending" },
];

export default function UploadReports() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<AnalysisResult | null>(null);
  const [fileUrl, setFileUrl] = useState<string | undefined>();
  const [textInput, setTextInput] = useState("");
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [showPipeline, setShowPipeline] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const langMap: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi" };

  const updateStep = (stepId: string, status: "pending" | "active" | "done" | "error") => {
    setPipelineSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    setFiles(Array.from(e.dataTransfer.files));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const runFullPipeline = async (medicines: ExtractedMedicine[], analysisResult: AnalysisResult) => {
    if (!user || !analysisResult.disease) return;

    updateStep("stage", "active");

    try {
      const { data: fullAnalysis, error } = await supabase.functions.invoke("ai-health", {
        body: {
          action: "full-prescription-analysis",
          data: {
            disease: analysisResult.disease,
            medicines: medicines.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
            age: undefined, // profile age if available
            language: langMap[locale],
          },
        },
      });

      if (error || fullAnalysis?.error) throw new Error(fullAnalysis?.error || "Pipeline failed");

      updateStep("stage", "done");
      updateStep("careplan", "active");

      // Update disease stage
      await supabase.from("disease_stages").update({
        stage: fullAnalysis.stage?.stage || "Unknown",
        confidence: fullAnalysis.stage?.confidence || 50,
      }).eq("user_id", user.id).eq("disease", analysisResult.disease);

      updateStep("careplan", "done");
      updateStep("precautions", "active");

      // Save care plan
      await supabase.from("care_plans").insert({
        user_id: user.id,
        disease: analysisResult.disease,
        plan: fullAnalysis.care_plan,
      });

      // Save AI precautions
      const precItems = Array.isArray(fullAnalysis.precautions) ? fullAnalysis.precautions : [];
      if (precItems.length > 0) {
        const precInserts = precItems.map((p: any) => ({
          user_id: user.id,
          precaution: `[${p.severity || "medium"}] ${p.category ? p.category + ": " : ""}${p.precaution}`,
          disease: analysisResult.disease!,
        }));
        await supabase.from("precautions").insert(precInserts);
      }

      updateStep("precautions", "done");
      updateStep("saving", "active");

      // Save consolidated health profile (upsert)
      const { data: existing } = await supabase
        .from("health_profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("disease", analysisResult.disease)
        .maybeSingle();

      const profileData = {
        user_id: user.id,
        disease: analysisResult.disease,
        stage: fullAnalysis.stage?.stage || "Unknown",
        stage_confidence: fullAnalysis.stage?.confidence || 50,
        care_plan: fullAnalysis.care_plan,
        diet_plan: {
          diet: fullAnalysis.care_plan?.diet || [],
          foods_to_avoid: fullAnalysis.care_plan?.foods_to_avoid || [],
          foods_to_include: fullAnalysis.care_plan?.foods_to_include || [],
        },
        precautions: fullAnalysis.precautions,
        medicines: medicines.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration })),
        summary: analysisResult.summary || "",
        last_updated: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("health_profiles").update(profileData).eq("id", existing.id);
      } else {
        await supabase.from("health_profiles").insert(profileData);
      }

      updateStep("saving", "done");
    } catch (err) {
      console.error("Pipeline error:", err);
      // Mark remaining as error
      setPipelineSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "error" } : s));
    }
  };

  const saveConfirmedMedicines = async (medicines: ExtractedMedicine[], analysisResult: AnalysisResult, savedFileUrl?: string) => {
    if (!user) return;

    setUploading(true);
    setShowPipeline(true);
    setPipelineSteps(PIPELINE_STEPS(t));

    // Mark OCR + analyze as done (already happened)
    setTimeout(() => {
      updateStep("ocr", "done");
      updateStep("analyze", "done");
      updateStep("medicines", "active");
    }, 200);

    setProgress(80);
    setStatus(t("upload.savingResults"));

    // Save report
    await supabase.from("medical_reports").insert({
      user_id: user.id,
      file_url: savedFileUrl || null,
      report_text: textInput || "file upload",
      report_type: analysisResult.report_type || "other",
      summary: analysisResult.summary || "",
    });

    // Save confirmed medicines
    if (medicines.length > 0) {
      const medsToInsert = medicines.map(m => ({
        user_id: user.id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        source_report: files[0]?.name || "text-input",
      }));
      await supabase.from("medicines").insert(medsToInsert);

      // Generate smart reminders
      try {
        const { data: reminderData } = await supabase.functions.invoke("ai-health", {
          body: {
            action: "generate-reminders",
            data: { medicines: medicines.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })) },
          },
        });
        if (reminderData?.reminders) {
          for (const reminder of reminderData.reminders) {
            if (reminder.type === "as_needed") {
              await supabase.from("notifications").insert({
                user_id: user.id, type: "medicine_reminder",
                message: `💊 ${reminder.medicine_name} (${reminder.dosage}) - Take as needed${reminder.instruction ? ` · ${reminder.instruction}` : ""}`,
                status: "active",
              });
            } else {
              for (const time of reminder.times || []) {
                await supabase.from("notifications").insert({
                  user_id: user.id, type: "medicine_reminder",
                  message: `⏰ ${time} - ${reminder.medicine_name} (${reminder.dosage})${reminder.instruction ? ` · ${reminder.instruction}` : ""}`,
                  status: "active", schedule_time: time,
                });
              }
            }
          }
        }
      } catch {
        for (const m of medicines) {
          await supabase.from("notifications").insert({
            user_id: user.id, type: "medicine_reminder",
            message: `💊 Take ${m.name} (${m.dosage}) - ${m.frequency}`, status: "active",
          });
        }
      }
    }

    // Save disease stage if detected
    if (analysisResult.disease) {
      await supabase.from("disease_stages").insert({
        user_id: user.id,
        disease: analysisResult.disease,
        stage: "Pending analysis",
        confidence: 0,
      });
    }

    // Save initial precautions from analysis
    const precautions = [...(analysisResult.warnings || []), ...(analysisResult.contraindications || [])];
    if (precautions.length > 0 && analysisResult.disease) {
      const precautionInserts = precautions.map(p => ({
        user_id: user.id, precaution: p, disease: analysisResult.disease!,
      }));
      await supabase.from("precautions").insert(precautionInserts);
    }

    updateStep("medicines", "done");

    // Run the full AI pipeline (stage prediction, care plan, precautions, health profile)
    await runFullPipeline(medicines, analysisResult);

    setProgress(100);
    setStatus(t("upload.complete"));
    setResult({ ...analysisResult, medicines });
    setPendingConfirmation(null);

    // Invalidate ALL health-related queries
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["medicines"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["disease-stages"] });
    queryClient.invalidateQueries({ queryKey: ["precautions"] });
    queryClient.invalidateQueries({ queryKey: ["care-plans"] });
    queryClient.invalidateQueries({ queryKey: ["health-profile"] });
    queryClient.invalidateQueries({ queryKey: ["has-prescriptions"] });

    toast.success(t("upload.uploadSuccess"));
    setUploading(false);
  };

  const processReport = async (reportText: string, savedFileUrl?: string, imageBase64?: string, imageMimeType?: string) => {
    if (!user) return;

    setStatus(t("upload.analyzingDoc"));
    setProgress(60);

    const body: Record<string, any> = {
      action: "analyze-report",
      data: { reportText, language: langMap[locale] },
    };
    if (imageBase64) {
      body.data.imageBase64 = imageBase64;
      body.data.imageMimeType = imageMimeType || "image/jpeg";
    }

    const { data: aiResult, error: aiError } = await supabase.functions.invoke("ai-health", { body });

    if (aiError || aiResult?.error) {
      toast.error(aiResult?.error || "AI analysis failed");
      setUploading(false);
      return;
    }

    setProgress(75);

    const needsReview = aiResult.medicines?.some((m: ExtractedMedicine) => m.needs_review || m.confidence < 90);

    if (needsReview && aiResult.medicines?.length > 0) {
      setFileUrl(savedFileUrl);
      setPendingConfirmation(aiResult);
      setUploading(false);
      setStatus(t("upload.reviewRequired"));
    } else {
      await saveConfirmedMedicines(aiResult.medicines || [], aiResult, savedFileUrl);
    }
  };

  const handleUpload = async () => {
    if (!user || files.length === 0) return;
    setUploading(true);
    setProgress(10);
    setStatus(t("upload.uploading"));

    try {
      const file = files[0];
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("medical-reports").upload(filePath, file);
      if (uploadError) throw uploadError;

      setProgress(25);
      setStatus(t("upload.extracting"));

      let reportText = "";
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (file.type.startsWith("text/")) {
        reportText = await file.text();
      } else if (file.type.startsWith("image/")) {
        setStatus(t("upload.extracting"));
        imageBase64 = await fileToBase64(file);
        imageMimeType = file.type;
        try { reportText = await runOCR(file); } catch { reportText = ""; }
        if (!reportText.trim()) reportText = `Prescription image: ${file.name}`;
      } else {
        reportText = `[Uploaded file: ${file.name}, type: ${file.type}, size: ${(file.size / 1024).toFixed(1)}KB]. Please analyze this medical document.`;
      }

      setProgress(45);
      setStatus(t("upload.textExtracted"));

      const { data: urlData } = supabase.storage.from("medical-reports").getPublicUrl(filePath);
      await processReport(reportText, urlData.publicUrl, imageBase64, imageMimeType);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setUploading(true);
    setProgress(10);
    setStatus(t("upload.analyzing"));
    try {
      await processReport(textInput);
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setUploading(false);
    }
  };

  // Pipeline animation overlay
  const PipelineAnimation = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-xl p-6 bg-card"
    >
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        {t("pipeline.title")}
      </h3>
      <div className="space-y-3">
        <AnimatePresence>
          {pipelineSteps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${step.status === "active"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : step.status === "done"
                    ? "border-border bg-background opacity-80"
                    : step.status === "error"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-border bg-background opacity-40"
                }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.status === "active"
                  ? "bg-primary text-primary-foreground"
                  : step.status === "done"
                    ? "bg-primary/20 text-primary"
                    : step.status === "error"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-muted text-muted-foreground"
                }`}>
                {step.status === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step.status === "done" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : step.status === "error" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <step.icon className="h-4 w-4" />
                )}
              </div>
              <span className={`text-sm font-medium ${step.status === "active" ? "text-primary" : step.status === "done" ? "text-foreground" : "text-muted-foreground"
                }`}>
                {step.label}
              </span>
              {step.status === "done" && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto text-xs text-primary font-medium"
                >
                  ✓
                </motion.span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  // Medicine confirmation pending
  if (pendingConfirmation) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("upload.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("upload.reviewExtracted")}</p>
        </div>

        {pendingConfirmation.summary && (
          <div className="border border-border rounded-xl p-4 bg-card">
            <h3 className="font-semibold mb-1">{t("upload.summary")}</h3>
            <p className="text-sm text-muted-foreground">{pendingConfirmation.summary}</p>
            {pendingConfirmation.disease && (
              <p className="text-sm font-medium text-primary mt-2">{t("upload.detectedCondition")}: {pendingConfirmation.disease}</p>
            )}
          </div>
        )}

        {pendingConfirmation.warnings && pendingConfirmation.warnings.length > 0 && (
          <div className="border border-warning/50 rounded-xl p-4 bg-warning/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="font-semibold text-sm">{t("upload.warnings")}</h3>
            </div>
            <ul className="space-y-1">
              {pendingConfirmation.warnings.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="border border-border rounded-xl p-6 bg-card">
          <MedicineConfirmation
            medicines={pendingConfirmation.medicines || []}
            onConfirm={(confirmedMeds) => saveConfirmedMedicines(confirmedMeds, pendingConfirmation, fileUrl)}
            onCancel={() => { setPendingConfirmation(null); setProgress(0); }}
          />
        </div>
      </div>
    );
  }

  if (showPipeline && uploading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("upload.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("pipeline.subtitle")}</p>
        </div>
        <PipelineAnimation />
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border border-border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <h2 className="text-xl font-bold">{t("upload.success")}</h2>
              <p className="text-sm text-muted-foreground">{t("upload.analyzed")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background mb-4">
            <span className="text-2xl">💊</span>
            <div>
              <p className="font-medium">{files[0]?.name || "Text input"}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{result.report_type}</span>
            </div>
          </div>

          {result.summary && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">{t("upload.summary")}</h3>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </div>
          )}

          {result.disease && (
            <div className="mb-4 p-3 rounded-lg border border-border bg-background">
              <h3 className="font-semibold mb-1">{t("upload.detectedCondition")}</h3>
              <p className="text-sm text-primary font-medium">{result.disease}</p>
            </div>
          )}

          {result.medicines && result.medicines.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">{t("upload.medicinesFound")} ({result.medicines.length})</h3>
              {result.medicines.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💊</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{m.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                          {m.confidence || 100}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.dosage} · {m.frequency}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-accent font-medium">{m.duration}</span>
                </div>
              ))}
            </div>
          )}

          {/* Show pipeline completion summary */}
          <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <h3 className="font-semibold mb-2 text-primary">✨ {t("pipeline.complete")}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("pipeline.stageAnalyzed")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("pipeline.carePlanReady")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("pipeline.dietReady")}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5 text-primary" /> {t("pipeline.precautionsReady")}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 text-sm mb-6">
            <p>⚠️ {t("common.disclaimer")}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => { setResult(null); setFiles([]); setProgress(0); setShowPipeline(false); }}>{t("common.uploadAnother")}</Button>
            <Button onClick={() => navigate("/dashboard")}>{t("common.goToDashboard")}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("upload.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("upload.description")}</p>
      </div>

      <div className="border border-border rounded-xl bg-card p-6">
        <Tabs defaultValue="file">
          <TabsList className="grid grid-cols-4 mb-6">
            <TabsTrigger value="file" className="gap-2"><FileText className="h-4 w-4" /> {t("upload.file")}</TabsTrigger>
            <TabsTrigger value="camera" className="gap-2"><Camera className="h-4 w-4" /> {t("upload.camera")}</TabsTrigger>
            <TabsTrigger value="text" className="gap-2"><Type className="h-4 w-4" /> {t("upload.text")}</TabsTrigger>
            <TabsTrigger value="link" className="gap-2"><LinkIcon className="h-4 w-4" /> {t("upload.link")}</TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium">{t("upload.dragDrop")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("upload.supportedFormats")}</p>
              <input id="file-input" type="file" className="hidden" accept="image/*,.pdf,.txt" onChange={handleFileSelect} />
            </div>
          </TabsContent>

          <TabsContent value="camera">
            <div
              onClick={() => document.getElementById("camera-input")?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-all"
            >
              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium">{t("upload.takePhoto")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("upload.cameraDesc")}</p>
              <input id="camera-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileSelect} />
            </div>
          </TabsContent>

          <TabsContent value="text">
            <div className="space-y-4">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={t("upload.textPlaceholder")}
                className="w-full min-h-[200px] rounded-xl border border-border bg-background p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handleTextSubmit} disabled={uploading || !textInput.trim()} className="w-full">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("upload.analyzeText")}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="link">
            <div className="border-2 border-dashed rounded-xl p-10 text-center">
              <LinkIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium">{t("upload.comingSoon")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("upload.linkDesc")}</p>
            </div>
          </TabsContent>
        </Tabs>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button onClick={handleUpload} disabled={uploading} className="w-full mt-4">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {status}</> : <><Upload className="h-4 w-4 mr-2" /> {t("upload.analyzeReport")}</>}
            </Button>
          </div>
        )}

        {uploading && !showPipeline && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{status}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <motion.div className="bg-primary h-2 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
