type Request = { method?: string; headers: Record<string, string | string[] | undefined> };
type Response = {
  setHeader(name: string, value: string): unknown;
  status(code: number): Response;
  json(body: unknown): unknown;
};
function exactCount(response: globalThis.Response): number {
  const match = response.headers.get("content-range")?.match(/\/(\d+)$/);
  if (!match) throw new Error("Missing database count");
  return Number(match[1]);
}
export default async function clearErrorLogs(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !/^Bearer \S+$/i.test(authorization)) {
    return res.status(401).json({ error: "Entre novamente para limpar os logs." });
  }
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: "Limpeza de logs indisponível no servidor." });
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { ...headers, Authorization: authorization }, signal: AbortSignal.timeout(10000),
    });
    if (userResponse.status === 401 || userResponse.status === 403) {
      return res.status(401).json({ error: "Sessão expirada. Entre novamente." });
    }
    if (!userResponse.ok) throw new Error("Authentication unavailable");
    const user = await userResponse.json();
    if (!user?.id) return res.status(401).json({ error: "Sessão inválida." });
    const roleResponse = await fetch(`${url}/rest/v1/rpc/has_role`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ _user_id: user.id, _role: "admin" }), signal: AbortSignal.timeout(10000),
    });
    if (!roleResponse.ok) throw new Error("Administrator check unavailable");
    if (await roleResponse.json() !== true) return res.status(403).json({ error: "Apenas administradores podem limpar os logs." });
    // New errors arriving after this instant must remain visible.
    const cutoff = new Date().toISOString();
    const filter = `or=(created_at.lte.${encodeURIComponent(cutoff)},created_at.is.null)`;
    const deletion = await fetch(`${url}/rest/v1/error_logs?${filter}`, {
      method: "DELETE", headers: { ...headers, Prefer: "count=exact,return=minimal" }, signal: AbortSignal.timeout(15000),
    });
    if (!deletion.ok) throw new Error("Deletion failed");
    const deleted = exactCount(deletion);
    const verification = await fetch(`${url}/rest/v1/error_logs?select=id&${filter}`, {
      method: "HEAD", headers: { ...headers, Prefer: "count=exact" }, signal: AbortSignal.timeout(10000),
    });
    if (!verification.ok || exactCount(verification) !== 0) throw new Error("Deletion not confirmed");
    return res.status(200).json({ deleted, cutoff });
  } catch {
    return res.status(500).json({ error: "Não foi possível confirmar a limpeza dos logs. Atualize a lista e tente novamente." });
  }
}
