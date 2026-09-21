import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";

const DemoFinancial = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold font-display">Financeiro</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { label: "Faturamento Hoje", value: "R$ 144,60", icon: DollarSign },
        { label: "Faturamento Mês", value: "R$ 4.870,00", icon: TrendingUp },
        { label: "Ticket Médio", value: "R$ 48,20", icon: DollarSign },
      ].map((s, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <s.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold font-display">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        <p>📊 Dados financeiros fictícios para demonstração</p>
      </CardContent>
    </Card>
  </div>
);

export default DemoFinancial;
