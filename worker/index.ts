import clearErrorLogs from "../server/clearErrorLogs";
import quotaReadings from "../server/supabaseQuotaReadings";

const MAX_BODY_BYTES = 200000;
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname !== "/api" && !pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const handler = pathname === "/api/admin/clear-error-logs" ? clearErrorLogs
      : pathname === "/api/admin/supabase-quota-readings" ? quotaReadings : null;
    if (!handler) return json({ error: "API não encontrada." }, 404);
    // Reject anonymous writes before consuming their bodies or accessing Supabase.
    const authorization = request.headers.get("authorization");
    let body: unknown;
    if (handler === quotaReadings && request.method === "PUT" && authorization && /^Bearer \S+$/i.test(authorization)) {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) {
            await reader.cancel();
            return json({ error: "Leitura muito grande." }, 413);
          }
          chunks.push(value);
        }
      }
      try {
        body = JSON.parse(await new Blob(chunks).text());
      } catch { return json({ error: "Envie uma leitura em JSON válido." }, 400); }
    }
    let result: Response | undefined;
    let status = 200;
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    const response = {
      setHeader(name: string, value: string) { headers.set(name, value); },
      status(code: number) { status = code; return response; },
      json(value: unknown) { result = new Response(JSON.stringify(value), { status, headers }); },
    };
    try {
      const input = { method: request.method, headers: { authorization: authorization ?? undefined }, body };
      await handler(input, response, env);
      return result ?? json({ error: "Resposta indisponível." }, 500);
    } catch {
      console.error(JSON.stringify({ event: "admin_api_failed", path: pathname }));
      return json({ error: "Não foi possível concluir a operação." }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
