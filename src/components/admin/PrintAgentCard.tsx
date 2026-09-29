import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Zap } from "lucide-react";

const MANIFEST_URL =
  "https://mwnjoglolbyeyrmkqqqc.supabase.co/storage/v1/object/public/installers/print-agent/latest.json";

const FALLBACK_URL =
  "https://github.com/serpa45/noov-app/releases/download/print-agent-v1.0.1/noov-print-agent.exe";

const STEPS = [
  "Baixe o programa no computador que fica ligado durante o expediente e que tem as impressoras.",
  "Dê dois cliques no arquivo baixado. A tela de configuração abre sozinha no navegador.",
  "Entre com o mesmo e-mail e senha que você usa aqui no painel.",
  "Escolha a impressora do balcão e a da cozinha, clique em Imprimir teste e depois em Salvar.",
];

/**
 * O agente roda fora do navegador, entao ele nao aparece no status do QZ:
 * a loja instala uma vez e o pedido passa a sair sozinho mesmo com o painel
 * fechado ou aceito pelo celular.
 */
const PrintAgentCard = () => {
  const [downloadUrl, setDownloadUrl] = useState(FALLBACK_URL);
  const [version, setVersion] = useState<string | null>(null);

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
        // Sem manifesto o botao continua valendo com a ultima versao conhecida.
      });
    return () => {
      active = false;
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
