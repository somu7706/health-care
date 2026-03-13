import { Phone, Shield, Heart, AlertTriangle, Baby, Users, ExternalLink } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export default function HelpSafety() {
  const { t } = useI18n();

  const emergencyContacts = [
    { number: "112", label: t("help.emergency112"), icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
    { number: "108", label: t("help.ambulance108"), icon: Heart, color: "bg-info/10 text-info" },
    { number: "181", label: t("help.women181"), icon: Users, color: "bg-feature-doctor text-feature-doctor-icon" },
    { number: "1098", label: t("help.child1098"), icon: Baby, color: "bg-feature-ai text-feature-ai-icon" },
    { number: "104", label: t("help.health104"), icon: Phone, color: "bg-success/10 text-success" },
    { number: "14529", label: t("help.senior14529"), icon: Users, color: "bg-feature-hospital text-feature-hospital-icon" },
  ];

  const safetyInfo = [
    { icon: Shield, title: t("help.dataSecure"), desc: t("help.dataSecureDesc") },
    { icon: Heart, title: t("help.mentalHealth"), desc: t("help.mentalHealthDesc") },
    { icon: AlertTriangle, title: t("help.medicalDisclaimer"), desc: t("help.medicalDisclaimerDesc") },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("help.title")}</h1>
        <p className="text-muted-foreground">{t("help.description")}</p>
      </div>

      <div className="border border-border rounded-xl p-6 bg-card">
        <h2 className="font-semibold text-lg mb-4">{t("help.emergencyNumbers")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {emergencyContacts.map((c) => (
            <a
              key={c.number}
              href={`tel:${c.number}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background hover:bg-accent/30 transition-colors group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-lg">{c.number}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {safetyInfo.map((item, i) => (
          <div key={i} className="border border-border rounded-xl p-5 bg-card flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-xl p-5 bg-card">
        <h2 className="font-semibold text-lg mb-3">{t("help.usefulLinks")}</h2>
        <div className="space-y-2">
          {[
            { label: "WHO Health Topics", url: "https://www.who.int/health-topics" },
            { label: "MedlinePlus", url: "https://medlineplus.gov" },
            { label: "WebMD Symptom Checker", url: "https://www.webmd.com/symptom-checker" },
          ].map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-accent/30 transition-colors text-sm">
              <span className="font-medium">{link.label}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
