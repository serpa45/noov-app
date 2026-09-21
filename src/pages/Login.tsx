import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, User, ArrowLeft, Store, KeyRound, CreditCard, Loader2, UserCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import loginFoodBg from "@/assets/login-food-bg.png";

type AppRole = "admin" | "lojista" | "afiliado" | "entregador";

const roleLabels: Record<AppRole, { label: string; emoji: string; desc: string }> = {
  admin: { label: "Administrador", emoji: "🛡️", desc: "Gerencie toda a plataforma" },
  lojista: { label: "Lojista", emoji: "🏪", desc: "Gerencie sua loja e pedidos" },
  afiliado: { label: "Afiliado", emoji: "🤝", desc: "Acompanhe indicações e comissões" },
  entregador: { label: "Entregador", emoji: "🛵", desc: "Acesse pelo código da loja" },
};

interface EntregadorOption {
  id: string;
  nome: string;
}

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nameExists, setNameExists] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("lojista");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Role-specific login fields
  const [storeName, setStoreName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [storeResults, setStoreResults] = useState<{ id: string; nome: string; slug: string }[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  // Entregador code-based login
  const [entregadorStep, setEntregadorStep] = useState<"code" | "pick">("code");
  const [entregadorList, setEntregadorList] = useState<EntregadorOption[]>([]);
  const [entregadorLoja, setEntregadorLoja] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  // Afiliado code-based login
  const [afiliadoCodigo, setAfiliadoCodigo] = useState("");
  const [afiliadoLoading, setAfiliadoLoading] = useState(false);
  const [afiliadoAttempts, setAfiliadoAttempts] = useState(0);
  const [afiliadoLockedUntil, setAfiliadoLockedUntil] = useState<number | null>(null);
  const afiliadoLocked = afiliadoLockedUntil !== null && Date.now() < afiliadoLockedUntil;

  const { signIn, signUp: authSignUp, getRedirectPath } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Search stores as lojista types
  useEffect(() => {
    if (selectedRole !== "lojista" || isSignUp || storeName.trim().length < 2) {
      setStoreResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, slug")
        .ilike("nome", `%${storeName.trim()}%`)
        .limit(5);
      setStoreResults(data ?? []);
      setShowStoreDropdown(true);
    }, 300);
    return () => clearTimeout(timeout);
  }, [storeName, selectedRole, isSignUp]);

  const handleNameChange = async (value: string) => {
    setFullName(value);
    setNameExists(false);
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", trimmed)
      .limit(1);
    setNameExists((data ?? []).length > 0);
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Entregador: lookup by code
  const handleCodeLookup = async () => {
    if (!storeCode.trim()) {
      toast({ title: "Digite o código da loja", variant: "destructive" });
      return;
    }
    setCodeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("entregador-login", {
        body: { codigo: storeCode.trim() },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "Código não encontrado", variant: "destructive" });
        setCodeLoading(false);
        return;
      }
      setEntregadorLoja(data.loja.nome);
      setEntregadorList(data.entregadores);
      setEntregadorStep("pick");
    } catch {
      toast({ title: "Erro ao buscar código", variant: "destructive" });
    }
    setCodeLoading(false);
  };

  // Entregador: pick and get session
  const handleEntregadorPick = async (entregadorId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("entregador-session", {
        body: { codigo: storeCode.trim(), entregador_id: entregadorId },
      });
      if (error || data?.error) {
        toast({ title: data?.error || "Erro ao acessar", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Use verifyOtp with the hashed token to establish session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (otpError) {
        toast({ title: "Erro ao iniciar sessão", description: otpError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ title: "Bem-vindo! 🛵" });
      navigate("/entregador");
    } catch {
      toast({ title: "Erro ao acessar", variant: "destructive" });
    }
    setLoading(false);
  };

  // Afiliado: login by code
  const handleAfiliadoLogin = async () => {
    if (!afiliadoCodigo.trim() || afiliadoLocked) return;
    setAfiliadoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("afiliado-session", {
        body: { codigo: afiliadoCodigo.trim() },
      });
      if (error || data?.error) {
        const newAttempts = afiliadoAttempts + 1;
        setAfiliadoAttempts(newAttempts);
        if (newAttempts >= 5) {
          setAfiliadoLockedUntil(Date.now() + 60000);
          toast({ title: "Muitas tentativas", description: "Aguarde 60 segundos.", variant: "destructive" });
        } else {
          toast({ title: "Código inválido", description: `${5 - newAttempts} tentativas restantes.`, variant: "destructive" });
        }
        setAfiliadoLoading(false);
        return;
      }
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (otpError) {
        toast({ title: "Erro na autenticação", description: otpError.message, variant: "destructive" });
        setAfiliadoLoading(false);
        return;
      }
      setAfiliadoAttempts(0);
      toast({ title: "Bem-vindo ao painel de afiliado! 🤝" });
      navigate("/afiliado/painel");
    } catch {
      toast({ title: "Erro inesperado", variant: "destructive" });
    }
    setAfiliadoLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === "entregador" && !isSignUp) return;
    if (selectedRole === "afiliado" && !isSignUp) return; // handled by handleAfiliadoLogin
    setLoading(true);

    if (isSignUp) {
      const { error } = await authSignUp(email, password, fullName, selectedRole);
      if (error) {
        toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
      } else {
        if (selectedRole === "afiliado") {
          // Wait briefly for the trigger to create profile + code
          await new Promise((r) => setTimeout(r, 1500));
          // Fetch the generated code to pass to confirmation page
          const { data: session } = await supabase.auth.getSession();
          const uid = session?.session?.user?.id;
          let codigo = "";
          if (uid) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("codigo_afiliado, codigo_acesso")
              .eq("user_id", uid)
              .single();
            codigo = (prof as any)?.codigo_afiliado || "";
            const codigo_acesso = (prof as any)?.codigo_acesso || "";
            toast({
              title: "Conta de afiliado criada! 🤝",
              description: "Verifique seu e-mail para confirmar.",
            });
            navigate("/afiliado/confirmacao", { state: { codigo, codigo_acesso, userId: uid } });
          }
        } else {
          toast({ title: "Conta criada! ✅", description: "Verifique seu e-mail para confirmar." });
          const redirectMap: Record<string, string> = {
            admin: "/admin",
            lojista: "/admin",
            entregador: "/entregador",
          };
          navigate(redirectMap[selectedRole] || "/");
        }
      }
    } else {
      const { error, redirectTo } = await signIn(email, password);
      if (error) {
        toast({ title: "Erro no login", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Bem-vindo de volta! 🎉" });
        navigate(redirectTo || "/");
      }
    }

    setLoading(false);
  };

  const loginRoles: AppRole[] = ["lojista", "entregador", "afiliado"];

  const resetEntregadorFlow = () => {
    setEntregadorStep("code");
    setEntregadorList([]);
    setEntregadorLoja("");
    setStoreCode("");
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
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao site
        </a>

        <Card className="border-border/50 shadow-elevated">
          <CardHeader className="text-center pb-2">
            <a href="/" className="text-3xl font-extrabold font-display text-gradient-hero tracking-tight">
              N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV
            </a>
            <CardTitle className="text-xl font-display mt-2">
              {isSignUp ? "Criar conta" : "Entrar na sua conta"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Preencha os dados para começar" : "Escolha seu perfil e acesse"}
            </p>
          </CardHeader>

          <CardContent>
            {/* Role selector */}
            <div className="mb-4">
              <Label className="text-xs font-medium">{isSignUp ? "Tipo de conta" : "Acessar como"}</Label>
              <div className={`grid ${isSignUp ? "grid-cols-3" : "grid-cols-3"} gap-2 mt-1`}>
                {(isSignUp ? (Object.keys(roleLabels) as AppRole[]).filter(r => r !== "admin") : loginRoles).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      if (!isSignUp && role === "entregador") {
                        navigate("/entregador/login");
                        return;
                      }
                      setSelectedRole(role);
                      setStoreName("");
                      setStoreCode("");
                      setCpf("");
                      setStoreResults([]);
                      resetEntregadorFlow();
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedRole === role
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xl block">{roleLabels[role].emoji}</span>
                    <span className="text-xs font-medium text-foreground block mt-1">
                      {roleLabels[role].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ENTREGADOR LOGIN: code-only flow */}
            {!isSignUp && selectedRole === "entregador" ? (
              <AnimatePresence mode="wait">
                {entregadorStep === "code" ? (
                  <motion.div
                    key="code-step"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div>
                      <Label className="text-xs font-medium">Código da loja</Label>
                      <div className="relative mt-1">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={storeCode}
                          onChange={(e) => setStoreCode(e.target.value)}
                          placeholder="Digite o código fornecido pelo lojista"
                          className="pl-10"
                          maxLength={10}
                          onKeyDown={(e) => e.key === "Enter" && handleCodeLookup()}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Peça o código ao lojista da sua loja
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold"
                      onClick={handleCodeLookup}
                      disabled={codeLoading}
                    >
                      {codeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 mr-2" />
                          Acessar
                        </>
                      )}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="pick-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-2">
                      <p className="text-sm text-muted-foreground">
                        Loja: <span className="font-bold text-foreground">{entregadorLoja}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Selecione seu nome para entrar</p>
                    </div>

                    <div className="space-y-2">
                      {entregadorList.map((ent) => (
                        <Button
                          key={ent.id}
                          type="button"
                          variant="outline"
                          className="w-full h-12 justify-start text-left"
                          onClick={() => handleEntregadorPick(ent.id)}
                          disabled={loading}
                        >
                          <UserCheck className="w-4 h-4 mr-3 text-primary" />
                          <span className="font-medium">{ent.nome}</span>
                          {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                        </Button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-sm"
                      onClick={resetEntregadorFlow}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Voltar e digitar outro código
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : !isSignUp && selectedRole === "afiliado" ? (
              /* AFILIADO LOGIN: code-only flow */
              <motion.div
                key="afiliado-code"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div>
                  <Label className="text-xs font-medium">Código de Acesso</Label>
                  <div className="relative mt-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={afiliadoCodigo}
                      onChange={(e) => setAfiliadoCodigo(e.target.value.toUpperCase())}
                      placeholder="EX: D691AFA2"
                      className="pl-10 text-center text-lg tracking-[0.2em] uppercase font-mono font-bold"
                      maxLength={12}
                      minLength={4}
                      onKeyDown={(e) => e.key === "Enter" && handleAfiliadoLogin()}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Você recebeu este código ao se cadastrar como afiliado
                  </p>
                </div>

                {afiliadoLocked && (
                  <p className="text-sm text-destructive text-center font-medium">
                    Muitas tentativas. Aguarde...
                  </p>
                )}

                <Button
                  type="button"
                  className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold h-12"
                  onClick={handleAfiliadoLogin}
                  disabled={afiliadoLoading || afiliadoLocked}
                >
                  {afiliadoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Acessar painel
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <div>
                      <Label className="text-xs font-medium">Nome completo</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={fullName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="Seu nome"
                          className={`pl-10 h-12 text-lg md:text-lg ${nameExists ? "border-destructive" : ""}`}
                          required
                        />
                      </div>
                      {nameExists && (
                        <p className="text-xs text-destructive mt-1">Já existe um usuário com esse nome.</p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-medium">E-mail</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-10 h-12 text-lg md:text-lg"
                        required
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
                        className="pl-10 pr-10 h-12 text-lg md:text-lg"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-cta border-0 text-accent-foreground font-bold mt-8 h-12"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isSignUp ? (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Criar conta
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Entrar
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}

            {isSignUp && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(false);
                    setSelectedRole("lojista");
                    resetEntregadorFlow();
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Já tem conta? Fazer login
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
