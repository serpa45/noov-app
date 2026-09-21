import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

const PIE_COLORS = ["#3B82F6", "#22C55E", "#F97316", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F59E0B"];

interface Props {
  evolucaoDiaria: { dia: string; receita: number; despesa: number; lucro: number }[];
  despesasPorCategoria: { categoria: string; valor: number; percentual: number }[];
  produtosMaisVendidos: { nome: string; qtd: number; total: number }[];
}

export default function FinancialCharts({ evolucaoDiaria, despesasPorCategoria, produtosMaisVendidos }: Props) {
  return (
    <div className="space-y-6">
      {/* Receita vs Despesa vs Lucro */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">📊 Receita × Despesa × Lucro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {evolucaoDiaria.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolucaoDiaria} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Sem dados no período</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Despesas por Categoria - Pie */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">💸 Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {despesasPorCategoria.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={despesasPorCategoria} dataKey="valor" nameKey="categoria" cx="50%" cy="50%" outerRadius={90} label={({ categoria, percentual }) => `${categoria} (${percentual.toFixed(0)}%)`} labelLine={false} fontSize={10}>
                      {despesasPorCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmt(v), ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem despesas</p>
            )}
          </CardContent>
        </Card>

        {/* Produtos mais vendidos */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">🔥 Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {produtosMaisVendidos.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {produtosMaisVendidos.map((p, i) => (
                  <div key={p.nome} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{p.qtd} vendidos</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-blue-500">{fmt(p.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem vendas</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
