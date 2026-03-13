import { Link, useLocation } from "react-router-dom";
import { Heart, LayoutDashboard, Upload, MessageSquare, Stethoscope, MapPin, Pill, Clock, Search, Shield, HelpCircle, HeartPulse, ClipboardList, AlertTriangle, Settings, X, Lock, Siren, Activity, Lightbulb, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function DashboardSidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { t } = useI18n();

  // Check if user has any prescriptions uploaded
  const { data: hasPrescriptions } = useQuery({
    queryKey: ["has-prescriptions"],
    queryFn: async () => {
      const { count } = await supabase
        .from("medical_reports")
        .select("*", { count: "exact", head: true });
      return (count || 0) > 0;
    },
  });

  const coreLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/upload", icon: Upload, label: t("nav.upload") },
    { to: "/assistant", icon: MessageSquare, label: t("nav.assistant") },
    { to: "/find-doctors", icon: Stethoscope, label: t("nav.findDoctors") },
    { to: "/nearby", icon: MapPin, label: t("nav.nearby") },
    { to: "/medicines", icon: Pill, label: t("nav.medicines") },
    { to: "/history", icon: Clock, label: t("nav.history") },
    { to: "/symptoms", icon: Search, label: t("nav.symptoms") },
    { to: "/medicine-safety", icon: Shield, label: t("nav.medicineSafety") },
    { to: "/help", icon: HelpCircle, label: t("nav.help") },
  ];

  const healthLinks = [
    { to: "/disease-stage", icon: HeartPulse, label: t("nav.diseaseStage") },
    { to: "/care-plan", icon: ClipboardList, label: t("nav.carePlan") },
    { to: "/precautions", icon: AlertTriangle, label: t("nav.precautions") },
  ];

  const aiLinks = [
    { to: "/emergency", icon: Siren, label: t("nav.emergency") },
    { to: "/health-risk", icon: Activity, label: t("nav.healthRisk") },
    { to: "/medicine-interactions", icon: Zap, label: t("nav.interactions") },
    { to: "/health-coach", icon: Lightbulb, label: t("nav.healthCoach") },
  ];

  const NavItem = ({ to, icon: Icon, label, disabled }: { to: string; icon: React.ElementType; label: string; disabled?: boolean }) => {
    const isActive = location.pathname === to;

    if (disabled) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-sidebar-foreground/40 cursor-not-allowed">
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{label}</span>
              <Lock className="h-3 w-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">{t("nav.uploadFirst")}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        to={to}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-[3px] border-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-[240px] h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.webp" alt="VitalWave Logo" className="h-8 w-8 object-contain" />
          <span className="text-xl font-bold text-sidebar-primary-foreground">
            Vital<span className="text-sidebar-primary">Wave</span>
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-sidebar-accent transition-colors">
            <X className="h-5 w-5 text-sidebar-foreground" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted px-4 mb-2">{t("nav.core")}</p>
        {coreLinks.map(link => <NavItem key={link.to} {...link} />)}

        <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted px-4 mt-6 mb-2">
          {t("nav.myHealth")} {!hasPrescriptions && <Lock className="h-3 w-3 inline ml-1" />}
        </p>
        {healthLinks.map(link => <NavItem key={link.to} {...link} disabled={!hasPrescriptions} />)}

        <p className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted px-4 mt-6 mb-2">
          {t("nav.aiFeatures")}
        </p>
        {aiLinks.map(link => <NavItem key={link.to} {...link} />)}
      </nav>

      <div className="px-3 pb-4">
        <NavItem to="/settings" icon={Settings} label={t("nav.settings")} />
      </div>
    </aside>
  );
}
