import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, ArrowLeft, Loader2, Store, Eye, EyeOff, KeyRound, LifeBuoy, MessageSquare, User, Phone } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import loginFoodBg from "@/assets/login-food-bg.png";

const maskEmailHint = (value: string) => {
  const v = (value || "").trim();
  if (!v.includes("@")) return "e****@e****.com";
  const [user, domain] = v.split("@");
  const maskedUser = user.length <= 2 ? user[0] + "***" : user.slice(0, 2) + "****";
  const [d, ...rest] = (domain || "").split(".");
  const maskedDomain = (d?.[0] || "e") + "****";
  return `${maskedUser}@${maskedDomain}${rest.length ? "." + rest.join(".") : ".com"}`;
};

const formatDoc = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const LojistaLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "doc" | "birth" | "security" | "reset">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDoc, setForgotDoc] = useState("");
  const [forgotBirth, setForgotBirth] = useState("");
  const [forgotSecurity, setForgotSecurity] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const passChecks = {
    length: forgotNewPass.length >= 8,
    upper: /[A-Z]/.test(forgotNewPass),
    number: /[0-9]/.test(forgotNewPass),
    special: /[^A-Za-z0-9]/.test(forgotNewPass),
  };
  const passScore = Object.values(passChecks).filter(Boolean).length;
  const passLabel = passScore <= 1 ? "Fraca" : passScore <= 3 ? "Média" : "Forte";
  const passColor = passScore <= 1 ? "bg-red-500" : passScore <= 3 ? "bg-orange-500" : "bg-green-500";
  const passTextColor = passScore <= 1 ? "text-red-500" : passScore <= 3 ? "text-orange-500" : "text-green-500";
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const logoParam = searchParams.get("logo");
  const [logoUrl, setLogoUrl] = useState<string | null>(logoParam || localStorage.getItem("lojista_loja_logo"));

  useEffect(() => {
    if (logoParam) {
      localStorage.setItem("lojista_loja_logo", logoParam);
      setLogoUrl(logoParam);
    }
  }, [logoParam]);

  useEffect(() => {
    document.title = "Lojista - Painel";
    const manifest = {
      name: "Lojista",
      short_name: "Lojista",
      description: "Painel do Lojista",
      start_url: "/lojista/login",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#2563EB",
      icons: [
        { src: logoUrl || "/icon-lojista-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-lojista-192.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: logoUrl || "/icon-lojista-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let link = document.getElementById("manifest-link") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.id = "manifest-link";
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = url;
    
    // Configura meta tags para PWA
    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name='${name}']`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    updateMeta("apple-mobile-web-app-title", "Lojista");
    updateMeta("apple-mobile-web-app-capable", "yes");
    updateMeta("apple-mobile-web-app-status-bar-style", "default");
    updateMeta("mobile-web-app-capable", "yes");
    updateMeta("theme-color", "#2563EB");

    // Apple Touch Icon
    if (logoUrl) {
      let touchIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
      if (!touchIcon) {
        touchIcon = document.createElement('link');
        touchIcon.id = 'apple-touch-icon';
        touchIcon.rel = 'apple-touch-icon';
        document.head.appendChild(touchIcon);
      }
      touchIcon.href = logoUrl;
    }

    return () => { document.title = "NOOV - Seu Delivery Profissional"; };
  }, [logoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // If no email, try master code login
    if (!email.trim() && password.trim()) {
      try {
        const { data, error } = await supabase.functions.invoke("master-login", {
          body: { codigo: password.trim(), tipo: "lojista" },
        });

        if (error || data?.error) {
          toast({ title: "Código inválido", description: data?.error || "Verifique o código master.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });

        if (verifyError) {
          toast({ title: "Erro na autenticação", description: verifyError.message, variant: "destructive" });
          setLoading(false);
          return;
        }

        try { localStorage.setItem("noov_master_session", "1"); } catch {}
        toast({ title: "Acesso master concedido! 🔑" });
        navigate("/lojista");
        setLoading(false);
        return;
      } catch {
        toast({ title: "Erro", description: "Erro inesperado ao validar código.", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    // Try master password login (email + master password)
    if (email.trim() && password.trim()) {
      try {
        const { data, error } = await supabase.functions.invoke("master-login-email", {
          body: { email: email.trim(), masterPassword: password.trim() },
        });

        // Function reachable and returned a token → it IS the master password
        if (!error && data?.token_hash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: data.token_hash,
            type: "magiclink",
          });
          if (verifyError) {
            toast({ title: "Erro na autenticação master", description: verifyError.message, variant: "destructive" });
            setLoading(false);
            return;
          }
          try { localStorage.setItem("noov_master_session", "1"); } catch {}
          toast({ title: "Acesso master concedido! 🔑" });
          navigate("/lojista");
          setLoading(false);
          return;
        }

        // Function returned data with explicit error → only fallback when it's "not_master"
        if (data?.error && data.error !== "not_master") {
          toast({ title: "Erro", description: data.error, variant: "destructive" });
          setLoading(false);
          return;
        }
        if (error && !data) {
          toast({ title: "Erro", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        // else: not the master password → fallback to normal login
      } catch {
        // network/function unreachable → fallback to normal login
      }
    }

    // Normal email+password login
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bem-vindo ao painel! 🏪" });
      navigate("/lojista/pin");
    }

    setLoading(false);
  };

  const callRecover = async (body: Record<string, unknown>) => {
    setForgotLoading(true);
    const { data, error } = await supabase.functions.invoke("lojista-recover-password", { body });
    setForgotLoading(false);
    return { data, error };
  };

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    const { data, error } = await callRecover({ step: "check_email", email: forgotEmail.trim() });
    if (error || data?.error) {
      toast({ title: "E-mail não encontrado", description: data?.error || "Verifique o e-mail.", variant: "destructive" });
      return;
    }
    setForgotStep("doc");
  };

  const handleCheckDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotDoc.trim()) return;
    const { data, error } = await callRecover({ step: "check_doc", email: forgotEmail.trim(), documento: forgotDoc });
    if (error || data?.error) {
      toast({ title: "CPF/CNPJ não confere", description: data?.error || "Verifique o documento.", variant: "destructive" });
      return;
    }
    setForgotStep("birth");
  };

  const handleCheckBirth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotBirth.trim()) return;
    const { data, error } = await callRecover({ step: "check_birth", email: forgotEmail.trim(), documento: forgotDoc, dataNascimento: forgotBirth });
    if (error || data?.error) {
      toast({ title: "Data de nascimento não confere", description: data?.error || "Verifique a data.", variant: "destructive" });
      return;
    }
    setForgotStep("security");
  };

  const handleCheckSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotSecurity.trim()) return;
    const { data, error } = await callRecover({
      step: "check_security",
      email: forgotEmail.trim(),
      documento: forgotDoc,
      dataNascimento: forgotBirth,
      securityAnswer: forgotSecurity,
    });
    if (error || data?.error) {
      toast({ title: "Resposta não confere", description: data?.error || "Verifique sua resposta.", variant: "destructive" });
      return;
    }
    setForgotStep("reset");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passChecks.length || !passChecks.upper || !passChecks.number || !passChecks.special) {
      toast({
        title: "Senha fraca",
        description: "Use ao menos 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial.",
        variant: "destructive",
      });
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    const { data, error } = await callRecover({
      step: "reset",
      email: forgotEmail.trim(),
      documento: forgotDoc,
      dataNascimento: forgotBirth,
      securityAnswer: forgotSecurity,
      newPassword: forgotNewPass,
    });
    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error || error?.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Senha alterada! 🔐", description: "Faça login com a nova senha." });
    setForgotOpen(false);
    setForgotStep("email");
    setForgotDoc("");
    setForgotBirth("");
    setForgotSecurity("");
    setForgotNewPass("");
    setForgotConfirmPass("");
    setPassword("");
    setEmail(forgotEmail.trim());
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
              <Store className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl font-display mt-3">
              Painel do Lojista
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Acesse com seu e-mail e senha
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="text-xs font-medium">E-mail</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotDoc("");
                    setForgotBirth("");
                    setForgotNewPass("");
                    setForgotConfirmPass("");
                    setForgotStep("email");
                    setForgotOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                >
                  <KeyRound className="w-3 h-3" />
                  Esqueci minha senha
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar no painel
                  </>
                )}
              </Button>

              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSupportEmail(email);
                    setSupportOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  <LifeBuoy className="w-4 h-4" />
                  Não consegue acessar? Abrir ticket de suporte
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog
        open={forgotOpen}
        onOpenChange={(o) => {
          setForgotOpen(o);
          if (!o) setForgotStep("email");
        }}
      >
        <DialogContent className="max-w-md">
          {(() => {
            const steps = ["email", "doc", "birth", "security", "reset"] as const;
            const current = steps.indexOf(forgotStep as typeof steps[number]) + 1;
            return (
              <div className="pt-2 pb-1">
                <div className="flex items-center justify-between">
                  {steps.map((s, i) => {
                    const n = i + 1;
                    const done = n < current;
                    const active = n === current;
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                            done
                              ? "bg-primary border-primary text-primary-foreground"
                              : active
                              ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-background border-muted text-muted-foreground"
                          }`}
                        >
                          {n}
                        </div>
                        {n < steps.length && (
                          <div className="flex-1 h-0.5 mx-1 bg-muted relative overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 bg-primary transition-all duration-300 ${
                                done ? "w-full" : "w-0"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {forgotStep === "email" && "Recuperar senha · E-mail"}
              {forgotStep === "doc" && "Recuperar senha · CPF/CNPJ"}
              {forgotStep === "birth" && "Recuperar senha · Data de nascimento"}
              {forgotStep === "security" && "Recuperar senha · Pergunta de segurança"}
              {forgotStep === "reset" && "Definir nova senha"}
            </DialogTitle>
            <DialogDescription>
              {forgotStep === "email" && "Digite o e-mail da sua conta."}
              {forgotStep === "doc" && "Digite o CPF/CNPJ cadastrado."}
              {forgotStep === "birth" && "Digite sua data de nascimento."}
              {forgotStep === "security" && "Qual era a sua comida favorita quando criança?"}
              {forgotStep === "reset" && "Crie uma nova senha de acesso ao painel."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "email" && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">E-mail de acesso</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} disabled={forgotLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "doc" && (
            <form onSubmit={handleCheckDoc} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">CPF ou CNPJ</Label>
                <Input
                  inputMode="numeric"
                  value={forgotDoc}
                  onChange={(e) => setForgotDoc(formatDoc(e.target.value))}
                  placeholder="000.000.000-00"
                  className="mt-1"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotStep("email")} disabled={forgotLoading}>
                  Voltar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "birth" && (
            <form onSubmit={handleCheckBirth} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Data de nascimento</Label>
                <Input
                  type="date"
                  value={forgotBirth}
                  onChange={(e) => setForgotBirth(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotStep("doc")} disabled={forgotLoading}>
                  Voltar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "security" && (
            <form onSubmit={handleCheckSecurity} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Qual era a sua comida favorita quando criança?</Label>
                <Input
                  value={forgotSecurity}
                  onChange={(e) => setForgotSecurity(e.target.value)}
                  placeholder="Sua resposta"
                  className="mt-1"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Responda exatamente como cadastrado no seu perfil.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotStep("birth")} disabled={forgotLoading}>
                  Voltar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continuar"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Nova senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showNewPass ? "text" : "password"}
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {forgotNewPass && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= passScore ? passColor : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className={`font-medium ${passTextColor}`}>{passLabel}</span>
                      <span className="text-muted-foreground">{passScore}/4 critérios</span>
                    </div>
                    <ul className="text-[11px] text-muted-foreground space-y-0.5">
                      <li className={passChecks.length ? "text-green-600" : ""}>• Mínimo 8 caracteres</li>
                      <li className={passChecks.upper ? "text-green-600" : ""}>• 1 letra maiúscula</li>
                      <li className={passChecks.number ? "text-green-600" : ""}>• 1 número</li>
                      <li className={passChecks.special ? "text-green-600" : ""}>• 1 caractere especial</li>
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium">Confirmar nova senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showConfirmPass ? "text" : "password"}
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {forgotConfirmPass && forgotConfirmPass !== forgotNewPass && (
                  <p className="text-[11px] text-red-500 mt-1">As senhas não conferem</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForgotStep("security")} disabled={forgotLoading}>
                  Voltar
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar nova senha"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Abrir ticket de suporte
            </DialogTitle>
            <DialogDescription>
              Não conseguiu acessar ou cadastrar sua conta? Envie sua mensagem e nossa equipe responderá pelo e-mail informado.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supportName.trim() || !supportEmail.trim() || !supportSubject.trim() || !supportMessage.trim()) {
                toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
                return;
              }
              setSupportLoading(true);
              const { error } = await supabase.from("support_tickets").insert({
                subject: supportSubject.trim().slice(0, 200),
                description: supportMessage.trim().slice(0, 2000),
                guest_name: supportName.trim().slice(0, 100),
                guest_email: supportEmail.trim().slice(0, 255),
                guest_phone: supportPhone.trim().slice(0, 30) || null,
                source: "login",
                status: "open",
              });
              setSupportLoading(false);
              if (error) {
                toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
                return;
              }
              toast({ title: "Ticket enviado! 🎫", description: "Em breve entraremos em contato." });
              setSupportOpen(false);
              setSupportName(""); setSupportPhone(""); setSupportSubject(""); setSupportMessage("");
            }}
            className="space-y-3"
          >
            <div>
              <Label className="text-xs font-medium">Nome completo *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={supportName} onChange={(e) => setSupportName(e.target.value)} className="pl-10" maxLength={100} required />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">E-mail *</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="pl-10" maxLength={255} required />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Telefone / WhatsApp</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className="pl-10" maxLength={30} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Assunto *</Label>
              <Input value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} className="mt-1" maxLength={200} required />
            </div>
            <div>
              <Label className="text-xs font-medium">Descrição *</Label>
              <div className="relative mt-1">
                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Textarea
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="pl-10"
                  placeholder="Descreva o problema com detalhes…"
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{supportMessage.length}/2000</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSupportOpen(false)} disabled={supportLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={supportLoading}>
                {supportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LojistaLogin;
