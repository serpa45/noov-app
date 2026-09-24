import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pizza, Beef, IceCream, Sandwich, ArrowRight, ArrowLeft, Store, Mail, Lock, User, Phone, Link2, Copy, Check, Loader2, Eye, EyeOff, FileText, Shield, Cake, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NoovLogo from "@/components/NoovLogo";
import sushiImg from "@/assets/segments/sushi.png";
import churrasquinhoImg from "@/assets/segments/churrasquinho.png";
type Segment = "pizzaria" | "hamburgueria" | "acaiteria" | "lanchonete" | "japonesa" | "churrasquinho";

const segments: { id: Segment; label: string; icon: React.ElementType; description: string; emoji: string; image?: string; comingSoon?: boolean }[] = [
  { id: "hamburgueria", label: "Hamburgueria", icon: Beef, description: "Hambúrgueres, combos e acompanhamentos", emoji: "🍔" },
  { id: "pizzaria", label: "Pizzaria", icon: Pizza, description: "Pizzas com múltiplos sabores e bordas", emoji: "🍕", comingSoon: true },
  { id: "acaiteria", label: "Açaiteria/Sorveteria", icon: IceCream, description: "Açaí, sorvetes e complementos", emoji: "🍧" },
  { id: "lanchonete", label: "Lanchonete", icon: Sandwich, description: "Lanches, salgados e porções", emoji: "🥪" },
  { id: "japonesa", label: "Japonesa", icon: Sandwich, description: "Sushi, temaki e pratos orientais", emoji: "🍣", image: sushiImg },
  { id: "churrasquinho", label: "Churrasquinho", icon: Sandwich, description: "Espetinhos, carnes e acompanhamentos", emoji: "🍢", image: churrasquinhoImg },
];

const RegisterStore = () => {
  const [step, setStep] = useState(1);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [documento, setDocumento] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refAfiliado, setRefAfiliado] = useState<{ user_id: string; full_name: string } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [modalType, setModalType] = useState<"terms" | "privacy">("terms");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Lookup affiliate by ref code
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("codigo_afiliado", ref.toUpperCase())
      .single()
      .then(({ data }) => {
        if (data) setRefAfiliado(data);
      });
  }, [searchParams]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const [storeNameExists, setStoreNameExists] = useState(false);
  const [checkingName, setCheckingName] = useState(false);

  const handleStoreNameChange = async (value: string) => {
    setStoreName(value);
    setStoreSlug(generateSlug(value));
    setStoreNameExists(false);

    const trimmed = value.trim();
    if (trimmed.length < 2) return;

    setCheckingName(true);
    const { data } = await supabase
      .from("lojas")
      .select("id")
      .ilike("nome", trimmed)
      .limit(1);
    setStoreNameExists((data ?? []).length > 0);
    setCheckingName(false);
  };

  const storeLink = storeSlug ? `noov.app.br/${storeSlug}` : "";

  const copyLink = () => {
    if (storeLink) {
      navigator.clipboard.writeText(`https://${storeLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const maskDocumento = (v: string) => {
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
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const canAdvance =
    step === 1
      ? !!selectedSegment
      : step === 2
      ? !!(storeName && ownerName && email && phone && birthDate && documento && password && !storeNameExists && acceptedTerms)
      : securityAnswer.trim().length >= 2;

  const handleCreateStore = async () => {
    if (!selectedSegment || !storeName || !email || !password || !ownerName || !phone) return;
    setLoading(true);
    try {
      // 1. Sign up the user (trigger auto-creates profile + role)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: ownerName,
            role: "lojista",
            phone,
            data_nascimento: birthDate || null,
            security_answer: securityAnswer.trim().toLowerCase(),
            store_name: storeName,
            store_slug: storeSlug,
            segmento: selectedSegment,
            documento: documento || null,
            afiliado_id: refAfiliado ? refAfiliado.user_id : null,
          },
        },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Erro ao criar conta");

      // Se o e-mail já existia anteriormente no Supabase Auth, identities vem vazio
      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error("Este e-mail já está cadastrado no sistema. Faça login ou utilize outro e-mail.");
      }

      // Se a sessão não veio imediatamente no signUp, tentar login direto com a senha informada
      let currentSession = authData.session;
      if (!currentSession) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInData?.session) {
          currentSession = signInData.session;
        } else if (signInError?.message?.toLowerCase().includes("email not confirmed")) {
          throw new Error("A confirmação de e-mail ainda está ATIVA no Supabase. É obrigatório desativar 'Confirm email' em Authentication > Providers > Email no painel do Supabase.");
        } else if (signInError) {
          throw new Error(signInError.message || "Erro ao autenticar usuário.");
        }
      }

      const userId = authData.user.id;

      // 2. Update profile with phone
      await supabase.from("profiles").update({ phone, data_nascimento: birthDate || null, security_answer: securityAnswer.trim().toLowerCase() }).eq("user_id", userId);

      // 3. Create store (link to affiliate if ref exists)
      const { data: existingLoja } = await supabase
        .from("lojas")
        .select("id")
        .eq("slug", storeSlug)
        .maybeSingle();

      if (!existingLoja) {
        const lojaInsert: any = {
          user_id: userId,
          nome: storeName,
          slug: storeSlug,
          segmento: selectedSegment,
          documento: documento || null,
        };
        if (refAfiliado) lojaInsert.afiliado_id = refAfiliado.user_id;
        const { error: storeError } = await supabase.from("lojas").insert(lojaInsert);
        if (storeError) {
          if (storeError.message?.toLowerCase().includes("row-level security")) {
            throw new Error("Erro de permissão (RLS): o usuário não possui sessão ativa. Verifique se 'Confirm email' está desativado no painel do Supabase.");
          }
          throw storeError;
        }
      }

      toast({
        title: "Loja criada com sucesso! 🎉",
        description: "Sua loja foi cadastrada com sucesso.",
      });
      navigate("/lojista/confirmacao", {
        state: { storeName, storeSlug },
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar loja",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-primary via-primary/90 to-accent relative overflow-hidden items-center justify-center p-12">
        {!refAfiliado && (
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="absolute top-8 left-8 text-white hover:bg-white/10 gap-2 z-20"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 100 + 20,
                height: Math.random() * 100 + 20,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.3,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-white max-w-md">
          <h1 className="text-4xl font-bold font-display mb-4">N<span className="text-secondary">O</span>OV</h1>
          <p className="text-xl font-medium mb-2 text-white/90">
            Seu delivery profissional em minutos
          </p>
          <p className="text-white/70 text-sm leading-relaxed">
            Crie sua loja online, receba pedidos e venda mais — sem depender de marketplace.
          </p>
          <div className="mt-10 space-y-4">
            {["Sem taxas abusivas", "Controle total dos pedidos", "Pronto em menos de 10 min"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/80">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">✓</div>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">
        {!refAfiliado && (
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="lg:hidden absolute top-4 left-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        <div className="w-full max-w-lg">
          {/* Logo mobile */}
          <div className="lg:hidden mb-6 text-center">
            <NoovLogo className="text-3xl font-extrabold font-display text-foreground inline-block" />
          </div>
          {/* Affiliate banner */}
          {refAfiliado && (
            <div className="mb-4 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm text-foreground">
              🤝 Indicado por <span className="font-bold">{refAfiliado.full_name}</span>
            </div>
          )}
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                {s < 3 && <div className={`w-12 h-0.5 transition-all ${step > s ? "bg-primary" : "bg-muted"}`} />}
              </div>
            ))}
            <span className="ml-3 text-xs text-muted-foreground">Passo {step} de 3</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold font-display text-foreground mb-1">Qual é o seu segmento?</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Escolha o tipo do seu negócio para personalizarmos tudo pra você.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {segments.map((seg) => {
                    const Icon = seg.icon;
                    const selected = selectedSegment === seg.id;
                    return (
                      <motion.button
                        key={seg.id}
                        whileHover={seg.comingSoon ? {} : { scale: 1.02 }}
                        whileTap={seg.comingSoon ? {} : { scale: 0.98 }}
                        onClick={() => !seg.comingSoon && setSelectedSegment(seg.id)}
                        disabled={seg.comingSoon}
                        className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-md"
                            : seg.comingSoon
                            ? "border-border bg-muted/20 opacity-70 cursor-not-allowed"
                            : "border-border hover:border-primary/40 bg-card"
                        }`}
                      >
                        {seg.comingSoon && (
                          <div className="absolute top-3 right-3 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Em Breve
                          </div>
                        )}
                        {selected && !seg.comingSoon && (
                          <motion.div
                            layoutId="segment-check"
                            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                          >
                            <span className="text-[10px] text-primary-foreground font-bold">✓</span>
                          </motion.div>
                        )}
                        {seg.image ? (
                          <img src={seg.image} alt={seg.label} loading="lazy" width={40} height={40} className="w-10 h-10 mb-2 object-contain" />
                        ) : (
                          <span className="text-3xl mb-2 block">{seg.emoji}</span>
                        )}
                        <p className="font-semibold font-display text-foreground text-sm">{seg.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{seg.description}</p>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold font-display text-foreground mb-1">Dados da sua loja</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Preencha os dados para criar sua loja em segundos.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs">Nome da loja <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Ex: Burger House" className={`pl-10 h-12 text-lg md:text-lg ${storeNameExists ? "border-destructive" : ""}`} value={storeName} onChange={(e) => handleStoreNameChange(e.target.value)} />
                    </div>
                    {storeNameExists && (
                      <p className="text-xs text-destructive mt-1">Já existe uma loja com esse nome. Escolha outro.</p>
                    )}
                  </div>

                  {/* Store link preview */}
                  {storeSlug && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden"
                    >
                      <Label className="text-xs flex items-center gap-1.5">
                        <Link2 className="w-3 h-3" />
                        Link da sua loja para clientes
                      </Label>
                      <div className="mt-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5 border border-border">
                        <span className="text-sm text-muted-foreground">https://</span>
                        <span className="text-sm font-semibold text-primary flex-1 truncate">{storeLink}</span>
                        <button
                          type="button"
                          onClick={copyLink}
                          className="shrink-0 p-1 rounded hover:bg-primary/10 transition-colors"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Seus clientes acessarão seu cardápio por este link
                      </p>
                    </motion.div>
                  )}
                  <div>
                    <Label className="text-xs">Seu nome <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Ex: João Silva" className="pl-10 h-12 text-lg md:text-lg" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="(11) 99999-9999" className="pl-10 h-12 text-lg md:text-lg" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">CPF/CNPJ <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        className="pl-10 h-12 text-lg md:text-lg"
                        value={documento}
                        onChange={(e) => setDocumento(maskDocumento(e.target.value))}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Data de nascimento <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        className="pl-10 h-12 text-lg md:text-lg"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">E-mail <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="joao@email.com" className="pl-10 h-12 text-lg md:text-lg" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Senha <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" className="pl-10 pr-10 h-12 text-lg md:text-lg" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-2 pt-2">
                    <Checkbox 
                      id="terms" 
                      checked={acceptedTerms} 
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                      className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="terms"
                        className="text-xs text-muted-foreground leading-relaxed"
                      >
                        Eu li e aceito os{" "}
                        <button 
                          type="button" 
                          onClick={() => { setModalType("terms"); setShowTermsModal(true); }}
                          className="text-primary hover:underline font-medium"
                        >
                          Termos de Uso
                        </button>
                        {" "}e a{" "}
                        <button 
                          type="button" 
                          onClick={() => { setModalType("privacy"); setShowTermsModal(true); }}
                          className="text-primary hover:underline font-medium"
                        >
                          Política de Privacidade
                        </button>
                        .
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-2xl font-bold font-display text-foreground mb-1">Pergunta de segurança</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Essa resposta será usada para recuperar sua senha caso você esqueça. Apenas você deve saber a resposta.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs">Qual era a sua comida favorita quando criança? <span className="text-destructive">*</span></Label>
                    <div className="relative mt-1">
                      <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Ex: lasanha da vovó"
                        className="pl-10 h-12 text-lg md:text-lg"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Dica: guarde essa resposta em local seguro. Ela será solicitada na recuperação de senha.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate("/demo")} className="text-primary border-primary hover:bg-primary hover:text-primary-foreground gap-2">
                <Eye className="w-4 h-4" /> Ver demonstração
              </Button>
            )}

            {step < 3 ? (
              <Button
                disabled={!canAdvance}
                onClick={() => setStep(step + 1)}
                className="bg-gradient-to-r from-primary to-accent text-white font-bold gap-2 px-6"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                disabled={!canAdvance || loading}
                onClick={handleCreateStore}
                className="bg-gradient-to-r from-primary to-accent text-white font-bold gap-2 px-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Criar Minha Loja <ArrowRight className="w-4 h-4" /></>}
              </Button>
            )}
          </div>

          {step < 2 && (
            <p className="text-[11px] text-muted-foreground text-center mt-6">
              Ao criar sua conta, você concorda com os{" "}
              <button 
                type="button" 
                onClick={() => { setModalType("terms"); setShowTermsModal(true); }}
                className="underline cursor-pointer hover:text-primary transition-colors"
              >
                Termos de Uso
              </button>
              {" "}e{" "}
              <button 
                type="button" 
                onClick={() => { setModalType("privacy"); setShowTermsModal(true); }}
                className="underline cursor-pointer hover:text-primary transition-colors"
              >
                Política de Privacidade
              </button>
              .
            </p>
          )}
        </div>
      </div>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalType === "terms" ? (
                <>
                  <FileText className="w-5 h-5 text-primary" />
                  Termos de Uso - NOOV
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 text-primary" />
                  Política de Privacidade - NOOV
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed py-4">
            {modalType === "terms" ? (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground underline uppercase">Termo de Uso do Sistema NOOV</h3>
                
                <div>
                  <h4 className="font-bold text-foreground">1. ACEITAÇÃO DOS TERMOS</h4>
                  <p>Ao utilizar o sistema NOOV, o lojista declara estar ciente e de acordo com os presentes Termos de Uso, comprometendo-se a cumpri-los integralmente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">2. CADASTRO E INFORMAÇÕES DO CLIENTE</h4>
                  <p>O sistema poderá coletar informações básicas dos clientes, tais como nome, telefone e outros dados necessários para fins de cadastro, contato e comunicação. Essas informações serão utilizadas exclusivamente para a operação do sistema e relacionamento entre o lojista e seus clientes.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">3. RESPONSABILIDADE DO LOJISTA</h4>
                  <p>Todo o conteúdo inserido no sistema é de inteira responsabilidade do lojista, incluindo, mas não se limitando a: Produtos cadastrados, Preços e valores informados, Imagens utilizadas, Descrições e informações adicionais. O sistema não se responsabiliza por quaisquer erros, inconsistências ou irregularidades nessas informações.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">4. PLANOS E PAGAMENTOS</h4>
                  <p>O uso do sistema está condicionado ao pagamento dos valores contratados entre as partes. Em caso de inadimplência: O acesso ao sistema será automaticamente bloqueado; A liberação do sistema ocorrerá somente após a regularização do pagamento pendente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">5. USO DAS INFORMAÇÕES</h4>
                  <p>As informações cadastradas no sistema são de uso exclusivo da plataforma e do lojista, sendo utilizadas apenas para a operação do serviço, gerenciamento de pedidos e atendimento ao cliente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">6. FUNCIONALIDADE DO SISTEMA</h4>
                  <p>O lojista é responsável por: Cadastrar e manter atualizadas suas informações; Gerenciar os pedidos realizados pelos clientes; Garantir a veracidade das informações fornecidas.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">7. CANCELAMENTO E EXCLUSÃO DE DADOS</h4>
                  <p>Caso o lojista opte por não continuar utilizando o sistema: A conta será considerada inativa após o término do período contratado; Os dados permanecerão armazenados por até 3 (três) meses; Após esse período, todas as informações serão permanentemente excluídas, incluindo dados da conta e registros associados.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">8. ALTERAÇÕES NOS TERMOS</h4>
                  <p>Estes Termos de Uso poderão ser atualizados a qualquer momento, sendo responsabilidade do lojista revisá-los periodicamente.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">9. PROPRIEDADE INTELECTUAL</h4>
                  <p>O sistema NOOV, incluindo sua estrutura, funcionalidades, design e código, é de propriedade exclusiva do fornecedor, sendo proibida: Cópia, Reprodução, Engenharia reversa, Distribuição sem autorização.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">10. LIMITAÇÃO DE RESPONSABILIDADE</h4>
                  <p>O NOOV não se responsabiliza por: Prejuízos decorrentes do uso inadequado da plataforma; Perda de dados causada por ação do lojista; Problemas externos, como falhas de internet ou dispositivos.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">11. ALTERAÇÕES NOS TERMOS</h4>
                  <p>Este Termo poderá ser atualizado a qualquer momento. O uso contínuo da plataforma após alterações implica na aceitação dos novos termos.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">12. RETENÇÃO DE HISTÓRICO DE PEDIDOS E ENTREGAS</h4>
                  <p>O sistema NOOV disponibiliza exclusivamente o histórico de informações de pedidos e entregas referentes ao ano vigente (ano atual). Informações de anos anteriores não permanecem registradas no sistema e não estarão disponíveis para consulta. Da mesma forma, os gráficos e relatórios analíticos são gerados apenas com base nos dados do ano atual, não sendo gerados relatórios ou gráficos com base em dados de anos anteriores.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">13. REAJUSTE ANUAL</h4>
                  <p>O valor do plano contratado será reajustado automaticamente em 2,5% (dois e meio por cento) ao completar 1 (um) ano de cadastro do lojista no sistema NOOV, contado a partir da data de ativação da conta. O reajuste será aplicado anualmente nas mesmas condições, de forma cumulativa, e comunicado previamente ao lojista.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">14. DISPOSIÇÕES GERAIS</h4>
                  <p>O uso do sistema implica na aceitação integral destes termos. Em caso de discordância, o uso do serviço deve ser imediatamente interrompido.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-foreground underline uppercase">POLÍTICA DE PRIVACIDADE – SISTEMA NOOV</h3>
                
                <div>
                  <h4 className="font-bold text-foreground">1. DADOS COLETADOS</h4>
                  <p>O NOOV poderá coletar os seguintes dados:</p>
                  <p className="mt-2 font-semibold">1.1. Dados de lojistas (usuários do sistema):</p>
                  <ul className="list-disc pl-5">
                    <li>Nome</li>
                    <li>E-mail</li>
                    <li>Telefone</li>
                    <li>Informações comerciais</li>
                  </ul>
                  <p className="mt-2 font-semibold">1.2. Dados de clientes finais cadastrados pelo lojista:</p>
                  <ul className="list-disc pl-5">
                    <li>Nome</li>
                    <li>Telefone</li>
                    <li>Endereço (quando aplicável)</li>
                    <li>Informações relacionadas a pedidos</li>
                  </ul>
                  <p className="mt-2 font-semibold">1.3. Dados técnicos (automáticos):</p>
                  <ul className="list-disc pl-5">
                    <li>Endereço IP</li>
                    <li>Informações do dispositivo</li>
                    <li>Dados de acesso e uso da plataforma</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">2. FINALIDADE DO USO DOS DADOS</h4>
                  <p>Os dados coletados são utilizados para:</p>
                  <ul className="list-disc pl-5">
                    <li>Permitir o funcionamento do sistema</li>
                    <li>Gerenciar pedidos e cadastros</li>
                    <li>Facilitar o contato entre lojista e cliente</li>
                    <li>Melhorar a experiência do usuário</li>
                    <li>Garantir segurança e prevenção a fraudes</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">3. BASE LEGAL (LGPD)</h4>
                  <p>O tratamento de dados pessoais é realizado com base na Lei nº 13.709/2018 (LGPD), considerando:</p>
                  <ul className="list-disc pl-5">
                    <li>Execução de contrato</li>
                    <li>Legítimo interesse</li>
                    <li>Consentimento do titular, quando necessário</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">4. COMPARTILHAMENTO DE DADOS</h4>
                  <p>O NOOV não comercializa dados pessoais. Os dados poderão ser compartilhados apenas quando necessário, como:</p>
                  <ul className="list-disc pl-5">
                    <li>Cumprimento de obrigações legais</li>
                    <li>Requisição por autoridades públicas</li>
                    <li>Serviços essenciais para funcionamento da plataforma (ex: hospedagem)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">5. RESPONSABILIDADE DO LOJISTA</h4>
                  <p>O lojista é responsável pelos dados inseridos no sistema, devendo:</p>
                  <ul className="list-disc pl-5">
                    <li>Garantir que possui autorização do cliente</li>
                    <li>Utilizar os dados de forma adequada</li>
                    <li>Cumprir a legislação vigente de proteção de dados</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">6. ARMAZENAMENTO E SEGURANÇA</h4>
                  <p>Os dados são armazenados em ambiente seguro, com medidas técnicas e administrativas para proteção contra:</p>
                  <ul className="list-disc pl-5">
                    <li>Acesso não autorizado</li>
                    <li>Vazamentos</li>
                    <li>Alterações indevidas</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">7. RETENÇÃO E EXCLUSÃO DOS DADOS</h4>
                  <ul className="list-disc pl-5">
                    <li>Os dados serão mantidos enquanto o contrato estiver ativo</li>
                    <li>Em caso de cancelamento, os dados serão armazenados por até 3 (três) meses</li>
                    <li>Após esse período, serão permanentemente excluídos</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">8. DIREITOS DOS TITULARES DOS DADOS</h4>
                  <p>Nos termos da LGPD, os titulares podem solicitar:</p>
                  <ul className="list-disc pl-5">
                    <li>Acesso aos dados</li>
                    <li>Correção de dados incompletos ou desatualizados</li>
                    <li>Exclusão de dados (quando aplicável)</li>
                    <li>Revogação do consentimento</li>
                  </ul>
                  <p className="mt-2">Solicitações podem ser feitas através do e-mail informado neste documento.</p>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">9. COOKIES E TECNOLOGIAS DE RASTREAMENTO</h4>
                  <p>O sistema poderá utilizar cookies e tecnologias similares para:</p>
                  <ul className="list-disc pl-5">
                    <li>Melhorar a navegação</li>
                    <li>Personalizar a experiência</li>
                    <li>Coletar dados estatísticos</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-foreground">10. ALTERAÇÕES NESTA POLÍTICA</h4>
                  <p>Esta Política poderá ser atualizada a qualquer momento. Recomenda-se a revisão periódica.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTermsModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegisterStore;
