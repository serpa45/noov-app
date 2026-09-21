import { useEffect, useState, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "@/lib/mapbox";

mapboxgl.accessToken = MAPBOX_TOKEN;

export interface NavigationStep {
  instruction: string;
  distance: string;
  modifier?: string;
  type?: string;
}

interface TrackingMapProps {
  driverLoc: [number, number] | null;
  customerLoc: [number, number] | null;
  storeLoc?: [number, number] | null;
  mode?: "customer" | "driver";
  driverName?: string | null;
  driverPhoto?: string | null;
  storeLogo?: string | null;
  driverSpeed?: number;
  simulationMode?: boolean;
  onRouteInfo?: (info: { distance: string; duration: string; steps?: NavigationStep[] }) => void;
}

// Calculate bearing between two points [lat,lng]
const calcBearing = (from: [number, number], to: [number, number]): number => {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(toRad(to[0]));
  const x = Math.cos(toRad(from[0])) * Math.sin(toRad(to[0])) - Math.sin(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const snapToRoute = (point: [number, number], route: [number, number][]): { snapped: [number, number]; bearing: number; segmentIndex: number } => {
  if (route.length < 2) return { snapped: point, bearing: 0, segmentIndex: 0 };
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371000;
  let minDist = Infinity;
  let bestPoint: [number, number] = point;
  let bestIdx = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [lat1, lon1] = route[i];
    const [lat2, lon2] = route[i + 1];
    const [pLat, pLon] = point;
    const dLat1 = (pLat - lat1) * R * toRad(1);
    const dLon1 = (pLon - lon1) * R * toRad(1) * Math.cos(toRad(lat1));
    const dLat2 = (lat2 - lat1) * R * toRad(1);
    const dLon2 = (lon2 - lon1) * R * toRad(1) * Math.cos(toRad(lat1));
    const segLen2 = dLat2 * dLat2 + dLon2 * dLon2;
    let t = 0;
    if (segLen2 > 0) t = Math.max(0, Math.min(1, (dLat1 * dLat2 + dLon1 * dLon2) / segLen2));
    const projLat = lat1 + t * (lat2 - lat1);
    const projLon = lon1 + t * (lon2 - lon1);
    const dx = (pLat - projLat) * R * toRad(1);
    const dy = (pLon - projLon) * R * toRad(1) * Math.cos(toRad(pLat));
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) { minDist = d; bestPoint = [projLat, projLon]; bestIdx = i; }
  }
  const lookAheadDist = 50;
  let accumulated = 0;
  let lookAheadIdx = bestIdx;
  for (let i = bestIdx; i < route.length - 1; i++) {
    const segDist = Math.sqrt(
      ((route[i + 1][0] - route[i][0]) * R * toRad(1)) ** 2 +
      ((route[i + 1][1] - route[i][1]) * R * toRad(1) * Math.cos(toRad(route[i][0]))) ** 2
    );
    accumulated += segDist;
    lookAheadIdx = i + 1;
    if (accumulated >= lookAheadDist) break;
  }
  const bearing = calcBearing(route[bestIdx], route[Math.min(lookAheadIdx, route.length - 1)]);
  return { snapped: bestPoint, bearing, segmentIndex: bestIdx };
};

const lerpAngle = (from: number, to: number, t: number): number => {
  let diff = ((to - from + 540) % 360) - 180;
  return ((from + diff * t) + 360) % 360;
};

const distanceToRoute = (point: [number, number], route: [number, number][]): number => {
  if (route.length === 0) return Infinity;
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371000;
  let minDist = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const [lat1, lon1] = route[i];
    const [lat2, lon2] = route[i + 1];
    const [pLat, pLon] = point;
    const dLat1 = (pLat - lat1) * R * toRad(1);
    const dLon1 = (pLon - lon1) * R * toRad(1) * Math.cos(toRad(lat1));
    const dLat2 = (lat2 - lat1) * R * toRad(1);
    const dLon2 = (lon2 - lon1) * R * toRad(1) * Math.cos(toRad(lat1));
    const segLen2 = dLat2 * dLat2 + dLon2 * dLon2;
    if (segLen2 === 0) {
      const d = Math.sqrt(dLat1 * dLat1 + dLon1 * dLon1);
      if (d < minDist) minDist = d;
      continue;
    }
    let t = (dLat1 * dLat2 + dLon1 * dLon2) / segLen2;
    t = Math.max(0, Math.min(1, t));
    const projLat = t * dLat2;
    const projLon = t * dLon2;
    const d = Math.sqrt((dLat1 - projLat) ** 2 + (dLon1 - projLon) ** 2);
    if (d < minDist) minDist = d;
  }
  return minDist;
};

function falar(instrucao: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(instrucao);
  msg.lang = "pt-BR";
  msg.rate = 1.1;
  window.speechSynthesis.speak(msg);
}

// Create marker elements
function createDriverEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "driver-marker-mapbox";
  el.innerHTML = `<div style="position:relative;width:32px;height:32px">
    <div style="width:32px;height:32px;background:#2563eb;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(37,99,235,0.5)">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
    </div>
    <div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%)">
      <svg width="8" height="5" viewBox="0 0 12 8" fill="#2563eb"><polygon points="6,0 12,8 0,8"/></svg>
    </div>
  </div>`;
  el.style.width = "32px";
  el.style.height = "32px";
  return el;
}

function createCustomerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `<div style="width:32px;height:32px;background:#22c55e;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
  </div>`;
  el.style.width = "32px";
  el.style.height = "32px";
  return el;
}

function createStoreEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `<div style="width:32px;height:32px;background:#f97316;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
  </div>`;
  el.style.width = "32px";
  el.style.height = "32px";
  return el;
}

export const TrackingMap = ({
  driverLoc: externalDriverLoc,
  customerLoc: externalCustomerLoc,
  storeLoc: externalStoreLoc,
  mode = "customer",
  driverName,
  driverSpeed,
  simulationMode = false,
  onRouteInfo,
}: TrackingMapProps) => {
  const SIM_STORE: [number, number] = [-23.5505, -46.6333];
  const SIM_CUSTOMER: [number, number] = [-23.5605, -46.6200];
  const [simDriverPos, setSimDriverPos] = useState<[number, number]>(SIM_STORE);
  const [simRunning, setSimRunning] = useState(false);
  const [simRouteCoords, setSimRouteCoords] = useState<[number, number][]>([]);
  const simStepRef = useRef(0);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const driverLoc = simulationMode ? simDriverPos : externalDriverLoc;
  const customerLoc = simulationMode ? SIM_CUSTOMER : externalCustomerLoc;
  const storeLoc = simulationMode && !simRunning ? SIM_STORE : (simulationMode ? null : externalStoreLoc);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const storeMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [heading, setHeading] = useState(0);
  const [status, setStatus] = useState<"parado" | "em movimento">("parado");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const smoothHeading = useRef(0);
  const lastDriverLoc = useRef<[number, number] | null>(null);
  const lastFetchKey = useRef("");
  const lastFetchTime = useRef(0);
  const lastInstructionRef = useRef("");
  const onRouteInfoRef = useRef(onRouteInfo);
  onRouteInfoRef.current = onRouteInfo;

  const isDriverMode = mode === "driver";
  const isNight = (() => { const h = new Date().getHours(); return h >= 18 || h < 6; })();

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const center: [number, number] = driverLoc
      ? [driverLoc[1], driverLoc[0]]
      : storeLoc
      ? [storeLoc[1], storeLoc[0]]
      : customerLoc
      ? [customerLoc[1], customerLoc[0]]
      : [-46.6333, -23.5505];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: isNight ? "mapbox://styles/mapbox/navigation-night-v1" : "mapbox://styles/mapbox/streets-v12",
      center,
      zoom: isDriverMode ? 18 : 15,
      attributionControl: false,
      pitch: isDriverMode ? 60 : 0,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Status detection
  useEffect(() => {
    if (driverSpeed !== undefined) {
      setStatus(driverSpeed < 2 ? "parado" : "em movimento");
    }
  }, [driverSpeed]);

  // Heading from route snap
  useEffect(() => {
    if (!isDriverMode || !driverLoc) return;
    if (lastDriverLoc.current) {
      const dlat = (driverLoc[0] - lastDriverLoc.current[0]) * 111320;
      const dlng = (driverLoc[1] - lastDriverLoc.current[1]) * 111320 * Math.cos(driverLoc[0] * Math.PI / 180);
      if (Math.sqrt(dlat * dlat + dlng * dlng) < 3) return;
    }
    lastDriverLoc.current = driverLoc;
    if (routeCoords.length >= 2) {
      const { bearing } = snapToRoute(driverLoc, routeCoords);
      const smoothed = lerpAngle(smoothHeading.current, bearing, 0.2);
      smoothHeading.current = smoothed;
      setHeading(smoothed);
    }
  }, [driverLoc, isDriverMode, routeCoords]);

  // Update markers & camera
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Driver marker
    if (driverLoc) {
      const lngLat: [number, number] = [driverLoc[1], driverLoc[0]];
      // Driver mode: map rotates → marker fixed pointing up (viewport alignment, rotation 0)
      // Customer mode: map static → marker rotates to show direction (map alignment)
      const markerRotation = isDriverMode ? 0 : heading;
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLngLat(lngLat);
        driverMarkerRef.current.setRotation(markerRotation);
      } else {
        driverMarkerRef.current = new mapboxgl.Marker({
          element: createDriverEl(),
          rotation: markerRotation,
          rotationAlignment: isDriverMode ? "viewport" : "map",
          pitchAlignment: isDriverMode ? "viewport" : "map",
        })
          .setLngLat(lngLat)
          .addTo(map);
      }

      // Camera follow
      if (isDriverMode && autoFollow) {
        let targetZoom = 18;
        const spd = driverSpeed || 0;
        if (spd > 60) targetZoom = 16;
        else if (spd > 20) targetZoom = 17;
        map.easeTo({
          center: lngLat,
          zoom: targetZoom,
          bearing: heading,
          pitch: 60,
          duration: 800,
          easing: (t) => t * (2 - t),
        });
      }
    }

    // Customer marker
    if (customerLoc) {
      const lngLat: [number, number] = [customerLoc[1], customerLoc[0]];
      if (customerMarkerRef.current) {
        customerMarkerRef.current.setLngLat(lngLat);
      } else {
        customerMarkerRef.current = new mapboxgl.Marker({ element: createCustomerEl() })
          .setLngLat(lngLat)
          .addTo(map);
      }
    }

    // Store marker
    if (storeLoc) {
      const lngLat: [number, number] = [storeLoc[1], storeLoc[0]];
      if (storeMarkerRef.current) {
        storeMarkerRef.current.setLngLat(lngLat);
      } else {
        storeMarkerRef.current = new mapboxgl.Marker({ element: createStoreEl() })
          .setLngLat(lngLat)
          .addTo(map);
      }
    } else if (storeMarkerRef.current) {
      storeMarkerRef.current.remove();
      storeMarkerRef.current = null;
    }

    // Customer mode: fit bounds
    if (!isDriverMode) {
      const points: [number, number][] = [];
      if (driverLoc) points.push([driverLoc[1], driverLoc[0]]);
      if (customerLoc) points.push([customerLoc[1], customerLoc[0]]);
      if (storeLoc) points.push([storeLoc[1], storeLoc[0]]);
      if (points.length >= 2) {
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { padding: 50, animate: true });
      }
    }
  }, [driverLoc, customerLoc, storeLoc, heading, isDriverMode, autoFollow, driverSpeed]);

  // Route fetching
  const routeFrom = driverLoc || storeLoc;
  const routeTo = customerLoc;

  useEffect(() => {
    if (!routeFrom || !routeTo) return;
    const key = `${routeFrom[0].toFixed(3)},${routeFrom[1].toFixed(3)}-${routeTo[0].toFixed(3)},${routeTo[1].toFixed(3)}`;
    const now = Date.now();
    if (key === lastFetchKey.current && now - lastFetchTime.current < 30000) return;
    lastFetchKey.current = key;
    lastFetchTime.current = now;

    const url = `https://router.project-osrm.org/route/v1/driving/${routeFrom[1]},${routeFrom[0]};${routeTo[1]},${routeTo[0]}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const routeData = data?.routes?.[0];
        if (!routeData) return;

        const coords: [number, number][] = routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        setRouteCoords(coords);

        const distance = (routeData.distance / 1000).toFixed(1) + " km";
        const duration = Math.ceil(routeData.duration / 60) + " min";
        setRouteDistance(distance);
        setRouteDuration(duration);

        const steps: NavigationStep[] = [];
        for (const leg of routeData.legs || []) {
          for (const step of leg?.steps || []) {
            if (!step?.maneuver || step.distance <= 5) continue;
            const mod = step.maneuver.modifier || "";
            const type = step.maneuver.type || "";
            const name = step.name || "";
            const modMap: Record<string, string> = {
              left: "à esquerda", right: "à direita",
              "sharp left": "acentuada à esquerda", "sharp right": "acentuada à direita",
              "slight left": "levemente à esquerda", "slight right": "levemente à direita",
              straight: "em frente", uturn: "retorno",
            };
            const modText = modMap[mod] || mod;
            let instruction = "";
            if (type === "depart") instruction = `Siga ${modText || "em frente"}${name ? ` na ${name}` : ""}`;
            else if (type === "arrive") instruction = "Você chegou ao destino";
            else if (type === "turn") instruction = `Vire ${modText}${name ? ` na ${name}` : ""}`;
            else instruction = `Continue ${modText}${name ? ` na ${name}` : ""}`;
            const stepDist = step.distance >= 1000 ? (step.distance / 1000).toFixed(1) + " km" : Math.round(step.distance) + " m";
            steps.push({ instruction, distance: stepDist, modifier: mod, type });
          }
        }

        if (isDriverMode && steps.length > 0 && steps[0].instruction !== lastInstructionRef.current) {
          falar(steps[0].instruction);
          lastInstructionRef.current = steps[0].instruction;
        }

        onRouteInfoRef.current?.({ distance, duration, steps });

        // Draw route on map
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        // Build traveled + remaining segments
        const { snapped, segmentIndex } = snapToRoute(routeFrom, coords);
        const traveled = [...coords.slice(0, segmentIndex + 1), snapped];
        const remaining = [snapped, ...coords.slice(segmentIndex + 1)];

        const traveledGeo: GeoJSON.Feature = {
          type: "Feature", properties: {},
          geometry: { type: "LineString", coordinates: traveled.map(c => [c[1], c[0]]) },
        };
        const remainingGeo: GeoJSON.Feature = {
          type: "Feature", properties: {},
          geometry: { type: "LineString", coordinates: remaining.map(c => [c[1], c[0]]) },
        };

        if (map.getSource("route-traveled")) {
          (map.getSource("route-traveled") as mapboxgl.GeoJSONSource).setData(traveledGeo);
          (map.getSource("route-remaining") as mapboxgl.GeoJSONSource).setData(remainingGeo);
        } else {
          map.addSource("route-traveled", { type: "geojson", data: traveledGeo });
          map.addLayer({
            id: "route-traveled", type: "line", source: "route-traveled",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#9ca3af", "line-width": 4, "line-opacity": 0.4, "line-dasharray": [2, 3] },
          });
          map.addSource("route-remaining", { type: "geojson", data: remainingGeo });
          map.addLayer({
            id: "route-remaining", type: "line", source: "route-remaining",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.85 },
          });
        }
      })
      .catch(err => { if (err?.name !== "AbortError") lastFetchKey.current = ""; });

    return () => controller.abort();
  }, [routeFrom?.[0], routeFrom?.[1], routeTo?.[0], routeTo?.[1], isDriverMode]);

  // Off-route recalculation
  useEffect(() => {
    if (!routeFrom || routeCoords.length <= 1) return;
    const dist = distanceToRoute(routeFrom, routeCoords);
    if (dist <= 80) return;
    lastFetchKey.current = "";
    lastFetchTime.current = 0;
  }, [routeFrom?.[0], routeFrom?.[1], routeCoords]);

  // Simulation
  const startSimulation = useCallback(async () => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${SIM_STORE[1]},${SIM_STORE[0]};${SIM_CUSTOMER[1]},${SIM_CUSTOMER[0]}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.routes?.[0]) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        setSimRouteCoords(coords);
        simStepRef.current = 0;
        setSimDriverPos(coords[0]);
        setSimRunning(true);
      }
    } catch {
      const coords: [number, number][] = [];
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        coords.push([
          SIM_STORE[0] + (SIM_CUSTOMER[0] - SIM_STORE[0]) * t,
          SIM_STORE[1] + (SIM_CUSTOMER[1] - SIM_STORE[1]) * t,
        ]);
      }
      setSimRouteCoords(coords);
      simStepRef.current = 0;
      setSimDriverPos(coords[0]);
      setSimRunning(true);
    }
  }, []);

  useEffect(() => {
    if (!simRunning || !Array.isArray(simRouteCoords) || simRouteCoords.length === 0) return;
    simIntervalRef.current = setInterval(() => {
      simStepRef.current += 1;
      if (simStepRef.current >= simRouteCoords.length) {
        setSimRunning(false);
        simStepRef.current = 0;
        setSimDriverPos(SIM_STORE);
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        return;
      }
      setSimDriverPos(simRouteCoords[simStepRef.current]);
    }, 500);
    return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); };
  }, [simRunning, simRouteCoords]);

  const shouldUseNavigationCamera = isDriverMode && autoFollow && !!driverLoc;

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-border/50 shadow-card bg-muted relative">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Fixed driver icon overlay for nav mode */}
      {shouldUseNavigationCamera && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2">
          <div style={{ position: "relative", width: 32, height: 32 }}>
            <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: "50%", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(37,99,235,0.5)" }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)" }}>
              <svg width="8" height="5" viewBox="0 0 12 8" fill="#2563eb"><polygon points="6,0 12,8 0,8"/></svg>
            </div>
            <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-25" />
          </div>
        </div>
      )}

      {/* Route info overlay */}
      {(routeDistance || routeDuration) && (
        <div className="absolute top-[4.5rem] right-3 z-[1000] pointer-events-none flex flex-col items-end gap-2">
          {isDriverMode && (
            <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm border ${
              status === "parado"
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : "bg-green-100 text-green-700 border-green-200"
            }`}>
              {status}
            </div>
          )}
          <div className="bg-background/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-border/50 flex items-center gap-2.5">
            <div className="flex flex-col items-center min-w-[35px]">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">Km</span>
              <span className="text-xs font-black text-primary -mt-0.5">{routeDistance || "—"}</span>
            </div>
            <div className="w-[1px] h-5 bg-border/40" />
            <div className="flex flex-col items-center min-w-[45px]">
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">Tempo</span>
              <span className="text-xs font-black text-primary -mt-0.5">{routeDuration || "—"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-follow toggle */}
      {mode === "driver" && driverLoc && (
        <div className="absolute bottom-16 left-3 z-[1000] flex flex-col gap-2">
          <button
            className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center transition-all active:scale-90 ${
              autoFollow ? "bg-primary text-primary-foreground border-primary" : "bg-background/90 text-foreground border-border/50"
            }`}
            onClick={() => setAutoFollow(prev => !prev)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3 9L15 3l3 9h4"/></svg>
          </button>
        </div>
      )}

      {/* Simulation controls */}
      {simulationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            className={`px-5 py-2.5 rounded-full shadow-lg border border-border/50 text-sm font-bold transition-all active:scale-95 flex items-center gap-2 ${
              simRunning ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
            onClick={() => {
              if (simRunning) {
                setSimRunning(false);
                simStepRef.current = 0;
                setSimDriverPos(SIM_STORE);
                if (simIntervalRef.current) clearInterval(simIntervalRef.current);
              } else {
                startSimulation();
              }
            }}
          >
            {simRunning ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Parar Simulação
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                Simular Entrega
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
