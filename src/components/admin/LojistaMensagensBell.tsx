import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Trash2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  lojaId?: string | null;
}

const LojistaMensagensBell = ({ lojaId }: Props) => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: mensagens = [] } = useQuery({
    queryKey: ["lojista-mensagens", lojaId],
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from("admin_mensagens")
        .select("*")
        .or(lojaId ? `loja_id.is.null,loja_id.eq.${lojaId}` : "loja_id.is.null")
        .order("created_at", { ascending: false });
      if (!msgs || !lojaId) return msgs || [];
      const { data: excluidas } = await supabase
        .from("admin_mensagens_excluidas")
        .select("mensagem_id")
        .eq("loja_id", lojaId);
      const excSet = new Set((excluidas || []).map((e: any) => e.mensagem_id));
      return msgs.filter((m: any) => !excSet.has(m.id));
    },
    enabled: !!lojaId,
    refetchInterval: 60000,
  });

  const { data: lidas = [] } = useQuery({
    queryKey: ["lojista-mensagens-lidas", lojaId],
    queryFn: async () => {
      if (!lojaId) return [];
      const { data } = await supabase
        .from("admin_mensagens_lidas")
        .select("mensagem_id")
        .eq("loja_id", lojaId);
      return (data || []).map((r: any) => r.mensagem_id);
    },
    enabled: !!lojaId,
  });

  const lidasSet = new Set(lidas);
  const naoLidas = mensagens.filter((m: any) => !lidasSet.has(m.id)).length;

  useEffect(() => {
    if (!lojaId) return;
    const ch = supabase
      .channel("lojista-mensagens-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_mensagens" }, () => {
        qc.invalidateQueries({ queryKey: ["lojista-mensagens", lojaId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lojaId, qc]);

  const marcarLida = async (mensagemId: string) => {
    if (!lojaId) return;
    if (lidasSet.has(mensagemId)) return;
    await supabase.from("admin_mensagens_lidas").insert({ mensagem_id: mensagemId, loja_id: lojaId });
    qc.invalidateQueries({ queryKey: ["lojista-mensagens-lidas", lojaId] });
  };

  const excluir = async (mensagemId: string) => {
    if (!lojaId) return;
    const { error } = await supabase
      .from("admin_mensagens_excluidas")
      .insert({ mensagem_id: mensagemId, loja_id: lojaId });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Mensagem removida" });
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["lojista-mensagens", lojaId] });
  };

  if (mensagens.length === 0) return null;
  
  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
      <SheetTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          title="Mensagens"
        >
          <Mail className="w-5 h-5 text-muted-foreground" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {selected ? (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 hover:text-primary">
                <ChevronLeft className="w-5 h-5" /> Mensagens
              </button>
            ) : (
              <><Mail className="w-5 h-5" /> Mensagens</>
            )}
          </SheetTitle>
        </SheetHeader>

        {!selected ? (
          <div className="mt-4 space-y-1">
            {mensagens.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma mensagem no momento.
              </p>
            ) : (
              mensagens.map((m: any) => {
                const naoLida = !lidasSet.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); marcarLida(m.id); }}
                    className="w-full text-left flex items-center justify-between gap-2 p-3 rounded-lg hover:bg-muted transition-colors border-b border-border/50"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 relative pl-6">
                      {naoLida ? (
                        <Mail className="w-4 h-4 text-destructive shrink-0 absolute -left-1 top-1/2 -translate-y-1/2" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600 shrink-0 absolute -left-1 top-1/2 -translate-y-1/2" />
                      )}
                      <span className={`text-sm truncate ${naoLida ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {m.titulo}
                      </span>
                    </div>
                    {naoLida && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-4 border rounded-lg overflow-hidden bg-card">
            {selected.banner_url && (
              <img src={selected.banner_url} alt="" className="w-full max-h-64 object-cover" />
            )}
            <div className="p-4">
              <h3 className="font-bold text-base mb-1">{selected.titulo}</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                {new Date(selected.created_at).toLocaleString("pt-BR")}
              </p>
              {selected.descricao && (
                <p className="text-sm text-foreground whitespace-pre-line">
                  {selected.descricao}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => excluir(selected.id)}
                className="mt-4 text-destructive hover:text-destructive gap-2"
              >
                <Trash2 className="w-4 h-4" /> Excluir mensagem
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default LojistaMensagensBell;
