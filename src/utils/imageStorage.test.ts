import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ upload: vi.fn(), publicUrl: vi.fn(), session: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: mocked.upload, getPublicUrl: mocked.publicUrl }) },
  auth: { getSession: mocked.session },
} }));
import { uploadImage } from "./imageStorage";
import { uniqueImagePath, validImagePath } from "./mediaStoragePaths";
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("VITE_MEDIA_STORAGE", "supabase"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("preserves Supabase uploads and URLs while R2 is disabled", async () => {
  mocked.upload.mockResolvedValue({ error: null }); mocked.publicUrl.mockReturnValue({ data: { publicUrl: "https://old.test/a.png" } });
  const result = await uploadImage("logos", "a.png", new Blob(["image"]));
  expect(result.data?.publicUrl).toBe("https://old.test/a.png"); expect(mocked.session).not.toHaveBeenCalled();
});
it("does not return a URL when the Supabase upload failed", async () => {
  mocked.upload.mockResolvedValue({ error: new Error("failed") });
  expect((await uploadImage("logos", "a.png", new Blob())).data).toBeNull(); expect(mocked.publicUrl).not.toHaveBeenCalled();
});
it("uploads to R2 using a unique key and returns the actual stored URL", async () => {
  vi.stubEnv("VITE_MEDIA_STORAGE", "r2"); mocked.session.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
  const request = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ publicUrl: "https://noov.test/media/logos/unique.png", path: "unique.png" }) }));
  vi.stubGlobal("fetch", request);
  const result = await uploadImage("logos", "user/logo.png", new Blob(["image"], { type: "image/png" }));
  expect(result.data?.publicUrl).toContain("unique.png"); expect(mocked.upload).not.toHaveBeenCalled();
  expect(request.mock.calls[0][0]).toMatch(/^\/api\/media\/logos\/user\/logo-.+\.png$/);
  expect(request.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer user-token" });
});
it("propagates an R2 permission failure without silently uploading somewhere else", async () => {
  vi.stubEnv("VITE_MEDIA_STORAGE", "r2"); mocked.session.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Sem permissão" }) })));
  expect((await uploadImage("logos", "a.png", new Blob())).error?.message).toBe("Sem permissão"); expect(mocked.upload).not.toHaveBeenCalled();
});
it("explains an HTML or invalid API response without reporting upload success", async () => {
  vi.stubEnv("VITE_MEDIA_STORAGE", "r2"); mocked.session.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError("HTML response"); } })));
  const result = await uploadImage("logos", "a.png", new Blob());
  expect(result.data).toBeNull(); expect(result.error?.message).toContain("Armazenamento de imagens indisponível");
});
it("rejects ambiguous paths and makes replacements independent of existing images", () => {
  for (const path of ["../a.png", "a//b.png", "a\\b.png", "a%2fb.png"]) expect(validImagePath(path)).toBe(false);
  expect(uniqueImagePath("store/a.png")).not.toBe(uniqueImagePath("store/a.png"));
});
