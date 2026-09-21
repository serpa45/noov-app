import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface MarginEditorProps {
  isOpen: boolean;
  onClose: () => void;
  margens: {
    superior: number;
    inferior: number;
    esquerda: number;
    direita: number;
  };
  onSave: (margens: {
    superior: number;
    inferior: number;
    esquerda: number;
    direita: number;
  }) => void;
}

const MarginEditor = ({ isOpen, onClose, margens, onSave }: MarginEditorProps) => {
  const [localMargens, setLocalMargens] = useState(margens);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);

  useEffect(() => {
    setLocalMargens(margens);
  }, [margens]);

  const handleMouseDown = (side: string) => {
    setIsDragging(side);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Constantes para escala (considerando 1mm = 2px para visualização)
    const scale = 2;

    if (isDragging === "superior") {
      const val = Math.max(0, Math.min(100, Math.round((y / scale) * 10) / 10));
      setLocalMargens(prev => ({ ...prev, superior: val }));
    } else if (isDragging === "inferior") {
      const val = Math.max(0, Math.min(100, Math.round(((rect.height - y) / scale) * 10) / 10));
      setLocalMargens(prev => ({ ...prev, inferior: val }));
    } else if (isDragging === "esquerda") {
      const val = Math.max(0, Math.min(50, Math.round((x / scale) * 10) / 10));
      setLocalMargens(prev => ({ ...prev, esquerda: val }));
    } else if (isDragging === "direita") {
      const val = Math.max(0, Math.min(50, Math.round(((rect.width - x) / scale) * 10) / 10));
      setLocalMargens(prev => ({ ...prev, direita: val }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const scale = 2;
  const paperWidth = 80 * scale; // 80mm
  const paperHeight = 120 * scale; // 120mm visual

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajustar Margens da Impressora</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg w-full">
            Clique e arraste as linhas azuis para ajustar as margens (valores em mm).
          </div>

          <div 
            ref={containerRef}
            className="relative bg-white shadow-2xl border border-gray-200 overflow-hidden cursor-crosshair"
            style={{ width: paperWidth, height: paperHeight }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Linhas de Margem */}
            <div 
              className={`absolute w-full h-0.5 bg-blue-500 hover:h-1 transition-all cursor-ns-resize z-10 ${isDragging === 'superior' ? 'h-1' : ''}`}
              style={{ top: localMargens.superior * scale }}
              onMouseDown={() => handleMouseDown("superior")}
            />
            <div 
              className={`absolute w-full h-0.5 bg-blue-500 hover:h-1 transition-all cursor-ns-resize z-10 ${isDragging === 'inferior' ? 'h-1' : ''}`}
              style={{ bottom: localMargens.inferior * scale }}
              onMouseDown={() => handleMouseDown("inferior")}
            />
            <div 
              className={`absolute h-full w-0.5 bg-blue-500 hover:w-1 transition-all cursor-ew-resize z-10 ${isDragging === 'esquerda' ? 'w-1' : ''}`}
              style={{ left: localMargens.esquerda * scale }}
              onMouseDown={() => handleMouseDown("esquerda")}
            />
            <div 
              className={`absolute h-full w-0.5 bg-blue-500 hover:w-1 transition-all cursor-ew-resize z-10 ${isDragging === 'direita' ? 'w-1' : ''}`}
              style={{ right: localMargens.direita * scale }}
              onMouseDown={() => handleMouseDown("direita")}
            />

            {/* Conteúdo Exemplo do Recibo */}
            <div 
              className="absolute pointer-events-none opacity-40 font-mono text-[8px] flex flex-col items-center w-full"
              style={{ 
                paddingTop: localMargens.superior * scale,
                paddingBottom: localMargens.inferior * scale,
                paddingLeft: localMargens.esquerda * scale,
                paddingRight: localMargens.direita * scale,
              }}
            >
              <div className="font-bold text-center border-b border-gray-300 w-full pb-1 mb-1">LOJA EXEMPLO</div>
              <div className="w-full">PEDIDO #001</div>
              <div className="w-full">25/05/2024 14:30</div>
              <div className="border-t border-dashed border-gray-300 w-full my-1"></div>
              <div className="flex justify-between w-full"><span>1x Pizza G</span><span>R$ 50,00</span></div>
              <div className="flex justify-between w-full"><span>1x Coca 2L</span><span>R$ 12,00</span></div>
              <div className="border-t border-dashed border-gray-300 w-full my-1"></div>
              <div className="font-bold flex justify-between w-full"><span>TOTAL</span><span>R$ 62,00</span></div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 w-full">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Superior</Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0"
                value={localMargens.superior} 
                onChange={(e) => setLocalMargens(prev => ({ ...prev, superior: Number(e.target.value) }))}
                className="h-8 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Inferior</Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0"
                value={localMargens.inferior} 
                onChange={(e) => setLocalMargens(prev => ({ ...prev, inferior: Number(e.target.value) }))}
                className="h-8 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Esquerda</Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0"
                value={localMargens.esquerda} 
                onChange={(e) => setLocalMargens(prev => ({ ...prev, esquerda: Number(e.target.value) }))}
                className="h-8 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Direita</Label>
              <Input 
                type="number" 
                step="0.1" 
                min="0"
                value={localMargens.direita} 
                onChange={(e) => setLocalMargens(prev => ({ ...prev, direita: Number(e.target.value) }))}
                className="h-8 text-xs font-bold"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(localMargens)}>Confirmar Ajustes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarginEditor;
