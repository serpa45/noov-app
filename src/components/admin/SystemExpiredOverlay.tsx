import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SystemExpiredOverlayProps {
  onRenew: () => void;
  canRenew: boolean;
}

const SystemExpiredOverlay = ({ onRenew, canRenew }: SystemExpiredOverlayProps) => {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!closed) return;
    const t = setTimeout(() => setClosed(false), 20_000);
    return () => clearTimeout(t);
  }, [closed]);

  if (closed) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative max-w-md w-full rounded-2xl pointer-events-auto bg-card border border-border shadow-xl"
      >
        <button
          onClick={() => setClosed(true)}
          aria-label="Fechar"
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>

          <h2 className="text-2xl font-extrabold font-display text-foreground mb-2">
            Sistema vencido
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Sua loja está temporariamente fora do ar. Reative agora para voltar a receber pedidos sem perder clientes.
          </p>

          <Button
            onClick={onRenew}
            disabled={!canRenew}
            className="w-full py-6 rounded-xl font-bold bg-gradient-cta text-accent-foreground hover:scale-[1.02] transition-transform border-0"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reativar agora
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default SystemExpiredOverlay;
