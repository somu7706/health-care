import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { MapPin, Building2, Stethoscope, Pill, Loader2, Navigation, Phone, Search, X, Clock, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import type { MapPlace, RouteInfo } from "@/components/maps/LeafletMap";

const LeafletMap = lazy(() => import("@/components/maps/LeafletMap"));

const SPECIALTY_TAGS: Record<string, string[]> = {
  dentist: ["dentist", "dental"],
  cardiology: ["cardiology", "cardiologist", "heart"],
  orthopedics: ["orthopedics", "orthopaedics", "orthopedic"],
  pediatrics: ["pediatrics", "paediatrics", "pediatrician", "children"],
  gynecology: ["gynecology", "gynaecology", "obstetrics", "maternity"],
  ophthalmology: ["ophthalmology", "eye", "optometry"],
  dermatology: ["dermatology", "skin"],
  neurology: ["neurology", "neurologist", "neuro"],
  ent: ["ent", "ear", "otolaryngology"],
  generalMedicine: ["general", "general_practice", "gp"],
};

async function fetchRoute(from: [number, number], to: [number, number]): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
      );
      return {
        coordinates: coords,
        distance: route.distance,
        duration: route.duration,
        destinationName: "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

export default function NearbyCare() {
  const [position, setPosition] = useState<[number, number]>([28.6139, 77.2090]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [located, setLocated] = useState(false);
  const [manualLocation, setManualLocation] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const { t } = useI18n();

  const fetchNearby = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setRoute(null);
    setSelectedPlace(null);
    try {
      const radius = 5000;
      const query = `
        [out:json][timeout:15];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lon});
          node["amenity"="clinic"](around:${radius},${lat},${lon});
          node["amenity"="pharmacy"](around:${radius},${lat},${lon});
          node["amenity"="dentist"](around:${radius},${lat},${lon});
          node["amenity"="doctors"](around:${radius},${lat},${lon});
          node["healthcare"="doctor"](around:${radius},${lat},${lon});
          node["healthcare"="centre"](around:${radius},${lat},${lon});
        );
        out body 80;
      `;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data = await res.json();
      const mapped: MapPlace[] = (data.elements || []).map((el: any) => ({
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags?.name || el.tags?.amenity || "Unknown",
        type: el.tags?.amenity === "hospital" ? "hospital"
          : el.tags?.amenity === "pharmacy" ? "pharmacy"
            : "clinic",
        tags: el.tags || {},
      }));
      setPlaces(mapped);
    } catch {
      toast.error("Failed to fetch nearby facilities");
    } finally {
      setLoading(false);
    }
  }, []);

  const autoDetect = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        setLocated(true);
        fetchNearby(coords[0], coords[1]);
      },
      () => {
        toast.error("Location access denied");
        setLoading(false);
      }
    );
  };

  const searchManualLocation = async () => {
    if (!manualLocation.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualLocation)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        setPosition(coords);
        setLocated(true);
        toast.success(`Location: ${data[0].display_name.split(",").slice(0, 2).join(",")}`);
        fetchNearby(coords[0], coords[1]);
      } else {
        toast.error("Location not found. Try a different search term.");
      }
    } catch {
      toast.error("Failed to search location");
    } finally {
      setGeocoding(false);
    }
  };

  const navigateToPlace = async (place: MapPlace) => {
    setRouteLoading(true);
    setSelectedPlace(place);
    const routeData = await fetchRoute(position, [place.lat, place.lon]);
    if (routeData) {
      setRoute({ ...routeData, destinationName: place.name });
    } else {
      toast.error("Could not calculate route");
    }
    setRouteLoading(false);
  };

  const clearRoute = () => {
    setRoute(null);
    setSelectedPlace(null);
  };

  useEffect(() => { autoDetect(); }, []);

  const typeFiltered = filter === "all" ? places : places.filter(p => p.type === filter);
  const filtered = specialty === "all"
    ? typeFiltered
    : typeFiltered.filter(p => {
      const specTags = SPECIALTY_TAGS[specialty] || [];
      const tagStr = JSON.stringify(p.tags).toLowerCase();
      const nameStr = p.name.toLowerCase();
      return specTags.some(s => tagStr.includes(s) || nameStr.includes(s));
    });

  const hospitals = filtered.filter(p => p.type === "hospital");
  const clinics = filtered.filter(p => p.type === "clinic");
  const pharmacies = filtered.filter(p => p.type === "pharmacy");

  const PlaceCard = ({ place }: { place: MapPlace }) => {
    const isSelected = selectedPlace?.id === place.id;
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent/30"
        }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${place.type === "hospital" ? "bg-destructive/10 text-destructive" :
          place.type === "clinic" ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"
          }`}>
          {place.type === "hospital" ? <Building2 className="h-4 w-4" /> :
            place.type === "clinic" ? <Stethoscope className="h-4 w-4" /> : <Pill className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{place.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{place.type}</p>
          {place.tags?.["healthcare:speciality"] && (
            <p className="text-xs text-primary capitalize mt-0.5">{place.tags["healthcare:speciality"]}</p>
          )}
          {place.tags?.phone && (
            <a href={`tel:${place.tags.phone}`} className="text-xs text-primary flex items-center gap-1 mt-1">
              <Phone className="h-3 w-3" /> {place.tags.phone}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`tel:${place.tags?.phone || place.tags?.['contact:phone'] || ''}`}>
            <Button size="sm" variant="outline" className="gap-1 text-xs">
              <Phone className="h-3 w-3" /> Call
            </Button>
          </a>
          <Button
            size="sm"
            variant={isSelected ? "default" : "outline"}
            className="gap-1 text-xs"
            disabled={routeLoading}
            onClick={() => isSelected ? clearRoute() : navigateToPlace(place)}
          >
            {routeLoading && selectedPlace?.id === place.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isSelected ? (
              <X className="h-3 w-3" />
            ) : (
              <Navigation className="h-3 w-3" />
            )}
            {isSelected ? "Close" : "Navigate"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("nearby.title")}</h1>
        <p className="text-muted-foreground">{t("nearby.description")}</p>
      </div>

      {/* Manual Location Input */}
      <div className="border border-border rounded-xl p-4 bg-card space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          {t("nearby.manualLocation")}
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={manualLocation}
              onChange={e => setManualLocation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchManualLocation()}
              placeholder={t("nearby.manualLocationPlaceholder")}
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button onClick={searchManualLocation} disabled={geocoding || !manualLocation.trim()} className="gap-2">
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("nearby.searchLocation")}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{t("nearby.or")}</span>
          <Button variant="outline" size="sm" className="gap-2" onClick={autoDetect} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
            {located ? t("nearby.refreshLocation") : t("nearby.autoDetect")}
          </Button>
          {located && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              {position[0].toFixed(4)}, {position[1].toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {/* Route Info Banner */}
      {route && (
        <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Route className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Navigating to {route.destinationName}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Navigation className="h-3 w-3" /> {formatDistance(route.distance)}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(route.duration)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={clearRoute} className="gap-1">
            <X className="h-3 w-3" /> Close
          </Button>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("nearby.allFacilities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("nearby.allFacilities")}</SelectItem>
            <SelectItem value="hospital">{t("nearby.hospitals")}</SelectItem>
            <SelectItem value="clinic">{t("nearby.clinics")}</SelectItem>
            <SelectItem value="pharmacy">{t("nearby.pharmacies")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={specialty} onValueChange={setSpecialty}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("nearby.allSpecialties")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("nearby.allSpecialties")}</SelectItem>
            <SelectItem value="dentist">{t("nearby.dentist")}</SelectItem>
            <SelectItem value="cardiology">{t("nearby.cardiology")}</SelectItem>
            <SelectItem value="orthopedics">{t("nearby.orthopedics")}</SelectItem>
            <SelectItem value="pediatrics">{t("nearby.pediatrics")}</SelectItem>
            <SelectItem value="gynecology">{t("nearby.gynecology")}</SelectItem>
            <SelectItem value="ophthalmology">{t("nearby.ophthalmology")}</SelectItem>
            <SelectItem value="dermatology">{t("nearby.dermatology")}</SelectItem>
            <SelectItem value="neurology">{t("nearby.neurology")}</SelectItem>
            <SelectItem value="ent">{t("nearby.ent")}</SelectItem>
            <SelectItem value="generalMedicine">{t("nearby.generalMedicine")}</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} {t("nearby.allFacilities").toLowerCase()}
        </span>
      </div>

      {/* Map + List */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-xl overflow-hidden bg-card min-h-[400px]">
          <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <LeafletMap
              position={position}
              places={filtered}
              route={route}
              onMarkerClick={navigateToPlace}
            />
          </Suspense>
        </div>

        <div>
          <Tabs defaultValue="hospitals">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="hospitals" className="gap-1.5 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5" /> {t("nearby.hospitals")} ({hospitals.length})
              </TabsTrigger>
              <TabsTrigger value="clinics" className="gap-1.5 text-xs sm:text-sm">
                <Stethoscope className="h-3.5 w-3.5" /> {t("nearby.clinics")} ({clinics.length})
              </TabsTrigger>
              <TabsTrigger value="pharmacies" className="gap-1.5 text-xs sm:text-sm">
                <Pill className="h-3.5 w-3.5" /> {t("nearby.pharmacies")} ({pharmacies.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hospitals" className="mt-4 space-y-2 max-h-[340px] overflow-y-auto">
              {hospitals.length > 0 ? hospitals.map(p => <PlaceCard key={p.id} place={p} />) :
                <p className="text-center text-muted-foreground py-8">{t("nearby.noHospitals")}</p>}
            </TabsContent>
            <TabsContent value="clinics" className="mt-4 space-y-2 max-h-[340px] overflow-y-auto">
              {clinics.length > 0 ? clinics.map(p => <PlaceCard key={p.id} place={p} />) :
                <p className="text-center text-muted-foreground py-8">{t("nearby.noClinics")}</p>}
            </TabsContent>
            <TabsContent value="pharmacies" className="mt-4 space-y-2 max-h-[340px] overflow-y-auto">
              {pharmacies.length > 0 ? pharmacies.map(p => <PlaceCard key={p.id} place={p} />) :
                <p className="text-center text-muted-foreground py-8">{t("nearby.noPharmacies")}</p>}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
