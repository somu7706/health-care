import { useState, useCallback, useEffect } from "react";
import { Search, Stethoscope, Phone, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

type Doctor = {
  id: number;
  name: string;
  specialty: string;
  lat: number;
  lon: number;
  phone?: string;
  tags: Record<string, string>;
};

export default function FindDoctors() {
  const [query, setQuery] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { t } = useI18n();

  const searchDoctors = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      ).catch(() => null);

      const lat = pos?.coords.latitude || 28.6139;
      const lon = pos?.coords.longitude || 77.2090;
      const radius = 10000;

      const overpassQuery = `
        [out:json][timeout:15];
        (
          node["amenity"="doctors"](around:${radius},${lat},${lon});
          node["healthcare"="doctor"](around:${radius},${lat},${lon});
          node["amenity"="clinic"](around:${radius},${lat},${lon});
        );
        out body 30;
      `;

      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();

      const mapped: Doctor[] = (data.elements || []).map((el: any) => ({
        id: el.id,
        name: el.tags?.name || "Medical Clinic",
        specialty: el.tags?.["healthcare:speciality"] || el.tags?.amenity || "General",
        lat: el.lat,
        lon: el.lon,
        phone: el.tags?.phone || el.tags?.["contact:phone"],
        tags: el.tags || {},
      }));

      const filtered = query.trim()
        ? mapped.filter(d =>
            d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.specialty.toLowerCase().includes(query.toLowerCase())
          )
        : mapped;

      setDoctors(filtered);
    } catch {
      toast.error("Failed to search doctors");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { searchDoctors(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("doctors.title")}</h1>
        <p className="text-muted-foreground">{t("doctors.description")}</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchDoctors()}
            placeholder={t("doctors.searchPlaceholder")}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button onClick={searchDoctors} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("common.search")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : doctors.length > 0 ? (
        <div className="space-y-4">
          {doctors.map((doc) => (
            <div key={doc.id} className="border border-border rounded-xl p-5 bg-card flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-feature-doctor flex items-center justify-center shrink-0">
                  <Stethoscope className="h-5 w-5 text-feature-doctor-icon" />
                </div>
                <div>
                  <h3 className="font-semibold">{doc.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{doc.specialty}</p>
                  {doc.tags?.opening_hours && (
                    <p className="text-xs text-muted-foreground mt-0.5">Hours: {doc.tags.opening_hours}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.phone && (
                  <a href={`tel:${doc.phone}`}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <Phone className="h-3 w-3" /> {t("doctors.call")}
                    </Button>
                  </a>
                )}
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${doc.lat},${doc.lon}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1">
                    <Navigation className="h-3 w-3" /> {t("doctors.directions")}
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : searched ? (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("doctors.noResults")}</p>
          <p className="text-sm mt-1">{t("doctors.noResultsDesc")}</p>
        </div>
      ) : null}
    </div>
  );
}
