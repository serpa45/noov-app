// Bluetooth thermal printer (ESC/POS) via Web Bluetooth API
// Compatible with most generic 58mm/80mm BT thermal printers (Mini Print, MTP, GOOJPRT, etc.)
// On Android: works in Chrome/Edge. On iOS: works in apps like Bluefy browser (Web Bluetooth não suportado no Safari nativo).

import { buildReceiptBytes, buildReceiptData, ReceiptData } from "./thermalPrint";

// Serviços ESC/POS comuns em impressoras térmicas Bluetooth
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Genérico (MTP, GOOJPRT, Mini Print)
  "0000ff00-0000-1000-8000-00805f9b34fb", // Alternativo
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC/Microchip
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Outro modelo comum
];

const WRITE_CHARACTERISTICS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
];

const CHUNK_SIZE = 180; // BLE MTU típico ~ 185-244 bytes

export type PrintTextSize = "small" | "normal" | "large";

export interface BluetoothPrinterSettings {
  paperWidth: 58 | 80;
  autoPrint: boolean;
  printOnAccept?: boolean;
  deviceId?: string;
  deviceName?: string;
  textSize?: PrintTextSize;
  sharpMode?: boolean;
}

const STORAGE_KEY = "bt-printer-settings";

export function getBluetoothSettings(): BluetoothPrinterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // backward-compat: valores antigos só conheciam small/normal
      const validSizes: PrintTextSize[] = ["small", "normal", "large"];
      const textSize = validSizes.includes(parsed.textSize) ? parsed.textSize : "normal";
      return { sharpMode: false, printOnAccept: true, ...parsed, textSize };
    }
  } catch {}
  return { paperWidth: 58, autoPrint: false, textSize: "normal", sharpMode: false, printOnAccept: true };
}

export function saveBluetoothSettings(s: BluetoothPrinterSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function htmlToReceiptText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const container = document.createElement("div");
  container.innerHTML = html;
  // remove elementos não imprimíveis
  container.querySelectorAll("button, .print-hidden, .print\\:hidden, [class~='print:hidden']").forEach((el) => el.remove());
  const separator = "--------------------------------";

  container.querySelectorAll<HTMLElement>("div, hr").forEach((el) => {
    const style = el.getAttribute("style") || "";
    if (/border-(top|bottom)\s*:/i.test(style) && !el.textContent?.trim()) {
      el.textContent = `\n${separator}\n`;
    }
  });

  container.querySelectorAll("br").forEach((el) => el.replaceWith(document.createTextNode("\n")));
  container.querySelectorAll("th, td").forEach((el) => el.appendChild(document.createTextNode("  ")));
  container.querySelectorAll("tr, div, p, li, h1, h2, h3, h4").forEach((el) => {
    el.appendChild(document.createTextNode("\n"));
  });

  const text = (container.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}



class BluetoothPrintService {
  private device: any | null = null;
  private characteristic: any | null = null;

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  async requestDevice(): Promise<string> {
    if (!this.isSupported()) {
      throw new Error(
        "Bluetooth não suportado neste navegador. No Android use Chrome; no iOS use o app Bluefy."
      );
    }
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { namePrefix: "Printer" },
        { namePrefix: "MTP" },
        { namePrefix: "BlueTooth Printer" },
        { namePrefix: "MPT" },
        { namePrefix: "GOOJPRT" },
        { namePrefix: "RPP" },
        { namePrefix: "MP" },
        { namePrefix: "POS" },
        { namePrefix: "BT" },
        { namePrefix: "PT" },
      ],
      optionalServices: PRINTER_SERVICES,
    }).catch(async () => {
      // Fallback: aceitar todos os dispositivos
      return await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });
    });

    this.device = device;
    await this.connect();
    const name = device.name || "Impressora Bluetooth";
    const s = getBluetoothSettings();
    saveBluetoothSettings({ ...s, deviceId: device.id, deviceName: name });
    return name;
  }

  private async connect(): Promise<void> {
    if (!this.device) throw new Error("Nenhum dispositivo selecionado");
    const server = await this.device.gatt.connect();

    // Auto-reconnect: quando a impressora desligar/sair de alcance, tenta voltar sozinha
    try {
      this.device.removeEventListener?.("gattserverdisconnected", this.handleDisconnected);
      this.device.addEventListener?.("gattserverdisconnected", this.handleDisconnected);
    } catch {}

    for (const svcUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(svcUuid);
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (
            ch.properties.write ||
            ch.properties.writeWithoutResponse ||
            WRITE_CHARACTERISTICS.includes(ch.uuid)
          ) {
            this.characteristic = ch;
            return;
          }
        }
      } catch {
        continue;
      }
    }
    throw new Error("Não foi possível encontrar característica de escrita na impressora");
  }

  private handleDisconnected = async () => {
    this.characteristic = null;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      try {
        if (this.device?.gatt && !this.device.gatt.connected) {
          await this.connect();
          if (this.isConnected()) return;
        }
      } catch {
        // continua tentando
      }
    }
  };

  async ensureConnected(): Promise<void> {
    if (!this.device) throw new Error("Conecte uma impressora Bluetooth primeiro");
    if (!this.device.gatt.connected || !this.characteristic) {
      await this.connect();
    }
  }

  async sendBytes(bytes: Uint8Array): Promise<void> {
    await this.ensureConnected();
    if (!this.characteristic) throw new Error("Característica de escrita não disponível");

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      try {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } catch {
        await this.characteristic.writeValue(chunk);
      }
      // pequena pausa entre chunks para não saturar o buffer da impressora
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  // Aplica opções de fonte/nitidez de forma dinâmica.
  // - small: Font B + modo condensado + remove ampliações (GS ! 0)
  // - normal: Font A com formatações originais (negrito/double-height preservados)
  // - large: Font A + força GS ! 2x2 globalmente, mantendo bits originais
  private applyStyleOptions(bytes: Uint8Array): Uint8Array {
    const s = getBluetoothSettings();
    const size: PrintTextSize = this.effectiveTextSize();
    const patched = new Uint8Array(bytes);

    for (let i = 0; i < patched.length - 2; i++) {
      // ESC ! n (print mode: font, bold, double-width, double-height)
      if (patched[i] === 0x1b && patched[i + 1] === 0x21) {
        const orig = patched[i + 2];
        const boldBit = orig & 0x08;
        const heightBit = orig & 0x10;
        const widthBit = orig & 0x20;
        if (size === "small") {
          // Font B + preserva negrito, remove ampliações
          patched[i + 2] = boldBit | 0x01;
        } else if (size === "large") {
          // Font A + preserva tudo, força double-height
          patched[i + 2] = boldBit | heightBit | widthBit;
        }
      }
      // GS ! n (character size 0xWH)
      if (patched[i] === 0x1d && patched[i + 1] === 0x21) {
        if (size === "small") {
          patched[i + 2] = 0x00;
        } else if (size === "large") {
          const orig = patched[i + 2];
          const w = (orig >> 4) & 0x0f;
          const h = orig & 0x0f;
          patched[i + 2] = (Math.min(w + 1, 3) << 4) | Math.min(h + 1, 3);
        }
      }
    }

    const extra: number[] = [];
    if (size === "small") {
      extra.push(0x0f); // SI — modo condensado quando suportado pela impressora
      extra.push(0x1b, 0x21, 0x01); // ESC ! Font B (bit0 seleciona Font B)
      extra.push(0x1d, 0x21, 0x00); // GS ! 1x1
      extra.push(0x1b, 0x20, 0x00); // ESC SP 0 — sem espaçamento extra entre caracteres
    } else if (size === "large") {
      extra.push(0x12); // DC2 — cancela condensado
      extra.push(0x1b, 0x21, 0x00); // ESC ! Font A
      extra.push(0x1d, 0x21, 0x11); // GS ! 2x2 base
    } else {
      extra.push(0x12); // DC2 — cancela condensado
      extra.push(0x1b, 0x21, 0x00); // ESC ! Font A
      extra.push(0x1d, 0x21, 0x00);
    }
    // Double-strike para impressão mais nítida — ESC G n
    extra.push(0x1b, 0x47, s.sharpMode ? 0x01 : 0x00);
    const initIdx =
      patched.length >= 2 && patched[0] === 0x1b && patched[1] === 0x40 ? 2 : 0;
    const out = new Uint8Array(patched.length + extra.length);
    out.set(patched.slice(0, initIdx), 0);
    out.set(extra, initIdx);
    out.set(patched.slice(initIdx), initIdx + extra.length);
    return out;
  }

  // Em papel 58mm o texto padrão fica apertado; reduz um nível para caber melhor
  private effectiveTextSize(): PrintTextSize {
    const s = getBluetoothSettings();
    const size: PrintTextSize = s.textSize ?? "normal";
    if (s.paperWidth === 58) {
      if (size === "large") return "normal";
      if (size === "normal") return "small";
    }
    return size;
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    const settings = getBluetoothSettings();
    const size = this.effectiveTextSize();
    const bytes = this.applyStyleOptions(
      buildReceiptBytes(data, { textSize: size, paperWidth: settings.paperWidth })
    );
    await this.sendBytes(bytes);
  }

  // Imprime a partir do HTML do ThermalReceipt. Se houver payload JSON embutido
  // (<script data-noov-receipt>), reconstrói o recibo via ESC/POS estruturado
  // para espelhar EXATAMENTE o layout do comprovante detalhado.
  async printHTML(html: string): Promise<void> {
    const match = html.match(/<script[^>]*data-noov-receipt[^>]*>([\s\S]*?)<\/script>/i);
    if (match) {
      try {
        const payload = JSON.parse(match[1]);
        if (payload?.order && payload?.loja) {
          const data = buildReceiptData(payload.order, payload.loja, payload.orderNumStr || "");
          await this.printReceipt(data);
          return;
        }
      } catch (e) {
        console.warn("Falha ao decodificar payload do recibo, usando fallback texto:", e);
      }
    }

    // Fallback: extrai texto bruto do HTML
    const text = htmlToReceiptText(html);
    const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
    const init = [ESC, 0x40];
    const align = [ESC, 0x61, 0x00];
    const encoder = new TextEncoder();
    const body = encoder.encode(text + "\n\n\n\n");
    const cut = [GS, 0x56, 0x42, 0x00];
    const out = new Uint8Array(init.length + align.length + body.length + 1 + cut.length);
    let o = 0;
    out.set(init, o); o += init.length;
    out.set(align, o); o += align.length;
    out.set(body, o); o += body.length;
    out[o++] = LF;
    out.set(cut, o);
    await this.sendBytes(this.applyStyleOptions(out));
  }

  async printTest(): Promise<void> {
    const settings = getBluetoothSettings();
    const data: ReceiptData = {
      storeName: "NOOV",
      orderNumber: "TESTE",
      date: new Date().toLocaleString("pt-BR"),
      type: "Teste",
      clientName: "Configuração",
      items: [
        { name: "Teste de Impressão", qty: 1, price: 0 },
        { name: `Papel ${settings.paperWidth}mm`, qty: 1, price: 0 },
      ],
      total: 0,
      observations: "Impressora Bluetooth configurada com sucesso!",
    };
    await this.printReceipt(data);
  }

  disconnect() {
    try {
      this.device?.gatt?.disconnect();
    } catch {}
    this.device = null;
    this.characteristic = null;
  }

  isConnected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic;
  }

  // Tenta reconectar a uma impressora previamente autorizada (Chrome Android).
  // Requer chrome://flags/#enable-experimental-web-platform-features OU
  // permissão já concedida via requestDevice. Não exibe seletor.
  async tryAutoReconnect(): Promise<boolean> {
    if (this.isConnected()) return true;
    const settings = getBluetoothSettings();
    if (!settings.deviceId && !settings.deviceName) return false;
    try {
      const bt: any = (navigator as any).bluetooth;
      if (bt && typeof bt.getDevices === "function") {
        const devices = await bt.getDevices();
        const match =
          devices.find((d: any) => settings.deviceId && d.id === settings.deviceId) ||
          devices.find((d: any) => settings.deviceName && d.name === settings.deviceName) ||
          devices[0];
        if (match) {
          this.device = match;
          await this.connect();
          const current = getBluetoothSettings();
          saveBluetoothSettings({
            ...current,
            deviceId: match.id || current.deviceId,
            deviceName: match.name || current.deviceName,
          });
          return this.isConnected();
        }
      }
    } catch (e) {
      console.warn("Bluetooth auto-reconnect falhou:", e);
    }
    return false;
  }
}

export const bluetoothPrintService = new BluetoothPrintService();
