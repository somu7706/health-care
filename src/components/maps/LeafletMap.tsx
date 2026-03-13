import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createColorIcon = (color: string) =>
  new L.DivIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const icons = {
  hospital: createColorIcon("#ef4444"),
  clinic: createColorIcon("#3b82f6"),
  pharmacy: createColorIcon("#22c55e"),
  user: createColorIcon("#8b5cf6"),
  destination: createColorIcon("#f97316"),
};

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 14); }, [center, map]);
  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

export type MapPlace = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: "hospital" | "clinic" | "pharmacy";
  tags: Record<string, string>;
};

export type RouteInfo = {
  coordinates: [number, number][];
  distance: number; // meters
  duration: number; // seconds
  destinationName: string;
};

interface LeafletMapProps {
  position: [number, number];
  places: MapPlace[];
  route?: RouteInfo | null;
  onMarkerClick?: (place: MapPlace) => void;
}

export default function LeafletMap({ position, places, route, onMarkerClick }: LeafletMapProps) {
  const routeBounds = route && route.coordinates.length > 0
    ? L.latLngBounds(route.coordinates.map(c => L.latLng(c[0], c[1])))
    : null;

  return (
    <MapContainer center={position} zoom={14} className="h-[400px] w-full z-0" key={`${position[0]}-${position[1]}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {routeBounds ? <FitBounds bounds={routeBounds} /> : <FlyTo center={position} />}
      
      <Marker position={position} icon={icons.user}>
        <Popup>📍 Your Location</Popup>
      </Marker>

      {/* Route polyline */}
      {route && route.coordinates.length > 0 && (
        <Polyline
          positions={route.coordinates}
          pathOptions={{ color: "#3b82f6", weight: 5, opacity: 0.8, dashArray: "10 6" }}
        />
      )}

      {places.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lon]}
          icon={icons[p.type]}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(p) } : {}}
        >
          <Popup>
            <strong>{p.name}</strong><br />
            <span className="capitalize">{p.type}</span>
            {p.tags?.phone && <><br />{p.tags.phone}</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
