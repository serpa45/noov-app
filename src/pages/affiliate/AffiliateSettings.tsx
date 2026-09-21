import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, CreditCard, Bell, Loader2, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AffiliateSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["affiliate-settings-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [pixTipo, setPixTipo] = useState("");
  const [pixNomeFavorecido, setPixNomeFavorecido] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setPixChave(profile.pix_chave || "");
      setPixTipo(profile.pix_tipo || "");
      setPixNomeFavorecido(profile.pix_nome_favorecido || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !user) return;

      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Imagem muito grande", description: "Máximo permitido: 2MB", variant: "destructive" });
        return;
      }

      setIsUploading(true);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["affiliate-settings-profile"] });
      toast({ title: "Foto atualizada! 📸" });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({ title: "Erro ao carregar foto", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, avatar_url: avatarUrl })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-settings-profile"] });
      toast({ title: "Dados atualizados! ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const updatePix = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ pix_chave: pixChave, pix_tipo: pixTipo, pix_nome_favorecido: pixNomeFavorecido })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-settings-profile"] });
      toast({ title: "Dados bancários atualizados! ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const [notifications, setNotifications] = useState({
    newReferral: true,
    commission: true,
    withdrawal: true,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">
          Configurações ⚙️
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie seus dados e preferências</p>
      </motion.div>

      {/* Personal data */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center sm:items-start gap-4">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-2 border-border/50 transition-transform group-hover:scale-105">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    <User className="w-10 h-10 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              </div>
              <div>
                <h3 className="font-medium text-foreground">{fullName || "Seu Nome"}</h3>
                <p className="text-sm text-muted-foreground">Toque no ícone para alterar sua foto</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={email} className="mt-1" readOnly disabled />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="(11) 99999-9999" />
              </div>
              <div>
                <Label className="text-xs">Código de Acesso</Label>
                <Input value={profile?.codigo_acesso || ""} className="mt-1" readOnly disabled />
              </div>
            </div>
            <Button
              onClick={() => updateProfile.mutate()}
              disabled={updateProfile.isPending}
              className="bg-primary text-primary-foreground"
            >
              {updateProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payment data */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Dados para Saque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nome do Favorecido</Label>
              <Input value={pixNomeFavorecido} onChange={(e) => setPixNomeFavorecido(e.target.value)} className="mt-1" placeholder="Nome completo do titular" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Chave PIX</Label>
                <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} className="mt-1" placeholder="Sua chave PIX" />
              </div>
              <div>
                <Label className="text-xs">Tipo da Chave</Label>
                <Select value={pixTipo} onValueChange={setPixTipo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => updatePix.mutate()}
              disabled={updatePix.isPending}
              className="bg-primary text-primary-foreground"
            >
              {updatePix.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Atualizar dados bancários
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Nova indicação</p>
                <p className="text-xs text-muted-foreground">Receber aviso quando alguém se cadastrar pelo seu link</p>
              </div>
              <Switch checked={notifications.newReferral} onCheckedChange={(v) => setNotifications((p) => ({ ...p, newReferral: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Comissão recebida</p>
                <p className="text-xs text-muted-foreground">Aviso quando uma nova comissão for creditada</p>
              </div>
              <Switch checked={notifications.commission} onCheckedChange={(v) => setNotifications((p) => ({ ...p, commission: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Saque processado</p>
                <p className="text-xs text-muted-foreground">Aviso quando seu saque for concluído</p>
              </div>
              <Switch checked={notifications.withdrawal} onCheckedChange={(v) => setNotifications((p) => ({ ...p, withdrawal: v }))} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AffiliateSettings;
