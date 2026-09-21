import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Flame, ShoppingCart, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface TopSellersTabProps {
  lojaId: string;
  userId: string;
}

interface ProductRow {
  id: string;
  nome: string;
  imagem_url: string | null;
  preco: number | null;
  preco_promocional: number | null;
  disponivel: boolean;
  categoria: string | null;
}

const rankColors = [
  "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
  "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-50",
];

export default function TopSellersTab({ lojaId, userId }: TopSellersTabProps) {
  const [ativo, setAtivo] = useState<boolean>(true);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lojas")
        .select("mais_vendidos_ativo")
        .eq("id", lojaId)
        .maybeSingle();
      if (data) setAtivo((data as any).mais_vendidos_ativo !== false);
    })();
  }, [lojaId]);

  const toggleAtivo = async (next: boolean) => {
    setAtivo(next);
    setSavingToggle(true);
    const { error } = await supabase
      .from("lojas")
      .update({ mais_vendidos_ativo: next } as any)
      .eq("id", lojaId);
    setSavingToggle(false);
    if (error) {
      setAtivo(!next);
      toast.error("Erro ao atualizar");
    } else {
      toast.success(next ? "Vitrine ativada no cardápio" : "Vitrine desativada no cardápio");
    }
  };

  const { data: counts = {}, isLoading: loadingCounts } = useQuery({
    queryKey: ["admin-top-sellers", userId, lojaId],
    enabled: !!userId && !!lojaId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const acc: Record<string, number> = {};
      const [pedidosRes, pdvRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select("items")
          .eq("lojista_id", userId)
          .in("status", ["concluido", "finalizado", "entregue"]),
        supabase
          .from("pdv_pedidos")
          .select("items")
          .eq("loja_id", lojaId)
          .in("status", ["finalizado", "fechado"]),
      ]);
      const accumulate = (rows: any[] | null) => {
        if (!rows) return;
        for (const p of rows) {
          const items = Array.isArray(p.items) ? p.items : [];
          for (const it of items) {
            const id = it?.id;
            if (!id) continue;
            const qty = Number(it?.quantity || it?.quantidade || it?.qtd || 1) || 1;
            acc[id] = (acc[id] || 0) + qty;
          }
        }
      };
      accumulate(pedidosRes.data as any[]);
      accumulate(pdvRes.data as any[]);
      return acc;
    },
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["admin-top-sellers-products", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id,nome,imagem_url,preco,preco_promocional,disponivel,categoria")
        .eq("loja_id", lojaId);
      if (error) throw error;
      return (data || []) as ProductRow[];
    },
  });

  const loading = loadingCounts || loadingProducts;

  const ranking = [...products]
    .map((p) => ({ ...p, qtd: counts[p.id] || 0 }))
    .filter((p) => p.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);

  const top5Ids = new Set(ranking.slice(0, 5).map((p) => p.id));
  const totalVendidos = ranking.reduce((s, p) => s + p.qtd, 0);

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-primary" />
            </div>
            <div>
              <Label htmlFor="mais-vendidos-toggle" className="text-sm font-semibold cursor-pointer">
                Exibir vitrine "Mais vendidos" no cardápio público
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando ativado, os 5 produtos mais vendidos aparecem em destaque na página pública da sua loja.
              </p>
            </div>
          </div>
          <Switch
            id="mais-vendidos-toggle"
            checked={ativo}
            disabled={savingToggle}
            onCheckedChange={toggleAtivo}
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-4 h-4" /> Produtos com vendas
            </div>
            <p className="text-2xl font-bold font-display">{ranking.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingCart className="w-4 h-4" /> Total de unidades vendidas
            </div>
            <p className="text-2xl font-bold font-display">{totalVendidos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-secondary" />
          Ranking de produtos mais vendidos
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : ranking.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma venda registrada ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {ranking.map((p, idx) => {
              const isTop5 = top5Ids.has(p.id);
              return (
                <Card
                  key={p.id}
                  className={`transition-all ${isTop5 ? "border-primary/40 bg-primary/[0.02]" : "opacity-70"}`}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <Badge
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-0 shadow-sm flex-shrink-0 ${
                        rankColors[idx] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {idx + 1}º
                    </Badge>
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {p.imagem_url ? (
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.categoria || "Sem categoria"}
                        {!p.disponivel && " • Indisponível"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end text-primary font-bold">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span className="text-base">{p.qtd}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">vendidos</p>
                    </div>
                    {isTop5 && (
                      <Badge variant="outline" className="border-primary/40 text-primary text-[10px] hidden sm:inline-flex">
                        No cardápio
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
