import { ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const DemoBanner = () => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold shadow-md">
      <span>🎯 Você está em modo demonstração</span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs bg-white/20 border-white/30 text-secondary-foreground hover:bg-white/30"
        onClick={() => navigate("/cadastro")}
      >
        Quero criar minha loja <ArrowRight className="w-3 h-3 ml-1" />
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 p-1 rounded hover:bg-white/20 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default DemoBanner;
