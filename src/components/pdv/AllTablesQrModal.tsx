import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AllTablesQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mesas: any[];
  loja: any;
}

export function AllTablesQrModal({ open, onOpenChange, mesas, loja }: AllTablesQrModalProps) {
  const qrUrl = (mesaId: string, mesaNome: string) =>
    `https://noov.app.br/${loja?.slug}?mesa=${mesaId}&mesaNome=${encodeURIComponent(mesaNome)}`;

  const handlePrint = () => {
    const source = document.getElementById("all-qr-print");
    if (!source) return window.print();
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return window.print();
    const styles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    )
      .map((n) => n.outerHTML)
      .join("\n");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>QR Code Mesas</title>${styles}
      <style>
        body { margin: 0; background: #e5e7eb; display: flex; justify-content: center; padding: 16px; }
        #all-qr-print.a4-page { zoom: 1 !important; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
        @media print {
          body { background: #fff; padding: 0; }
          #all-qr-print.a4-page { box-shadow: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      </style>
    </head><body>${source.outerHTML}</body></html>`);
    w.document.close();
    w.onload = () => {
      setTimeout(() => {
        w.focus();
        w.print();
      }, 500);
    };
  };

  const Banner = ({ mesa }: { mesa: any }) => (
    <div
      className="qr-banner-design w-[300px] h-[450px] bg-white rounded-lg overflow-hidden flex flex-col items-center px-6 pt-3 pb-6 border relative"
      style={{
        fontFamily: "'Inter', sans-serif",
        borderColor: loja?.cor_primaria || "#f1f1f1",
      }}
    >
      <div
        className="absolute top-0 left-0 w-full h-3"
        style={{ backgroundColor: loja?.cor_primaria || "#2563EB" }}
      />

      <div className="flex flex-col items-center mt-2 mb-2 gap-1">
        {loja?.logo_url ? (
          <img
            src={loja.logo_url}
            alt={loja.nome}
            className="h-14 w-14 object-contain rounded-full border shadow-sm"
          />
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
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">
          Peça agora
        </p>
        <p className="text-sm font-extrabold text-gray-900 leading-tight">
          ESCANEIE O QR CODE<br />E VEJA O CARDÁPIO
        </p>
      </div>

      <div className="p-3 bg-white rounded-2xl shadow-inner border-2 border-dashed border-gray-200 mb-2">
        <QRCodeSVG
          value={qrUrl(mesa.id, mesa.nome)}
          size={160}
          level="H"
          includeMargin={false}
        />
      </div>

      <p className="text-[10px] text-gray-400 mt-1 mb-6 font-medium uppercase tracking-tighter text-center">
        Realize o seu pedido direto do celular
      </p>

      <div
        className="absolute bottom-0 left-0 w-full py-2 flex items-center justify-center"
        style={{ backgroundColor: loja?.cor_primaria || "#2563EB" }}
      >
        <h3 className="text-lg font-black text-white uppercase tracking-wide">
          Mesa {String(mesa?.nome ?? "").replace(/^mesa\s*/i, "") || mesa?.nome}
        </h3>
      </div>
    </div>
  );

  const PER_PAGE = 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-primary" />
                QR Code de Todas as Mesas
              </DialogTitle>
              <DialogDescription>
                Cada banner imprime em 7,5×10,5 cm. Layout em página A4 (4 por página).
              </DialogDescription>
            </div>
            <Button onClick={handlePrint} size="sm" className="mr-8">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 bg-muted/40 p-4 rounded-lg overflow-auto">
          <div id="all-qr-print">
            {Array.from({ length: Math.ceil(mesas.length / PER_PAGE) }).map((_, pageIdx) => {
              const pageMesas = mesas.slice(pageIdx * PER_PAGE, pageIdx * PER_PAGE + PER_PAGE);
              return (
                <div key={pageIdx} className="a4-page bg-white shadow-xl">
                  <div className="qr-print-grid">
                    {pageMesas.map((mesa) => (
                      <div key={mesa.id} className="qr-cell">
                        <Banner mesa={mesa} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>

      <style>{`
        #all-qr-print .a4-page {
          width: 21cm;
          height: 29.7cm;
          padding: 0.75cm;
          box-sizing: border-box;
          background: #fff;
          zoom: 0.55;
          margin-bottom: 1rem;
        }
        #all-qr-print .qr-print-grid {
          display: grid;
          grid-template-columns: repeat(2, 7.5cm);
          grid-template-rows: repeat(2, 10.5cm);
          column-gap: 1cm;
          row-gap: 1cm;
          justify-content: center;
          align-content: center;
        }
        #all-qr-print .qr-cell {
          width: 7.5cm;
          height: 10.5cm;
          overflow: hidden;
          position: relative;
        }
        #all-qr-print .qr-cell .qr-banner-design {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.881);
          transform-origin: center center;
        }

        @media print {
          body * { visibility: hidden; }
          #all-qr-print, #all-qr-print * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          #all-qr-print { position: absolute; left: 0; top: 0; }
          #all-qr-print .a4-page {
            width: 21cm;
            height: 29.7cm;
            padding: 0.75cm;
            background: #fff;
            zoom: 1;
            margin: 0;
            box-shadow: none !important;
            page-break-after: always;
            break-after: page;
          }
          #all-qr-print .a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          #all-qr-print .qr-cell {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </Dialog>
  );
}
