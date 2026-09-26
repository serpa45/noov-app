import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Wrench, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  Store, 
  UtensilsCrossed, 
  RefreshCw, 
  MessageCircle, 
  CheckCircle2, 
  KeyRound, 
  ArrowRight,
  Zap,
  Lock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";

const Maintenance = () => {
  const navigate = useNavigate();
  const { isMaintenanceActive, enableBypass, refetch } = useMaintenanceMode();
  const [activeTab, setActiveTab] = useState<"lojista" | "cliente">("lojista");
  const [isChecking, setIsChecking] = useState(false);
  const [bypassCode, setBypassCode] = useState("");
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      const { data } = await refetch();
      if (data?.valor === "false") {
        toast.success("O sistema já está no ar! Redirecionando...");
        setTimeout(() => {
          navigate("/");
        }, 1200);
      } else {
        toast.info("A manutenção ainda está em andamento. Estamos quase prontos!");
      }
    } catch {
      toast.info("A manutenção ainda está em andamento.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bypassCode.trim()) {
      toast.error("Informe o código master");
      return;
    }
    const success = enableBypass(bypassCode);
    if (success) {
      toast.success("Acesso administrativo liberado!");
      setIsUnlockOpen(false);
      navigate("/lojista");
    } else {
      toast.error("Código incorreto");
    }
  };

  const handleWhatsAppContact = () => {
    const text = encodeURIComponent(
      "Olá, equipe NOOV! Gostaria de informações sobre o retorno do sistema em manutenção."
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-gradient-to-b from-background via-muted/30 to-background overflow-hidden text-foreground selection:bg-primary/20">
      {/* Luzes e gradientes ambientais no fundo */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-primary/15 via-secondary/10 to-transparent blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[400px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
      
      {/* Header superior */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <img src="/noov-logo.png" alt="NOOV Logo" className="w-9 h-9 object-contain drop-shadow" />
          <span className="text-2xl font-black font-display tracking-tight text-foreground">
            N<span className="text-secondary">O</span>OV
          </span>
        </a>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Manutenção Programada
          </Badge>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-3xl mx-auto space-y-8">
          
          {/* Card Hero com ícone animado */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-4"
          >
            {/* Ícone com anel pulsante */}
            <div className="relative inline-flex items-center justify-center mb-2">
              <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-secondary flex items-center justify-center shadow-elevated border border-white/20">
                <Wrench className="w-10 h-10 text-white animate-spin-slow" />
              </div>
              <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-1.5 rounded-full shadow-md">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display tracking-tight text-foreground">
              Sistema em Manutenção Temporária
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Estamos atualizando e aprimorando a nossa plataforma para proporcionar mais velocidade, novas funcionalidades e máxima estabilidade para todos.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/80 border border-border/60 text-xs sm:text-sm font-medium text-foreground">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span>Previsão de retorno: <strong>Em instantes</strong></span>
            </div>
          </motion.div>

          {/* Seletor de Público: Lojista x Cliente */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <div className="inline-flex p-1 rounded-2xl bg-muted/80 border border-border/60 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveTab("lojista")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === "lojista"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Para Lojistas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("cliente")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    activeTab === "cliente"
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Para Clientes
                </button>
              </div>
            </div>

            {/* Conteúdo Dinâmico por Aba */}
            <Card className="border-border/80 bg-card/85 backdrop-blur-xl shadow-elevated rounded-3xl overflow-hidden">
              <CardContent className="p-6 sm:p-8 space-y-6">
                {activeTab === "lojista" ? (
                  <motion.div
                    key="lojista"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        <Store className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold font-display">Aos Nossos Lojistas Parceiros</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Estamos aplicando melhorias na comunicação dos pedidos, impressão automática e na estabilidade do seu painel administrativo.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 pt-2">
                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">Dados 100% Salvos e Seguros</p>
                          <p className="text-muted-foreground">Seu cardápio, pedidos anteriores e histórico financeiro permanecem protegidos.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                        <Zap className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">Reconexão Automática</p>
                          <p className="text-muted-foreground">Não precisa reinstalar nada: quando o sistema voltar, seu painel se reconectará sozinho.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                      💡 <strong>Dica:</strong> Seus clientes ao tentarem acessar seus cardápios receberão este mesmo aviso explicativo, sabendo que os pedidos serão reabertos em breve.
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="cliente"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-secondary/15 flex items-center justify-center shrink-0 text-secondary">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold font-display">Aos Nossos Clientes</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Os estabelecimentos estão temporariamente em manutenção técnica para garantir um atendimento ainda mais rápido e eficiente para você.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 pt-2">
                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                        <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">Volte em alguns instantes</p>
                          <p className="text-muted-foreground">A plataforma está finalizando os ajustes e reabrirá os cardápios em instantes.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">Qualidade e Agilidade</p>
                          <p className="text-muted-foreground">A nova versão trará carregamento instantâneo do cardápio e checkout mais rápido.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-xs text-primary dark:text-primary-foreground/90">
                      🍽️ Obrigado pela compreensão! Em breve você poderá fazer seu pedido com total comodidade.
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Botões de Ação */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
          >
            <Button
              size="lg"
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="w-full sm:w-auto gap-2 px-6 rounded-2xl shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Verificando..." : "Verificar se o Sistema Voltou"}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={handleWhatsAppContact}
              className="w-full sm:w-auto gap-2 px-6 rounded-2xl border-border/80"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              Falar com o Suporte
            </Button>
          </motion.div>

        </div>
      </main>

      {/* Rodapé com link discreto para Admin */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} NOOV Tecnologia. Todos os direitos reservados.</p>

        <div className="flex items-center gap-4">
          <Dialog open={isUnlockOpen} onOpenChange={setIsUnlockOpen}>
            <DialogTrigger asChild>
              <button 
                type="button"
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Acesso Administrativo</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Acesso de Administrador
                </DialogTitle>
                <DialogDescription>
                  Insira o código master para liberar a visualização do sistema durante a manutenção.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleBypassSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Código Master..."
                    value={bypassCode}
                    onChange={(e) => setBypassCode(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button type="submit" className="w-full">
                    Liberar Visualização
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsUnlockOpen(false);
                      navigate("/admin/login");
                    }}
                    className="text-xs"
                  >
                    Ir para Login do Admin (/admin/login)
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </footer>
    </div>
  );
};

export default Maintenance;
