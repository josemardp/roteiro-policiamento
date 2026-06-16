import { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BlocoHorario } from "@/lib/types";
import { Compass, Navigation } from "lucide-react";

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

// Haversine formula to compute distance in km
const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth radius
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Calculate compass bearing
const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

const getBearingCardinalAndArrow = (angle: number) => {
  const directions = [
    { label: "Norte (N)", arrow: "↑" },
    { label: "Nordeste (NE)", arrow: "↗" },
    { label: "Leste (L)", arrow: "→" },
    { label: "Sudeste (SE)", arrow: "↘" },
    { label: "Sul (S)", arrow: "↓" },
    { label: "Sudoeste (SO)", arrow: "↙" },
    { label: "Oeste (O)", arrow: "←" },
    { label: "Noroeste (NO)", arrow: "↖" },
  ];
  const index = Math.round(angle / 45) % 8;
  return directions[index];
};

export default function MapaCPP({ blocos }: MapaCPPProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [userPos, setUserPos] = useState<L.LatLngLiteral | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Filter blocks with coordinates
  const blocksWithCoords = useMemo(() => {
    return blocos.filter(
      (b) => typeof b.lat === "number" && typeof b.lng === "number"
    );
  }, [blocos]);

  // Points list
  const points = useMemo(() => {
    return blocksWithCoords.map((b) => [b.lat!, b.lng!] as L.LatLngExpression);
  }, [blocksWithCoords]);

  // Next pending block (not concluded and geocoded)
  const nextPendingBlock = useMemo(() => {
    return blocos
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .find((b) => !b.concluido && typeof b.lat === "number" && typeof b.lng === "number");
  }, [blocos]);

  // Live distance/bearing
  const nextBlockInfo = useMemo(() => {
    if (!userPos || !nextPendingBlock) return null;
    const distKm = getDistanceKm(
      userPos.lat,
      userPos.lng,
      nextPendingBlock.lat!,
      nextPendingBlock.lng!
    );
    const bearing = getBearing(
      userPos.lat,
      userPos.lng,
      nextPendingBlock.lat!,
      nextPendingBlock.lng!
    );
    const direction = getBearingCardinalAndArrow(bearing);

    let formattedDist = "";
    if (distKm < 1) {
      formattedDist = `${Math.round(distKm * 1000)}m`;
    } else {
      formattedDist = `${distKm.toFixed(1)}km`;
    }

    return {
      bloco: nextPendingBlock,
      distanceStr: formattedDist,
      direction,
    };
  }, [userPos, nextPendingBlock]);

  // Geolocation tracker
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste aparelho.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsError(null);
      },
      (err) => {
        console.warn("GPS watch position error:", err);
        let msg = "GPS indisponível.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Permissão de GPS negada. Ative para se localizar no mapa.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Sinal de GPS fraco ou indisponível.";
        }
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Initialize and redraw route/blocks
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

    // Clear existing layers (except tileLayer and userMarker)
    map.eachLayer((layer) => {
      if (
        (layer instanceof L.Marker && layer !== userMarkerRef.current) ||
        layer instanceof L.Polyline
      ) {
        map.removeLayer(layer);
      }
    });

    const getModalityColor = (mod: string) => {
      switch (mod) {
        case "PREL":
        case "REL":
          return "#1e3a8a";
        case "REF":
          return "#10b981";
        case "DESL":
          return "#6b7280";
        case "POST":
          return "#ef4444";
        case "PREV":
          return "#3b82f6";
        case "PE":
          return "#f59e0b";
        case "FISC":
          return "#8b5cf6";
        case "ESC":
          return "#ec4899";
        case "RURAL":
          return "#059669";
        case "SAT":
          return "#dc2626";
        default:
          return "#4b5563";
      }
    };

    blocksWithCoords.forEach((b) => {
      const lat = b.lat!;
      const lng = b.lng!;

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
        <div style="font-family: sans-serif; font-size: 12px; min-width: 190px; padding: 2px;">
          <h4 style="margin: 0 0 5px 0; color: ${color}; font-weight: 800; font-size: 13px;">
            [${b.ordem}] ${b.modalidade} - ${b.horaInicio} às ${b.horaFim}
          </h4>
          <p style="margin: 0 0 4px 0;"><strong>Local:</strong> ${b.local}</p>
          <p style="margin: 0 0 4px 0; max-height: 60px; overflow-y: auto;"><strong>Ações:</strong> ${b.acoesPolicia}</p>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
               target="_blank" 
               rel="noopener noreferrer" 
               style="flex: 1; text-align: center; background: #0a2540; color: white; padding: 8px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              🗺️ Maps
            </a>
            <a href="waze://?ll=${lat},${lng}&navigate=yes" 
               style="flex: 1; text-align: center; background: #10b981; color: white; padding: 8px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 11px; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              🚗 Waze
            </a>
          </div>
        </div>
      `;

      L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent)
        .addTo(map);
    });

    // Draw route lines connecting sequenced locations
    if (points.length > 1) {
      L.polyline(points, {
        color: "#3b82f6",
        weight: 3.5,
        opacity: 0.75,
        dashArray: "6, 12",
      }).addTo(map);
    }

    // Zoom and center the map to fit all path coordinates
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [45, 45] });
    }
  }, [blocksWithCoords, points]);

  // Keep track of user position marker reactively
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (userPos) {
      const customUserIcon = L.divIcon({
        html: `
          <div class="gps-pulse-container">
            <div class="gps-pulse-ring"></div>
            <div class="gps-pulse-dot"></div>
          </div>
        `,
        className: "user-location-marker",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userPos);
      } else {
        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], {
          icon: customUserIcon,
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup("<strong>Você está aqui</strong><br/>Posição GPS em tempo real.");
      }
    } else {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
    }
  }, [userPos]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
      userMarkerRef.current = null;
    };
  }, []);

  const handleCentrarEmMim = () => {
    const map = leafletMap.current;
    if (map && userPos) {
      map.setView([userPos.lat, userPos.lng], 16);
    }
  };

  const handleCentrarTurno = () => {
    const map = leafletMap.current;
    if (map && points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  };

  if (blocksWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-xl p-8 text-center text-gray-500 h-96 select-none animate-fade-in">
        <span className="text-4xl mb-2">📍</span>
        <p className="font-semibold text-base text-gray-700 dark:text-white">Sem pontos geocodificados</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-sm">
          Nenhum dos locais planejados para este turno possui coordenadas geográficas cadastradas.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border border-gray-250 dark:border-slate-850 rounded-2xl overflow-hidden shadow-md bg-white dark:bg-slate-900">
      {/* Real-time distance info overlay */}
      {nextBlockInfo && (
        <div className="absolute top-2 left-2 right-12 z-[1000] bg-white/95 dark:bg-slate-900/95 border border-gray-250 dark:border-slate-800 rounded-xl p-3 shadow-md flex items-center justify-between text-xs animate-fade-in select-none">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[9px] text-gray-400 dark:text-slate-500 font-black tracking-wider uppercase leading-none mb-1">
              Próximo ponto
            </p>
            <p className="font-black text-gray-900 dark:text-white truncate">
              [{nextBlockInfo.bloco.ordem}] {nextBlockInfo.bloco.local}
            </p>
          </div>
          <div className="text-right flex-shrink-0 bg-blue-50 dark:bg-slate-850 border border-blue-100 dark:border-slate-800 px-2 py-1.5 rounded-lg">
            <span className="font-black text-blue-700 dark:text-blue-400 block text-sm leading-none">
              {nextBlockInfo.distanceStr}
            </span>
            <span className="text-[9px] text-blue-600 dark:text-blue-450 font-black flex items-center gap-0.5 justify-end mt-1">
              {nextBlockInfo.direction.arrow} {nextBlockInfo.direction.label.split(" ")[0]}
            </span>
          </div>
        </div>
      )}

      {/* Floating Centering controls */}
      <div className="absolute bottom-16 right-3.5 z-[1000] flex flex-col gap-2.5">
        {userPos && (
          <button
            onClick={handleCentrarEmMim}
            className="w-12 h-12 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full shadow-lg flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-90 transition-all cursor-pointer min-h-[48px] min-w-[48px]"
            title="Centralizar em mim"
          >
            <Compass className="w-6 h-6 animate-pulse" />
          </button>
        )}
        <button
          onClick={handleCentrarTurno}
          className="w-12 h-12 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-full shadow-lg flex items-center justify-center text-gray-750 dark:text-slate-350 active:scale-90 transition-all cursor-pointer min-h-[48px] min-w-[48px]"
          title="Ver rota completa"
        >
          <Navigation className="w-6 h-6 rotate-45" />
        </button>
      </div>

      {/* Status Warning overlay */}
      {gpsError && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[1000] bg-amber-50/95 dark:bg-amber-950/90 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5 text-[10px] text-amber-900 dark:text-amber-300 font-bold leading-normal shadow-md flex items-center gap-2 animate-fade-in select-none">
          <span className="text-sm">⚠️</span>
          <span className="flex-1">{gpsError}</span>
        </div>
      )}

      {/* Leaflet container */}
      <div ref={mapRef} className="h-[420px] w-full z-0" />

      {/* Map Legend */}
      <div className="bg-gray-50 dark:bg-slate-950 p-3.5 border-t border-gray-200 dark:border-slate-850 text-[10px] font-bold text-gray-550 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-2.5 justify-center select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1e3a8a] border border-white" /> Base/Preleção
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white" /> Refeição
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white" /> OST (POST)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white" /> PREV
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-white" /> PE
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] border border-white" /> FISC
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899] border border-white" /> ESC
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] border border-white" /> RURAL
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] border border-white" /> SAT
        </div>
      </div>
    </div>
  );
}

