const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function safeJsonFetch(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Non-JSON response:", text.slice(0, 200));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("DISTANCEMATRIX_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { origin_lat, origin_lng, dest_lat, dest_lng } = await req.json();

    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      return new Response(JSON.stringify({ error: "Missing coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get distance/duration from DistanceMatrix API
    const dmUrl = `https://api.distancematrix.ai/maps/api/distancematrix/json?origins=${origin_lat},${origin_lng}&destinations=${dest_lat},${dest_lng}&key=${apiKey}`;
    const dmData = await safeJsonFetch(dmUrl);

    let distance = null;
    let duration = null;
    let polyline = null;

    if (dmData?.rows?.[0]?.elements?.[0]?.status === "OK") {
      distance = dmData.rows[0].elements[0].distance;
      duration = dmData.rows[0].elements[0].duration;
    }

    // Use OSRM for routing (free, no key needed, reliable polyline)
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin_lng},${origin_lat};${dest_lng},${dest_lat}?overview=full&geometries=polyline`;
      const osrmData = await safeJsonFetch(osrmUrl);
      if (osrmData?.routes?.[0]?.geometry) {
        polyline = osrmData.routes[0].geometry;
        // Fallback distance/duration from OSRM if DM failed
        if (!distance && osrmData.routes[0].distance) {
          const distM = osrmData.routes[0].distance;
          distance = { text: distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`, value: distM };
        }
        if (!duration && osrmData.routes[0].duration) {
          const durS = osrmData.routes[0].duration;
          duration = { text: durS >= 60 ? `${Math.round(durS / 60)} min` : `${Math.round(durS)} s`, value: durS };
        }
      }
    } catch (e) {
      console.error("OSRM fallback error:", e);
    }

    return new Response(JSON.stringify({ distance, duration, polyline }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("DistanceMatrix error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
