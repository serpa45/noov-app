import { createClient } from "@supabase/supabase-js";
import { validateQuotaSnapshot } from "../src/utils/supabaseQuotas.js";
import { serverEnvironment, type ServerEnvironment } from "./clearErrorLogs.js";

export const QUOTA_BUCKET = "noov-system-metrics-private";
export const QUOTA_OBJECT = "pro-usage-reading.json";
type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader(name: string, value: string): unknown; status(code: number): Response; json(body: unknown): unknown };

export default async function quotaReadings(req: Request, res: Response, environment: ServerEnvironment = serverEnvironment()) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PUT"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer \S+$/i.test(authorization)) return res.status(401).json({ error: "Entre novamente para consultar as leituras." });
  const url = environment.SUPABASE_URL || environment.VITE_SUPABASE_URL;
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: "Leituras compartilhadas indisponíveis no servidor." });
  const projectRef = new URL(url).hostname.split(".")[0];
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: auth, error: authError } = await client.auth.getUser(authorization.replace(/^Bearer /i, ""));
    if (authError || !auth.user) return res.status(401).json({ error: "Sessão inválida. Entre novamente." });
    const { data: admin, error: roleError } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (roleError) throw new Error("Permission check failed");
    if (admin !== true) return res.status(403).json({ error: "Apenas administradores podem acessar estas leituras." });
    const bucket = client.storage.from(QUOTA_BUCKET);
    if (req.method === "GET") {
      const { data, error } = await bucket.download(QUOTA_OBJECT);
      if (error) {
        if (String((error as { statusCode?: string }).statusCode) === "404") return res.status(200).json({ snapshot: null });
        throw error;
      }
      if (data.size > 200000) throw new Error("Invalid stored file");
      const snapshot = validateQuotaSnapshot(JSON.parse(await data.text()), projectRef);
      return res.status(200).json({ snapshot });
    }
    let snapshot;
    try {
      if (JSON.stringify(req.body).length > 200000) throw new Error("Arquivo muito grande.");
      snapshot = validateQuotaSnapshot(req.body, projectRef);
    } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Leitura inválida." }); }
    const { error } = await bucket.upload(QUOTA_OBJECT, JSON.stringify(snapshot), { upsert: true, contentType: "application/json", cacheControl: "0" });
    if (error) throw error;
    return res.status(200).json({ snapshot });
  } catch {
    return res.status(500).json({ error: "Não foi possível ler ou salvar a leitura compartilhada. Nenhum consumo foi coletado automaticamente." });
  }
}
