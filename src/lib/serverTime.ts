// Server-synced clock to prevent users from bypassing plan expiration
// by changing their device clock. We read the `Date` header from a
// HEAD request to the Supabase REST endpoint (always set by the server)
// and keep an offset relative to the local clock.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

let offsetMs = 0;
let lastSync = 0;
let inFlight: Promise<void> | null = null;

async function syncOnce() {
  try {
    const localBefore = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: SUPABASE_KEY },
      cache: "no-store",
    });
    const dateHeader = res.headers.get("date");
    if (!dateHeader) return;
    const localAfter = Date.now();
    // approximate network latency
    const rtt = localAfter - localBefore;
    const serverMs = new Date(dateHeader).getTime() + Math.floor(rtt / 2);
    offsetMs = serverMs - Date.now();
    lastSync = Date.now();
  } catch {
    /* keep previous offset / fall back to local */
  }
}

export function syncServerTime(): Promise<void> {
  if (!inFlight) {
    inFlight = syncOnce().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Initial sync + periodic refresh every 10 minutes
if (typeof window !== "undefined") {
  void syncServerTime();
  setInterval(() => void syncServerTime(), 10 * 60 * 1000);
  window.addEventListener("focus", () => {
    if (Date.now() - lastSync > 60 * 1000) void syncServerTime();
  });
}

export function getServerNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function getServerOffsetMs() {
  return offsetMs;
}
