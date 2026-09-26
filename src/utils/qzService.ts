import * as qz from "qz-tray";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_QZ_CERTIFICATE, DEFAULT_QZ_PRIVATE_KEY, signWithWebCrypto } from "./qzSecurity";

export interface PrinterInfo {
  name: string;
}

/**
 * Service to manage QZ Tray connection and printing with digital signature
 */
class QZService {
  private static instance: QZService;
  private isConnected: boolean = false;
  private connectingPromise: Promise<void> | null = null;
  private isSecurityConfigured: boolean = false;
  private readonly signatureEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qz-tray-signature`;
  private readonly anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  private constructor() {}

  public static getInstance(): QZService {
    if (!QZService.instance) {
      QZService.instance = new QZService();
    }
    return QZService.instance;
  }

  /**
   * Configure digital security for QZ Tray to avoid "Untrusted" popups and enable silent printing
   */
  private configureSecurity(): void {
    if (this.isSecurityConfigured) return;

    try {
      qz.security.setSignatureAlgorithm("SHA256");

      // Busca um certificado remoto assinado pelo backend e cai no cert local se falhar.
      qz.security.setCertificatePromise((resolve: (cert: string) => void) => {
        void this.getCertificate()
          .then(resolve)
          .catch(() => resolve(DEFAULT_QZ_CERTIFICATE));
      });

      // Assinatura criptográfica — prioriza assinatura remota para evitar conexão anônima.
      qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: (sig: string) => void, reject: (err: any) => void) => {
          void this.signPayload(toSign)
            .then(resolve)
            .catch(reject);
        };
      });

      console.log("QZ Tray: Segurança configurada (certificado remoto/local + assinatura SHA-256).");
      this.isSecurityConfigured = true;
    } catch (err) {
      console.error("QZ Tray: Erro CRÍTICO ao configurar segurança:", err);
      // NÃO anula o certificado — melhor tentar com segurança parcial do que sem nenhuma
      this.isSecurityConfigured = true;
    }
  }

  private async getAuthHeaders(contentTypeJson = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (contentTypeJson) headers["Content-Type"] = "application/json";
    if (this.anonKey) headers.apikey = this.anonKey;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // sem sessão autenticada; segue com apikey
    }

    return headers;
  }

  private async getCertificate(): Promise<string> {
    if (!this.signatureEndpoint || !this.anonKey) {
      return DEFAULT_QZ_CERTIFICATE;
    }

    const res = await fetch(this.signatureEndpoint, {
      method: "GET",
      headers: await this.getAuthHeaders(false),
    });

    if (!res.ok) {
      throw new Error(`QZ certificate endpoint failed: ${res.status}`);
    }

    const cert = (await res.text()).trim();
    if (!cert.includes("BEGIN CERTIFICATE")) {
      throw new Error("Invalid certificate response");
    }
    return cert;
  }

  private async signPayload(toSign: string): Promise<string> {
    // 1) Tenta assinatura remota da edge function (sem expor chave privada no frontend)
    if (this.signatureEndpoint && this.anonKey) {
      try {
        const res = await fetch(this.signatureEndpoint, {
          method: "POST",
          headers: await this.getAuthHeaders(true),
          body: JSON.stringify({ request: toSign }),
        });
        if (res.ok) {
          const sig = (await res.text()).trim();
          if (sig) return sig;
        }
      } catch {
        // fallback local abaixo
      }
    }

    // 2) Fallback local para não quebrar em ambientes sem edge function
    return signWithWebCrypto(toSign, DEFAULT_QZ_PRIVATE_KEY);
  }

  /**
   * Initialize and connect to QZ Tray
   */
  public async connect(): Promise<void> {
    if (qz.websocket.isActive()) {
      this.isConnected = true;
      return;
    }
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        await this.configureSecurity();
        
        if (!qz.websocket.isActive()) {
          // Permite pequenas retentativas enquanto o usuário interage com o popup do QZ Tray
          await qz.websocket.connect({ retries: 2, delay: 1 });
        }
        this.isConnected = true;
        console.log("QZ Tray connected");
      } catch (err) {
        this.isConnected = false;
        console.warn("QZ Tray not found or waiting authorization", err);
        const errorText = String((err as any)?.message || err || "").toLowerCase();
        if (errorText.includes("blocked") || errorText.includes("untrusted") || errorText.includes("rejected")) {
          throw new Error(
            "O QZ Tray bloqueou este site como nao confiavel. Abra QZ Tray > Advanced > Site Manager, remova o dominio de Blocked e deixe em Allowed com 'Remember this decision'.",
          );
        }
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Find and select a printer
   */
  public async findPrinter(printerName?: string): Promise<string> {
    await this.connect();
    try {
      if (printerName) {
        return await qz.printers.find(printerName);
      }
      return await qz.printers.getDefault();
    } catch (err) {
      console.error("Error finding printer:", err);
      // If specific/default fails, try to find any printer with 'thermal' or 'receipt' in name
      try {
        const printers = await qz.printers.find();
        const thermal = printers.find((p: string) => 
          p.toLowerCase().includes('thermal') || 
          p.toLowerCase().includes('receipt') ||
          p.toLowerCase().includes('tm-') ||
          p.toLowerCase().includes('pos-')
        );
        return thermal || printers[0];
      } catch {
        throw new Error("Nenhuma impressora encontrada.");
      }
    }
  }

  /**
   * Print HTML content using QZ Tray
   */
  public async printHTML(content: string, printerName?: string, margins?: { top?: number; bottom?: number; left?: number; right?: number; doubleStrike?: boolean }): Promise<boolean> {
    try {
      const printer = await this.findPrinter(printerName);
      
      // QZ Tray margins are in INCHES by default.
      // 1 inch = 25.4mm
      const config = qz.configs.create(printer, {
        units: 'mm', // Explicitly set units to millimeters
        margins: {
          top: margins?.top || 0,
          bottom: margins?.bottom || 0,
          left: margins?.left || 0,
          right: margins?.right || 0
        },
        density: (margins as any)?.doubleStrike ? 'double' : undefined
      });

      const data = [{
        type: 'html',
        format: 'plain',
        data: `
          <html>
            <head>
              <style>
                body { 
                  margin: 0; 
                  padding: 0; 
                  width: 100%; 
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 14px;
                  font-weight: 700;
                  background: white;
                  color: black;
                  overflow: hidden;
                }
                .thermal-receipt-container { 
                  width: 100%; 
                  line-height: 1.4;
                  padding: 5px;
                  box-sizing: border-box;
                }
                .text-center { text-align: center; }
                .font-bold { font-weight: 900; }
                .text-base { font-size: 16px; }
                .text-sm { font-size: 13px; }
                .text-xs { font-size: 11px; }
                
                .border-t { 
                  border-top: 1.5px dashed black; 
                  margin-top: 10px;
                  margin-bottom: 10px;
                }
                .border-b { 
                  border-bottom: 1.5px solid black; 
                  margin-top: 10px;
                  margin-bottom: 10px;
                }
                
                .my-2 { margin-top: 12px; margin-bottom: 12px; }
                .mb-1 { margin-bottom: 6px; }
                .mb-2 { margin-bottom: 10px; }
                .mt-1 { margin-top: 6px; }
                .py-1.5 { padding-top: 8px; padding-bottom: 8px; }
                
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .items-center { align-items: center; }
                .gap-1.5 { gap: 8px; }
                .flex-1 { flex: 1; }
                .italic { font-style: italic; }
                
                .space-y-0.5 > * + * { margin-top: 4px; }
                
                p { margin: 0 0 6px 0; }
                
                .text-foreground { color: black !important; font-weight: 900; }
                .text-muted-foreground { color: black !important; font-weight: 700; }
                .text-primary { color: black !important; font-weight: 900; }
                
                button, .badge, .shrink-0.ml-1, .print-hidden { display: none !important; }
                [class~="print:hidden"], .print\\:hidden { display: none !important; }
              </style>
            </head>
            <body>
              <div class="thermal-receipt-container">
                ${content}
              </div>
            </body>
          </html>
        `
      }];

      await qz.print(config, data);
      return true;
    } catch (err: any) {
      console.error("QZ Print error:", err);
      if (err.message?.includes("not running") || err.message?.includes("offline")) {
        throw new Error("QZ Tray não está em execução ou impressora offline.");
      }
      throw err;
    }
  }

  /**
   * Raw ESC/POS printing (more reliable for thermal printers)
   */
  public async printRaw(commands: any[], printerName?: string): Promise<boolean> {
    try {
      const printer = await this.findPrinter(printerName);
      const config = qz.configs.create(printer);
      await qz.print(config, commands);
      return true;
    } catch (err) {
      console.error("QZ Raw Print error:", err);
      throw err;
    }
  }
  public isActive(): boolean {
    return qz.websocket.isActive();
  }

  /**
   * Get the system default printer
   */
  public async getDefaultPrinter(): Promise<string | null> {
    await this.connect();
    try {
      const def = await qz.printers.getDefault();
      return def || null;
    } catch (err) {
      console.warn("Could not get default printer:", err);
      return null;
    }
  }

  /**
   * List all available printers
   */
  public async listPrinters(): Promise<string[]> {
    await this.connect();
    try {
      const found = await qz.printers.find();
      const list = Array.isArray(found) ? found : (found ? [found] : []);
      if (list.length > 0) {
        return list;
      }
      // Se find() retornou vazio, tenta obter a padrão
      const def = await this.getDefaultPrinter();
      if (def) return [def];
      return [];
    } catch (err) {
      console.warn("Error in qz.printers.find(), attempting getDefault:", err);
      try {
        const def = await this.getDefaultPrinter();
        if (def) return [def];
      } catch {}
      return [];
    }
  }
}

export const qzService = QZService.getInstance();
