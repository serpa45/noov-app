/** Server-only bridge for the existing image-generation functions. */
export async function uploadGeneratedImageToR2(options: {
  origin: string; serviceRoleKey: string; bucket: "banners" | "category-images";
  path: string; bytes: Uint8Array; contentType: string;
}): Promise<string> {
  const origin = new URL(options.origin);
  if (origin.protocol !== "https:" || origin.username || origin.password || ![
    "noov.app.br", "www.noov.app.br", "noov-app.noov-serpainfo.workers.dev", "noov-app-r2-preview.noov-serpainfo.workers.dev",
  ].includes(origin.host)) throw new Error("Destino de imagens não autorizado.");
  if (!options.serviceRoleKey) throw new Error("Credencial interna indisponível.");
  if (!options.path || options.path.split("/").some(p => !p || p === "." || p === "..") || /[\\%?#\x00-\x1f]/.test(options.path)) throw new Error("Caminho de imagem inválido.");
  const path = [options.bucket, ...options.path.split("/")].map(encodeURIComponent).join("/");
  const response = await fetch(`${origin.origin}/api/media-internal/${path}`, {
    method: "PUT", headers: { Authorization: `Bearer ${options.serviceRoleKey}`, "Content-Type": options.contentType },
    body: options.bytes, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Armazenamento de imagens indisponível (HTTP ${response.status}).`);
  const result = await response.json() as { publicUrl?: unknown };
  if (typeof result.publicUrl !== "string" || !result.publicUrl.startsWith(`${origin.origin}/media/`)) throw new Error("Envio de imagem não confirmado.");
  return result.publicUrl;
}
