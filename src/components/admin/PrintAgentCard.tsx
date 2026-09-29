import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, Loader2, Zap } from "lucide-react";

const MANIFEST_URL =
  "https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/installers/print-agent/latest.json";

const FALLBACK_URL =
  "https://github.com/serpa45/noov-app/releases/download/print-agent-v1.0.1/noov-print-agent.exe";

const AGENT_STATUS_URL = "http://127.0.0.1:7777/api/status";

const STEPS = [
  "Baixe o programa no computador que fica ligado durante o expediente e que tem as impressoras.",
  "Dê dois cliques no arquivo baixado. A tela de configuração abre sozinha no navegador.",
  "Entre com o mesmo e-mail e senha que você usa aqui no painel.",
  "Escolha a impressora do balcão e a da cozinha, clique em Imprimir teste e depois em Salvar.",
];

type AgentLiveStatus =
  | { state: "checking" }
  | { state: "offline" }
  | {
      state: "online";
      connected: boolean;
      lojaNome: string | null;
      lastError: string | null;
      printers: string[];
      autostart: boolean;
      version: string | null;
    };

/**
 * O agente roda fora do navegador: a loja instala uma vez e o pedido passa a
 * sair sozinho mesmo com o painel fechado ou aceito pelo celular.
 */
const PrintAgentCard = () => {
  const [downloadUrl, setDownloadUrl] = useState(FALLBACK_URL);
  const [version, setVersion] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentLiveStatus>({ state: "checking" });

  useEffect(() => {
    let active = true;
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest) => {
        if (!active || !manifest?.url) return;
        setDownloadUrl(manifest.url);
        setVersion(manifest.version ?? null);
      })
      .catch(() => {
        // Sem manifesto o botao continua com a ultima versao conhecida.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(AGENT_STATUS_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        if (!active) return;
        const printers = Array.isArray(data?.config?.printers)
          ? data.config.printers
              .filter((p: any) => p?.enabled !== false && p?.address)
              .map((p: any) => `${p.name}: ${p.address}`)
          : [];
        setAgent({
          state: "online",
          connected: Boolean(data?.connected),
          lojaNome: data?.lojaNome ?? null,
          lastError: data?.lastError ?? null,
          printers,
          autostart: Boolean(data?.autostart),
          version: data?.version ?? null,
        });
      } catch {
        if (active) setAgent({ state: "offline" });
      }
    };

    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold text-foreground">Impressão automática NOOV</h4>
            <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">Recomendado</Badge>
            {version && (
              <span className="text-[11px] text-muted-foreground font-medium">versão {version}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Instale uma vez no computador da loja e os pedidos aceitos passam a sair sozinhos no balcão e
            na cozinha. Sem janela de permissão, sem certificado, e funciona mesmo com o painel fechado ou
            quando o pedido é aceito pelo celular.
          </p>
        </div>
      </div>

      {agent.state === "checking" && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verificando se o agente está rodando neste computador…
        </div>
      )}

      {agent.state === "offline" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <strong className="font-semibold">Agente offline neste PC.</strong> Baixe e abra o programa abaixo
          (ou abra o atalho já instalado). Sair do painel do NOOV não desliga a impressão — só se o programa
          ou o computador forem desligados.
        </div>
      )}

      {agent.state === "online" && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${
            agent.connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {agent.connected ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Impressora conectada
                {agent.lojaNome ? ` — ${agent.lojaNome}` : ""}
              </>
            ) : (
              <>Agente aberto, mas ainda sem conexão com a loja</>
            )}
          </div>
          {agent.printers.length > 0 && (
            <p className="opacity-90">
              {agent.printers.join(" · ")}
            </p>
          )}
          {agent.lastError && !agent.connected && (
            <p className="opacity-90">{agent.lastError}</p>
          )}
          <p className="opacity-80">
            {agent.autostart
              ? "Sobe sozinho com o Windows — não precisa configurar de novo ao religar o PC."
              : "Marque “Iniciar junto com o Windows” na tela do agente (localhost:7777) para não ter que abrir de novo."}
            {agent.version ? ` · agente v${agent.version}` : ""}
          </p>
        </div>
      )}

      <ol className="space-y-2 bg-background/80 p-3 rounded-xl border border-border/60 text-xs text-foreground">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-2" asChild>
          <a href={downloadUrl} rel="noreferrer">
            <Download className="w-4 h-4" />
            Baixar para Windows
          </a>
        </Button>
        {agent.state === "online" && (
          <Button size="sm" variant="outline" className="gap-2" asChild>
            <a href="http://localhost:7777" target="_blank" rel="noreferrer">
              Abrir configuração do agente
            </a>
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">
          Uma instalação por loja — as outras máquinas não precisam de nada.
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        O QZ Tray não é mais necessário. A impressão automática passa a ser feita por este programa.
      </p>
    </div>
  );
};

export default PrintAgentCard;
