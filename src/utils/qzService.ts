import * as qz from "qz-tray";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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

  private constructor() {}

  public static getInstance(): QZService {
    if (!QZService.instance) {
      QZService.instance = new QZService();
    }
    return QZService.instance;
  }

  /**
   * Configure digital security for QZ Tray to avoid "Untrusted" popups
   */
  private async configureSecurity(): Promise<void> {
    if (this.isSecurityConfigured) return;

    try {
      // QZ Tray defaults to SHA1. Our backend signs with SHA-256, so the
      // browser client must explicitly announce SHA256 or QZ shows
      // "Cannot verify trust - Invalid Signature".
      qz.security.setSignatureAlgorithm("SHA256");

      // Set the certificate promise
      qz.security.setCertificatePromise(async () => {
        const { data, error } = await supabase.functions.invoke('qz-tray-signature', {
          method: 'GET'
        });
        
        if (error) {
          console.warn("Could not fetch QZ certificate, using anonymous mode:", error);
          throw error;
        }
        if (typeof data !== 'string') {
          throw new Error("Certificado QZ inválido retornado pelo servidor");
        }
        return data;
      });

      // Set the signature promise
      qz.security.setSignaturePromise(async (toSign) => {
        const { data, error } = await supabase.functions.invoke('qz-tray-signature', {
          body: { request: toSign }
        });
        
        if (error) {
          console.error("QZ Signature error:", error);
          throw error;
        }
        if (typeof data !== 'string') {
          throw new Error("Assinatura QZ inválida retornada pelo servidor");
        }
        return data;
      });

      this.isSecurityConfigured = true;
      console.log("QZ Tray security configured");
    } catch (err) {
      console.error("Failed to configure QZ Tray security:", err);
    }
  }

  /**
   * Initialize and connect to QZ Tray
   */
  public async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        await this.configureSecurity();
        
        if (!qz.websocket.isActive()) {
          await qz.websocket.connect();
        }
        this.isConnected = true;
        console.log("QZ Tray connected");
      } catch (err) {
        this.isConnected = false;
        this.connectingPromise = null;
        console.warn("QZ Tray not found or not running", err);
        throw err;
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
  /**
   * List all available printers
   */
  public async listPrinters(): Promise<string[]> {
    await this.connect();
    try {
      return await qz.printers.find();
    } catch (err) {
      console.error("Error listing printers:", err);
      return [];
    }
  }
}

export const qzService = QZService.getInstance();
