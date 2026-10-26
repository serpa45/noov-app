import { afterEach, beforeEach, expect, it, vi } from "vitest";
import handler from "../../server/clearErrorLogs";
const request = { method: "DELETE", headers: { authorization: "Bearer user-token" } };
const fetchMock = vi.fn();
function response(status = 200, body: unknown = {}, count?: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => body,
    headers: { get: () => count === undefined ? null : `*/${count}` } };
}
function output() {
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); return res;
}
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("AbortSignal", { timeout: () => undefined });
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("rejects unauthenticated requests without accessing the database", async () => {
  const res = output(); await handler({ method: "DELETE", headers: {} }, res);
  expect(res.status).toHaveBeenCalledWith(401); expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects non-delete methods", async () => {
  const res = output(); await handler({ ...request, method: "GET" }, res);
  expect(res.status).toHaveBeenCalledWith(405); expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects expired tokens without deleting anything", async () => {
  fetchMock.mockResolvedValueOnce(response(401));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(401); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("rejects an authenticated store user without the administrator role", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: "store-user" })).mockResolvedValueOnce(response(200, false));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(403); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("returns the exact deleted count only after verifying the database is clear", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: "admin" })).mockResolvedValueOnce(response(200, true))
    .mockResolvedValueOnce(response(204, null, 113)).mockResolvedValueOnce(response(200, null, 0));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ deleted: 113, cutoff: expect.any(String) });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ _user_id: "admin", _role: "admin" });
  const deletion = fetchMock.mock.calls[2];
  expect(deletion[0]).toContain("created_at.lte.");
  expect(deletion[0]).toContain("created_at.is.null"); expect(deletion[1].method).toBe("DELETE");
  expect(fetchMock.mock.calls[3][0]).toContain(deletion[0].split("?")[1]);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer user-token");
});
it("does not report success when deletion silently leaves records behind", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: "admin" })).mockResolvedValueOnce(response(200, true))
    .mockResolvedValueOnce(response(204, null, 0)).mockResolvedValueOnce(response(200, null, 113));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json.mock.calls[0][0]).not.toHaveProperty("deleted");
});
it("fails closed when the role check fails", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: "admin" })).mockResolvedValueOnce(response(500));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(500); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("does not report success if the database omitted its deletion count", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: "admin" })).mockResolvedValueOnce(response(200, true))
    .mockResolvedValueOnce(response(204));
  const res = output(); await handler(request, res);
  expect(res.status).toHaveBeenCalledWith(500);
});
