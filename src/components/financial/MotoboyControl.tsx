import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Trophy, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MotoboyData {
  id: string;
  nome: string;
  entregas: number;
  valorTotal: number;
}

interface EntregaRaw {
  id: string;
  created_at: string;
  valor_entrega: number;
}

interface Props {
  ranking: MotoboyData[];
  entregas?: EntregaRaw[];
}

export default function MotoboyControl({ ranking, entregas = [] }: Props) {
  const navigate = useNavigate();
  const entregasPorDia = useMemo(() => {
    const dias: Record<string, { qtd: number; valor: number }> = {};
    entregas.forEach(e => {
      const dia = format(parseISO(e.created_at), "dd/MM");
      if (!dias[dia]) dias[dia] = { qtd: 0, valor: 0 };
      dias[dia].qtd++;
      dias[dia].valor += Number(e.valor_entrega);
    });
    return Object.entries(dias)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, v]) => ({ dia, qtd: v.qtd, valor: v.valor }));
  }, [entregas]);

  return (
    <div className="space-y-4">
      {/* Gráfico de entregas por dia */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-500" /> Entregas por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entregasPorDia.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrega no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={entregasPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "qtd" ? [`${value}`, "Entregas"] : [fmt(value), "Valor"]
                  }
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="qtd" fill="#F97316" radius={[4, 4, 0, 0]} name="qtd" />
                <Bar dataKey="valor" fill="#3B82F6" radius={[4, 4, 0, 0]} name="valor" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Motoboys
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma entrega registrada no período.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((m, i) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/lojista/financeiro/motoboy/${m.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-yellow-500/20 text-yellow-600" : i === 1 ? "bg-gray-300/30 text-gray-500" : "bg-orange-500/10 text-orange-500"
                    }`}>
                      {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{m.entregas} entregas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-600">{fmt(m.valorTotal)}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
