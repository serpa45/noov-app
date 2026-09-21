import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

interface Props {
  evolucaoDiaria: { dia: string; receita: number; despesa: number; lucro: number }[];
  receitaTotal: number;
  despesaTotal: number;
}

export default function AIPrediction({ evolucaoDiaria, receitaTotal, despesaTotal }: Props) {
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Simple moving average prediction (fallback without AI)
  const generateLocalPrediction = () => {
    if (evolucaoDiaria.length < 3) return null;
    const last7 = evolucaoDiaria.slice(-7);
    const avgReceita = last7.reduce((s, d) => s + d.receita, 0) / last7.length;
    const avgDespesa = last7.reduce((s, d) => s + d.despesa, 0) / last7.length;
    const avgLucro = avgReceita - avgDespesa;

    // Trend: compare first half vs second half
    const half = Math.floor(last7.length / 2);
    const firstHalf = last7.slice(0, half);
    const secondHalf = last7.slice(half);
    const avgFirst = firstHalf.reduce((s, d) => s + d.receita, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.receita, 0) / secondHalf.length;
    const trend = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0;

    const projectedDays = [];
    for (let i = 1; i <= 7; i++) {
      const factor = 1 + (trend / 100) * (i / 7);
      projectedDays.push({
        dia: `+${i}d`,
        receita: Math.round(avgReceita * factor),
        previsao: Math.round(avgReceita * factor),
      });
    }

    const chartData = [
      ...evolucaoDiaria.slice(-7).map(d => ({ dia: d.dia, receita: d.receita, previsao: null as number | null })),
      ...projectedDays.map(d => ({ dia: d.dia, receita: null as number | null, previsao: d.previsao })),
    ];

    return {
      previsaoFaturamento7d: Math.round(avgReceita * 7 * (1 + trend / 100)),
      previsaoLucro7d: Math.round(avgLucro * 7 * (1 + trend / 100)),
      tendencia: trend,
      chartData,
    };
  };

  const handlePredict = () => {
    setLoading(true);
    setTimeout(() => {
      const result = generateLocalPrediction();
      setPrediction(result);
      setLoading(false);
    }, 800);
  };

  return (
    <Card className="border-border/50 shadow-sm border-purple-200/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" /> Previsão Inteligente
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handlePredict} disabled={loading || evolucaoDiaria.length < 3} className="gap-1 border-purple-300 text-purple-600 hover:bg-purple-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            {loading ? "Analisando..." : "Gerar Previsão"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!prediction && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {evolucaoDiaria.length < 3
              ? "Dados insuficientes. Precisa de pelo menos 3 dias de vendas."
              : "Clique em 'Gerar Previsão' para analisar seus dados e projetar receitas futuras."}
          </p>
        )}

        {prediction && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-center">
                <p className="text-xs text-muted-foreground">Faturamento 7d</p>
                <p className="text-lg font-bold text-purple-600">{fmt(prediction.previsaoFaturamento7d)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                <p className="text-xs text-muted-foreground">Lucro Previsto 7d</p>
                <p className="text-lg font-bold text-green-600">{fmt(prediction.previsaoLucro7d)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Tendência</p>
                <div className="flex items-center gap-1">
                  {prediction.tendencia >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                  <span className={`text-lg font-bold ${prediction.tendencia >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {prediction.tendencia >= 0 ? "+" : ""}{prediction.tendencia.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prediction.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="dia" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => [fmt(v), ""]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" name="Real" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="previsao" name="Previsão (IA)" stroke="#8B5CF6" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
