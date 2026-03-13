import { Link } from "react-router-dom";
import { Heart, Upload, MessageSquare, MapPin, Stethoscope, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useI18n, localeNames, type Locale } from "@/hooks/useI18n";
import { Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Landing() {
  const { session } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const features = [
    { icon: Upload, title: t("landing.smartReport"), description: t("landing.smartReportDesc"), bg: "bg-feature-upload", iconColor: "text-feature-upload-icon" },
    { icon: MessageSquare, title: t("landing.aiAssistant"), description: t("landing.aiAssistantDesc"), bg: "bg-feature-ai", iconColor: "text-feature-ai-icon" },
    { icon: MapPin, title: t("landing.nearbyCare"), description: t("landing.nearbyCareDesc"), bg: "bg-feature-hospital", iconColor: "text-feature-hospital-icon" },
    { icon: Stethoscope, title: t("landing.findDoctors"), description: t("landing.findDoctorsDesc"), bg: "bg-feature-doctor", iconColor: "text-feature-doctor-icon" },
    { icon: Shield, title: t("landing.safePrivate"), description: t("landing.safePrivateDesc"), bg: "bg-accent", iconColor: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.webp" alt="VitalWave Logo" className="h-10 w-10 object-contain" />
          <span className="text-xl font-bold">Vital<span className="text-primary">Wave</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{localeNames[locale]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(localeNames) as Locale[]).map(l => (
                <DropdownMenuItem key={l} onClick={() => setLocale(l)} className={locale === l ? "font-semibold text-primary" : ""}>
                  {localeNames[l]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {session ? (
            <Button asChild><Link to="/dashboard">{t("nav.dashboard")}</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">{t("auth.login")}</Link></Button>
              <Button asChild><Link to="/auth">{t("auth.register")}</Link></Button>
            </>
          )}
        </div>
      </nav>

      <section className="text-center py-16 px-4 max-w-4xl mx-auto">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight">
          {t("landing.heroTitle")}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("landing.heroDesc")}
        </motion.p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="border border-border rounded-xl p-6 bg-card hover:shadow-lg transition-shadow cursor-pointer group">
              <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className={`h-5 w-5 ${f.iconColor}`} />
              </div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
