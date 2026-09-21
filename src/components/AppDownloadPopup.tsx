import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Apple, Smartphone, Monitor } from "lucide-react";

export function AppDownloadPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "other">("other");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      const hasSeenPopup = localStorage.getItem("app-download-popup-seen");
      if (!hasSeenPopup) {
        setIsOpen(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app is already running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone || 
      document.referrer.includes('android-app://');

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    
    if (isStandalone) return;

    // Detect platform
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios");
      // iOS doesn't support beforeinstallprompt, show instructions after a delay
      const hasSeenPopup = localStorage.getItem("app-download-popup-seen");
      if (!hasSeenPopup) {
        const timer = setTimeout(() => setIsOpen(true), 3000);
        return () => clearTimeout(timer);
      }
    } else if (/android/.test(userAgent)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      handleClose();
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem("app-download-popup-seen", "true");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[92vw] sm:max-w-[400px] rounded-[32px] p-6 gap-6">
        <DialogHeader className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
            {platform === "desktop" ? <Monitor className="w-8 h-8" /> : <Smartphone className="w-8 h-8" />}
          </div>
          <div className="space-y-2">
            <DialogTitle className="text-xl font-bold font-display leading-tight">
              Instalar o NOOV no seu {platform === "desktop" ? "Computador" : "Celular"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Use o sistema offline e acesse mais rápido direto da sua área de trabalho.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {deferredPrompt ? (
            <Button 
              className="w-full h-12 rounded-xl font-semibold text-base" 
              onClick={handleInstallClick}
            >
              Instalar Agora
            </Button>
          ) : (
            <div className="bg-muted/50 rounded-2xl p-4 space-y-4">
              {platform === "ios" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Apple className="w-3 h-3" /> No iPhone (Safari):
                  </h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Toque no ícone de <span className="font-semibold underline">Compartilhar</span> na barra inferior</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Selecione <span className="font-semibold underline">Adicionar à Tela de Início</span></span>
                    </li>
                  </ul>
                </div>
              )}
              
              {platform === "desktop" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Monitor className="w-3 h-3" /> No Computador (Chrome/Edge):
                  </h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Clique no ícone de <span className="font-semibold">instalação</span> na barra de endereços (ao lado da estrela)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Ou acesse o <span className="font-semibold">Menu (3 pontos)</span> e escolha <span className="font-semibold underline">Salvar e Compartilhar &gt; Instalar página como aplicativo</span></span>
                    </li>
                  </ul>
                </div>
              )}

              {platform === "android" && !deferredPrompt && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Smartphone className="w-3 h-3" /> No Android:
                  </h4>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">1</span>
                      <span>Acesse o <span className="font-semibold">Menu do Navegador</span></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0 mt-0.5">2</span>
                      <span>Toque em <span className="font-semibold underline">Instalar aplicativo</span> ou <span className="font-semibold underline">Adicionar à tela inicial</span></span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {!deferredPrompt && (
            <Button 
              className="w-full h-12 rounded-xl font-semibold" 
              onClick={handleClose}
            >
              Entendi
            </Button>
          )}
        </div>

        <div className="flex justify-center">
          <button 
            onClick={handleClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Continuar no navegador
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
