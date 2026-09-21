import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, ArrowLeft, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import loginFoodBg from "@/assets/login-food-bg.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

const AdminLogin = () => {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const remainingSeconds = isLocked ? Math.ceil((lockedUntil! - Date.now()) / 1000) : 0;

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => {
      if (Date.now() >= lockedUntil!) {
        setLockedUntil(null);
        setAttempts(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil, isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || isLocked) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-session", {
        body: { codigo: codigo.trim() },
      });

      if (error || data?.error) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
          toast({
            title: "Muitas tentativas",
            description: `Aguarde ${LOCKOUT_SECONDS} segundos antes de tentar novamente.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Código inválido",
            description: `Verifique e tente novamente. (${MAX_ATTEMPTS - newAttempts} tentativas restantes)`,
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (verifyError) {
        toast({
          title: "Erro na autenticação",
          description: verifyError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setAttempts(0);
      toast({ title: "Bem-vindo ao painel administrativo! 🛡️" });
      navigate("/admin");
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
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
            <a href="/" className="text-3xl font-extrabold font-display text-gradient-hero tracking-tight">
              N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV
            </a>
            <div className="mt-3 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-display mt-3">
              Painel Administrativo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Digite seu código de administrador para acessar
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Código de Acesso</Label>
                <div className="relative mt-1">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    placeholder="EX: ADM-XXXX"
                    className="pl-10 text-center text-lg tracking-[0.2em] uppercase font-mono font-bold"
                    required
                    minLength={4}
                    maxLength={20}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Código exclusivo de administrador
                </p>
              </div>

              {isLocked && (
                <p className="text-sm text-destructive text-center font-medium">
                  Muitas tentativas. Aguarde {remainingSeconds}s...
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
                disabled={loading || isLocked}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLocked ? (
                  `Aguarde ${remainingSeconds}s`
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Acessar painel
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
