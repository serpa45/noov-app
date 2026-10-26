import { afterEach, beforeEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: session } } }));
import { clearErrorLogs } from "./errorLogQueries";
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); session.mockResolvedValue({ data: { session: { access_token: "user-token" } }, error: null }); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
it("passes only the logged-in user's access token to the server", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ deleted: 113 }) });
  expect(await clearErrorLogs()).toBe(113);
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/clear-error-logs", { method: "DELETE", headers: { Authorization: "Bearer user-token" } });
});
it("rejects a false success response without a confirmed count", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  await expect(clearErrorLogs()).rejects.toThrow("confirmou");
});
it("shows a server permission failure rather than success", async () => {
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Admin only" }) });
  await expect(clearErrorLogs()).rejects.toThrow("Admin only");
});
it("does not request deletion without a session", async () => {
  session.mockResolvedValue({ data: { session: null }, error: null });
  await expect(clearErrorLogs()).rejects.toThrow("Entre novamente");
  expect(fetchMock).not.toHaveBeenCalled();
});
