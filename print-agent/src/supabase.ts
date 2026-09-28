import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentConfig } from "./config.js";
import { log } from "./logger.js";

export interface Session {
  client: SupabaseClient;
  userId: string;
  loja: any;
}

export async function connect(config: AgentConfig): Promise<Session> {
  const client = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: config.supabase.email,
    password: config.supabase.password,
  });
  if (error || !data?.user) {
    throw new Error(`Login no NOOV falhou: ${error?.message || "credenciais invalidas"}`);
  }

  const userId = data.user.id;
  const { data: loja, error: lojaError } = await client
    .from("lojas")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (lojaError) throw new Error(`Nao foi possivel carregar a loja: ${lojaError.message}`);
  if (!loja) throw new Error("Nenhuma loja encontrada para este usuario.");

  log.info(`Conectado como ${config.supabase.email} — loja "${loja.nome}".`);
  return { client, userId, loja };
}
