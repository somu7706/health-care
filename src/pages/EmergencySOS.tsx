import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Phone, MapPin, Heart, Activity, Loader2, Shield, Siren, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

type EmergencyLevel = "normal" | "warning" | "critical";

const EMERGENCY_NUMBER = "112"; // India emergency

export default function EmergencySOS() {
  const [heartRate, setHeartRate] = useState(72);
  const [oxygenLevel, setOxygenLevel] = useState(98);
  const [emergencyLevel, setEmergencyLevel] = useState<EmergencyLevel>("normal");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showAlert, setShowAlert] = useState(false);
  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [manualHeartRate, setManualHeartRate] = useState("");
  const [manualOxygen, setManualOxygen] = useState("");
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const emergencySymptoms = [
    { key: "chestPain", label: t("emergency.chestPain"), critical: true },
    { key: "breathingDifficulty", label: t("emergency.breathingDifficulty"), critical: true },
    { key: "severeHeadache", label: t("emergency.severeHeadache"), critical: false },
    { key: "numbness", label: t("emergency.numbness"), critical: true },
    { key: "vision", label: t("emergency.visionLoss"), critical: true },
    { key: "fainting", label: t("emergency.fainting"), critical: true },
    { key: "severeAbdominal", label: t("emergency.abdominalPain"), critical: false },
    { key: "allergicReaction", label: t("emergency.allergicReaction"), critical: true },
  ];

  const evaluateEmergency = useCallback(() => {
    const hasCriticalSymptom = symptoms.some(s => emergencySymptoms.find(es => es.key === s)?.critical);
    const highHR = heartRate > 120 || heartRate < 40;
    const lowO2 = oxygenLevel < 92;

    if (hasCriticalSymptom || (highHR && lowO2)) {
      setEmergencyLevel("critical");
      setShowAlert(true);
    } else if (highHR || lowO2 || symptoms.length >= 2) {
      setEmergencyLevel("warning");
    } else {
      setEmergencyLevel("normal");
    }
  }, [heartRate, oxygenLevel, symptoms]);

  useEffect(() => { evaluateEmergency(); }, [evaluateEmergency]);

  const fetchNearbyHospitals = async () => {
    setLoadingHospitals(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      const { latitude: lat, longitude: lon } = pos.coords;
      const query = `[out:json][timeout:10];node["amenity"="hospital"](around:5000,${lat},${lon});out body 5;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();
      setNearbyHospitals((data.elements || []).map((el: any) => ({
        name: el.tags?.name || "Hospital",
        lat: el.lat, lon: el.lon,
        phone: el.tags?.phone || el.tags?.["contact:phone"],
        distance: Math.round(
          Math.sqrt(Math.pow((el.lat - lat) * 111000, 2) + Math.pow((el.lon - lon) * 111000 * Math.cos(lat * Math.PI / 180), 2))
        ),
      })));
    } catch {
      toast.error("Could not find nearby hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  };

  const toggleSymptom = (key: string) => {
    setSymptoms(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const applyManualVitals = () => {
    if (manualHeartRate) setHeartRate(parseInt(manualHeartRate) || 72);
    if (manualOxygen) setOxygenLevel(parseInt(manualOxygen) || 98);
  };

  const levelColors = {
    normal: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
    warning: "text-amber-500 border-amber-500/30 bg-amber-500/5",
    critical: "text-red-500 border-red-500/30 bg-red-500/5",
  };

  const levelBg = {
    normal: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-red-500",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Critical Alert Modal */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="bg-card border-2 border-red-500 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-500">
                  <Siren className="h-6 w-6 animate-pulse" />
                  <h2 className="text-xl font-bold">{t("emergency.alertTitle")}</h2>
                </div>
                <button onClick={() => setShowAlert(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{t("emergency.alertDesc")}</p>

              <a href={`tel:${EMERGENCY_NUMBER}`} className="block">
                <Button className="w-full h-14 text-lg gap-3 bg-red-600 hover:bg-red-700">
                  <Phone className="h-6 w-6" /> {t("emergency.callNow")} ({EMERGENCY_NUMBER})
                </Button>
              </a>

              <Button variant="outline" className="w-full gap-2" onClick={() => { fetchNearbyHospitals(); setShowAlert(false); }}>
                <MapPin className="h-4 w-4" /> {t("emergency.findHospital")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Siren className="h-8 w-8 text-red-500" />
          {t("emergency.title")}
        </h1>
        <p className="text-muted-foreground">{t("emergency.description")}</p>
      </div>

      {/* Status Banner */}
      <div className={`border rounded-xl p-4 flex items-center justify-between ${levelColors[emergencyLevel]}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${levelBg[emergencyLevel]} ${emergencyLevel === "critical" ? "animate-pulse" : ""}`} />
          <div>
            <p className="font-semibold">{t(`emergency.level.${emergencyLevel}`)}</p>
            <p className="text-xs opacity-70">{t(`emergency.levelDesc.${emergencyLevel}`)}</p>
          </div>
        </div>
        {emergencyLevel !== "normal" && (
          <a href={`tel:${EMERGENCY_NUMBER}`}>
            <Button size="sm" variant="destructive" className="gap-2">
              <Phone className="h-4 w-4" /> SOS
            </Button>
          </a>
        )}
      </div>

      {/* Vitals Input */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-5 w-5 text-red-500" />
            <h3 className="font-semibold">{t("emergency.heartRate")}</h3>
          </div>
          <div className="text-center mb-3">
            <span className={`text-5xl font-bold ${heartRate > 120 || heartRate < 40 ? "text-red-500" : heartRate > 100 ? "text-amber-500" : "text-emerald-500"}`}>
              {heartRate}
            </span>
            <span className="text-sm text-muted-foreground ml-1">BPM</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={manualHeartRate}
              onChange={e => setManualHeartRate(e.target.value)}
              placeholder={t("emergency.enterBPM")}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm"
            />
            <Button size="sm" onClick={applyManualVitals}>{t("emergency.update")}</Button>
          </div>
        </div>

        <div className="border border-border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold">{t("emergency.oxygenLevel")}</h3>
          </div>
          <div className="text-center mb-3">
            <span className={`text-5xl font-bold ${oxygenLevel < 92 ? "text-red-500" : oxygenLevel < 95 ? "text-amber-500" : "text-emerald-500"}`}>
              {oxygenLevel}
            </span>
            <span className="text-sm text-muted-foreground ml-1">% SpO₂</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={manualOxygen}
              onChange={e => setManualOxygen(e.target.value)}
              placeholder={t("emergency.enterSpO2")}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm"
            />
            <Button size="sm" onClick={applyManualVitals}>{t("emergency.update")}</Button>
          </div>
        </div>
      </div>

      {/* Emergency Symptoms */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <h3 className="font-semibold mb-3">{t("emergency.reportSymptoms")}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {emergencySymptoms.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSymptom(s.key)}
              className={`p-3 rounded-lg border text-sm text-left transition-all ${symptoms.includes(s.key)
                ? s.critical ? "border-red-500 bg-red-500/10 text-red-500 font-medium" : "border-amber-500 bg-amber-500/10 text-amber-500 font-medium"
                : "border-border hover:border-primary/50"
                }`}
            >
              <span className="flex items-center gap-1.5">
                {s.critical && <AlertTriangle className="h-3 w-3" />}
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* One-tap SOS */}
      <a href={`tel:${EMERGENCY_NUMBER}`} className="block">
        <Button className="w-full h-16 text-xl gap-3 bg-red-600 hover:bg-red-700 rounded-xl shadow-lg">
          <Phone className="h-7 w-7" /> {t("emergency.sosCall")}
        </Button>
      </a>

      {/* Nearby Hospitals */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> {t("emergency.nearestHospitals")}
          </h3>
          <Button size="sm" variant="outline" onClick={fetchNearbyHospitals} disabled={loadingHospitals} className="gap-1">
            {loadingHospitals ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
            {t("emergency.findNow")}
          </Button>
        </div>
        {nearbyHospitals.length > 0 ? (
          <div className="space-y-2">
            {nearbyHospitals.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <div>
                  <p className="font-medium text-sm">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.distance < 1000 ? `${h.distance}m` : `${(h.distance / 1000).toFixed(1)}km`} away</p>
                </div>
                <div className="flex gap-2">
                  {h.phone && (
                    <a href={`tel:${h.phone}`}>
                      <Button size="sm" variant="outline" className="gap-1"><Phone className="h-3 w-3" /></Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("/nearby")}>
                    <MapPin className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">{t("emergency.clickFind")}</p>
        )}
      </div>
    </div>
  );
}
