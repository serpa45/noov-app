import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mock.session } } }));
import { requestQuotaReading } from "./supabaseQuotaReadings";
beforeEach(() => { vi.clearAllMocks(); mock.fetch.mockReset(); vi.stubGlobal("fetch", mock.fetch); mock.session.mockResolvedValue({ data: { session: { access_token: "user-token" } }, error: null }); });
afterEach(() => vi.unstubAllGlobals());
it("uses the user session for the admin endpoint and never sends an administrative key", async () => {
  mock.fetch.mockResolvedValue({ ok: true, json: async () => ({ snapshot: null }) });
  expect(await requestQuotaReading("project")).toEqual({ snapshot: null });
  expect(mock.fetch).toHaveBeenCalledWith("/api/admin/supabase-quota-readings", { method: "GET", headers: { Authorization: "Bearer user-token" } });
});
it("rejects missing sessions and failed server responses", async () => {
  mock.session.mockResolvedValueOnce({ data: { session: null }, error: null });
  await expect(requestQuotaReading("project")).rejects.toThrow("Entre novamente"); expect(mock.fetch).not.toHaveBeenCalled();
  mock.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Admin only" }) });
  await expect(requestQuotaReading("project")).rejects.toThrow("Admin only");
});
it("does not accept a malformed success response as an empty reading", async () => {
  mock.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  await expect(requestQuotaReading("project")).rejects.toThrow();
});
