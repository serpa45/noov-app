import { toast } from "sonner";
import { qzService } from "./qzService";
import { bluetoothPrintService, getBluetoothSettings } from "./bluetoothPrint";
import { buildKitchenBytes, KitchenTicketData } from "./thermalPrint";

export const isMobileOrTabletDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  // iPadOS 13+ reports as Mac but has touch
  const isIPadOS = ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document;
  const hasTouch = typeof window !== "undefined" && (navigator.maxTouchPoints || 0) > 1;
  const smallViewport = typeof window !== "undefined" && window.innerWidth < 1024;
  return uaMobile || isIPadOS || (hasTouch && smallViewport);
};

// Verifica se este dispositivo tem uma impressora Bluetooth pareada/conectada
// que deve ter prioridade sobre a QZ Tray.
const hasBluetoothPrinterReady = async (): Promise<boolean> => {
  if (!bluetoothPrintService.isSupported()) return false;
  const s = getBluetoothSettings();
  const configured = !!s.deviceId || !!s.deviceName || bluetoothPrintService.isConnected();
  if (!configured) return false;
  if (bluetoothPrintService.isConnected()) return true;
  try {
    await bluetoothPrintService.tryAutoReconnect();
  } catch {}
  return bluetoothPrintService.isConnected();
};

const SUCCESS_STYLE = { style: { background: "#16a34a", color: "#fff", border: "1px solid #15803d" } };
const ERROR_STYLE = { style: { background: "#dc2626", color: "#fff", border: "1px solid #b91c1c" } };

export const printReceipt = async (content: string) => {
  if (!content) {
    toast.error("Conteúdo do recibo não encontrado", ERROR_STYLE);
    return;
  }

  const isMobile = isMobileOrTabletDevice();
  const btSettings = getBluetoothSettings();
  const btConfigured = !!btSettings.deviceId || !!btSettings.deviceName || bluetoothPrintService.isConnected();

  // 1) PRIORIDADE: Bluetooth se configurada. Tenta reconectar silenciosamente.
  if (btConfigured && bluetoothPrintService.isSupported()) {
    try {
      if (!bluetoothPrintService.isConnected()) {
        await bluetoothPrintService.tryAutoReconnect();
      }
      if (bluetoothPrintService.isConnected()) {
        await bluetoothPrintService.printHTML(content);
        toast.success("Impressão enviada", SUCCESS_STYLE);
        return;
      }
      // Não conectou: no desktop cai para QZ; no mobile mostra erro genérico.
      if (isMobile) {
        toast.error("Falha ao enviar impressão", ERROR_STYLE);
        return;
      }
    } catch (err: any) {
      console.error("Bluetooth print failed:", err);
      if (isMobile) {
        toast.error("Falha ao enviar impressão", ERROR_STYLE);
        return;
      }
      // Desktop: cai para QZ Tray abaixo.
    }
  }

  // 2) Em mobile sem Bluetooth configurada: bloqueia (não abre diálogo nativo).
  if (isMobile) {
    toast.error("Falha ao enviar impressão", ERROR_STYLE);
    return;
  }

  // 3) Desktop: tenta QZ Tray (impressora térmica configurada).
  try {
    const success = await qzService.printHTML(content);
    if (success) {
      toast.success("Impressão enviada", SUCCESS_STYLE);
      return;
    }
  } catch (err) {
    console.log("QZ Tray not available or failed, falling back to browser print");
  }

  // 4) Fallback desktop: pop-up com window.print().
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    toast.error("Falha ao enviar impressão", ERROR_STYLE);
    return;
  }

  printWindow.document.write(buildPrintHTML(content, false));
  printWindow.document.close();
  toast.success("Impressão enviada", SUCCESS_STYLE);
};

export { SUCCESS_STYLE as PRINT_SUCCESS_STYLE, ERROR_STYLE as PRINT_ERROR_STYLE };


export const printReceiptInline = (content: string) => {
  printOnCurrentMobileDocument(content);
};

const printOnCurrentMobileDocument = (content: string) => {
  document.getElementById("noov-mobile-print-root")?.remove();
  document.getElementById("noov-mobile-print-style")?.remove();

  const root = document.createElement("div");
  root.id = "noov-mobile-print-root";
  root.className = "thermal-receipt-container";
  root.innerHTML = content;
  root.style.display = "none";

  const style = document.createElement("style");
  style.id = "noov-mobile-print-style";
  style.textContent = `
    @page { margin: 0; }
    @media screen { #noov-mobile-print-root { display: none !important; } }
    @media print {
      html, body { background: white !important; width: 100% !important; overflow: visible !important; }
      body { margin: 0 !important; padding: 0 !important; }
      body > *:not(#noov-mobile-print-root) { display: none !important; }
      #noov-mobile-print-root {
        display: block !important;
        width: 100% !important;
        max-width: 280px !important;
        margin: 0 auto !important;
        padding: 4px !important;
        background: white !important;
        color: black !important;
        font-family: 'Courier New', Courier, monospace !important;
        font-size: 11px !important;
        line-height: 1.15 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #noov-mobile-print-root button,
      #noov-mobile-print-root .badge,
      #noov-mobile-print-root .print-hidden,
      #noov-mobile-print-root [class~="print:hidden"],
      #noov-mobile-print-root .print\\:hidden { display: none !important; }
    }
  `;

  const cleanup = () => {
    root.remove();
    style.remove();
    window.removeEventListener("afterprint", handleAfterPrint);
  };
  const handleAfterPrint = () => setTimeout(cleanup, 2000);

  document.head.appendChild(style);
  document.body.appendChild(root);
  window.addEventListener("afterprint", handleAfterPrint);

  try {
    void root.offsetHeight;
    window.focus();
    window.print();
    setTimeout(cleanup, 60000);
  } catch (e) {
    console.error(e);
    cleanup();
    toast.error("Falha ao abrir a impressão nativa do dispositivo");
  }
};

const buildPrintHTML = (content: string, isMobile: boolean) => {
  const autoPrintScript = isMobile
    ? ""
    : `<script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.onafterprint = function() { window.close(); };
              setTimeout(() => { if (!window.closed) window.close(); }, 2000);
            }, 500);
          };
        </script>`;
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Impressão - Noov</title>
        <style>
          @page { margin: 0; }
          body { 
            margin: 0;
            padding: 5px;
            background: white;
            color: black;
            font-family: 'Courier New', Courier, monospace;
            -webkit-print-color-adjust: exact;
          }
          .thermal-receipt-container {
            font-size: 11px;
            line-height: 1.1;
            width: 100%;
            max-width: 280px;
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .text-base { font-size: 14px; }
          .text-sm { font-size: 11px; }
          .text-xs { font-size: 9px; }
          
          /* Finas linhas de separação */
          .border-t { border-top: 0.5px dashed black; }
          .border-b { border-bottom: 0.5px solid #ddd; }
          .border-dashed { border-style: dashed; border-width: 0.5px; }
          .border-dotted { border-style: dotted; border-width: 0.5px; }
          
          .my-2 { margin-top: 4px; margin-bottom: 4px; }
          .mb-1 { margin-bottom: 2px; }
          .mb-1.5 { margin-bottom: 3px; }
          .mb-2 { margin-bottom: 4px; }
          .mb-3 { margin-bottom: 6px; }
          .mt-0.5 { margin-top: 1px; }
          .mt-1 { margin-top: 2px; }
          .mt-2 { margin-top: 4px; }
          .ml-2 { margin-left: 4px; }
          .ml-5 { margin-left: 10px; }
          .py-1.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-3 { padding-top: 4px; padding-bottom: 4px; }
          .px-5 { padding-left: 5px; padding-right: 5px; }
          
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-start { align-items: flex-start; }
          .items-center { align-items: center; }
          .items-baseline { align-items: baseline; }
          .gap-1.5 { gap: 4px; }
          .gap-2 { gap: 6px; }
          .flex-1 { flex: 1; }
          .shrink-0 { flex-shrink: 0; }
          .min-w-0 { min-width: 0; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .font-medium { font-weight: 500; }
          .italic { font-style: italic; }
          
          /* Espaçamento entre linhas reduzido */
          .space-y-0.5 > * + * { margin-top: 1px; }
          .space-y-1 > * + * { margin-top: 2px; }
          
          /* Estilos específicos para emular o layout original */
          .thermal-receipt-container p { margin: 0 0 2px 0; }
          
          /* Utility colors replaced for print */
          .text-foreground { color: black !important; }
          .text-muted-foreground { color: #555 !important; }
          .text-primary { color: black !important; }
          
          /* Hide interactive UI elements */
          button, .badge, .shrink-0.ml-1, .print-hidden { display: none !important; }
          /* Honor Tailwind's print:hidden utility (escaped colon class name) */
          [class~="print:hidden"], .print\\:hidden { display: none !important; }
          
          @media print {
            body { padding: 0; width: 100%; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="thermal-receipt-container">
          ${content}
        </div>
        ${autoPrintScript}
      </body>
    </html>
  `;
};


// Imprime um ticket enxuto para a cozinha (nº pedido, hora e itens).
// Em mobile/tablet: envia ESC/POS direto para a impressora Bluetooth pareada.
// Em desktop: tenta QZ Tray; se indisponível, abre um pop-up minimalista.
export const printKitchenTicket = async (data: KitchenTicketData) => {
  const isMobile = isMobileOrTabletDevice();
  const settings = getBluetoothSettings();
  const btConfigured = !!settings.deviceId || !!settings.deviceName || bluetoothPrintService.isConnected();

  // 1) PRIORIDADE: Bluetooth pareada. Tenta reconectar silenciosamente.
  if (btConfigured && bluetoothPrintService.isSupported()) {
    try {
      if (!bluetoothPrintService.isConnected()) await bluetoothPrintService.tryAutoReconnect();
      if (bluetoothPrintService.isConnected()) {
        const bytes = buildKitchenBytes(data, { paperWidth: settings.paperWidth });
        await bluetoothPrintService.sendBytes(bytes);
        toast.success("Impressão enviada", SUCCESS_STYLE);
        return;
      }
      if (isMobile) {
        toast.error("Falha ao enviar impressão", ERROR_STYLE);
        return;
      }
    } catch (err: any) {
      console.error("Bluetooth kitchen print failed:", err);
      if (isMobile) {
        toast.error("Falha ao enviar impressão", ERROR_STYLE);
        return;
      }
    }
  }

  // 2) Mobile sem Bluetooth: bloqueia.
  if (isMobile) {
    toast.error("Falha ao enviar impressão", ERROR_STYLE);
    return;
  }

  // 3) Desktop: QZ Tray como fallback.
  const itemsHtml = data.items
    .map((it) => {
      const extras = (it.extras || [])
        .map((e: any) => {
          const nome = typeof e === "string" ? e : e?.nome || "";
          const q = typeof e === "object" ? Math.max(1, Number(e?.quantidade) || 1) : 1;
          return nome ? `<div style="padding-left:12px;font-size:11px">+ ${nome}${q > 1 ? ` x${q}` : ""}</div>` : "";
        })
        .join("");
      const sab = it.sabores?.length ? `<div style="padding-left:12px;font-size:11px">Sab: ${it.sabores.join(" / ")}</div>` : "";
      const tam = it.tamanho ? `<div style="padding-left:12px;font-size:11px">Tam: ${it.tamanho}</div>` : "";
      const obs = it.obs ? `<div style="padding-left:12px;font-size:11px;font-style:italic">Obs: ${it.obs}</div>` : "";
      return `<div style="margin-bottom:6px"><div style="font-weight:bold;font-size:13px">${it.qty}x ${it.name}</div>${tam}${sab}${extras}${obs}</div>`;
    })
    .join("");

  const html = `
    <div style="font-family:monospace;max-width:280px;margin:0 auto;padding:8px">
      <div style="text-align:center;font-weight:900">** COZINHA **</div>
      <div style="text-align:center;font-weight:900;font-size:14px">PEDIDO Nº ${data.orderNumber}</div>
      ${data.date ? `<div style="font-size:11px">Hora: ${data.date}</div>` : ""}
      ${data.mesaNome ? `<div style="font-size:11px">Mesa: ${data.mesaNome}</div>` : ""}
      ${data.garcomNome ? `<div style="font-size:11px">Garçom: ${data.garcomNome}</div>` : ""}
      <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
      <div style="font-weight:bold;margin-bottom:4px">ITENS·${(data.items || []).reduce((s: number, it: any) => s + (Number(it?.qty) || 0), 0)}</div>
      ${itemsHtml}
    </div>`;

  try {
    const ok = await qzService.printHTML(html);
    if (ok) { toast.success("Impressão enviada", SUCCESS_STYLE); return; }
  } catch {}

  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) { toast.error("Falha ao enviar impressão", ERROR_STYLE); return; }
  w.document.write(buildPrintHTML(html, false));
  w.document.close();
  toast.success("Impressão enviada", SUCCESS_STYLE);
};
