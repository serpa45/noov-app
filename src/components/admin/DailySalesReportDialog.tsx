import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printReceiptInline, isMobileOrTabletDevice, PRINT_SUCCESS_STYLE, PRINT_ERROR_STYLE } from "@/utils/printHelper";
import { bluetoothPrintService, getBluetoothSettings } from "@/utils/bluetoothPrint";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orders: any[];
  lojaNome: string;
  lojistaId?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const labelTipo = (t?: string) => {
  const map: Record<string, string> = {
    delivery: "Delivery",
    retirada: "Retirada",
    balcao: "Balcão",
    mesa: "Mesa",
    comanda: "Comanda",
  };
  return map[String(t || "").toLowerCase()] || (t || "Outros");
};

const labelPagamento = (p?: string) => {
  if (!p) return "Não informado";
  const s = String(p).toLowerCase();
  if (s.includes("pix")) return "Pix";
  if (s.includes("credito") || s.includes("crédito")) return "Cartão Crédito";
  if (s.includes("debito") || s.includes("débito")) return "Cartão Débito";
  if (s.includes("cartão") || s.includes("cartao")) return "Cartão";
  if (s.includes("dinheiro")) return "Dinheiro";
  return p;
};

// Extrai a forma de pagamento do pedido, considerando o campo `forma_pagamento`
// e o fallback em `observacoes` (padrão "Pagamento: XXX | ...").
const extractPagamento = (o: any): string | undefined => {
  if (o?.forma_pagamento) return o.forma_pagamento;
  const obs = String(o?.observacoes || "");
  const m = obs.match(/Pagamento\s*:\s*([^|\n\r]+)/i);
  if (m) return m[1].trim();
  return undefined;
};

function buildReport(orders: any[], lojaNome: string) {
  const finalizados = orders.filter((o) =>
    ["entregue", "finalizado", "concluido"].includes(String(o.status).toLowerCase())
  );
  const cancelados = orders.filter((o) => String(o.status).toLowerCase() === "cancelado");
  const emAndamento = orders.filter(
    (o) =>
      !["entregue", "finalizado", "concluido", "cancelado"].includes(
        String(o.status).toLowerCase()
      )
  );

  const totalVendas = finalizados.reduce((s, o) => s + Number(o.total || 0), 0);
  const ticketMedio = finalizados.length ? totalVendas / finalizados.length : 0;

  const porTipo: Record<string, { qtd: number; total: number }> = {};
  const porPagamento: Record<string, { qtd: number; total: number }> = {};
  const produtos: Record<string, { nome: string; qtd: number; total: number }> = {};

  for (const o of finalizados) {
    const t = labelTipo(o.tipo);
    porTipo[t] = porTipo[t] || { qtd: 0, total: 0 };
    porTipo[t].qtd += 1;
    porTipo[t].total += Number(o.total || 0);

    const p = labelPagamento(extractPagamento(o));
    porPagamento[p] = porPagamento[p] || { qtd: 0, total: 0 };
    porPagamento[p].qtd += 1;
    porPagamento[p].total += Number(o.total || 0);

    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items) {
      const nome = it.nome || it.name || "Item";
      const qtd = Number(it.quantidade || it.qtd || it.quantity || 1);
      const preco = Number(it.preco || it.price || 0);
      const key = String(it.id || nome);
      produtos[key] = produtos[key] || { nome, qtd: 0, total: 0 };
      produtos[key].qtd += qtd;
      produtos[key].total += qtd * preco;
    }
  }

  const topProdutos = Object.values(produtos)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 15);

  const porPedido = finalizados
    .map((o) => ({
      numero: o.numero_diario ?? o.numero ?? String(o.id).slice(0, 6),
      total: Number(o.total || 0),
    }))
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  return {
    lojaNome,
    dataStr: new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    horaStr: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    totalPedidos: finalizados.length,
    totalVendas,
    ticketMedio,
    cancelados: cancelados.length,
    emAndamento: emAndamento.length,
    porTipo,
    porPagamento,
    porPedido,
    topProdutos,
  };
}

function buildReportHTML(r: ReturnType<typeof buildReport>) {
  const linha = "--------------------------------";
  // Linha da grade: usa flex com espaço entre label e valor, sem margem
  // (o valor fica encostado à direita do papel).
  const row = (l: string, v: string) =>
    `<div style="display:flex;justify-content:space-between;gap:6px;margin:0;line-height:1.15"><span>${l}</span><span style="text-align:right;white-space:nowrap">${v}</span></div>`;
  const sep = `<div style="margin:0;line-height:1.15">${linha}</div>`;
  const title = (t: string) =>
    `<div style="font-weight:bold;margin:0;line-height:1.15">${t}</div>`;

  const tipoRows = Object.entries(r.porTipo)
    .map(([k, v]) => row(`${k} (${v.qtd})`, formatCurrency(v.total)))
    .join("");
  const pagRows = Object.entries(r.porPagamento)
    .map(([k, v]) => row(`${k} (${v.qtd})`, formatCurrency(v.total)))
    .join("");
  const prodRows = r.topProdutos
    .map(
      (p) =>
        `<div style="display:flex;justify-content:space-between;gap:6px;margin:0;line-height:1.15"><span style="max-width:70%;overflow:hidden">${p.qtd}x ${p.nome}</span><span style="text-align:right;white-space:nowrap">${formatCurrency(p.total)}</span></div>`
    )
    .join("");
  const pedidoRows = r.porPedido
    .map((p) => row(`Pedido Nº ${String(p.numero).padStart(2, "0")}`, formatCurrency(p.total)))
    .join("");

  return `<div style="font-family:monospace;font-size:11px;line-height:1.15;color:#000;padding:6px;width:100%;max-width:280px;margin:0 auto">
    <div style="text-align:center;font-weight:bold;font-size:13px;margin:0;line-height:1.15">${r.lojaNome}</div>
    <div style="text-align:center;font-weight:bold;margin:0;line-height:1.15">RELATÓRIO DE VENDAS DO DIA</div>
    <div style="text-align:center;margin:0;line-height:1.15">${r.dataStr} - ${r.horaStr}</div>
    ${sep}
    ${row("Pedidos finalizados", String(r.totalPedidos))}
    ${row("Pedidos em andamento", String(r.emAndamento))}
    ${row("Pedidos cancelados", String(r.cancelados))}
    ${row("Total vendido", formatCurrency(r.totalVendas))}
    ${row("Ticket médio", formatCurrency(r.ticketMedio))}
    ${sep}
    ${title("POR TIPO")}
    ${tipoRows || "<div>Sem dados</div>"}
    ${sep}
    ${title("POR PAGAMENTO")}
    ${pagRows || "<div>Sem dados</div>"}
    ${sep}
    ${title("POR PEDIDO")}
    ${pedidoRows || "<div>Sem dados</div>"}
    ${sep}
    ${title("TOP PRODUTOS")}
    ${prodRows || "<div>Sem dados</div>"}
    ${sep}
    <div style="text-align:center;font-size:10px;margin:0;line-height:1.15">Emitido em ${r.dataStr} ${r.horaStr}</div>
  </div>`;
}

// Constrói bytes ESC/POS para o relatório: valores alinhados à direita e
// separadores sem espaço em branco entre linhas.
function buildReportBytes(r: ReturnType<typeof buildReport>, paperWidth: 58 | 80): Uint8Array {
  const WIDTH = paperWidth === 80 ? 48 : 32;
  const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
  const encoder = new TextEncoder();
  const out: number[] = [];
  const push = (arr: number[]) => arr.forEach((b) => out.push(b));
  const write = (s: string) => push(Array.from(encoder.encode(s)));
  const writeLn = (s: string) => { write(s); out.push(LF); };
  // Quebra o rótulo em várias linhas mantendo o valor apenas na primeira,
  // alinhado à direita. As linhas de continuação ficam recuadas.
  const padWrap = (l: string, v: string): string[] => {
    l = String(l ?? ""); v = String(v ?? "");
    const valSpace = v.length + 1; // 1 espaço mínimo antes do valor
    const firstLineMax = Math.max(1, WIDTH - valSpace);
    if (l.length <= firstLineMax) {
      return [l + " ".repeat(WIDTH - l.length - v.length) + v];
    }
    // Quebra por palavras
    const words = l.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    const limitFor = (idx: number) => (idx === 0 ? firstLineMax : WIDTH - 2); // recuo 2 nas continuações
    for (const w of words) {
      const limit = limitFor(lines.length);
      const candidate = cur ? cur + " " + w : w;
      if (candidate.length <= limit) {
        cur = candidate;
      } else {
        if (cur) lines.push(cur);
        // palavra maior que o limite: força quebra
        while (w.length > limitFor(lines.length)) {
          const lim = limitFor(lines.length);
          lines.push((lines.length === 0 ? "" : "  ") + w.slice(0, lim - (lines.length === 0 ? 0 : 2)));
        }
        cur = (lines.length === 0 ? "" : "  ") + w;
      }
    }
    if (cur) lines.push(cur);
    // Anexa valor à direita na primeira linha
    const first = lines[0] || "";
    lines[0] = first + " ".repeat(Math.max(1, WIDTH - first.length - v.length)) + v;
    return lines;
  };
  const sep = "-".repeat(WIDTH);

  push([ESC, 0x40]); // init
  push([ESC, 0x32]); // line spacing default
  push([ESC, 0x33, 0x08]); // line spacing bem baixo (8/180)
  push([ESC, 0x20, 0x00]); // sem espaçamento extra entre caracteres

  // Cabeçalho centralizado + negrito
  push([ESC, 0x61, 0x01]);
  push([ESC, 0x45, 0x01]);
  writeLn(r.lojaNome.toUpperCase());
  writeLn("RELATORIO DE VENDAS DO DIA");
  push([ESC, 0x45, 0x00]);
  writeLn(`${r.dataStr} - ${r.horaStr}`);
  push([ESC, 0x61, 0x00]);
  writeLn(sep);

  const writeRow = (l: string, v: string) => {
    for (const ln of padWrap(l, v)) writeLn(ln);
  };

  writeRow("Pedidos finalizados", String(r.totalPedidos));
  writeRow("Pedidos em andamento", String(r.emAndamento));
  writeRow("Pedidos cancelados", String(r.cancelados));
  writeRow("Total vendido", formatCurrency(r.totalVendas));
  writeRow("Ticket medio", formatCurrency(r.ticketMedio));
  writeLn(sep);

  const section = (title: string, rows: Array<[string, string]>) => {
    push([ESC, 0x45, 0x01]);
    writeLn(title);
    push([ESC, 0x45, 0x00]);
    if (!rows.length) writeLn("Sem dados");
    for (const [l, v] of rows) writeRow(l, v);
    writeLn(sep);
  };

  section(
    "POR TIPO",
    Object.entries(r.porTipo).map(([k, v]) => [`${k} (${v.qtd})`, formatCurrency(v.total)])
  );
  section(
    "POR PAGAMENTO",
    Object.entries(r.porPagamento).map(([k, v]) => [`${k} (${v.qtd})`, formatCurrency(v.total)])
  );
  section(
    "POR PEDIDO",
    r.porPedido.map((p) => [`Pedido No ${String(p.numero).padStart(2, "0")}`, formatCurrency(p.total)])
  );
  section(
    "TOP PRODUTOS",
    r.topProdutos.map((p) => [`${p.qtd}x ${p.nome}`, formatCurrency(p.total)])
  );

  push([ESC, 0x61, 0x01]);
  writeLn(`Emitido em ${r.dataStr} ${r.horaStr}`);
  push([ESC, 0x61, 0x00]);

  push([LF, LF, LF]);
  push([GS, 0x56, 0x42, 0x00]); // cut
  return new Uint8Array(out);
}

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayLabel = (d: Date, isToday: boolean) => {
  if (isToday) return "Hoje";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
};

const DailySalesReportDialog = ({ open, onOpenChange, orders, lojaNome, lojistaId }: Props) => {
  const isMobile = useIsMobile();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [open]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return d;
    });
  }, [today]);

  const [selectedKey, setSelectedKey] = useState<string>(dayKey(today));
  const [historicalOrders, setHistoricalOrders] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setSelectedKey(dayKey(today));
  }, [open, today]);

  const isToday = selectedKey === dayKey(today);

  useEffect(() => {
    if (!open || isToday || !lojistaId) return;
    if (historicalOrders[selectedKey]) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const start = new Date(selectedKey + "T00:00:00");
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const { data, error } = await supabase
          .from("pedidos")
          .select("*")
          .eq("lojista_id", lojistaId)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setHistoricalOrders((prev) => ({ ...prev, [selectedKey]: data ?? [] }));
      } catch (err: any) {
        console.error("Load historical orders failed:", err);
        toast.error("Falha ao carregar pedidos do dia");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, selectedKey, isToday, lojistaId, historicalOrders]);

  const activeOrders = isToday ? orders : (historicalOrders[selectedKey] ?? []);
  const r = useMemo(() => buildReport(activeOrders, lojaNome), [activeOrders, lojaNome]);

  const handlePrint = async () => {
    const isMob = isMobileOrTabletDevice();
    const bt = getBluetoothSettings();
    const btConfigured = !!bt.deviceId || !!bt.deviceName || bluetoothPrintService.isConnected();
    const btAvailable = btConfigured && bluetoothPrintService.isSupported();

    // 1) PRIORIDADE: Bluetooth se configurada. Tenta reconectar silenciosamente.
    if (btAvailable) {
      try {
        if (!bluetoothPrintService.isConnected()) {
          await bluetoothPrintService.tryAutoReconnect();
        }
        if (bluetoothPrintService.isConnected()) {
          const bytes = buildReportBytes(r, bt.paperWidth || 58);
          await bluetoothPrintService.sendBytes(bytes);
          toast.success("Impressão enviada", PRINT_SUCCESS_STYLE);
          return;
        }
        // Não conectou: desktop cai para QZ; mobile mostra erro genérico.
        if (isMob) {
          toast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
          return;
        }
      } catch (err: any) {
        console.error("Bluetooth report print failed:", err);
        if (isMob) {
          toast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
          return;
        }
      }
    }

    const html = buildReportHTML(r);

    // Desktop: tenta QZ Tray, senão usa impressão inline (mesmo espaçamento do mobile)
    if (!isMob) {
      try {
        const { qzService } = await import("@/utils/qzService");
        const ok = await qzService.printHTML(html);
        if (ok) {
          toast.success("Impressão enviada", PRINT_SUCCESS_STYLE);
          return;
        }
      } catch (err) {
        console.log("QZ Tray indisponível, usando impressão nativa.");
      }
    }

    try {
      printReceiptInline(html);
      toast.success("Impressão enviada", PRINT_SUCCESS_STYLE);
    } catch {
      toast.error("Falha ao enviar impressão", PRINT_ERROR_STYLE);
    }
  };


  const Row = ({ l, v }: { l: string; v: string }) => (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{l}</span>
      <span className="font-semibold text-foreground">{v}</span>
    </div>
  );

  const contentClass = isMobile
    ? "w-screen h-[100dvh] max-w-none sm:max-w-none p-0 gap-0 rounded-none border-0 flex flex-col"
    : "max-w-2xl w-full h-[85vh] p-0 gap-0 flex flex-col";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClass}>
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">Vendas do Dia</DialogTitle>
        </DialogHeader>

        {/* Seletor de dias (últimos 7 dias) */}
        <div className="shrink-0 border-b border-border px-4 py-2 overflow-x-auto">
          <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">Últimos 7 dias</div>
          <div className="flex gap-2 min-w-max">
            {days.map((d) => {
              const key = dayKey(d);
              const active = key === selectedKey;
              const label = dayLabel(d, key === dayKey(today));
              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-md mx-auto space-y-4 pb-4">
            <div className="text-center">
              <div className="font-bold text-foreground">{r.lojaNome}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(selectedKey + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                {isToday ? ` · ${r.horaStr}` : ""}
              </div>
            </div>

            {loading && !isToday ? (
              <p className="text-center text-sm text-muted-foreground py-8">Carregando…</p>
            ) : (
              <>
            <div className="p-3 rounded-lg bg-muted/40 space-y-1.5">
              <Row l="Pedidos finalizados" v={String(r.totalPedidos)} />
              <Row l="Em andamento" v={String(r.emAndamento)} />
              <Row l="Cancelados" v={String(r.cancelados)} />
              <div className="border-t border-border/50 my-1" />
              <Row l="Total vendido" v={formatCurrency(r.totalVendas)} />
              <Row l="Ticket médio" v={formatCurrency(r.ticketMedio)} />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase text-muted-foreground">Por tipo</div>
              {Object.keys(r.porTipo).length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados</p>
              ) : (
                Object.entries(r.porTipo).map(([k, v]) => (
                  <Row key={k} l={`${k} (${v.qtd})`} v={formatCurrency(v.total)} />
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase text-muted-foreground">Por pagamento</div>
              {Object.keys(r.porPagamento).length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados</p>
              ) : (
                Object.entries(r.porPagamento).map(([k, v]) => (
                  <Row key={k} l={`${k} (${v.qtd})`} v={formatCurrency(v.total)} />
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase text-muted-foreground">Por pedido</div>
              {r.porPedido.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados</p>
              ) : (
                r.porPedido.map((p) => (
                  <Row key={String(p.numero)} l={`Pedido Nº ${String(p.numero).padStart(2, "0")}`} v={formatCurrency(p.total)} />
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase text-muted-foreground">Top produtos</div>
              {r.topProdutos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados</p>
              ) : (
                r.topProdutos.map((p) => (
                  <Row key={p.nome} l={`${p.qtd}x ${p.nome}`} v={formatCurrency(p.total)} />
                ))
              )}
            </div>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button className="flex-1" onClick={handlePrint} disabled={loading && !isToday}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DailySalesReportDialog;
