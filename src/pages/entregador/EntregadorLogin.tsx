import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, ArrowLeft, Loader2, KeyRound, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import loginFoodBg from "@/assets/login-food-bg.png";

const EntregadorLogin = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(window.location.search);
  const logoParam = searchParams.get("logo");
  const [logoUrl, setLogoUrl] = useState<string | null>(logoParam || localStorage.getItem("entregador_loja_logo"));

  useEffect(() => {
    if (logoParam) {
      localStorage.setItem("entregador_loja_logo", logoParam);
      setLogoUrl(logoParam);
    }
  }, [logoParam]);

  useEffect(() => {
    // Atualiza o título da página e as tags de app mobile
    document.title = "Entregador - Painel";
    
    // Configura manifest e meta tags para PWA
    const manifest = {
      name: "Entregador",
      short_name: "Entregador",
      start_url: "/entregador/login",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#000000",
      icons: [
        {
          src: logoUrl || "/icon-entregador-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: logoUrl || "/icon-entregador-192.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: logoUrl || "/icon-entregador-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    let manifestLink = document.getElementById('manifest-link') as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.id = 'manifest-link';
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;

    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name='${name}']`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMeta("apple-mobile-web-app-title", "Entregador");
    updateMeta("apple-mobile-web-app-capable", "yes");
    updateMeta("apple-mobile-web-app-status-bar-style", "default");
    updateMeta("mobile-web-app-capable", "yes");
    updateMeta("theme-color", "#000000");

    // Apple Touch Icon (Logo do Lojista)
    let touchIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
    if (!touchIcon) {
      touchIcon = document.createElement("link");
      touchIcon.id = 'apple-touch-icon';
      touchIcon.rel = "apple-touch-icon";
      document.head.appendChild(touchIcon);
    }
    touchIcon.href = logoUrl || "/favicon.ico";

    return () => {
      document.title = "NOOV - Seu Delivery Profissional";
    };
  }, [logoUrl]);

  const handleLogin = async () => {
    if (!code.trim()) {
      toast({ title: "Digite seu código de acesso", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("entregador-login", {
        body: { codigo: code.trim() },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "Código não encontrado", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (otpError) {
        toast({ title: "Erro ao iniciar sessão", description: otpError.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      toast({ title: `Bem-vindo, ${data.nome}! 🛵` });
      
      // Request location permission immediately upon login
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
      }
      
      navigate("/entregador");
    } catch {
      toast({ title: "Erro ao acessar", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={loginFoodBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" loading="lazy" width={1920} height={1080} />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >



        <Card className="border-border/50 shadow-elevated">
          <CardHeader className="text-center pb-2">
            {logoUrl ? (
              <div className="mb-4">
                <img src={logoUrl} alt="Logo do Lojista" className="w-20 h-20 rounded-2xl object-cover mx-auto shadow-elevated border-2 border-primary/20" />
              </div>
            ) : (
              <a href="/" className="text-3xl font-extrabold font-display text-gradient-hero tracking-tight">
                N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV
              </a>
            )}
            <div className="mt-3 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Bike className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-display mt-3">Painel do Entregador</CardTitle>
            <p className="text-sm text-muted-foreground">
              Digite o código de acesso fornecido pelo lojista
            </p>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Código de acesso</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex: A1B2C3"
                    className="pl-10 h-12 text-center text-lg tracking-widest uppercase"
                    maxLength={8}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Peça o código ao lojista que te cadastrou
                </p>
              </div>

              <Button
                type="button"
                className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default EntregadorLogin;
