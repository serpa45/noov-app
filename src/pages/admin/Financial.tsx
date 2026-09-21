import { useFinancialData } from "@/hooks/useFinancialData";
import FinancialStats from "@/components/financial/FinancialStats";
import FinancialFilters from "@/components/financial/FinancialFilters";
import FinancialCharts from "@/components/financial/FinancialCharts";
import DespesasManager from "@/components/financial/DespesasManager";
import MotoboyControl from "@/components/financial/MotoboyControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Receipt, Bike, BarChart3, Lock } from "lucide-react";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Financial = () => {
  const data = useFinancialData();
  const { trialDays, daysRemaining, isExpired } = useTrialStatus();
  const { limits } = useStorePlanLimits();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;

  // Fetch plano atual para controle de abas
  const { data: lojaPlano } = useQuery({
    queryKey: ["loja-plano-financial", data.loja?.id],
    queryFn: async () => {
      const { data: lp } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(slug)")
        .eq("loja_id", data.loja!.id)
        .eq("ativo", true)
        .maybeSingle();
      return lp;
    },
    enabled: !!data.loja?.id,
  });

  const planoSlug = (lojaPlano as any)?.planos?.slug || "";
  const isPlanProOrUltra = planoSlug === "pro" || planoSlug === "ultra" || isInTrial || !!(limits as any).financeiro;
  
  // A aba motoboy deve estar disponível apenas se o plano permitir entregas (mesma lógica do menu lateral)
  const isDeliveryEnabled = limits.entregas !== false;
  const isMotoboyTabAvailable = isPlanProOrUltra && isDeliveryEnabled;


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground truncate">Financeiro</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Central de inteligência financeira do seu negócio</p>
        </div>
        <div className="w-full lg:w-auto lg:flex-shrink-0">
          <FinancialFilters
            period={data.period}
            setPeriod={data.setPeriod}
            selectedMonth={data.selectedMonth}
            setSelectedMonth={data.setSelectedMonth}
            selectedYear={data.selectedYear}
            setSelectedYear={data.setSelectedYear}
            monthNames={data.monthNames}
            yearsList={data.yearsList}
            customRange={data.customRange}
            setCustomRange={data.setCustomRange}
          />
        </div>
      </div>



      <FinancialStats
        receitaTotal={data.receitaTotal}
        despesaTotal={data.despesaTotal}
        lucroLiquido={data.lucroLiquido}
        margemLucro={data.margemLucro}
        totalPedidos={data.totalPedidos}
      />


      <Tabs defaultValue="visao-geral" className="w-full">
        <div className="mb-0 relative z-10">
          <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-1 overflow-x-auto overflow-y-hidden flex-nowrap rounded-none">
            <TabsTrigger value="visao-geral" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
              <BarChart3 className="w-4 h-4" /> Geral
            </TabsTrigger>
            <TabsTrigger value="receitas" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
              <DollarSign className="w-4 h-4" /> Receitas
            </TabsTrigger>
            <TabsTrigger value="despesas" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
              <Receipt className="w-4 h-4" /> Despesas
            </TabsTrigger>
            <TabsTrigger
              value="motoboy"
              disabled={!isMotoboyTabAvailable}
              className={`flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-medium -mb-px ${!isMotoboyTabAvailable ? 'grayscale' : ''}`}
            >
              <Bike className="w-4 h-4" /> Motoboy {!isMotoboyTabAvailable && <Lock className="w-3 h-3 ml-0.5" />}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="rounded-xl rounded-tl-none border border-border/50 bg-card overflow-hidden">
          <TabsContent value="visao-geral" className="mt-0 p-4">
            <FinancialCharts
              evolucaoDiaria={data.evolucaoDiaria}
              despesasPorCategoria={data.despesasPorCategoria}
              produtosMaisVendidos={data.produtosMaisVendidos}
            />
          </TabsContent>

          <TabsContent value="despesas" className="mt-0 p-4">
            {data.loja ? (
              <DespesasManager despesas={data.despesas} lojaId={data.loja.id} onRefresh={data.refetchDespesas} />
            ) : (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            )}
          </TabsContent>

          <TabsContent value="motoboy" className="mt-0 p-4">
            <MotoboyControl ranking={data.motoboyRanking} entregas={data.entregas} />
          </TabsContent>

          <TabsContent value="receitas" className="mt-0 p-4">
            <div className="space-y-2">
              {data.pedidos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido no período selecionado.</p>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left font-medium">Cliente</th>
                        <th className="p-3 text-left font-medium">Origem</th>
                        <th className="p-3 text-left font-medium">Tipo</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-right font-medium">Total</th>
                        <th className="p-3 text-right font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pedidos.slice(0, 50).map(p => (
                        <tr key={p.id} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                          <td className="p-3">{p.cliente_nome || "Não informado"}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              p.origem === "pdv" ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                            }`}>{p.origem === "pdv" ? "PDV" : "App"}</span>
                          </td>
                          <td className="p-3 capitalize">{p.tipo}</td>
                          <td className="p-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              p.status === "entregue" || p.status === "finalizado" ? "bg-primary/10 text-primary" :
                              p.status === "cancelado" ? "bg-destructive/10 text-destructive" :
                              "bg-muted text-muted-foreground"
                            }`}>{p.status}</span>
                          </td>
                          <td className="p-3 text-right font-semibold">
                            {Number(p.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="p-3 text-right text-muted-foreground text-xs">
                            {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

    </div>
  );
};

export default Financial;
