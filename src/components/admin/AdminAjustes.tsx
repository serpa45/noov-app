import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Clock, Percent, DollarSign, KeyRound, Printer } from "lucide-react";


const useGlobalConfig = (chave: string) => {
  return useQuery({
    queryKey: ["config-global", chave],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_globais")
        .select("*")
        .eq("chave", chave)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

const useSaveConfig = (chave: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ valor, existingId }: { valor: string; existingId?: string }) => {
      if (existingId) {
        const { error } = await supabase
          .from("configuracoes_globais")
          .update({ valor, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_globais")
          .insert({ chave, valor });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-global"] });
      toast({ title: "Configuração salva ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });
};

const AdminAjustes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [diasTeste, setDiasTeste] = useState("");
  const [testeAtivo, setTesteAtivo] = useState(true);
  const [comissaoAfiliado, setComissaoAfiliado] = useState("");
  const [comissaoPlataforma, setComissaoPlataforma] = useState("");
  const [masterLojista, setMasterLojista] = useState("");
  const [masterAfiliado, setMasterAfiliado] = useState("");
  const [taxaIntegracao, setTaxaIntegracao] = useState("");

  const { data: config, isLoading: loadingTeste } = useGlobalConfig("dias_teste_gratis");
  const { data: comissaoConfig, isLoading: loadingComissao } = useGlobalConfig("comissao_afiliado_percent");
  const { data: comissaoPlataformaConfig, isLoading: loadingComissaoPlataforma } = useGlobalConfig("comissao_plataforma_percent");
  const { data: masterLojistaConfig, isLoading: loadingMasterLojista } = useGlobalConfig("master_code_lojista");
  const { data: masterAfiliadoConfig, isLoading: loadingMasterAfiliado } = useGlobalConfig("master_code_afiliado");
  const { data: taxaIntegracaoConfig, isLoading: loadingTaxaIntegracao } = useGlobalConfig("taxa_integracao_mercado_pago");

  const saveMasterLojistaMutation = useSaveConfig("master_code_lojista");
  const saveMasterAfiliadoMutation = useSaveConfig("master_code_afiliado");

  useEffect(() => {
    if (config?.valor !== undefined) {
      const val = config.valor;
      if (val === "0" || val === "desativado") {
        setTesteAtivo(false);
        setDiasTeste(val === "desativado" ? "0" : val);
      } else {
        setTesteAtivo(true);
        setDiasTeste(val);
      }
    }
  }, [config]);

  useEffect(() => {
    if (comissaoConfig?.valor !== undefined) setComissaoAfiliado(comissaoConfig.valor);
  }, [comissaoConfig]);

  useEffect(() => {
    if (comissaoPlataformaConfig?.valor !== undefined) setComissaoPlataforma(comissaoPlataformaConfig.valor);
  }, [comissaoPlataformaConfig]);

  useEffect(() => {
    if (masterLojistaConfig?.valor !== undefined) setMasterLojista(masterLojistaConfig.valor);
  }, [masterLojistaConfig]);

  useEffect(() => {
    if (masterAfiliadoConfig?.valor !== undefined) setMasterAfiliado(masterAfiliadoConfig.valor);
  }, [masterAfiliadoConfig]);

  useEffect(() => {
    if (taxaIntegracaoConfig?.valor !== undefined) setTaxaIntegracao(taxaIntegracaoConfig.valor);
  }, [taxaIntegracaoConfig]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      const valorFinal = testeAtivo ? diasTeste : "0";
      if (config?.id) {
        const { error } = await supabase
          .from("configuracoes_globais")
          .update({ valor: valorFinal, updated_at: new Date().toISOString() })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_globais")
          .insert({ chave: "dias_teste_gratis", valor: valorFinal });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-global"] });
      queryClient.invalidateQueries({ queryKey: ["landing-planos"] });
      toast({ title: "Configuração salva ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const saveComissao = useMutation({
    mutationFn: async () => {
      if (comissaoConfig?.id) {
        const { error } = await supabase
          .from("configuracoes_globais")
          .update({ valor: comissaoAfiliado, updated_at: new Date().toISOString() })
          .eq("id", comissaoConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_globais")
          .insert({ chave: "comissao_afiliado_percent", valor: comissaoAfiliado });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-global"] });
      toast({ title: "Comissão de afiliado salva ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const saveComissaoPlataforma = useMutation({
    mutationFn: async () => {
      if (comissaoPlataformaConfig?.id) {
        const { error } = await supabase
          .from("configuracoes_globais")
          .update({ valor: comissaoPlataforma, updated_at: new Date().toISOString() })
          .eq("id", comissaoPlataformaConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_globais")
          .insert({ chave: "comissao_plataforma_percent", valor: comissaoPlataforma });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-global"] });
      toast({ title: "Comissão da plataforma salva ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const saveTaxaIntegracao = useMutation({
    mutationFn: async () => {
      if (taxaIntegracaoConfig?.id) {
        const { error } = await supabase
          .from("configuracoes_globais")
          .update({ valor: taxaIntegracao, updated_at: new Date().toISOString() })
          .eq("id", taxaIntegracaoConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_globais")
          .insert({ chave: "taxa_integracao_mercado_pago", valor: taxaIntegracao });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-global"] });
      toast({ title: "Taxa de integração salva ✅" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const isLoading = loadingTeste || loadingComissao || loadingComissaoPlataforma || loadingMasterLojista || loadingMasterAfiliado || loadingTaxaIntegracao;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      
      {/* Teste Grátis */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold font-display text-foreground">Teste Grátis</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Define o período de teste grátis exibido na landing page e aplicado aos novos cadastros de planos pagos.
        </p>
        {testeAtivo && (
          <div>
            <Label className="text-xs">Dias de teste grátis</Label>
            <Input
              type="number"
              min={1}
              value={diasTeste}
              onChange={(e) => setDiasTeste(e.target.value)}
              placeholder="Ex: 7"
              className="mt-1 w-40"
            />
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={testeAtivo} onCheckedChange={setTesteAtivo} />
            <Label className="text-xs text-muted-foreground">{testeAtivo ? "Ativado" : "Desativado"}</Label>
          </div>
          <Button onClick={() => saveConfig.mutate()} disabled={saveConfig.isPending} size="sm">
            {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Comissão de Afiliado */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-accent" />
          <h3 className="text-base font-bold font-display text-foreground">Comissão de Afiliado</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Define a porcentagem de comissão que o afiliado recebe por cada assinatura de lojista indicado.
        </p>
        <div>
          <Label className="text-xs">Porcentagem de comissão (%)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input type="number" min={0} max={100} step={0.5} value={comissaoAfiliado} onChange={(e) => setComissaoAfiliado(e.target.value)} placeholder="Ex: 10" className="w-40" />
            <span className="text-sm text-muted-foreground font-medium">%</span>
          </div>
        </div>
        <Button onClick={() => saveComissao.mutate()} disabled={saveComissao.isPending} size="sm">
          {saveComissao.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>

      {/* Comissão da Plataforma */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold font-display text-foreground">Comissão da Plataforma (Split PIX)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Define a porcentagem que a plataforma retém em cada pagamento PIX realizado pelo PDV.
        </p>
        <div>
          <Label className="text-xs">Porcentagem da plataforma (%)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input type="number" min={0} max={100} step={0.5} value={comissaoPlataforma} onChange={(e) => setComissaoPlataforma(e.target.value)} placeholder="Ex: 5" className="w-40" />
            <span className="text-sm text-muted-foreground font-medium">%</span>
          </div>
        </div>
        <Button onClick={() => saveComissaoPlataforma.mutate()} disabled={saveComissaoPlataforma.isPending} size="sm">
          {saveComissaoPlataforma.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>

      {/* Código Master Lojista */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold font-display text-foreground">Código Master Lojista</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Código que permite acessar o painel do lojista diretamente pelo campo de senha, sem precisar de e-mail.
        </p>
        <div>
          <Label className="text-xs">Código de acesso master</Label>
          <Input
            type="text"
            value={masterLojista}
            onChange={(e) => setMasterLojista(e.target.value.toUpperCase())}
            placeholder="Ex: MASTER2024"
            className="mt-1 font-mono tracking-wider uppercase"
            maxLength={20}
          />
        </div>
        <Button
          onClick={() => saveMasterLojistaMutation.mutate({ valor: masterLojista, existingId: masterLojistaConfig?.id })}
          disabled={saveMasterLojistaMutation.isPending}
          size="sm"
        >
          {saveMasterLojistaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>

      {/* Taxa de Integração Mercado Pago */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-orange-600" />
          <h3 className="text-base font-bold font-display text-foreground">Taxa de Integração Mercado Pago</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Define a taxa percentual cobrada nas vendas via Mercado Pago para todos os lojistas.
        </p>
        <div>
          <Label className="text-xs">Taxa percentual (%)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input type="number" min={0} max={100} step={0.1} value={taxaIntegracao} onChange={(e) => setTaxaIntegracao(e.target.value)} placeholder="Ex: 1.5" className="w-40" />
            <span className="text-sm text-muted-foreground font-medium">%</span>
          </div>
        </div>
        <Button onClick={() => saveTaxaIntegracao.mutate()} disabled={saveTaxaIntegracao.isPending} size="sm">
          {saveTaxaIntegracao.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default AdminAjustes;
