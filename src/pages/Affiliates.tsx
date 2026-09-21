import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DollarSign,
  Link2,
  Users,
  TrendingUp,
  Repeat,
  Infinity,
  BarChart3,
  Wallet,
  ArrowRight,
  CheckCircle2,
  UserPlus,
  Share2,
  BadgeDollarSign,
  ChevronRight,
  X,
  Loader2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const steps = [
  {
    icon: UserPlus,
    title: "Cadastre-se grátis",
    desc: "Crie sua conta de afiliado em menos de 2 minutos",
    emoji: "1️⃣",
  },
  {
    icon: Link2,
    title: "Receba seu link exclusivo",
    desc: "Um link personalizado só seu para compartilhar",
    emoji: "2️⃣",
  },
  {
    icon: Share2,
    title: "Compartilhe com lojistas",
    desc: "Envie para donos de restaurantes, hamburguerias e pizzarias",
    emoji: "3️⃣",
  },
  {
    icon: BadgeDollarSign,
    title: "Ganhe comissão recorrente",
    desc: "Receba todo mês enquanto o lojista for assinante",
    emoji: "4️⃣",
  },
];

const benefits = [
  { icon: Repeat, title: "Renda recorrente", desc: "Ganhe todos os meses, não apenas uma vez" },
  { icon: Infinity, title: "Sem limite de ganhos", desc: "Quanto mais indicar, mais ganha" },
  { icon: BarChart3, title: "Painel de resultados", desc: "Acompanhe suas indicações e ganhos em tempo real" },
  { icon: Wallet, title: "Saques simplificados", desc: "Saque suas comissões de forma rápida e segura" },
];

const planColors = ["from-muted-foreground to-gray-500", "from-primary to-blue-600", "from-accent to-orange-600"];

const pixTypes = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

const Affiliates = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const { data: comissaoPercent } = useQuery({
    queryKey: ["config-global", "comissao_afiliado_percent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_globais")
        .select("valor")
        .eq("chave", "comissao_afiliado_percent")
        .maybeSingle();
      return data?.valor ? Number(data.valor) : 10;
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ["affiliate-landing-planos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: "", cpf: "", data_nascimento: "", email: "", phone: "",
    pix_tipo: "", pix_chave: "", pix_nome_favorecido: "",
  });

  const maskCpfCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) {
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAffiliateSignup = async () => {
    if (!formData.nome || !formData.email || !formData.cpf || !formData.data_nascimento) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome, CPF/CNPJ, data de nascimento e e-mail são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    const autoPassword = crypto.randomUUID().slice(0, 16);

    setLoading(true);

    try {
      const { error } = await signUp(formData.email, autoPassword, formData.nome, "afiliado");

      if (error) {
        toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      await new Promise((r) => setTimeout(r, 1500));
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;

      let codigo = "";
      if (uid) {
        // Upload avatar if selected
        if (avatarFile) {
          const ext = avatarFile.name.split(".").pop();
          const filePath = `afiliados/${uid}.${ext}`;
          await supabase.storage.from("logos").upload(filePath, avatarFile, { upsert: true });
          const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
          await supabase.from("profiles").update({ avatar_url: urlData.publicUrl } as any).eq("user_id", uid);
        }

        // Save phone and pix data
        const updateData: any = {};
        if (formData.phone) updateData.phone = formData.phone;
        if (formData.cpf) updateData.cpf_cnpj = formData.cpf;
        if (formData.data_nascimento) updateData.data_nascimento = formData.data_nascimento;
        if (formData.pix_tipo && formData.pix_chave) {
          updateData.pix_tipo = formData.pix_tipo;
          updateData.pix_chave = formData.pix_chave;
          updateData.pix_nome_favorecido = formData.pix_nome_favorecido;
        }
        if (Object.keys(updateData).length > 0) {
          await supabase.from("profiles").update(updateData).eq("user_id", uid);
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("codigo_afiliado, codigo_acesso")
          .eq("user_id", uid)
          .single();
        codigo = (prof as any)?.codigo_afiliado || "";
        const codigo_acesso = (prof as any)?.codigo_acesso || "";

        setFormOpen(false);
        toast({ title: "Conta de afiliado criada! 🤝", description: "Verifique seu e-mail para confirmar." });
        navigate("/afiliado/confirmacao", { state: { codigo, codigo_acesso, userId: uid } });
      }
    } catch (e) {
      toast({ title: "Erro no cadastro", description: "Tente novamente.", variant: "destructive" });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar mini */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container flex items-center justify-between h-16">
            <a href="/" className="text-2xl font-extrabold font-display text-gradient-hero tracking-tight">
              N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV
            </a>
            <Button
              onClick={() => setFormOpen(true)}
              className="bg-gradient-cta text-accent-foreground font-bold border-0"
            >
              Quero me afiliar
            </Button>
          </div>
        </div>
        <div className="h-[2px] bg-secondary" />
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container relative z-10 text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-semibold mb-6">
              <DollarSign className="w-4 h-4" /> Programa de Afiliados
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-display text-foreground leading-tight"
          >
            Ganhe dinheiro indicando o{" "}
            <span className="text-gradient-hero">N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto"
          >
            Receba comissões recorrentes sempre que seus indicados assinarem um plano.
            Sem limite de ganhos, sem investimento inicial.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              onClick={() => setFormOpen(true)}
              size="lg"
              className="bg-gradient-cta text-accent-foreground font-bold text-lg px-8 py-6 rounded-xl border-0 shadow-elevated"
            >
              Quero me afiliar <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground">100% gratuito • Sem burocracia</p>
          </motion.div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
              Como funciona?
            </h2>
            <p className="text-muted-foreground mt-3">
              4 passos simples para começar a ganhar
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <Card className="border-border/50 shadow-card h-full text-center hover:shadow-elevated transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>
                    <span className="text-2xl mb-2 block">{step.emoji}</span>
                    <h3 className="font-bold font-display text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GANHOS ── */}
      <section className="py-20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
              Quanto você pode ganhar?
            </h2>
            <p className="text-muted-foreground mt-3">
              Comissão recorrente mensal baseada em porcentagem definida pelo administrador
            </p>
          </div>
          <div className={`grid gap-6 max-w-4xl mx-auto ${planos.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {planos.map((plan, i) => (
              <motion.div
                key={plan.id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <Card className={`border-border/50 shadow-elevated overflow-hidden ${plan.popular ? "ring-2 ring-primary" : ""}`}>
                  <div className={`h-2 bg-gradient-to-r ${planColors[i % planColors.length]}`} />
                  <CardContent className="p-6 text-center">
                    <h3 className="text-xl font-bold font-display text-foreground mb-1">
                      Plano {plan.nome}
                    </h3>
                    <p className="text-3xl font-extrabold font-display text-primary">
                      {plan.preco === 0 ? "Grátis" : `R$ ${plan.preco}`}
                      {plan.preco > 0 && <span className="text-base font-normal text-muted-foreground">{plan.periodo}</span>}
                    </p>
                    <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/20">
                      <p className="text-sm font-semibold text-success">
                        Comissão de {comissaoPercent && comissaoPercent > 0 ? comissaoPercent : ((plan as any).comissao_afiliado ?? 10)}% por assinatura ativa
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ganho recorrente enquanto o cliente estiver ativo
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Indicou 10 clientes? Receba <strong>10x</strong> a comissão todo mês 💰
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ── */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
              Por que ser afiliado NOOV?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <Card className="border-border/50 shadow-card h-full hover:shadow-elevated transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                      <b.icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-bold font-display text-foreground mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA INTERMEDIÁRIO ── */}
      <section className="py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center p-10 rounded-3xl bg-gradient-hero text-primary-foreground"
          >
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-3">
              Começar agora é 100% gratuito
            </h2>
            <p className="text-primary-foreground/80 mb-6">
              Cadastre-se, receba seu link e comece a ganhar comissões recorrentes hoje mesmo.
            </p>
            <Button
              onClick={() => setFormOpen(true)}
              size="lg"
              className="bg-white text-primary font-bold text-lg px-8 py-6 rounded-xl hover:bg-white/90"
            >
              Começar agora gratuitamente <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-20 bg-muted/30">
        <div className="container text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Pronto para transformar indicações em renda?
          </h2>
          <p className="text-muted-foreground mb-8">
            Junte-se a centenas de afiliados que já estão ganhando com o NOOV.
          </p>
          <Button
            onClick={() => setFormOpen(true)}
            size="lg"
            className="bg-gradient-cta text-accent-foreground font-bold text-lg px-8 py-6 rounded-xl border-0 shadow-elevated"
          >
            Quero me afiliar agora <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="py-8 border-t border-border">
        <div className="container text-center">
          <span className="text-xl font-extrabold font-display text-gradient-hero">N<span className="text-secondary" style={{ WebkitTextFillColor: "hsl(var(--secondary))" }}>O</span>OV</span>
          <p className="text-sm text-muted-foreground mt-2">
            © {new Date().getFullYear()} N<span className="text-secondary">O</span>OV. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* ── MODAL DE CADASTRO ── */}
      {formOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4"
          onClick={() => setFormOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-3xl shadow-elevated max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold font-display text-foreground">Cadastro de Afiliado</h3>
                  <p className="text-sm text-muted-foreground">Preencha seus dados para começar</p>
                </div>
                <button onClick={() => setFormOpen(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Avatar Upload */}
                <div className="flex flex-col items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-20 h-20 rounded-full bg-muted/60 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                  <p className="text-[11px] text-muted-foreground">Foto de perfil (opcional)</p>
                </div>

                <div>
                  <Label className="text-xs">Nome completo</Label>
                  <Input placeholder="Seu nome" className="mt-1" value={formData.nome} onChange={(e) => update("nome", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">CPF/CNPJ <span className="text-destructive">*</span></Label>
                    <Input placeholder="000.000.000-00" className="mt-1" value={formData.cpf} onChange={(e) => update("cpf", maskCpfCnpj(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data de nascimento <span className="text-destructive">*</span></Label>
                    <Input type="date" className="mt-1" value={formData.data_nascimento} onChange={(e) => update("data_nascimento", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">WhatsApp</Label>
                  <Input placeholder="(11) 99999-9999" className="mt-1" value={formData.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" placeholder="email@email.com" className="mt-1" value={formData.email} onChange={(e) => update("email", e.target.value)} />
                </div>

                <div className="pt-2 pb-1">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" /> Dados PIX
                  </p>
                </div>

                <div>
                  <Label className="text-xs">Nome do Favorecido</Label>
                  <Input placeholder="Nome completo do titular" className="mt-1" value={formData.pix_nome_favorecido} onChange={(e) => update("pix_nome_favorecido", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo de chave</Label>
                    <Select value={formData.pix_tipo} onValueChange={(v) => update("pix_tipo", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {pixTypes.map((pt) => (
                          <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Chave PIX</Label>
                    <Input placeholder="Sua chave PIX" className="mt-1" value={formData.pix_chave} onChange={(e) => update("pix_chave", e.target.value)} />
                  </div>
                </div>

                <Button
                  onClick={handleAffiliateSignup}
                  disabled={loading}
                  className="w-full mt-2 py-6 bg-gradient-cta text-accent-foreground font-bold text-base rounded-xl border-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                  {loading ? "Criando conta..." : "Criar minha conta de afiliado"}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  Ao se cadastrar, você concorda com os Termos do Programa de Afiliados.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Affiliates;
