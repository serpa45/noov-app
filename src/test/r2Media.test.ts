// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { media, imageMime } from "../../worker/media";

const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const get = vi.fn(); const head = vi.fn(); const put = vi.fn(); const upstream = vi.fn<typeof fetch>();
const env = { R2_MEDIA_ENABLED: "true", SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", SUPABASE_SERVICE_ROLE_KEY: "must-never-authorize-uploads", R2_IMAGES: { get, head, put } } as unknown as Env;
const upload = (bucket = "product-images", body: BodyInit = png, headers = { Authorization: "Bearer user" }) => media(new Request(`https://noov.app.br/api/media/${bucket}/store/image.png`, { method: "PUT", headers, body }), env);
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", upstream);
  upstream.mockImplementation(async () => new Response("{}", { status: 200 }));
  put.mockResolvedValue({ key: "image.png" });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps R2 disabled until explicitly enabled", async () => {
  expect((await media(new Request("https://noov.app.br/media/logos/a.png"), { ...env, R2_MEDIA_ENABLED: "false" } as unknown as Env)).status).toBe(503);
  expect(get).not.toHaveBeenCalled();
});
it.each(["installers/a.exe", "noov-system-metrics-private/a.json", "logos/a%255cb.png", "logos/a%2F..%2Fb.png", "logos/%ZZ.png"])("rejects invalid or non-image namespace %s", async path => {
  expect((await media(new Request(`https://noov.app.br/media/${path}`), env)).status).toBeGreaterThanOrEqual(400);
  expect(get).not.toHaveBeenCalled();
});
it("serves public images with safe headers and handles conditional requests", async () => {
  get.mockImplementation(async () => ({ body: new Response(png).body, size: png.length, httpEtag: '"v1"', httpMetadata: { contentType: "image/png" } }));
  const response = await media(new Request("https://noov.app.br/media/product-images/a.png"), env);
  expect(response.status).toBe(200); expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
  expect((await media(new Request("https://noov.app.br/media/product-images/a.png", { headers: { "If-None-Match": '"v1"' } }), env)).status).toBe(304);
});
it("uses HEAD metadata without reading the object and never serves executables", async () => {
  head.mockResolvedValue({ size: 20, httpEtag: '"v1"', httpMetadata: { contentType: "application/x-msdownload" } });
  expect((await media(new Request("https://noov.app.br/media/logos/fake.png", { method: "HEAD" }), env)).status).toBe(404);
  expect(get).not.toHaveBeenCalled();
});
it("does not turn missing images or R2 errors into cached success", async () => {
  get.mockResolvedValue(null);
  expect((await media(new Request("https://noov.app.br/media/logos/absent.png"), env)).status).toBe(404);
  get.mockRejectedValue(new Error("unavailable"));
  const response = await media(new Request("https://noov.app.br/media/logos/a.png"), env);
  expect(response.status).toBe(502); expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("keeps personal photo responses out of shared caches", async () => {
  get.mockResolvedValue({ body: png, size: png.length, httpEtag: '"v1"', httpMetadata: { contentType: "image/png" } });
  const response = await media(new Request("https://noov.app.br/media/client-photos/a.png"), env);
  expect(response.headers.get("Cache-Control")).toContain("private");
});
it("rejects anonymous catalog uploads and untrusted origins before writing", async () => {
  expect((await upload("product-images", png, {} as { Authorization: string })).status).toBe(401);
  const response = await media(new Request("https://noov.app.br/api/media/logos/a.png", { method: "PUT", headers: { Origin: "https://untrusted.test", Authorization: "Bearer token" }, body: png }), env);
  expect(response.status).toBe(403); expect(put).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
});
it("requires live per-path Supabase Storage permission without using service_role", async () => {
  const response = await upload();
  expect(response.status).toBe(201);
  expect(upstream.mock.calls[1][0]).toBe("https://project.supabase.co/storage/v1/object/upload/sign/product-images/store/image.png");
  expect(upstream.mock.calls[1][1]?.headers).toMatchObject({ apikey: "public-key", Authorization: "Bearer user" });
  const result = await response.json(); expect(result).toMatchObject({ publicUrl: "https://noov.app.br/media/product-images/store/image.png" });
  expect(JSON.stringify(result)).not.toContain("must-never-authorize");
  expect(put.mock.calls[0][2].onlyIf.get("If-None-Match")).toBe("*");
});
it("does not write after an expired session or rejected ownership check", async () => {
  upstream.mockResolvedValueOnce(new Response("{}", { status: 401 }));
  expect((await upload()).status).toBe(401);
  upstream.mockResolvedValueOnce(new Response("{}", { status: 200 })).mockResolvedValueOnce(new Response("{}", { status: 403 }));
  expect((await upload()).status).toBe(403); expect(put).not.toHaveBeenCalled();
});
it("keeps anonymous customer-photo permission checks in the existing Storage policy", async () => {
  expect((await upload("client-photos")).status).toBe(201);
  expect(upstream).toHaveBeenCalledOnce();
  expect(String(upstream.mock.calls[0][0])).toContain("/object/upload/sign/client-photos/");
});
it("rejects executable content, empty files and oversized streamed uploads", async () => {
  expect((await upload("logos", "<script>bad()</script>")).status).toBe(415);
  expect((await upload("logos", new Uint8Array())).status).toBe(413);
  expect((await upload("logos", new Uint8Array(5 * 1024 * 1024 + 1))).status).toBe(413);
  expect(put).not.toHaveBeenCalled();
});
it("does not overwrite objects or report success after a failed write", async () => {
  put.mockResolvedValueOnce(null); expect((await upload()).status).toBe(409);
  put.mockRejectedValueOnce(new Error("write failed")); expect((await upload()).status).toBe(502);
});
it("recognizes supported raster signatures without trusting the extension", () => {
  expect(imageMime(png)).toBe("image/png"); expect(imageMime(Uint8Array.from([255,216,255]))).toBe("image/jpeg");
  expect(imageMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
  expect(imageMime(new TextEncoder().encode("<svg></svg>"))).toBeNull();
});

it("accepts internal server uploads only with the server credential and no browser origin", async () => {
  const make = (token: string, origin?: string) => media(new Request("https://noov.app.br/api/media-internal/banners/generated.png", {
    method: "PUT", headers: { Authorization: `Bearer ${token}`, ...(origin ? { Origin: origin } : {}) }, body: png,
  }), env);
  expect((await make("public-key")).status).toBe(401);
  expect((await make(env.SUPABASE_SERVICE_ROLE_KEY, "https://noov.app.br")).status).toBe(403);
  expect((await make(env.SUPABASE_SERVICE_ROLE_KEY)).status).toBe(201);
  expect(upstream).not.toHaveBeenCalled();
});
