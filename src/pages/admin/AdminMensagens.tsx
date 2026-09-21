import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus, Trash2, MessageSquare, ImagePlus, Loader2, Send, Globe, Store as StoreIcon, Search } from "lucide-react";

const AdminMensagens = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoDestino, setTipoDestino] = useState<"all" | "specific">("all");
  const [lojaId, setLojaId] = useState<string>("");
  const [lojaSearch, setLojaSearch] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: lojas = [] } = useQuery({
    queryKey: ["admin-lojas-mensagens"],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["admin-mensagens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_mensagens")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const resetForm = () => {
    setTitulo(""); setDescricao(""); setTipoDestino("all"); setLojaId(""); setLojaSearch(""); setBannerFile(null);
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    if (tipoDestino === "specific" && !lojaId) {
      toast({ title: "Selecione o lojista", description: "Clique no nome do lojista na lista antes de enviar.", variant: "destructive" });
      return;
    }
    const finalLojaId = tipoDestino === "specific" ? lojaId : null;
    const lojaSelecionada = finalLojaId ? lojas.find((l: any) => l.id === finalLojaId) : null;
    if (tipoDestino === "specific" && !lojaSelecionada) {
      toast({ title: "Lojista inválido", description: "A loja selecionada não foi encontrada. Selecione novamente.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let banner_url: string | null = null;
      if (bannerFile) {
        if (!user?.id) throw new Error("Usuário não autenticado");
        const ext = bannerFile.name.split(".").pop();
        const path = `${user.id}/mensagens-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("banners").upload(path, bannerFile);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
        banner_url = pub.publicUrl;
      }
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        banner_url,
        loja_id: finalLojaId,
        created_by: user?.id,
      };
      console.log("[admin_mensagens] insert payload:", payload);
      const { data: inserted, error } = await supabase.from("admin_mensagens").insert(payload).select().single();
      if (error) throw error;
      if (finalLojaId && inserted?.loja_id !== finalLojaId) {
        toast({ title: "Aviso", description: "A mensagem foi salva sem destinatário. Verifique permissões.", variant: "destructive" });
      } else {
        toast({
          title: "Mensagem enviada!",
          description: lojaSelecionada ? `Destinatário: ${lojaSelecionada.nome}` : "Enviada para todos os lojistas.",
        });
      }
      resetForm(); setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-mensagens"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("admin_mensagens").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem removida" });
    qc.invalidateQueries({ queryKey: ["admin-mensagens"] });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Mensagens aos Lojistas
          </h1>
          <p className="text-sm text-muted-foreground">Envie comunicados para todos ou uma loja específica.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <MessageSquarePlus className="w-4 h-4" /> Nova mensagem
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : mensagens.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem enviada.</div>
          ) : (
            <div className="space-y-3">
              {mensagens.map((m: any) => {
                const loja = lojas.find((l: any) => l.id === m.loja_id);
                return (
                  <div key={m.id} className="border rounded-lg p-4 flex gap-4">
                    {m.banner_url && (
                      <img src={m.banner_url} alt="" className="w-24 h-24 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{m.titulo}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                          {m.loja_id ? <><StoreIcon className="w-3 h-3" />{loja?.nome || "Loja"}</> : <><Globe className="w-3 h-3" />Todos</>}
                        </span>
                      </div>
                      {m.descricao && <p className="text-sm text-muted-foreground line-clamp-3">{m.descricao}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover mensagem?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A mensagem será removida para todos os lojistas. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(m.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova mensagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Destinatário</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => { setTipoDestino("all"); setLojaId(""); setLojaSearch(""); }}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    tipoDestino === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  <Globe className="w-4 h-4" /> Todos os lojistas
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoDestino("specific"); }}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    tipoDestino === "specific" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  <StoreIcon className="w-4 h-4" /> Lojista específico
                </button>
              </div>
            </div>
            {tipoDestino === "specific" && (
              <div>
                <Label>Selecione o lojista</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={lojaSearch}
                    onChange={(e) => setLojaSearch(e.target.value)}
                    placeholder="Buscar lojista..."
                    className="pl-8"
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md divide-y">
                  {lojas
                    .filter((l: any) => l.nome.toLowerCase().includes(lojaSearch.toLowerCase()))
                    .map((l: any) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { setTipoDestino("specific"); setLojaId(l.id); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                          lojaId === l.id ? "bg-primary text-primary-foreground font-semibold" : ""
                        }`}
                      >
                        <StoreIcon className="w-3.5 h-3.5 shrink-0" />
                        {l.nome}
                        {lojaId === l.id && <span className="ml-auto text-[10px]">✓ SELECIONADO</span>}
                      </button>
                    ))}
                  {lojas.filter((l: any) => l.nome.toLowerCase().includes(lojaSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum lojista encontrado</p>
                  )}
                </div>
                {lojaId && (
                  <div className="mt-2 p-2 rounded-md bg-primary/10 border border-primary/30 text-xs">
                    <span className="text-muted-foreground">Destinatário: </span>
                    <span className="font-bold text-primary">{lojas.find((l: any) => l.id === lojaId)?.nome}</span>
                  </div>
                )}
              </div>
            )}
            <div>
              <Label>Título *</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Manutenção programada" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Conteúdo da mensagem..." rows={5} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><ImagePlus className="w-4 h-4" /> Banner (opcional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
              {bannerFile && (
                <p className="text-xs text-muted-foreground mt-1">{bannerFile.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMensagens;
