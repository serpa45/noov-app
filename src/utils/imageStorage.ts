import { supabase } from "@/integrations/supabase/client";
import { encodedImageKey, uniqueImagePath, type ImageBucket } from "./mediaStoragePaths";

type UploadOptions = { upsert?: boolean; cacheControl?: string; contentType?: string };
type UploadResult = { data: { publicUrl: string; path: string } | null; error: Error | null };

/** R2 is opt-in at build time. Existing builds keep using Supabase until cutover. */
export async function uploadImage(bucket: ImageBucket, path: string, file: Blob, options: UploadOptions = {}): Promise<UploadResult> {
  try {
    if (import.meta.env.VITE_MEDIA_STORAGE !== "r2") {
      const { error } = await supabase.storage.from(bucket).upload(path, file, options);
      if (error) return { data: null, error };
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return { data: { publicUrl: data.publicUrl, path }, error: null };
    }
    // New keys are immutable. A replacement never overwrites an image shared by old orders.
    const uniquePath = uniqueImagePath(path);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!token) throw new Error("Entre novamente para enviar a imagem.");
    const response = await fetch(`/api/media/${encodedImageKey(bucket, uniquePath)}`, {
      method: "PUT", credentials: "omit",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": options.contentType || file.type || "application/octet-stream" },
      body: file,
    });
    let result;
    try { result = await response.json(); }
    catch { throw new Error("Armazenamento de imagens indisponível. Tente novamente."); }
    if (!response.ok) throw new Error(result.error || "Não foi possível enviar a imagem.");
    if (typeof result.publicUrl !== "string" || typeof result.path !== "string") throw new Error("Envio da imagem não confirmado.");
    return { data: { publicUrl: result.publicUrl, path: result.path }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Não foi possível enviar a imagem.") };
  }
}
