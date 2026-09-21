import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Smile, Meh, Frown, MessageSquareX, Trash2, Loader2, Image as ImageIcon, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ratingMeta: Record<string, { label: string; color: string; icon: any }> = {
  ruim: { label: "Ruim", color: "text-orange-500", icon: Frown },
  bom: { label: "Bom", color: "text-lime-500", icon: Meh },
  otimo: { label: "Ótimo", color: "text-emerald-500", icon: Smile },
};

export default function AdminAvaliacoes() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin-rating-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_rating_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["admin-ratings-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_ratings")
        .select(`*, lojas ( nome )`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: optouts = [] } = useQuery({
    queryKey: ["admin-rating-optouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_rating_optouts")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const toggleEnabled = async (val: boolean) => {
    const { error } = await supabase
      .from("system_rating_settings")
      .update({ enabled: val, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return toast.error("Erro ao atualizar.");
    qc.invalidateQueries({ queryKey: ["admin-rating-settings"] });
    toast.success(val ? "Popup ativado" : "Popup desativado");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta avaliação?")) return;
    const { error } = await supabase.from("system_ratings").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir.");
    qc.invalidateQueries({ queryKey: ["admin-ratings-list"] });
    toast.success("Avaliação excluída");
  };

  const handleEventImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const ext = file.name.split(".").pop();
      const path = `${uid}/event-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("banners").upload(path, file, { upsert: true });
      if (upErr) {
        toast.error("Erro ao enviar imagem: " + upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
      const url = pub.publicUrl + "?t=" + Date.now();
      const { error } = await supabase
        .from("system_rating_settings")
        .update({ event_image_url: url, updated_at: new Date().toISOString() } as any)
        .eq("id", 1);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-rating-settings"] });
      toast.success("Imagem de evento atualizada!");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveEventImage = async () => {
    if (!confirm("Remover imagem de evento?")) return;
    const { error } = await supabase
      .from("system_rating_settings")
      .update({ event_image_url: null, updated_at: new Date().toISOString() } as any)
      .eq("id", 1);
    if (error) return toast.error("Erro ao remover.");
    qc.invalidateQueries({ queryKey: ["admin-rating-settings"] });
    toast.success("Imagem removida");
  };

  const total = ratings.length;
  const ruim = ratings.filter((r: any) => r.rating === "ruim").length;
  const bom = ratings.filter((r: any) => r.rating === "bom").length;
  const otimo = ratings.filter((r: any) => r.rating === "otimo").length;
  const avgScore = total > 0 ? ((ruim * 1 + bom * 2 + otimo * 3) / total).toFixed(2) : "0.00";

  const eventImageUrl = (settings as any)?.event_image_url as string | null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <Star className="w-6 h-6 text-secondary" /> Avaliações & Conteúdo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie o popup de avaliação e imagens de eventos exibidas no cardápio público.
        </p>
      </div>

      <Tabs defaultValue="avaliacoes" className="w-full">
        <TabsList>
          <TabsTrigger value="avaliacoes">
            <Star className="w-4 h-4 mr-1.5" /> Avaliações
          </TabsTrigger>
          <TabsTrigger value="evento">
            <ImageIcon className="w-4 h-4 mr-1.5" /> Imagem de Eventos do Dia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacoes" className="space-y-6 mt-4">
          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="enabled" className="text-base font-semibold">
                  Exibir popup de avaliação
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Quando ativado, o popup aparece para clientes logados que ainda não avaliaram.
                </p>
              </div>
              <Switch id="enabled" checked={!!settings?.enabled} onCheckedChange={toggleEnabled} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold font-display">{total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-orange-500 font-semibold">Ruim</p><p className="text-2xl font-bold font-display text-orange-500">{ruim}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-lime-600 font-semibold">Bom</p><p className="text-2xl font-bold font-display text-lime-600">{bom}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-emerald-600 font-semibold">Ótimo</p><p className="text-2xl font-bold font-display text-emerald-600">{otimo}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquareX className="w-3 h-3" /> Não quiseram votar</p><p className="text-2xl font-bold font-display">{optouts.length}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Nota média (de 1 a 3)</p>
              <p className="text-3xl font-bold font-display text-primary">{avgScore}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Histórico de Avaliações</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : ratings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {ratings.map((r: any) => {
                    const meta = ratingMeta[r.rating] || ratingMeta.bom;
                    const Icon = meta.icon;
                    return (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                        <div className={`shrink-0 ${meta.color}`}><Icon className="w-6 h-6" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{r.cliente_nome || "Cliente"}</span>
                            <span className="text-xs text-muted-foreground">{r.cliente_telefone}</span>
                            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                            {r.lojas?.nome && (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">Loja: {r.lojas.nome}</Badge>
                            )}
                          </div>
                          {r.observacoes && (
                            <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{r.observacoes}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evento" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" /> Imagem de Eventos do Dia
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Adicione uma imagem temática (Dia dos Namorados, Dia dos Pais, Copa do Mundo, Olimpíadas…).
                Ela aparece no canto superior direito do cabeçalho do cardápio público de todas as lojas.
                Use uma imagem quadrada (PNG com fundo transparente recomendado).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-border flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  {eventImageUrl ? (
                    <img src={eventImageUrl} alt="Evento" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    id="event-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleEventImageUpload}
                    disabled={uploading}
                  />
                  <Button
                    onClick={() => document.getElementById("event-image-input")?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> {eventImageUrl ? "Trocar imagem" : "Enviar imagem"}</>
                    )}
                  </Button>
                  {eventImageUrl && (
                    <Button variant="outline" onClick={handleRemoveEventImage} disabled={uploading}>
                      <X className="w-4 h-4 mr-2" /> Remover imagem
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A imagem é global — alterações refletem em todas as lojas imediatamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
