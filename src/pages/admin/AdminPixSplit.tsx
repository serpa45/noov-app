import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Building2, Percent, QrCode } from "lucide-react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminPixSplit() {
  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["admin-pix-split"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_split_pagamentos")
        .select("*, lojas(nome, slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const totalPlataforma = pagamentos.filter(p => p.status === "aprovado").reduce((s, p) => s + Number(p.valor_plataforma), 0);
  const totalLojistas = pagamentos.filter(p => p.status === "aprovado").reduce((s, p) => s + Number(p.valor_lojista), 0);
  const totalGeral = pagamentos.filter(p => p.status === "aprovado").reduce((s, p) => s + Number(p.valor_total), 0);

  const statusColor = (s: string) => {
    if (s === "aprovado") return "bg-green-100 text-green-700";
    if (s === "rejeitado" || s === "cancelado") return "bg-red-100 text-red-700";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold font-display">Pagamentos PIX — Split</h2>
        <p className="text-sm text-muted-foreground">Visualize todos os pagamentos PIX com divisão plataforma × lojista</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Recebido</p>
              <p className="text-lg font-bold">{fmt(totalGeral)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Percent className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comissão Plataforma</p>
              <p className="text-lg font-bold">{fmt(totalPlataforma)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Repassado Lojistas</p>
              <p className="text-lg font-bold">{fmt(totalLojistas)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : pagamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento PIX registrado.</p>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Loja</th>
                <th className="p-3 text-right font-medium">Total</th>
                <th className="p-3 text-right font-medium">Plataforma</th>
                <th className="p-3 text-right font-medium">Lojista</th>
                <th className="p-3 text-center font-medium">%</th>
                <th className="p-3 text-center font-medium">Status</th>
                <th className="p-3 text-right font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p: any) => (
                <tr key={p.id} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{(p as any).lojas?.nome || "—"}</td>
                  <td className="p-3 text-right">{fmt(Number(p.valor_total))}</td>
                  <td className="p-3 text-right text-orange-600 font-semibold">{fmt(Number(p.valor_plataforma))}</td>
                  <td className="p-3 text-right text-green-600 font-semibold">{fmt(Number(p.valor_lojista))}</td>
                  <td className="p-3 text-center">{Number(p.comissao_percentual).toFixed(1)}%</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                  </td>
                  <td className="p-3 text-right text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
