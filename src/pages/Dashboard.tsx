import { Link } from "react-router-dom";
import { Upload, Stethoscope, MapPin, MessageSquare, Search, HeartPulse, Pill, ClipboardList, Salad, ShieldAlert, Activity } from "lucide-react";
import { Heart } from "lucide-react";
import LiveHealthMetrics from "@/components/dashboard/LiveHealthMetrics";
import QuickReminders from "@/components/dashboard/QuickReminders";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useI18n } from "@/hooks/useI18n";

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useI18n();

  const quickActions = [
    { to: "/upload", icon: Upload, label: t("dashboard.uploadReport"), bg: "bg-feature-upload", iconColor: "text-feature-upload-icon" },
    { to: "/find-doctors", icon: Stethoscope, label: t("dashboard.findDoctor"), bg: "bg-feature-doctor", iconColor: "text-feature-doctor-icon" },
    { to: "/nearby", icon: MapPin, label: t("dashboard.nearbyHospital"), bg: "bg-feature-hospital", iconColor: "text-feature-hospital-icon" },
    { to: "/assistant", icon: MessageSquare, label: t("dashboard.askAI"), bg: "bg-feature-ai", iconColor: "text-feature-ai-icon" },
    { to: "/symptoms", icon: Search, label: t("dashboard.symptomChecker"), bg: "bg-feature-symptom", iconColor: "text-feature-symptom-icon" },
  ];


  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data } = await supabase.from("medical_reports").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: medicines } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });


  const { data: healthProfile } = useQuery({
    queryKey: ["health-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("health_profiles")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const hasUploads = reports && reports.length > 0;
  const hasHealthProfile = !!healthProfile;


  const stageColor = (stage: string | null) => {
    if (!stage) return "text-muted-foreground";
    if (stage.toLowerCase().includes("early") || stage.toLowerCase().includes("recovery")) return "text-success";
    if (stage.toLowerCase().includes("moderate")) return "text-warning";
    return "text-destructive";
  };

  const renderCarePlanPreview = (plan: any) => {
    if (!plan || typeof plan !== "object") return null;
    const diet = plan.diet || [];
    const exercise = plan.exercise || [];
    const items = [...diet.slice(0, 2), ...exercise.slice(0, 1)];
    if (items.length === 0) return null;
    return (
      <ul className="space-y-1 mt-2">
        {items.map((item: string, i: number) => (
          <li key={i} className="text-xs text-muted-foreground truncate">• {item}</li>
        ))}
      </ul>
    );
  };

  const renderPrecautionsPreview = (precs: any) => {
    if (!precs || !Array.isArray(precs)) return null;
    return (
      <ul className="space-y-1 mt-2">
        {precs.slice(0, 2).map((p: any, i: number) => (
          <li key={i} className="text-xs text-muted-foreground truncate">
            • {typeof p === "string" ? p : p.precaution}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.welcome")}, {profile?.name || "User"} 👋</h1>
          <p className="text-muted-foreground mt-1">{profile?.location || t("dashboard.healthDashboard")}</p>
        </div>
        <Button asChild>
          <Link to="/upload" className="gap-2"><Upload className="h-4 w-4" /> {t("dashboard.uploadReport")}</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {quickActions.map((a, i) => (
          <motion.div key={a.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={a.to} className="border border-border rounded-xl p-5 bg-card hover:shadow-md transition-all flex flex-col items-center gap-3 text-center group">
              <div className={`w-14 h-14 rounded-xl ${a.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <a.icon className={`h-6 w-6 ${a.iconColor}`} />
              </div>
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Live Health Metrics from Smartwatch */}
      <LiveHealthMetrics />

      {/* My Health Section - only shown when health profile exists */}
      {hasHealthProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-primary/20 rounded-xl p-6 bg-primary/5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("nav.myHealth")}</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {healthProfile.last_updated ? format(new Date(healthProfile.last_updated), "MMM d, yyyy h:mm a") : ""}
            </span>
          </div>

          {/* Disease & Stage */}
          <div className="grid md:grid-cols-4 gap-4">
            <Link to="/disease-stage" className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("nav.diseaseStage")}</span>
              </div>
              <p className="text-sm font-medium">{healthProfile.disease}</p>
              <p className={`text-xs font-semibold mt-1 ${stageColor(healthProfile.stage)}`}>
                {healthProfile.stage}
                {healthProfile.stage_confidence ? ` (${healthProfile.stage_confidence}%)` : ""}
              </p>
            </Link>

            <Link to="/care-plan" className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("nav.carePlan")}</span>
              </div>
              {renderCarePlanPreview(healthProfile.care_plan)}
              <p className="text-xs text-primary mt-2 font-medium">{t("dashboard.viewFull")} →</p>
            </Link>

            <Link to="/care-plan" className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Salad className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold">{t("dashboard.dietPlan")}</span>
              </div>
              {healthProfile.diet_plan && typeof healthProfile.diet_plan === "object" && (
                <ul className="space-y-1 mt-2">
                  {((healthProfile.diet_plan as any)?.foods_to_avoid || []).slice(0, 2).map((f: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground truncate">🚫 {f}</li>
                  ))}
                  {((healthProfile.diet_plan as any)?.foods_to_include || []).slice(0, 1).map((f: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground truncate">✅ {f}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-primary mt-2 font-medium">{t("dashboard.viewFull")} →</p>
            </Link>

            <Link to="/precautions" className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold">{t("nav.precautions")}</span>
              </div>
              {renderPrecautionsPreview(healthProfile.precautions)}
              <p className="text-xs text-primary mt-2 font-medium">{t("dashboard.viewFull")} →</p>
            </Link>
          </div>
        </motion.div>
      )}

      {/* No prescription uploaded prompt */}
      {!hasUploads && !hasHealthProfile && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-dashed border-primary/30 rounded-xl p-8 bg-primary/5 text-center"
        >
          <Upload className="h-12 w-12 mx-auto mb-3 text-primary/40" />
          <h3 className="font-semibold text-lg">{t("dashboard.noHealthData")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">{t("dashboard.uploadToUnlock")}</p>
          <Button asChild>
            <Link to="/upload">{t("dashboard.uploadReport")}</Link>
          </Button>
        </motion.div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("dashboard.healthOverview")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{t("dashboard.recentActivity")}</p>

          {medicines && medicines.length > 0 ? (
            <div className="space-y-3">
              {medicines.map(med => (
                <div key={med.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-3">
                    <Pill className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground">{med.dosage} · {med.frequency}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{med.duration}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Upload className="h-10 w-10 mb-3 opacity-40" />
              <p className="font-medium">{t("dashboard.noUploads")}</p>
              <p className="text-sm mt-1">{t("dashboard.firstUpload")}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-border rounded-xl p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4">{t("dashboard.recentUploads")}</h2>
            {reports && reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="p-3 rounded-lg border border-border bg-background">
                    <p className="text-sm font-medium">{r.report_type || "Report"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.summary?.slice(0, 60) || t("dashboard.processing")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{r.created_at ? format(new Date(r.created_at), "MMM d, yyyy") : ""}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <div className="w-12 h-14 border-2 border-dashed border-border rounded-lg flex items-center justify-center mb-3">
                  <span className="text-xs opacity-40">📄</span>
                </div>
                <p className="text-sm">{t("dashboard.noUploads")}</p>
              </div>
            )}
          </div>

          <QuickReminders />
        </div>
      </div>
    </div>
  );
}
