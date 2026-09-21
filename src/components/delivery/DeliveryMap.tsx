import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { supabase } from "@/integrations/supabase/client";
import { Maximize2, Minimize2, Navigation, Clock, MapPin } from "lucide-react";

mapboxgl.accessToken = MAPBOX_TOKEN;

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function estimateArrival(durationText?: string): string {
  if (!durationText) return "--:--";
  const mins = parseInt(durationText) || 0;
  const arrival = new Date(Date.now() + mins * 60000);
  return arrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Find the closest point index on the route to a given lat/lng */
function findClosestPointIndex(coords: [number, number][], lng: number, lat: number): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - lng;
    const dy = coords[i][1] - lat;
    const d = dx * dx + dy * dy;
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return minIdx;
}

interface DeliveryMapProps {
  driverLat?: number | null;
  driverLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  destAddress?: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  showBottomBar?: boolean;
  onRouteInfo?: (info: { distance?: string; duration?: string }) => void;
  fitToRoute?: boolean;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({ driverLat, driverLng, destLat, destLng, fullscreen, onToggleFullscreen, showBottomBar = true, onRouteInfo, fitToRoute = false }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance?: string; duration?: string } | null>(null);
  const lastFetch = useRef(0);
  const prevDriver = useRef<{ lat: number; lng: number } | null>(null);
  const currentBearing = useRef(0);
  const isUserInteracting = useRef(false);
  const interactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeCoords = useRef<[number, number][]>([]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const initLat = driverLat || -15.78;
    const initLng = driverLng || -47.93;
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [initLng, initLat],
      zoom: 17,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      touchZoomRotate: true,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("dragstart", () => {
      isUserInteracting.current = true;
      if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    });
    map.on("dragend", () => {
      interactionTimeout.current = setTimeout(() => {
        isUserInteracting.current = false;
      }, 5000);
    });

    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Update bearing from movement AND rotate the marker arrow to point along route
  useEffect(() => {
    if (driverLat && driverLng && prevDriver.current) {
      const bearing = calculateBearing(prevDriver.current.lat, prevDriver.current.lng, driverLat, driverLng);
      const dist = Math.sqrt(
        Math.pow((driverLat - prevDriver.current.lat) * 111320, 2) +
        Math.pow((driverLng - prevDriver.current.lng) * 111320 * Math.cos(driverLat * Math.PI / 180), 2)
      );
      if (dist > 2) {
        if (routeCoords.current.length > 1) {
          const idx = findClosestPointIndex(routeCoords.current, driverLng, driverLat);
          // Look a few points ahead for a smoother bearing
          const lookAhead = Math.min(idx + 3, routeCoords.current.length - 1);
          if (lookAhead > idx) {
            currentBearing.current = calculateBearing(
              routeCoords.current[idx][1], routeCoords.current[idx][0],
              routeCoords.current[lookAhead][1], routeCoords.current[lookAhead][0]
            );
          } else {
            currentBearing.current = bearing;
          }
        } else {
          currentBearing.current = bearing;
        }
      }
    }
    if (driverLat && driverLng) {
      prevDriver.current = { lat: driverLat, lng: driverLng };
    }
  }, [driverLat, driverLng]);

  // Update markers, camera, and traveled/remaining route
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Driver marker
    if (driverLat && driverLng) {
      // fitToRoute: map doesn't rotate → marker rotates on map to show direction
      // driver mode: map rotates with bearing → marker fixed pointing up on screen
      const useViewportAlignment = !fitToRoute;
      const markerRotation = fitToRoute ? currentBearing.current : 0;

      if (driverMarker.current) {
        driverMarker.current.setLngLat([driverLng, driverLat]);
        driverMarker.current.setRotation(markerRotation);
      } else {
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.4))">
            <div style="width:44px;height:44px;background:radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 65%);border-radius:50%;position:absolute;animation:pulse-ring 2s ease-out infinite"></div>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:relative;z-index:2;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#3B82F6" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>`;
        el.style.width = "48px";
        el.style.height = "48px";

        const style = document.createElement("style");
        style.textContent = `@keyframes pulse-ring{0%{transform:scale(0.8);opacity:1}100%{transform:scale(1.6);opacity:0}}`;
        document.head.appendChild(style);

        driverMarker.current = new mapboxgl.Marker({
          element: el,
          rotationAlignment: useViewportAlignment ? "viewport" : "map",
          pitchAlignment: useViewportAlignment ? "viewport" : "map",
        })
          .setLngLat([driverLng, driverLat])
          .setRotation(markerRotation)
          .addTo(map);
      }

      // Split route into traveled (gray) and remaining (blue)
      if (routeCoords.current.length > 1) {
        const idx = findClosestPointIndex(routeCoords.current, driverLng, driverLat);
        const traveled = routeCoords.current.slice(0, idx + 1);
        // Add driver position as last point of traveled
        traveled.push([driverLng, driverLat]);
        const remaining = [[driverLng, driverLat] as [number, number], ...routeCoords.current.slice(idx + 1)];

        if (map.isStyleLoaded()) {
          // Update traveled route (gray)
          const traveledGeo: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: traveled } };
          if (map.getSource("route-traveled")) {
            (map.getSource("route-traveled") as mapboxgl.GeoJSONSource).setData(traveledGeo);
          }

          // Update remaining route (blue)
          const remainingGeo: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: remaining } };
          if (map.getSource("route")) {
            (map.getSource("route") as mapboxgl.GeoJSONSource).setData(remainingGeo);
          }
        }
      }

      // Camera behavior
      if (!isUserInteracting.current) {
        if (fitToRoute && destLat && destLng) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([driverLng, driverLat]);
          bounds.extend([destLng!, destLat!]);
          map.fitBounds(bounds, {
            padding: { top: 60, bottom: 80, left: 40, right: 40 },
            duration: 800,
            maxZoom: 15,
          });
        } else {
          map.easeTo({
            center: [driverLng, driverLat],
            bearing: currentBearing.current,
            pitch: 0,
            zoom: 17,
            duration: 800,
            easing: (t) => t * (2 - t),
          });
        }
      }
    }

    // Dest marker
    if (destLat && destLng) {
      if (destMarker.current) {
        destMarker.current.setLngLat([destLng, destLat]);
      } else {
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:36px;height:36px;background:#EF4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg></div>`;
        el.style.width = "36px";
        el.style.height = "36px";
        destMarker.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([destLng, destLat])
          .addTo(map);
      }
    }

    // Fetch route
    const now = Date.now();
    if (driverLat && driverLng && destLat && destLng && now - lastFetch.current > 10000) {
      lastFetch.current = now;
      supabase.functions.invoke("distancematrix-directions", {
        body: { origin_lat: driverLat, origin_lng: driverLng, dest_lat: destLat, dest_lng: destLng },
      }).then(({ data }) => {
        if (data?.polyline && map.isStyleLoaded()) {
          const coords = decodePolyline(data.polyline);
          routeCoords.current = coords;

          // Calculate bearing from route on first load
          const idx = findClosestPointIndex(coords, driverLng, driverLat);
          const nextIdx = Math.min(idx + 1, coords.length - 1);
          if (nextIdx > idx) {
            const routeBearing = calculateBearing(
              coords[idx][1], coords[idx][0],
              coords[nextIdx][1], coords[nextIdx][0]
            );
            currentBearing.current = routeBearing;
            // Update marker rotation immediately
            if (driverMarker.current && fitToRoute) {
              driverMarker.current.setRotation(routeBearing);
            }
          }

          // Split into traveled and remaining
          const traveled = [...coords.slice(0, idx + 1), [driverLng, driverLat] as [number, number]];
          const remaining = [[driverLng, driverLat] as [number, number], ...coords.slice(idx + 1)];

          const traveledGeo: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: traveled } };
          const remainingGeo: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: remaining } };

          // Traveled route (gray)
          if (map.getSource("route-traveled")) {
            (map.getSource("route-traveled") as mapboxgl.GeoJSONSource).setData(traveledGeo);
          } else {
            map.addSource("route-traveled", { type: "geojson", data: traveledGeo });
            map.addLayer({
              id: "route-traveled-glow",
              type: "line",
              source: "route-traveled",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#6B7280", "line-width": 10, "line-opacity": 0.15, "line-blur": 3 },
            });
            map.addLayer({
              id: "route-traveled",
              type: "line",
              source: "route-traveled",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#9CA3AF", "line-width": 5, "line-opacity": 0.6 },
            });
          }

          // Remaining route (blue)
          if (map.getSource("route")) {
            (map.getSource("route") as mapboxgl.GeoJSONSource).setData(remainingGeo);
          } else {
            map.addSource("route", { type: "geojson", data: remainingGeo });
            map.addLayer({
              id: "route-glow",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#2563EB", "line-width": 12, "line-opacity": 0.2, "line-blur": 4 },
            });
            map.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#3B82F6", "line-width": 6, "line-opacity": 0.9 },
            });
          }
        }
        if (data?.distance || data?.duration) {
          const info = { distance: data.distance?.text, duration: data.duration?.text };
          setRouteInfo(info);
          onRouteInfo?.(info);
        }
      }).catch(() => {});
    }
  }, [driverLat, driverLng, destLat, destLng]);

  // Resize on fullscreen change
  useEffect(() => {
    setTimeout(() => mapInstance.current?.resize(), 300);
  }, [fullscreen]);

  const handleRecenter = () => {
    isUserInteracting.current = false;
    if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
    const map = mapInstance.current;
    if (map && driverLat && driverLng) {
      map.easeTo({
        center: [driverLng, driverLat],
        bearing: currentBearing.current,
        pitch: 0,
        zoom: 17,
        duration: 600,
      });
    }
  };

  const arrivalTime = estimateArrival(routeInfo?.duration);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border/40">
      <div ref={mapRef} className={`w-full ${fullscreen ? "h-full min-h-[100vh]" : "h-48"} transition-all`} style={{ overflow: "hidden" }} />

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className="w-10 h-10 bg-background/90 backdrop-blur-md rounded-xl border border-border/40 shadow-lg flex items-center justify-center active:scale-90 transition-transform"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4 text-foreground" /> : <Maximize2 className="w-4 h-4 text-foreground" />}
          </button>
        )}
        {isUserInteracting.current && (
          <button
            onClick={handleRecenter}
            className="w-10 h-10 bg-primary/90 backdrop-blur-md rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-transform"
          >
            <Navigation className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {showBottomBar && routeInfo && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-md rounded-xl border border-border/40 shadow-lg px-4 py-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[9px] text-muted-foreground leading-none">Tempo</p>
                <p className="font-bold text-foreground">{routeInfo.duration || "--"}</p>
              </div>
            </div>
            <div className="w-px h-6 bg-border/60" />
            <div className="flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[9px] text-muted-foreground leading-none">Distância</p>
                <p className="font-bold text-foreground">{routeInfo.distance || "--"}</p>
              </div>
            </div>
            <div className="w-px h-6 bg-border/60" />
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[9px] text-muted-foreground leading-none">Chegada</p>
                <p className="font-bold text-foreground">{arrivalTime}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;
