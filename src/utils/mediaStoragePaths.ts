export const IMAGE_BUCKETS = ["product-images", "banners", "category-images", "logos", "avatars", "client-photos", "public_assets"] as const;
export type ImageBucket = typeof IMAGE_BUCKETS[number];

export function isImageBucket(value: string): value is ImageBucket {
  return (IMAGE_BUCKETS as readonly string[]).includes(value);
}

export function validImagePath(path: string): boolean {
  return path.length > 0 && path.length <= 1024 && !/[\\%?#\x00-\x1f\x7f]/.test(path)
    && path.split("/").every(part => part.length > 0 && part !== "." && part !== "..");
}

export function encodedImageKey(bucket: ImageBucket, path: string): string {
  if (!validImagePath(path)) throw new Error("Caminho de imagem inválido.");
  return [bucket, ...path.split("/")].map(encodeURIComponent).join("/");
}

export function uniqueImagePath(path: string): string {
  if (!validImagePath(path)) throw new Error("Caminho de imagem inválido.");
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  const suffix = crypto.randomUUID();
  return dot > slash ? `${path.slice(0, dot)}-${suffix}${path.slice(dot)}` : `${path}-${suffix}`;
}
