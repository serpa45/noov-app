import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useDriverLocation = (driverId: string | undefined, activeDeliveryIds: string[]) => {
  const [location, setLocation] = useState<{ lat: number; lng: number; speed: number } | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const positionBufferRef = useRef<[number, number][]>([]);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const activeDeliveryIdsRef = useRef<string[]>(activeDeliveryIds);

  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const wakeLockRef = useRef<any>(null);

  // Keep ref in sync so watchPosition callback always has latest IDs
  useEffect(() => {
    activeDeliveryIdsRef.current = activeDeliveryIds;
  }, [activeDeliveryIds]);

  // Always request geolocation permission on mount
  useEffect(() => {
    if (!driverId) return;

    // Check and monitor permission status
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        setPermissionStatus(result.state as any);
        result.addEventListener("change", () => {
          setPermissionStatus(result.state as any);
        });
      }).catch(() => {});
    }

    // Immediately request location to trigger permission prompt
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setPermissionStatus("granted"),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [driverId]);

  // Keep GPS tracking always active — runs even without active deliveries
  useEffect(() => {
    if (!driverId) return;

    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords;

        setPermissionStatus("granted");

        // Smart GPS Filtering (ANTI RUÍDO)
        if (accuracy > 30) return;

        positionBufferRef.current.push([latitude, longitude]);
        if (positionBufferRef.current.length > 3) positionBufferRef.current.shift();

        const avgLat = positionBufferRef.current.reduce((sum, p) => sum + p[0], 0) / positionBufferRef.current.length;
        const avgLng = positionBufferRef.current.reduce((sum, p) => sum + p[1], 0) / positionBufferRef.current.length;

        let finalLat = avgLat;
        let finalLng = avgLng;

        if (lastLocationRef.current) {
          finalLat = lastLocationRef.current.lat + (avgLat - lastLocationRef.current.lat) * 0.2;
          finalLng = lastLocationRef.current.lng + (avgLng - lastLocationRef.current.lng) * 0.2;
        }

        lastLocationRef.current = { lat: finalLat, lng: finalLng };

        const speedKmh = (speed || 0) * 3.6;
        setLocation({ lat: finalLat, lng: finalLng, speed: speedKmh });

        // Update active deliveries in DB (debounce 1.5s)
        const now = Date.now();
        if (activeDeliveryIdsRef.current.length > 0 && (now - lastUpdateRef.current > 1500)) {
          lastUpdateRef.current = now;
          const { error } = await supabase
            .from("entregas")
            .update({
              latitude_atual: finalLat,
              longitude_atual: finalLng,
            })
            .in("id", activeDeliveryIdsRef.current);

          if (error) {
            console.error("Error updating driver location:", error);
          }
        }
      },
      (error) => {
        console.error("Error watching position:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionStatus("denied");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [driverId]); // Only depends on driverId — GPS always on
  // Wake Lock to keep screen on and GPS active in PWA mode
  useEffect(() => {
    if (!driverId) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (!isStandalone) return;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => {
            // Re-acquire on release (e.g. tab switch)
            setTimeout(requestWakeLock, 1000);
          });
        }
      } catch (err) {
        console.warn("Wake Lock failed:", err);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [driverId]);

  return { location, permissionStatus };
};
