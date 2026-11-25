import { encodedImageKey, isImageBucket, validImagePath } from "../src/utils/mediaStoragePaths";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const cachedBuckets = new Set(["product-images", "category-images", "banners", "public_assets"]);
const allowedOrigins = new Set(["https://noov.app.br", "https://www.noov.app.br", "https://noov-app.noov-serpainfo.workers.dev", "https://noov-app-r2-preview.noov-serpainfo.workers.dev"]);
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

async function internalAuthorization(token: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(secret));
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(token));
}

/** Raster signatures: browser-provided MIME and file names do not authorize executable content. */
export function imageMime(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return "image/png";
  if (["GIF87a", "GIF89a"].includes(text(0, 6))) return "image/gif";
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (text(4, 8) === "ftyp") {
    const brand = text(8, 12);
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

async function readImage(request: Request): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function media(request: Request, env: Env, context?: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const internal = url.pathname.startsWith("/api/media-internal/");
  const isUpload = internal || url.pathname.startsWith("/api/media/");
  const prefix = internal ? "/api/media-internal/" : isUpload ? "/api/media/" : "/media/";
  let bucket: string, path: string;
  try {
    const parts = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
    bucket = parts.shift() || "";
    path = parts.join("/");
  } catch { return json({ error: "Caminho inválido." }, 400); }
  if (!isImageBucket(bucket) || !validImagePath(path)) return json({ error: "Imagem não encontrada." }, 404);

  if (isUpload) {
    const origin = request.headers.get("Origin");
    if (internal && origin) return json({ error: "Envio interno não permitido no navegador." }, 403);
    if (origin && origin !== url.origin && !allowedOrigins.has(origin)) return json({ error: "Origem não permitida." }, 403);
    const respond = (response: Response) => {
      if (origin) { response.headers.set("Access-Control-Allow-Origin", origin); response.headers.set("Vary", "Origin"); }
      return response;
    };
    if (request.method === "OPTIONS") {
      return respond(new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Methods": "PUT, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600",
      } }));
    }
    if (request.method !== "PUT") return respond(json({ error: "Método não permitido." }, 405));
    if (env.R2_MEDIA_ENABLED !== "true" || !env.R2_IMAGES) return respond(json({ error: "Armazenamento de imagens ainda não ativado." }, 503));
    const authorization = request.headers.get("Authorization");
    if (!authorization || !/^Bearer \S+$/i.test(authorization)) return respond(json({ error: "Envio não autorizado." }, 401));
    if (!internal && !env.SUPABASE_PUBLISHABLE_KEY) return respond(json({ error: "Autorização de imagens indisponível." }, 503));
    const size = request.headers.get("Content-Length");
    if (size && (!/^\d+$/.test(size) || Number(size) > MAX_IMAGE_BYTES)) return respond(json({ error: "Imagem muito grande. Máximo 5 MB." }, 413));
    try {
      if (internal) {
        if (!env.SUPABASE_SERVICE_ROLE_KEY || !await internalAuthorization(authorization.replace(/^Bearer /i, ""), env.SUPABASE_SERVICE_ROLE_KEY)) {
          return respond(json({ error: "Envio interno não autorizado." }, 401));
        }
      } else {
        const headers = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization, "Content-Type": "application/json" };
        // Customer photos use the application's existing anonymous Storage policy.
        // Every other bucket requires a real Supabase user, not the public anon JWT.
        if (bucket !== "client-photos") {
          const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
          if (auth.status === 401 || auth.status === 403) return respond(json({ error: "Entre novamente para enviar a imagem." }, 401));
          if (!auth.ok) throw new Error("User check unavailable");
        }
        // Keep the existing per-path Storage RLS rules. Only mint a permission ticket:
        // do not upload a file to Supabase and never use service_role for this check.
        const permission = await fetch(`${env.SUPABASE_URL}/storage/v1/object/upload/sign/${encodedImageKey(bucket, path)}`, {
          method: "POST", headers, body: "{}", signal: AbortSignal.timeout(10000),
        });
        if (!permission.ok) {
          if ([400, 401, 403].includes(permission.status)) return respond(json({ error: "Sem permissão para enviar esta imagem." }, 403));
          throw new Error("Storage permission check unavailable");
        }
        // Discard the signed upload ticket; it is never returned to the client or logged.
        await permission.body?.cancel();
      }
      const bytes = await readImage(request);
      if (!bytes?.length) return respond(json({ error: "Imagem vazia ou maior que 5 MB." }, 413));
      const contentType = imageMime(bytes);
      if (!contentType) return respond(json({ error: "Use uma imagem JPG, PNG, WebP, GIF, AVIF ou HEIC." }, 415));
      const object = await env.R2_IMAGES.put(`${bucket}/${path}`, bytes, {
        onlyIf: new Headers({ "If-None-Match": "*" }),
        httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
        sha256: await crypto.subtle.digest("SHA-256", bytes),
      });
      if (!object) return respond(json({ error: "Este arquivo já existe. Selecione a imagem novamente." }, 409));
      const publicUrl = `${url.origin}/media/${encodedImageKey(bucket, path)}`;
      return respond(json({ publicUrl, path }, 201));
    } catch {
      console.error(JSON.stringify({ event: "image_upload_failed", bucket }));
      return respond(json({ error: "Não foi possível confirmar o envio. Tente novamente." }, 502));
    }
  }

  if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Método não permitido." }, 405);
  if (env.R2_MEDIA_ENABLED !== "true" || !env.R2_IMAGES) return json({ error: "Armazenamento de imagens ainda não ativado." }, 503);
  try {
    // Never cache errors, API responses or personal photo buckets in a shared cache.
    const useCache = request.method === "GET" && cachedBuckets.has(bucket) && context && !url.hostname.endsWith(".workers.dev");
    const cacheKey = new Request(request.url, { method: "GET" });
    if (useCache) {
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
    }
    const read = request.method === "GET" ? await env.R2_IMAGES.get(`${bucket}/${path}`) : null;
    const object = request.method === "HEAD" ? await env.R2_IMAGES.head(`${bucket}/${path}`) : read;
    if (!object) return json({ error: "Imagem não encontrada." }, 404);
    const contentType = object.httpMetadata?.contentType || "";
    if (!contentType.startsWith("image/")) return json({ error: "Imagem não encontrada." }, 404);
    const headers = new Headers({
      "Content-Type": contentType, "Content-Length": String(object.size), "ETag": object.httpEtag,
      "Cache-Control": cachedBuckets.has(bucket) ? "public, max-age=3600" : "private, max-age=300",
      "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    if (request.headers.get("If-None-Match") === object.httpEtag) {
      await read?.body.cancel();
      return new Response(null, { status: 304, headers });
    }
    const response = new Response(read?.body ?? null, { headers });
    if (useCache) context.waitUntil(caches.default.put(cacheKey, response.clone()).catch(() => {
      console.warn(JSON.stringify({ event: "image_cache_write_failed" }));
    }));
    return response;
  } catch {
    console.error(JSON.stringify({ event: "image_read_failed", bucket }));
    return json({ error: "Não foi possível carregar a imagem." }, 502);
  }
}
