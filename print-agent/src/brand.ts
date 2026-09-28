/**
 * Dados fixos do NOOV embutidos no executavel, para que o lojista precise
 * digitar apenas e-mail e senha na instalacao.
 *
 * A chave abaixo e a chave publica (anon) do projeto, a mesma que o site
 * entrega ao navegador. Ela nao da nenhum acesso alem do que as regras de
 * seguranca do banco ja permitem ao proprio lojista logado.
 */
export const NOOV_SUPABASE_URL = "https://mwnjoglolbyeyrmkqqqc.supabase.co";

export const NOOV_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bmpvZ2xvbGJ5ZXlybWtxcXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NTY2MTgsImV4cCI6MjEwNTMzMjYxOH0.CruP03oebkRmP6ms5yIF1hYBWMRXvEGO-yjpYGclHOM";

/** Porta local da tela de configuracao. Ouve apenas em 127.0.0.1. */
export const SETUP_PORT = 7777;
