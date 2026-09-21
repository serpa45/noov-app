import { QRCodeSVG } from "qrcode.react";
import { QrCode, Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRef } from "react";
import html2canvas from "html2canvas";
import { toast } from "@/hooks/use-toast";

interface TableQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesa: any;
  loja: any;
}

export function TableQrModal({ open, onOpenChange, mesa, loja }: TableQrModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const qrUrl = (mesaId: string, mesaNome: string) => {
    // Generates the table-specific URL using the client domain
    return `https://noov.app.br/${loja?.slug}?mesa=${mesaId}&mesaNome=${encodeURIComponent(mesaNome)}`;
  };

  const downloadQrBanner = async () => {
    if (!qrRef.current) return;
    try {
      const canvas = await html2canvas(qrRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff"
      });
      const link = document.createElement("a");
      link.download = `qrcode-${mesa.nome}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    }
  };

  const printQrBanner = async () => {
    if (!qrRef.current) return;
    try {
      const canvas = await html2canvas(qrRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const dataUrl = canvas.toDataURL("image/png");
      const win = window.open("", "_blank", "width=800,height=1000");
      if (!win) {
        toast({ title: "Permita pop-ups para imprimir", variant: "destructive" });
        return;
      }
      win.document.write(`<!DOCTYPE html><html><head><title>QR Mesa ${mesa?.nome ?? ""}</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          .page {
            width: 21cm; height: 29.7cm; position: relative;
            background: #fff; box-sizing: border-box;
          }
          .banner {
            position: absolute; top: 0; left: 0;
            width: 7.5cm; height: 10.5cm;
            object-fit: fill; display: block;
          }
            object-fit: contain; display: block;
          }
          @media print {
            .page { width: 21cm; height: 29.7cm; }
          }
        </style></head><body>
        <div class="page"><img class="banner" src="${dataUrl}" /></div>
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };</script>
        </body></html>`);
      win.document.close();
    } catch (e) {
      toast({ title: "Erro ao gerar impressão", variant: "destructive" });
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR Code - {mesa?.nome}
          </DialogTitle>
          <DialogDescription>
            Banner para mesa (10x8cm). Imprima ou salve a imagem.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center p-4 bg-muted/30 rounded-lg">
          <div 
            ref={qrRef}
            id="qr-banner-print"
            className="w-[300px] h-[450px] bg-white shadow-xl rounded-lg overflow-hidden flex flex-col items-center px-6 pt-3 pb-6 border relative print:shadow-none print:m-0 print:border-none"
            style={{ 
              fontFamily: "'Inter', sans-serif",
              borderColor: loja?.cor_primaria || '#f1f1f1'
            }}
          >
            <div 
              className="absolute top-0 left-0 w-full h-3" 
              style={{ backgroundColor: loja?.cor_primaria || '#2563EB' }}
            />

            <div className="flex flex-col items-center mt-2 mb-2 gap-1">
              {loja?.logo_url ? (
                <img src={loja.logo_url} alt={loja.nome} className="h-14 w-14 object-contain rounded-full border shadow-sm" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border">
                  <QrCode className="w-8 h-8 text-primary" />
                </div>
              )}
              <h2 className="text-xl font-black text-center text-gray-800 leading-tight uppercase tracking-tight">
                {loja?.nome}
              </h2>
            </div>

            <div className="text-center mb-3">
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Peça agora</p>
              <p className="text-sm font-extrabold text-gray-900 leading-tight">
                ESCANEIE O QR CODE<br/>E VEJA O CARDÁPIO
              </p>
            </div>

            <div className="p-3 bg-white rounded-2xl shadow-inner border-2 border-dashed border-gray-200 mb-2">
            {mesa && (
                <QRCodeSVG
                  value={qrUrl(mesa.id, mesa.nome)}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 mb-6 font-medium uppercase tracking-tighter text-center">
              Realize o seu pedido direto do celular
            </p>

            <div 
              className="absolute bottom-0 left-0 w-full py-2 flex items-center justify-center"
              style={{ backgroundColor: loja?.cor_primaria || '#2563EB' }}
            >
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Mesa {String(mesa?.nome ?? "").replace(/^mesa\s*/i, "") || mesa?.nome}
              </h3>
            </div>
          </div>

        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={downloadQrBanner}>
            <Download className="w-4 h-4 mr-2" /> Salvar PNG
          </Button>
          <Button className="flex-1" onClick={printQrBanner}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden;
          }
          #qr-banner-print, #qr-banner-print * {
            visibility: visible;
          }
          /* Banner original 300x450 escalado para caber em 10x8cm, ancorado no canto superior esquerdo da A4 */
          #qr-banner-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 300px !important;
            height: 450px !important;
            transform: scale(0.67) !important;
            transform-origin: top left !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </Dialog>
  );
}
