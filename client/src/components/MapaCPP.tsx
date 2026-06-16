import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BlocoHorario } from "@/lib/types";

// Fix for default marker icon issue in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapaCPPProps {
  blocos: BlocoHorario[];
}

export default function MapaCPP({ blocos }: MapaCPPProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  // Filter blocks with coordinates
  const blocksWithCoords = blocos.filter(
    (b) => typeof b.lat === "number" && typeof b.lng === "number"
  );

  useEffect(() => {
    if (!mapRef.current) return;
    if (blocksWithCoords.length === 0) return;

    // Initialize map
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(leafletMap.current);
    }

    const map = leafletMap.current;

    // Clear existing layers (except tileLayer)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const getModalityColor = (mod: string) => {
      switch (mod) {
        case "PREL":
        case "REL":
          return "#1e3a8a"; // Navy Blue
        case "REF":
          return "#10b981"; // Green
        case "DESL":
          return "#6b7280"; // Gray
        case "POST":
          return "#ef4444"; // Red
        case "PREV":
          return "#3b82f6"; // Blue
        case "PE":
          return "#f59e0b"; // Orange/Yellow
        case "FISC":
          return "#8b5cf6"; // Purple
        case "ESC":
          return "#ec4899"; // Pink
        case "RURAL":
          return "#059669"; // Dark Green
        case "SAT":
          return "#dc2626"; // Crimson
        default:
          return "#4b5563";
      }
    };

    const points: L.LatLngExpression[] = [];

    blocksWithCoords.forEach((b) => {
      const lat = b.lat!;
      const lng = b.lng!;
      points.push([lat, lng]);

      const color = getModalityColor(b.modalidade);
      const isBase = b.modalidade === "PREL" || b.modalidade === "REL";
      const markerText = isBase ? "⭐" : String(b.ordem);

      const customIcon = L.divIcon({
        html: `<div style="
          background-color: ${color};
          color: white;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${markerText}</div>`,
        className: "custom-leaflet-marker",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const popupContent = `
        <div style="font-family: sans-serif; font-size: 13px; min-width: 180px;">
          <h4 style="margin: 0 0 5px 0; color: ${color}; font-weight: bold;">
            [${b.ordem}] ${b.modalidade} - ${b.horaInicio} às ${b.horaFim}
          </h4>
          <p style="margin: 0 0 5px 0;"><strong>Local:</strong> ${b.local}</p>
          <p style="margin: 0 0 5px 0;"><strong>Problema:</strong> ${b.problemaSolucionar}</p>
          <p style="margin: 0;"><strong>Ações:</strong> ${b.acoesPolicia}</p>
        </div>
      `;

      L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent)
        .addTo(map);
    });

    // Draw route lines connecting sequenced locations
    if (points.length > 1) {
      L.polyline(points, {
        color: "#1e3a8a",
        weight: 3,
        opacity: 0.7,
        dashArray: "5, 10",
      }).addTo(map);
    }

    // Zoom and center the map to fit all path coordinates
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [blocksWithCoords]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  if (blocksWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500 h-96">
        <span className="text-4xl mb-2">📍</span>
        <p className="font-semibold text-base">Sem pontos geocodificados</p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">
          Nenhum dos locais planejados para este turno possui coordenadas geográficas cadastradas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
      <div ref={mapRef} className="h-[400px] w-full z-0" />
      {/* Map Legend */}
      <div className="bg-gray-50 p-3 border-t border-gray-200 text-xs flex flex-wrap gap-x-4 gap-y-2 justify-center">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#1e3a8a]" /> Base/Preleção
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#10b981]" /> Refeição
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#ef4444]" /> OST (POST)
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#3b82f6]" /> PREV
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> PE
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#8b5cf6]" /> FISC
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#ec4899]" /> ESC
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#059669]" /> RURAL
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#dc2626]" /> SAT
        </div>
      </div>
    </div>
  );
}
