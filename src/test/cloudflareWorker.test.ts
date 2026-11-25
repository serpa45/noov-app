// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import worker from "../../worker/index";

const assetFetch = vi.fn(async () => new Response("app"));
const env = { ASSETS: { fetch: assetFetch }, SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-secret" } as unknown as Env;
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://noov.test${path}`, init), env);

it("serves application routes through the assets binding", async () => {
  expect(await (await call("/lojista/pedidos/historico")).text()).toBe("app");
  expect(assetFetch).toHaveBeenCalledOnce();
});
it("returns JSON 404 for unknown APIs instead of the SPA", async () => {
  const result = await call("/api/unknown");
  expect(result.status).toBe(404);
  expect(result.headers.get("content-type")).toContain("application/json");
  expect(assetFetch).not.toHaveBeenCalled();
});
it("keeps both admin APIs protected without contacting Supabase", async () => {
  const upstream = vi.fn(); vi.stubGlobal("fetch", upstream);
  expect((await call("/api/admin/clear-error-logs", { method: "DELETE" })).status).toBe(401);
  expect((await call("/api/admin/supabase-quota-readings")).status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});
it("preserves method restrictions and no-store headers", async () => {
  const result = await call("/api/admin/clear-error-logs");
  expect(result.status).toBe(405);
  expect(result.headers.get("allow")).toBe("DELETE");
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it("rejects malformed JSON and bounds streamed request bodies", async () => {
  const headers = { authorization: "Bearer token" };
  expect((await call("/api/admin/supabase-quota-readings", { method: "PUT", headers, body: "{" })).status).toBe(400);
  expect((await call("/api/admin/supabase-quota-readings", { method: "PUT", headers, body: "x".repeat(200001) })).status).toBe(413);
});
it("uses the Worker environment rather than process-wide service credentials", async () => {
  const upstream = vi.fn<typeof fetch>(async () => new Response("{}", { status: 401 })); vi.stubGlobal("fetch", upstream);
  const result = await call("/api/admin/clear-error-logs", { method: "DELETE", headers: { authorization: "Bearer expired" } });
  expect(result.status).toBe(401);
  expect(upstream.mock.calls[0][0]).toBe("https://example.supabase.co/auth/v1/user");
  expect(upstream.mock.calls[0][1]?.headers).toHaveProperty("apikey", "test-secret");
});
