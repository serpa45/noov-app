import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Save, Loader2, ArrowLeft, MapPin, Upload, Image, Palette, ImageIcon, Link as LinkIcon, Copy, AlertTriangle, CheckCircle2, Instagram, Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import bannerPizzaria from "@/assets/banner-pizzaria.jpg";
import bannerHamburgueria from "@/assets/banner-hamburgueria.jpg";
import bannerAcaiteria from "@/assets/banner-acaiteria.jpg";
import bannerLanchonete from "@/assets/banner-lanchonete.jpg";

const segmentBanners: Record<string, string> = {
  pizzaria: bannerPizzaria,
  hamburgueria: bannerHamburgueria,
  acaiteria: bannerAcaiteria,
  lanchonete: bannerLanchonete,
};

const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["lojista-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: loja } = useQuery({
    queryKey: ["lojista-loja-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [corPrimaria, setCorPrimaria] = useState("");
  const [corSecundaria, setCorSecundaria] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [documento, setDocumento] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || "");
      setDataNascimento((profile as any).data_nascimento || "");
    }
  }, [profile]);

  useEffect(() => {
    if (loja) {
      setRua((loja as any).endereco_rua || "");
      setNumero((loja as any).endereco_numero || "");
      setComplemento((loja as any).endereco_complemento || "");
      setBairro((loja as any).endereco_bairro || "");
      setCidade((loja as any).endereco_cidade || "");
      setEstado((loja as any).endereco_estado || "");
      setCep((loja as any).endereco_cep || "");
      setLogoUrl((loja as any).logo_url || "");
      setCorPrimaria((loja as any).cor_primaria || "");
      setCorSecundaria((loja as any).cor_secundaria || "");
      setBannerUrl((loja as any).banner_url || "");
      setInstagram((loja as any).instagram || "");
      setDocumento((loja as any).documento || "");
    }
  }, [loja]);

  const requiredFields = [
    { key: "fullName", label: "Nome completo", value: fullName },
    { key: "email", label: "E-mail", value: email },
    { key: "phone", label: "Telefone", value: phone },
    ...(loja ? [
      { key: "logoUrl", label: "Logo do estabelecimento", value: logoUrl },
      { key: "cep", label: "CEP", value: cep },
      { key: "rua", label: "Rua / Avenida", value: rua },
      { key: "numero", label: "Número", value: numero },
      { key: "bairro", label: "Bairro", value: bairro },
      { key: "cidade", label: "Cidade", value: cidade },
      { key: "estado", label: "Estado", value: estado },
      { key: "documento", label: "CPF/CNPJ", value: documento },
    ] : [])
  ];

  const missingFields = requiredFields.filter(f => !f.value?.trim());
  const completionPercent = Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100);
  const isComplete = missingFields.length === 0;

  const isMissing = (key: string) => {
    const vals: Record<string, string> = { fullName, email, phone, logoUrl, cep, rua, numero, bairro, cidade, estado, avatarUrl, instagram, documento };
    return submitted && !vals[key]?.trim();
  };

  const buscarCep = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
        setComplemento(data.complemento || "");
        toast({ title: "Endereço encontrado! ✅" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    }
    setBuscandoCep(false);
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 8);
    if (value.length > 5) value = value.slice(0, 5) + "-" + value.slice(5);
    setCep(value);
    if (value.replace(/\D/g, "").length === 8) buscarCep(value);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo permitido: 2MB", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { 
        upsert: true,
        cacheControl: "3600",
      });
      
      if (uploadError) {
        console.error("Logo upload error:", uploadError);
        toast({ title: "Erro ao enviar imagem", description: uploadError.message, variant: "destructive" });
        return;
      }
      
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      const url = urlData.publicUrl;
      setLogoUrl(url);
      setAvatarUrl(url);
      
      // Update profile avatar for all users
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      
      // Update store logo if it's a lojista
      if (loja) {
        await supabase.from("lojas").update({ logo_url: url } as any).eq("id", (loja as any).id);
      }
      
      queryClient.invalidateQueries({ queryKey: ["lojista-loja-profile"] });
      queryClient.invalidateQueries({ queryKey: ["lojista-profile"] });
      toast({ title: "Imagem de perfil atualizada! ✅" });
    } catch (err: any) {
      console.error("Logo upload exception:", err);
      toast({ title: "Erro ao enviar imagem", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Admins don't have banners unless they have a store
    if (!loja) {
      toast({ title: "Apenas lojistas podem ter banner", variant: "destructive" });
      return;
    }

    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/banner-${(loja as any).id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("banners").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) {
        toast({ title: "Erro ao enviar banner", description: error.message, variant: "destructive" });
        return;
      }
      const { data: urlData } = supabase.storage.from("banners").getPublicUrl(path);
      const url = urlData.publicUrl + "?t=" + Date.now();
      setBannerUrl(url);
      await supabase.from("lojas").update({ banner_url: url } as any).eq("id", (loja as any).id);
      toast({ title: "Banner atualizado! ✅" });
      queryClient.invalidateQueries({ queryKey: ["lojista-loja-profile"] });
    } catch (err: any) {
      console.error("Banner upload exception:", err);
      toast({ title: "Erro ao enviar banner", variant: "destructive" });
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSubmitted(true);

    const requiredKeys = ["fullName", "email", "phone", "logoUrl", "cep", "rua", "numero", "bairro", "cidade", "estado", "documento"];
    const vals: Record<string, string> = { fullName, email, phone, logoUrl, cep, rua, numero, bairro, cidade, estado, documento };
    const missing = requiredKeys.filter((k) => !vals[k]?.trim());
    if (missing.length > 0) {
      toast({
        title: "Preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const profileUpdate = supabase
      .from("profiles")
      .update({ full_name: fullName, email, phone, data_nascimento: dataNascimento || null, updated_at: new Date().toISOString() } as any)
      .eq("user_id", user.id);

    const lojaUpdate = loja
      ? supabase
          .from("lojas")
          .update({
            endereco_rua: rua,
            endereco_numero: numero,
            endereco_complemento: complemento,
            endereco_bairro: bairro,
            endereco_cidade: cidade,
            endereco_estado: estado,
            endereco_cep: cep,
            cor_primaria: corPrimaria || null,
            cor_secundaria: corSecundaria || null,
            instagram: instagram || null,
            whatsapp: phone || null,
            documento: documento || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", loja.id)
      : null;

    const [profileRes, lojaRes] = await Promise.all([profileUpdate, lojaUpdate].filter(Boolean));

    if ((profileRes as any)?.error || (lojaRes as any)?.error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso! ✅" });
      queryClient.invalidateQueries({ queryKey: ["lojista-profile"] });
      queryClient.invalidateQueries({ queryKey: ["lojista-loja-profile"] });
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais e do estabelecimento.</p>
      </motion.div>


      <div className="flex justify-between items-center bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-primary/10 shadow-sm mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas informações e do estabelecimento.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="gap-2 shadow-lg shadow-primary/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleLogoUpload}
        accept="image/*"
        className="hidden"
      />
      
      <input
        type="file"
        ref={bannerInputRef}
        onChange={handleBannerUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Personal info */}
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Nome completo <RequiredMark /></Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  className={`pl-10 ${isMissing("fullName") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">E-mail <RequiredMark /></Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 ${isMissing("email") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Whatsapp <RequiredMark /></Label>
              <div className="relative mt-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  className={`pl-10 ${isMissing("phone") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Data de nascimento</Label>
              <div className="relative mt-1">
                <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Instagram (usuário)</Label>
              <div className="relative mt-1">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={instagram} 
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="ex: @seu_insta"
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados do Estabelecimento */}
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Dados do Estabelecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
              {/* Column 1: Logo */}
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-28 h-28 rounded-2xl border-2 ${isMissing("logoUrl") ? "border-destructive/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-border"} flex items-center justify-center overflow-hidden bg-muted/50 relative group`}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">Logo</p>
                      </div>
                    )}
                    {uploadingLogo && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="w-3 h-3 mr-1.5" />
                    Alterar Logo
                  </Button>
                </div>
              </div>

              {/* Column 2: Imagem Principal do Cardápio */}
              <div className="space-y-3">
                <div className={`w-full h-28 rounded-2xl border-2 border-border flex items-center justify-center overflow-hidden bg-muted/50 relative group`}>
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover rounded-2xl" />
                  ) : loja ? (
                    <img src={segmentBanners[loja.segmento] || bannerLanchonete} alt={`Padrão ${loja.segmento}`} className="w-full h-full object-cover rounded-2xl opacity-60" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Banner</p>
                    </div>
                  )}
                  {uploadingBanner && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                >
                  <Image className="w-3 h-3 mr-1.5" />
                  Alterar Banner
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs font-medium">CPF/CNPJ <RequiredMark /></Label>
              <Input 
                value={documento} 
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="00.000.000/0000-00"
                className={`mt-1 ${isMissing("documento") ? "border-destructive bg-destructive/5" : ""}`}
              />
            </div>

            {/* Link do Cliente - abaixo das imagens */}
            {loja && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Link do cliente</span>
                </div>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
                  <code className="text-xs font-mono bg-background px-3 py-2 rounded-lg text-primary block break-all border border-border/50">
                    https://noov.app.br/{loja.slug}
                  </code>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 flex-1"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://noov.app.br/${loja.slug}`);
                        toast({ title: "Link copiado! ✅" });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => window.open(`https://noov.app.br/${loja.slug}`, "_blank")}
                    >
                      Abrir
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Compartilhe este link com seus clientes para acessarem seu cardápio.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colors */}
        <Card className="border-border/50 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Cores do Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-xs font-medium">Cor Principal</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div 
                      className="w-12 h-12 rounded-xl border-2 border-border" 
                      style={{ backgroundColor: corPrimaria || "#2563EB" }}
                    />
                    <input 
                      type="color" 
                      value={corPrimaria || "#2563EB"} 
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      placeholder="#2563EB (padrão NOOV)"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium">Cor Secundária</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div 
                      className="w-12 h-12 rounded-xl border-2 border-border" 
                      style={{ backgroundColor: corSecundaria || "#F97316" }}
                    />
                    <input 
                      type="color" 
                      value={corSecundaria || "#F97316"} 
                      onChange={(e) => setCorSecundaria(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      value={corSecundaria}
                      onChange={(e) => setCorSecundaria(e.target.value)}
                      placeholder="#F97316 (padrão NOOV)"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="border-border/50 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Endereço do Estabelecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium">CEP <RequiredMark /></Label>
                <div className="flex gap-2">
                  <Input 
                    value={cep} 
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    className={`max-w-[200px] ${isMissing("cep") ? "border-destructive bg-destructive/5" : ""}`}
                  />
                  {buscandoCep && <Loader2 className="w-4 h-4 animate-spin mt-3" />}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs font-medium">Rua / Avenida <RequiredMark /></Label>
                <Input 
                  value={rua} 
                  onChange={(e) => setRua(e.target.value)}
                  className={`mt-1 ${isMissing("rua") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Número <RequiredMark /></Label>
                <Input 
                  value={numero} 
                  onChange={(e) => setNumero(e.target.value)}
                  className={`mt-1 ${isMissing("numero") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Complemento</Label>
                <Input 
                  value={complemento} 
                  onChange={(e) => setComplemento(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Bairro <RequiredMark /></Label>
                <Input 
                  value={bairro} 
                  onChange={(e) => setBairro(e.target.value)}
                  className={`mt-1 ${isMissing("bairro") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Cidade <RequiredMark /></Label>
                <Input 
                  value={cidade} 
                  onChange={(e) => setCidade(e.target.value)}
                  className={`mt-1 ${isMissing("cidade") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Estado <RequiredMark /></Label>
                <Input 
                  value={estado} 
                  onChange={(e) => setEstado(e.target.value)}
                  className={`mt-1 max-w-[100px] ${isMissing("estado") ? "border-destructive bg-destructive/5" : ""}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
