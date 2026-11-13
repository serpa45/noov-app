import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ create: vi.fn(), user: vi.fn(), role: vi.fn(), from: vi.fn(), download: vi.fn(), upload: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.create }));
import handler, { QUOTA_BUCKET, QUOTA_OBJECT } from "../../server/supabaseQuotaReadings";
const req = { method: "GET", headers: { authorization: "Bearer user-token" } };
const reading = () => ({ version: 1, projectRef: "project", plan: "pro", cycleStart: new Date().toISOString().slice(0, 7) + "-01", cycleEnd: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).toISOString().slice(0, 10), readAt: new Date(Date.now() - 60000).toISOString(), values: { cached_egress: 200 }, limits: {} });
const output = () => { const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res; };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("SUPABASE_URL", "https://project.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
  mock.create.mockReturnValue({ auth: { getUser: mock.user }, rpc: mock.role, storage: { from: mock.from } });
  mock.user.mockResolvedValue({ data: { user: { id: "admin" } }, error: null });
  mock.role.mockResolvedValue({ data: true, error: null });
  mock.from.mockReturnValue({ download: mock.download, upload: mock.upload });
  mock.upload.mockResolvedValue({ error: null });
  mock.download.mockResolvedValue({ data: { size: 100, text: async () => JSON.stringify(reading()) }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects missing authorization and unsupported methods without opening storage", async () => {
  const res = output(); await handler({ method: "GET", headers: {} }, res);
  expect(res.status).toHaveBeenCalledWith(401); expect(mock.create).not.toHaveBeenCalled();
  await handler({ method: "DELETE", headers: {} }, res); expect(res.status).toHaveBeenCalledWith(405);
});
it("rejects expired sessions, non-admins and failed role checks before reading or writing", async () => {
  mock.user.mockResolvedValueOnce({ data: { user: null }, error: new Error("expired") });
  const res = output(); await handler(req, res); expect(res.status).toHaveBeenCalledWith(401);
  mock.role.mockResolvedValueOnce({ data: false, error: null });
  await handler({ ...req, method: "PUT", body: reading() }, res); expect(res.status).toHaveBeenCalledWith(403);
  mock.role.mockResolvedValueOnce({ data: true, error: new Error("failed") });
  await handler(req, res); expect(res.status).toHaveBeenCalledWith(500);
  expect(mock.from).not.toHaveBeenCalled();
});
it("reads only the fixed private bucket and validates its stored project", async () => {
  const res = output(); await handler(req, res);
  expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({ snapshot: expect.objectContaining({ values: { cached_egress: 200 } }) });
  expect(mock.from).toHaveBeenCalledWith(QUOTA_BUCKET); expect(mock.download).toHaveBeenCalledWith(QUOTA_OBJECT);
  expect(mock.user).toHaveBeenCalledWith("user-token"); expect(mock.role).toHaveBeenCalledWith("has_role", { _user_id: "admin", _role: "admin" });
});
it("returns no reading when the file is absent, not fabricated zero consumption", async () => {
  mock.download.mockResolvedValue({ data: null, error: { statusCode: "404" } });
  const res = output(); await handler(req, res); expect(res.json).toHaveBeenCalledWith({ snapshot: null });
});
it("validates writes and never accepts another project's data", async () => {
  const res = output(); await handler({ ...req, method: "PUT", body: { ...reading(), projectRef: "other" } }, res);
  expect(res.status).toHaveBeenCalledWith(400); expect(mock.upload).not.toHaveBeenCalled();
  await handler({ ...req, method: "PUT", body: reading() }, res);
  expect(mock.upload).toHaveBeenCalledWith(QUOTA_OBJECT, expect.any(String), { upsert: true, contentType: "application/json", cacheControl: "0" });
});
it("does not claim a successful save after a storage failure", async () => {
  mock.upload.mockResolvedValue({ error: new Error("storage failed") });
  const res = output(); await handler({ ...req, method: "PUT", body: reading() }, res);
  expect(res.status).toHaveBeenCalledWith(500); expect(res.json.mock.calls[0][0]).not.toHaveProperty("snapshot");
});
