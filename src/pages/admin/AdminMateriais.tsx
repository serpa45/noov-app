import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Upload,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BannerPreview {
  titulo: string;
  descricao: string;
  texto_whatsapp: string;
  imagem_url: string | null;
  imagem_base64?: string | null;
  warning?: string;
}

const AdminMateriais = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tema, setTema] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<BannerPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["admin-materiais-afiliado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materiais_afiliado")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleDisponivel = useMutation({
    mutationFn: async ({ id, disponivel }: { id: string; disponivel: boolean }) => {
      const { error } = await supabase
        .from("materiais_afiliado")
        .update({ disponivel })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-materiais-afiliado"] });
      toast({ title: "Status atualizado ✅" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materiais_afiliado").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-materiais-afiliado"] });
      toast({ title: "Material excluído" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem deve ter no máximo 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setReferenceImage(base64);
      setReferencePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearReferenceImage = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!tema.trim()) {
      toast({ title: "Digite um tema para o banner", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-banner`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            tema,
            referenceImageBase64: referenceImage || undefined,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao gerar banner");
      }

      const result = await response.json();
      if (result.preview) {
        const p = result.preview;
        setPreview(p);
        setEditTitulo(p.titulo);
        setEditDescricao(p.descricao || "");
        setEditWhatsapp(p.texto_whatsapp || "");
        setPreviewOpen(true);
      }
    } catch (e: any) {
      toast({ title: e.message || "Erro ao gerar banner", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("materiais_afiliado").insert({
        titulo: editTitulo,
        descricao: editDescricao,
        texto_whatsapp: editWhatsapp,
        imagem_url: preview.imagem_url,
        disponivel: false,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-materiais-afiliado"] });
      setPreviewOpen(false);
      setPreview(null);
      setTema("");
      clearReferenceImage();
      toast({ title: "Banner salvo com sucesso! 🎨", description: "O banner está oculto. Ative para disponibilizar aos afiliados." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar banner", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = () => {
    setPreviewOpen(false);
    setPreview(null);
    handleGenerate();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

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
        <div className="flex items-center gap-3 mb-1">
          <ImageIcon className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold font-display text-foreground">Material do Afiliado</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gere banners de marketing com IA para os afiliados divulgarem o sistema NOOV.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Generator Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold font-display text-foreground">Gerar Banner com IA</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Descreva o tema. O banner sempre incluirá a logo NOOV nas cores do sistema. Você verá uma prévia antes de salvar.
            </p>
            <div>
              <Label className="text-xs">Tema do banner</Label>
              <Input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: Promoção para pizzarias, Black Friday delivery, Economia vs iFood..."
                className="mt-1"
                disabled={generating}
              />
            </div>

            {/* Reference Image Upload */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={generating}
              />
              {referencePreview ? (
                <div className="flex items-center gap-3">
                  <div className="relative inline-block">
                    <img
                      src={referencePreview}
                      alt="Referência"
                      className="w-24 h-24 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={clearReferenceImage}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
                      disabled={generating}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Enviar imagem
                  </Button>
                  <span className="text-xs text-muted-foreground">Imagem de referência (opcional)</span>
                </div>
              )}
            </div>

            <Button onClick={handleGenerate} disabled={generating || !tema.trim()} className="w-full sm:w-auto">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Gerando banner...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Gerar Banner
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Manual Upload Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold font-display text-foreground">Adicionar Banner Manual</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Adicione um banner pronto para que ele faça parte da biblioteca disponível para os afiliados.
            </p>
            
            <div className="grid gap-3">
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Título do Material</Label>
                <Input
                  placeholder="Ex: Banner Natal 2024"
                  className="h-8 text-xs mt-1"
                  id="manual-title"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Descrição Curta</Label>
                <Input
                  placeholder="Onde usar esse material..."
                  className="h-8 text-xs mt-1"
                  id="manual-description"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const titleInput = document.getElementById('manual-title') as HTMLInputElement;
                    const descInput = document.getElementById('manual-description') as HTMLInputElement;
                    const title = titleInput?.value;
                    
                    if (!title) {
                      toast({ title: "Digite um título primeiro", variant: "destructive" });
                      return;
                    }

                    setSaving(true);
                    try {
                      // 1. Verificar se o bucket existe (fallback para o próprio upload tratar)
                      // 2. Definir nome do arquivo
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                      const filePath = `banners-materiais/${fileName}`;

                      // Upload image to storage
                      // Usando o bucket 'banners_produtos'
                      const { error: uploadError } = await supabase.storage
                        .from('banners')
                        .upload(filePath, file, {
                          cacheControl: '3600',
                          upsert: false
                        });

                      if (uploadError) {
                        console.error("Storage upload error:", uploadError);
                        // Se o erro for 'Bucket not found', avisar de forma amigável ou tentar criar
                        if (uploadError.message.includes("Bucket not found")) {
                          throw new Error("O repositório de imagens (bucket 'banners') não foi encontrado. Por favor, contate o suporte.");
                        }
                        throw uploadError;
                      }

                      const { data: { publicUrl } } = supabase.storage
                        .from('banners')
                        .getPublicUrl(filePath);

                      const description = descInput?.value;

                      // Insert into database
                      const { error: dbError } = await supabase.from("materiais_afiliado").insert({
                        titulo: title,
                        descricao: description || "",
                        imagem_url: publicUrl,
                        disponivel: false,
                      });

                      if (dbError) throw dbError;

                      queryClient.invalidateQueries({ queryKey: ["admin-materiais-afiliado"] });
                      toast({ title: "Banner adicionado com sucesso! 🎨" });
                      
                      // Clear inputs
                      if (titleInput) titleInput.value = "";
                      if (descInput) descInput.value = "";
                    } catch (err: any) {
                      console.error("Process error:", err);
                      toast({ 
                        title: "Erro ao processar banner", 
                        description: err.message || "Verifique se o bucket 'banners' existe.", 
                        variant: "destructive" 
                      });
                    } finally {
                      setSaving(false);
                    }
                  };
                  input.click();
                }}
                disabled={saving}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Banner
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Prévia do Banner
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              {/* Banner Image Preview */}
              {preview.imagem_url ? (
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden border border-border">
                  <img
                    src={preview.imagem_url}
                    alt="Prévia do banner"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center border border-border">
                  <div className="text-center text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{preview.warning || "Imagem não disponível"}</p>
                  </div>
                </div>
              )}

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold">Título</Label>
                  <Input
                    value={editTitulo}
                    onChange={(e) => setEditTitulo(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Descrição</Label>
                  <Input
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Texto WhatsApp</Label>
                  <Textarea
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={generating || saving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Gerar Novamente
            </Button>
            <Button
              onClick={handleApproveAndSave}
              disabled={saving || !editTitulo.trim()}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Aprovar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Materials List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {materiais.length} material(is) criado(s)
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {materiais.map((m: any, i: number) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/50 shadow-card overflow-hidden">
                {m.imagem_url ? (
                  <div className="relative aspect-square bg-muted">
                    <img
                      src={m.imagem_url}
                      alt={m.titulo}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <Badge
                      className={`absolute top-2 right-2 text-[10px] ${
                        m.disponivel
                          ? "bg-green-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.disponivel ? "Visível" : "Oculto"}
                    </Badge>
                  </div>
                ) : (
                  <div className="aspect-square bg-muted/50 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                <CardContent className="p-3 space-y-2">
                  <div>
                    <h3 className="text-sm font-bold font-display text-foreground leading-tight">
                      {m.titulo}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{m.descricao}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(m.created_at)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.disponivel}
                        onCheckedChange={(checked) =>
                          toggleDisponivel.mutate({ id: m.id, disponivel: checked })
                        }
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {m.disponivel ? (
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Disponível</span>
                        ) : (
                          <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Oculto</span>
                        )}
                      </span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir material?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O banner será removido permanentemente e não estará mais disponível para os afiliados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMaterial.mutate(m.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {materiais.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              Nenhum material criado ainda. Use o gerador acima para criar banners.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMateriais;
