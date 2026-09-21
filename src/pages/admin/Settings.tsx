import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Check, Loader2, Clock, Bike, Plus, Trash2, Save, CreditCard, X, QrCode, Pencil, Printer, ChevronDown, Upload, AlertCircle, Settings2, Star, Gift, Utensils, Lock, Ticket, Users, Megaphone, Image as ImageIcon } from "lucide-react";
import LojaUsuariosManager from "@/components/admin/LojaUsuariosManager";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import PrinterSettings from "@/components/admin/PrinterSettings";
import Coupons from "./Coupons";

const DAYS = [
  { key: "segunda", label: "Segunda-feira" },
  { key: "terca", label: "Terça-feira" },
  { key: "quarta", label: "Quarta-feira" },
  { key: "quinta", label: "Quinta-feira" },
  { key: "sexta", label: "Sexta-feira" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const defaultHours: Record<string, { aberto: boolean; inicio: string; fim: string }> = {
  segunda: { aberto: true, inicio: "18:00", fim: "23:00" },
  terca: { aberto: true, inicio: "18:00", fim: "23:00" },
  quarta: { aberto: true, inicio: "18:00", fim: "23:00" },
  quinta: { aberto: true, inicio: "18:00", fim: "23:00" },
  sexta: { aberto: true, inicio: "18:00", fim: "23:00" },
  sabado: { aberto: true, inicio: "17:00", fim: "00:00" },
  domingo: { aberto: true, inicio: "17:00", fim: "22:00" },
};

interface FreteByBairro {
  id?: string;
  bairro: string;
  valor: number;
}

interface FormaPagamento {
  nome: string;
  ativo: boolean;
}

const FORMAS_PADRAO: FormaPagamento[] = [
  { nome: "Dinheiro", ativo: true },
  { nome: "PIX", ativo: true },
  { nome: "Cartão de Crédito", ativo: true },
  { nome: "Cartão de Débito", ativo: true },
];

const Settings = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const { pdvUser, hasTabPermission, hasActionPermission } = usePdvUser();
  const canEdit = !pdvUser || pdvUser.nivel === "admin" || hasActionPermission("configuracoes", "edit");
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const trialStatus = useTrialStatus();
  const { limits } = useStorePlanLimits();
  const [impressaoAuto, setImpressaoAuto] = useState(false);
  const [toleranciaPedidos, setToleranciaPedidos] = useState("60");
  const [pdvVendaForaHorario, setPdvVendaForaHorario] = useState(false);
  const [avaliacoesAtivas, setAvaliacoesAtivas] = useState(true);
  const [avaliacoesProdutosAtivas, setAvaliacoesProdutosAtivas] = useState(false);
  const [lembreteAniversario, setLembreteAniversario] = useState(true);
  const [rankingAtivo, setRankingAtivo] = useState(true);

  // Hours state
  const [hours, setHours] = useState(defaultHours);

  // Delivery fee state
  const [freteTipo, setFreteTipo] = useState<"fixo" | "bairro">("fixo");
  const [freteFixo, setFreteFixo] = useState("5.00");
  const [freteBairros, setFreteBairros] = useState<FreteByBairro[]>([]);
  const [newBairro, setNewBairro] = useState("");
  const [newBairroValor, setNewBairroValor] = useState("");

  // Delivery time state
  const [tempoMin, setTempoMin] = useState("30");
  const [tempoMax, setTempoMax] = useState("40");

  // Payment methods state
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>(FORMAS_PADRAO);
  const [newFormaPagamento, setNewFormaPagamento] = useState("");
  // PIX state
  const [pixTipo, setPixTipo] = useState("");
  const [pixChave, setPixChave] = useState("");
  const [pixFavorecido, setPixFavorecido] = useState("");

  // Popup Informativo state
  const [popupInfoAtivo, setPopupInfoAtivo] = useState(false);
  const [popupInfoImagemUrl, setPopupInfoImagemUrl] = useState<string>("");
  const [popupInfoDataLimite, setPopupInfoDataLimite] = useState<string>("");
  const [uploadingPopupImg, setUploadingPopupImg] = useState(false);



  const { data: loja, isLoading } = useQuery({
    queryKey: ["minha-loja-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Global event image (admin-managed) — used to decide if toggle should appear
  const { data: globalEventImage } = useQuery({
    queryKey: ["global-event-image-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_rating_settings")
        .select("event_image_url")
        .eq("id", 1)
        .maybeSingle();
      return (data as any)?.event_image_url as string | null;
    },
    staleTime: 60_000,
  });

  const ocultarEvento = !!(loja as any)?.ocultar_evento;
  const toggleOcultarEvento = async (hide: boolean) => {
    if (!loja?.id) return;
    const { error } = await supabase
      .from("lojas")
      .update({ ocultar_evento: hide } as any)
      .eq("id", loja.id);
    if (error) {
      toast.error("Erro ao atualizar.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["minha-loja-settings", user?.id] });
    toast.success(hide ? "Imagem de evento ocultada" : "Imagem de evento ativada");
  };

  const { data: planoAtivo } = useQuery({
    queryKey: ["meu-plano-ativo-settings", user?.id],
    queryFn: async () => {
      if (!loja) return null;
      const { data } = await supabase
        .from("loja_planos")
        .select("*, planos:plano_id(id, nome, slug, limites, features)")
        .eq("loja_id", (loja as any).id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!loja,
  });

  const overrideLimites = (planoAtivo as any)?.limites_assinado;
  const hasOverride = overrideLimites && Object.keys(overrideLimites).length > 0;
  const limites = hasOverride ? overrideLimites : ((planoAtivo as any)?.planos?.limites || {});
  const settingsPlanoSlug = (planoAtivo as any)?.planos?.slug || "";
  const isInTrial = !trialStatus.isExpired && (trialStatus as any).trialDays > 0 && (trialStatus as any).daysRemaining > 0;
  const isPlanProOrUltra = settingsPlanoSlug === "pro" || settingsPlanoSlug === "ultra" || isInTrial;
  const isPlanUltra = settingsPlanoSlug === "ultra" || isInTrial;
  const canAvaliacoes = isPlanProOrUltra || !!limites.avaliacoes;
  const canLembreteAniv = isPlanProOrUltra || !!limites.lembrete_aniversario;
  const canRanking = isPlanUltra || !!limites.ranking_produtos;

  const { data: profile } = useQuery({
    queryKey: ["my-profile-pix", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pix_tipo, pix_chave, pix_nome_favorecido")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  // Load PIX data from profile
  useEffect(() => {
    if (!profile) return;
    setPixTipo(profile.pix_tipo || "");
    setPixChave(profile.pix_chave || "");
    setPixFavorecido(profile.pix_nome_favorecido || "");
  }, [profile]);

  const { data: bairrosPorLoja = [] } = useQuery({
    queryKey: ["loja-frete-bairros", (loja as any)?.id],
    queryFn: async () => {
      if (!(loja as any)?.id) return [];
      const { data, error } = await supabase
        .from("loja_frete_bairros" as any)
        .select("id, bairro, valor")
        .eq("loja_id", (loja as any).id)
        .order("bairro", { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as FreteByBairro[];
    },
    enabled: !!(loja as any)?.id,
    refetchOnWindowFocus: false,
  });

  // Load store data into state
  useEffect(() => {
    if (!loja) return;
    const l = loja as any;
    if (l.horario_funcionamento) {
      setHours({ ...defaultHours, ...l.horario_funcionamento });
    }
    if (l.frete_tipo) setFreteTipo(l.frete_tipo);
    if (l.frete_valor_fixo != null) setFreteFixo(String(l.frete_valor_fixo));
    if (l.tempo_entrega_min != null) setTempoMin(String(l.tempo_entrega_min));
    if (l.tempo_entrega_max != null) setTempoMax(String(l.tempo_entrega_max));
    if (l.impressao_automatica != null) setImpressaoAuto(!!l.impressao_automatica);
    if (l.tolerancia_pedidos_min != null) setToleranciaPedidos(String(l.tolerancia_pedidos_min));
    if (l.avaliacoes_ativas != null) setAvaliacoesAtivas(!!l.avaliacoes_ativas);
    if (l.pdv_venda_fora_horario != null) setPdvVendaForaHorario(!!l.pdv_venda_fora_horario);
    if (l.avaliacoes_produtos_ativas != null) setAvaliacoesProdutosAtivas(!!l.avaliacoes_produtos_ativas);
    if (l.lembrete_aniversario != null) setLembreteAniversario(!!l.lembrete_aniversario);
    if (l.ranking_ativo != null) setRankingAtivo(!!l.ranking_ativo);
    if (l.popup_informativo_ativo != null) setPopupInfoAtivo(!!l.popup_informativo_ativo);
    if (l.popup_informativo_imagem_url) setPopupInfoImagemUrl(l.popup_informativo_imagem_url);
    if (l.popup_informativo_data_limite) {
      // datetime-local expects "YYYY-MM-DDTHH:mm"
      const d = new Date(l.popup_informativo_data_limite);
      const pad = (n: number) => String(n).padStart(2, "0");
      setPopupInfoDataLimite(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
    
  }, [loja]);


  useEffect(() => {
    if (!loja) return;
    const l = loja as any;
    if (Array.isArray(l.formas_pagamento)) {
      // Support both legacy string[] and new {nome,ativo}[] format
      const parsed: FormaPagamento[] = l.formas_pagamento.map((f: any) =>
        typeof f === "string" ? { nome: f, ativo: true } : f
      );
      // Merge with defaults to ensure they always appear
      const merged = FORMAS_PADRAO.map((def) => {
        const existing = parsed.find((p) => p.nome.toLowerCase() === def.nome.toLowerCase());
        return existing || def;
      });
      // Add custom ones
      parsed.forEach((p) => {
        if (!merged.some((m) => m.nome.toLowerCase() === p.nome.toLowerCase())) {
          merged.push(p);
        }
      });
      setFormasPagamento(merged);
    }
  }, [loja]);

  useEffect(() => {
    if (bairrosPorLoja.length > 0) {
      setFreteBairros(
        bairrosPorLoja.map((b) => ({
          id: b.id,
          bairro: String(b.bairro || "").trim(),
          valor: Number(b.valor) || 0,
        }))
      );
      return;
    }

    const legacy = Array.isArray((loja as any)?.frete_bairros) ? ((loja as any).frete_bairros as FreteByBairro[]) : [];
    setFreteBairros(
      legacy.map((b) => ({
        bairro: String((b as any)?.bairro || "").trim(),
        valor: Number((b as any)?.valor) || 0,
      }))
    );
  }, [bairrosPorLoja, loja]);

  const codigoConvite = (loja as any)?.codigo_convite || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(codigoConvite);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const addBairro = () => {
    if (!newBairro.trim() || !newBairroValor.trim()) return;
    const bairroNormalizado = newBairro.trim();
    const valorNormalizado = Number(newBairroValor);
    if (Number.isNaN(valorNormalizado) || valorNormalizado < 0) {
      toast.error("Informe um valor de taxa de entrega válido.");
      return;
    }

    setFreteBairros((prev) => {
      const exists = prev.some((item) => item.bairro.toLowerCase() === bairroNormalizado.toLowerCase());
      if (exists) {
        toast.error("Esse bairro já foi adicionado.");
        return prev;
      }
      return [...prev, { bairro: bairroNormalizado, valor: valorNormalizado }];
    });
    setNewBairro("");
    setNewBairroValor("");
  };

  const editBairro = (fb: FreteByBairro & { originalIdx: number }) => {
    setNewBairro(fb.bairro);
    setNewBairroValor(String(fb.valor));
    removeBairro(fb.originalIdx);
    // Scroll to the input fields
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const removeBairro = (idx: number) => {
    setFreteBairros((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateHour = (day: string, field: "aberto" | "inicio" | "fim", value: any) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const addFormaPagamento = () => {
    const nome = newFormaPagamento.trim();
    if (!nome) return;
    if (formasPagamento.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error("Essa forma de pagamento já existe.");
      return;
    }
    setFormasPagamento((prev) => [...prev, { nome, ativo: true }]);
    setNewFormaPagamento("");
  };

  const toggleFormaPagamento = (idx: number) => {
    setFormasPagamento((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ativo: !f.ativo } : f))
    );
  };

  const removeFormaPagamento = (idx: number) => {
    // Only allow removing custom ones (not defaults)
    const forma = formasPagamento[idx];
    if (FORMAS_PADRAO.some((d) => d.nome.toLowerCase() === forma.nome.toLowerCase())) {
      toast.error("Formas padrão não podem ser removidas, apenas desativadas.");
      return;
    }
    setFormasPagamento((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!loja) return;
    if (!canEdit) {
      toast.error("Você não tem permissão para alterar as configurações.");
      return;
    }
    setSaving(true);
    try {
      const bairrosNormalizados = freteBairros
        .map((b) => ({
          id: b.id,
          bairro: String(b.bairro || "").trim(),
          valor: Number(b.valor) || 0,
        }))
        .filter((b) => b.bairro.length > 0);

      const bairrosUnicos = Array.from(
        bairrosNormalizados.reduce((acc, item) => {
          acc.set(item.bairro.toLowerCase(), item);
          return acc;
        }, new Map<string, FreteByBairro>()).values()
      );

      const { error: updateLojaError } = await supabase
        .from("lojas")
        .update({
          horario_funcionamento: hours,
          frete_tipo: freteTipo,
          frete_valor_fixo: Number(freteFixo),
          frete_bairros: bairrosUnicos,
          tempo_entrega_min: Number(tempoMin),
          tempo_entrega_max: Number(tempoMax),
          formas_pagamento: formasPagamento,
          impressao_automatica: impressaoAuto,
          tolerancia_pedidos_min: Number(toleranciaPedidos),
          pdv_venda_fora_horario: pdvVendaForaHorario,
          avaliacoes_ativas: avaliacoesAtivas,
          avaliacoes_produtos_ativas: avaliacoesProdutosAtivas,
          lembrete_aniversario: lembreteAniversario,
          ranking_ativo: rankingAtivo,
          popup_informativo_ativo: popupInfoAtivo,
          popup_informativo_imagem_url: popupInfoImagemUrl || null,
          popup_informativo_data_limite: popupInfoDataLimite ? new Date(popupInfoDataLimite).toISOString() : null,
          
          
        } as any)
        .eq("id", loja.id);

      if (updateLojaError) throw updateLojaError;

      const payload = bairrosUnicos.map((b) => ({
        loja_id: loja.id,
        bairro: b.bairro,
        valor: b.valor,
      }));

      const { error: upsertError } = await supabase
        .from("loja_frete_bairros" as any)
        .upsert(payload, { onConflict: "loja_id,bairro" });
      if (upsertError) throw upsertError;

      const idsToDelete = bairrosPorLoja
        .filter((b) => !bairrosUnicos.some((novo) => novo.id === b.id || novo.bairro.toLowerCase() === String(b.bairro).toLowerCase()))
        .map((b) => b.id)
        .filter(Boolean);

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("loja_frete_bairros" as any)
          .delete()
          .in("id", idsToDelete);
        if (deleteError) throw deleteError;
      }

      // Save PIX info to profile
      const { error: pixError } = await supabase
        .from("profiles")
        .update({
          pix_tipo: pixTipo || null,
          pix_chave: pixChave || null,
          pix_nome_favorecido: pixFavorecido || null,
        })
        .eq("user_id", user!.id);
      if (pixError) throw pixError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["minha-loja-settings", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["loja-frete-bairros", loja.id] }),
        queryClient.invalidateQueries({ queryKey: ["my-profile-pix", user?.id] }),
      ]);
      toast.success("Configurações salvas! ✅");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 w-full max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl font-bold tracking-tight">Configurações da Loja</h2>

      <Tabs defaultValue={tabFromUrl || (hasTabPermission("configuracoes", "usuarios") ? "usuarios" : "horario")} className="w-full">
        <div className="mb-0 relative z-10">
          <TabsList className="bg-transparent h-auto p-0 w-full justify-start gap-1 overflow-x-auto overflow-y-hidden flex-nowrap rounded-none">
            {hasTabPermission("configuracoes", "usuarios") && (
              <TabsTrigger 
                value="usuarios" 
                disabled={settingsPlanoSlug === "start"}
                className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-medium -mb-px"
              >
                <Users className="w-4 h-4" /> 
                Usuários
                {settingsPlanoSlug === "start" && <Lock className="w-3 h-3 ml-0.5" />}
              </TabsTrigger>
            )}
            {hasTabPermission("configuracoes", "horario") && (
              <TabsTrigger value="horario" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
                <Clock className="w-4 h-4" /> Horário
              </TabsTrigger>
            )}
            {hasTabPermission("configuracoes", "pagamento") && (
              <TabsTrigger value="pagamento" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
                <CreditCard className="w-4 h-4" /> Pagamento
              </TabsTrigger>
            )}
            {hasTabPermission("configuracoes", "entrega") && (
              <TabsTrigger value="entrega" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
                <Bike className="w-4 h-4" /> Entrega
              </TabsTrigger>
            )}
            {hasTabPermission("configuracoes", "cupons") && (
              <TabsTrigger 
                value="cupons" 
                disabled={settingsPlanoSlug === "start"}
                className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-medium -mb-px"
              >
                <Ticket className="w-4 h-4" /> 
                Cupons
                {settingsPlanoSlug === "start" && <Lock className="w-3 h-3 ml-0.5" />}
              </TabsTrigger>
            )}
            {hasTabPermission("configuracoes", "avaliacoes") && (
              <TabsTrigger value="avaliacoes" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
                <Star className="w-4 h-4" /> Avaliações
              </TabsTrigger>
            )}
            <TabsTrigger value="impressao" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
              <Printer className="w-4 h-4" /> Impressão
            </TabsTrigger>
            <TabsTrigger value="popup-informativo" className="flex items-center gap-1.5 text-sm rounded-t-lg rounded-b-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:border-b-card data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2 shrink-0 font-medium -mb-px">
              <Megaphone className="w-4 h-4" /> Popup
            </TabsTrigger>
          </TabsList>
        </div>

        {!canEdit && (
          <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center gap-2 text-amber-800 text-sm">
            <Lock className="w-4 h-4" />
            Sua conta tem permissão apenas para visualização. Alterações não serão salvas.
          </div>
        )}

        <div className="rounded-xl rounded-tl-none border border-border/50 bg-card divide-y divide-border/50 overflow-hidden">


          {/* Aba Horário */}
          <TabsContent value="horario" className="mt-0 divide-y divide-border/50">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between px-5 py-4 w-full hover:bg-muted/30 transition-colors group">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Horário de Funcionamento</h3>
                  <p className="text-sm text-muted-foreground font-medium">Defina quando sua loja está aberta para pedidos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {hours.segunda?.inicio || "18:00"} - {hours.segunda?.fim || "23:00"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-4 space-y-3">
                  {DAYS.map(({ key, label }) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 py-2 sm:py-0 border-b border-border/30 sm:border-0 last:border-0">
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={hours[key]?.aberto ?? true} onCheckedChange={(v) => updateHour(key, "aberto", v)} />
                        <Label className="text-sm font-medium whitespace-nowrap sm:w-28">{label}</Label>
                      </div>
                      {hours[key]?.aberto ? (
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Input type="time" value={hours[key]?.inicio || "18:00"} onChange={(e) => updateHour(key, "inicio", e.target.value)} className="w-24 h-9 text-sm" />
                          <span className="text-muted-foreground text-sm">às</span>
                          <Input type="time" value={hours[key]?.fim || "23:00"} onChange={(e) => updateHour(key, "fim", e.target.value)} className="w-24 h-9 text-sm" />
                        </div>
                      ) : (
                        <span className="text-sm text-destructive font-medium self-end sm:self-auto">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {(limits.pdv_balcao || limits.pdv_mesas) && (
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Venda no PDV fora do horário</h3>
                  <p className="text-sm text-muted-foreground font-medium">
                    Quando ativado, o PDV (Balcão e Mesas) permite registrar pedidos mesmo com a loja fora do horário de funcionamento. Desativado, segue o horário configurado acima.
                  </p>
                </div>
                <Switch checked={pdvVendaForaHorario} onCheckedChange={setPdvVendaForaHorario} />
              </div>
            )}

            <div className="px-5 py-4">
              <h3 className="text-lg font-bold text-foreground tracking-tight">Tolerância para zerar pedidos</h3>
              <p className="text-sm text-muted-foreground font-medium">Tempo extra após o fechamento da loja para concluir os pedidos em aberto. Depois desse período, a tela de pedidos será limpa para o próximo dia (minutos)</p>

              <div className="mt-3 flex items-center gap-2 self-end sm:self-auto">
                <Input
                  type="number"
                  min="0"
                  value={toleranciaPedidos}
                  onChange={(e) => setToleranciaPedidos(e.target.value)}
                  className="w-20 h-9 text-sm"
                />
                <span className="text-sm text-muted-foreground font-medium">min</span>
              </div>
            </div>

          </TabsContent>


          {/* Aba Entrega */}
          <TabsContent value="entrega" className="mt-0 divide-y divide-border/50">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between px-5 py-4 w-full hover:bg-muted/30 transition-colors group">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Taxa de Entrega {freteTipo === "fixo" ? "fixo" : "por bairro"}</h3>
                  <p className="text-sm text-muted-foreground font-medium">Gerencie os valores de frete para seus clientes</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {freteTipo === "fixo" ? `R$ ${Number(freteFixo).toFixed(2)}` : `${freteBairros.length} bairro(s)`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-4 space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <Label className="text-xs text-muted-foreground">Tipo:</Label>
                      <Select value={freteTipo} onValueChange={(v) => setFreteTipo(v as "fixo" | "bairro")}>
                        <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixo">Valor fixo</SelectItem>
                          <SelectItem value="bairro">Por bairro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {freteTipo === "fixo" && (
                      <div className="flex items-center gap-4">
                        <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                        <Input type="number" step="0.50" min="0" value={freteFixo} onChange={(e) => setFreteFixo(e.target.value)} className="w-28 h-9" />
                      </div>
                    )}
                  </div>
                  {freteTipo !== "fixo" && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-muted-foreground mb-1 block">Bairro</Label>
                            <Input placeholder="Nome do bairro" value={newBairro} onChange={(e) => setNewBairro(e.target.value)} className="h-9" />
                          </div>
                          <div className="w-28">
                            <Label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</Label>
                            <Input type="number" step="0.50" min="0" placeholder="5.00" value={newBairroValor} onChange={(e) => setNewBairroValor(e.target.value)} className="h-9" />
                          </div>
                          <Button variant="outline" size="sm" onClick={addBairro} className="h-9"><Plus className="w-4 h-4" /></Button>
                        </div>
                        
                      </div>
                      <div className="rounded-lg border border-border/50 divide-y divide-border/50 max-h-60 overflow-y-auto">
                        {freteBairros.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum bairro cadastrado.</p>}
                        {freteBairros
                          .map((fb, originalIdx) => ({ ...fb, originalIdx }))
                          .sort((a, b) => a.bairro.localeCompare(b.bairro))
                          .map((fb) => (
                            <div key={fb.originalIdx} className="flex items-center justify-between px-3 py-2">
                              <span className="text-sm font-medium">{fb.bairro}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">R$ {Number(fb.valor).toFixed(2)}</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => editBairro(fb)} className="p-1 rounded hover:bg-primary/10 text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => removeBairro(fb.originalIdx)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border/50">
                    <div className="mb-3">
                      <h3 className="text-lg font-bold text-foreground tracking-tight">Tempo de Entrega</h3>
                      <p className="text-sm text-muted-foreground font-medium">Estimativa de tempo para o cliente receber o pedido</p>
                    </div>
                    <div className="flex items-end gap-3">
                      <div>
                        <Input type="number" min="0" value={tempoMin} onChange={(e) => setTempoMin(e.target.value)} className="w-24 h-9" />
                        <Label className="text-xs text-muted-foreground mt-1 block">Mínimo (min)</Label>
                      </div>
                      <span className="text-muted-foreground pb-5">–</span>
                      <div>
                        <Input type="number" min="0" value={tempoMax} onChange={(e) => setTempoMax(e.target.value)} className="w-24 h-9" />
                        <Label className="text-xs text-muted-foreground mt-1 block">Máximo (min)</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* Aba Avaliações/Aniversariante */}
          <TabsContent value="avaliacoes" className="mt-0 divide-y divide-border/50">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">Avaliações</h3>
                <p className="text-sm text-muted-foreground font-medium">Permite que clientes avaliem pedidos após entrega</p>
                {!canAvaliacoes && (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20 mt-1">Plano Pro ou Ultra</Badge>
                )}
              </div>
              <Switch 
                checked={canAvaliacoes && avaliacoesAtivas} 
                onCheckedChange={setAvaliacoesAtivas}
                disabled={!canAvaliacoes}
              />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">Avaliações de Produtos</h3>
                <p className="text-sm text-muted-foreground font-medium">Permite que clientes avaliem produtos individualmente no cardápio</p>
              </div>
              <Switch 
                checked={avaliacoesProdutosAtivas} 
                onCheckedChange={setAvaliacoesProdutosAtivas} 
              />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">Lembrete de Aniversariante</h3>
                <p className="text-sm text-muted-foreground font-medium">Exibe alerta de aniversariantes do dia no painel</p>
                {!canLembreteAniv && (
                  <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20 mt-1">Plano Pro ou Ultra</Badge>
                )}
              </div>
              <Switch
                checked={canLembreteAniv && lembreteAniversario}
                onCheckedChange={setLembreteAniversario}
                disabled={!canLembreteAniv}
              />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Ranking de Produtos Mais Pedidos</h3>
                  {!canRanking && (
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">Plano Ultra</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Exclusivo para clientes. Exibe uma sugestão dos produtos que mais saem no menu inferior do cardápio</p>
              </div>
              <Switch
                checked={canRanking && rankingAtivo}
                onCheckedChange={setRankingAtivo}
                disabled={!canRanking}
              />
            </div>

          </TabsContent>

          {/* Aba Pagamento */}
          <TabsContent value="pagamento" className="mt-0 divide-y divide-border/50">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between px-5 py-4 w-full hover:bg-muted/30 transition-colors group">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Formas de pagamento</h3>
                  <p className="text-sm text-muted-foreground font-medium">Configure quais meios de pagamento você aceita</p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-4 space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Nova forma de pagamento</Label>
                      <Input placeholder="Ex: Vale Refeição" value={newFormaPagamento} onChange={(e) => setNewFormaPagamento(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFormaPagamento()} className="h-9" />
                    </div>
                    <Button variant="outline" size="sm" onClick={addFormaPagamento} className="h-9"><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                    {formasPagamento.map((forma, idx) => {
                      const isPadrao = FORMAS_PADRAO.some((d) => d.nome.toLowerCase() === forma.nome.toLowerCase());
                      return (
                        <div key={idx} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-3">
                            <Switch checked={forma.ativo} onCheckedChange={() => toggleFormaPagamento(idx)} />
                            <span className={`text-sm font-medium ${!forma.ativo ? "line-through text-muted-foreground" : ""}`}>{forma.nome}</span>
                            {isPadrao && <Badge variant="outline" className="text-[10px]">Padrão</Badge>}
                          </div>
                          {!isPadrao && (
                            <button onClick={() => removeFormaPagamento(idx)} className="p-1 rounded hover:bg-destructive/10 text-destructive"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-start justify-between px-5 py-4 w-full hover:bg-muted/30 transition-colors group text-left">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Chave PIX</h3>
                  <p className="text-sm text-muted-foreground font-medium">💡 Essa chave será exibida para o cliente copiar e colar no app do banco na hora do pagamento.</p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-5 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Tipo da chave</Label>
                    <Select value={pixTipo} onValueChange={setPixTipo}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="E-mail">E-mail</SelectItem>
                        <SelectItem value="Telefone">Telefone</SelectItem>
                        <SelectItem value="Chave aleatória">Chave aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Chave PIX</Label>
                    <Input placeholder="Digite sua chave PIX" value={pixChave} onChange={(e) => setPixChave(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Nome do favorecido</Label>
                    <Input placeholder="Nome que aparece no PIX" value={pixFavorecido} onChange={(e) => setPixFavorecido(e.target.value)} className="h-9" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* Aba Cupons */}
          <TabsContent value="cupons" className="mt-0 divide-y divide-border/50">
            <div className="p-4">
              <Coupons />
            </div>
          </TabsContent>

          {/* Aba Usuários */}
          <TabsContent value="usuarios" className="mt-0">
            {loja?.id && <LojaUsuariosManager lojaId={loja.id} />}
          </TabsContent>

          {/* Aba Impressão */}
          <TabsContent value="impressao" className="mt-0 p-4">
            <PrinterSettings />
          </TabsContent>

          {/* Aba Popup Informativo */}
          <TabsContent value="popup-informativo" className="mt-0">
            <div className="p-5 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  <Megaphone className="w-5 h-5" /> Popup Informativo
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  Exiba um banner popup no link público da sua loja para divulgar promoções ou eventos.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                <div>
                  <Label className="text-sm font-semibold">Ativar popup</Label>
                  <p className="text-xs text-muted-foreground">Quando ativo, o banner é exibido para os clientes.</p>
                </div>
                <Switch
                  checked={popupInfoAtivo}
                  onCheckedChange={setPopupInfoAtivo}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="popup-info-data" className="text-sm font-semibold">
                  Exibir até
                </Label>
                <Input
                  id="popup-info-data"
                  type="datetime-local"
                  value={popupInfoDataLimite}
                  onChange={(e) => setPopupInfoDataLimite(e.target.value)}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Após esta data e hora, o popup deixará de aparecer automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Imagem do banner</Label>
                {popupInfoImagemUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={popupInfoImagemUrl}
                      alt="Banner do popup informativo"
                      className="max-w-full max-h-64 rounded-lg border border-border/50 object-contain bg-muted"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-7 w-7"
                      onClick={() => setPopupInfoImagemUrl("")}
                      disabled={!canEdit}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full h-40 rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <input
                    id="popup-info-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !loja?.id || !user?.id) return;
                      setUploadingPopupImg(true);
                      try {
                        const ext = file.name.split(".").pop() || "jpg";
                        const path = `${user.id}/popup-informativo/${loja.id}-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from("banners")
                          .upload(path, file, { upsert: true, cacheControl: "3600" });
                        if (upErr) throw upErr;
                        const { data: pub } = supabase.storage.from("banners").getPublicUrl(path);
                        setPopupInfoImagemUrl(pub.publicUrl);
                        toast.success("Imagem carregada! Lembre de salvar.");
                      } catch {
                        toast.error("Erro ao enviar imagem.");
                      } finally {
                        setUploadingPopupImg(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => document.getElementById("popup-info-image-input")?.click()}
                    disabled={!canEdit || uploadingPopupImg}
                  >
                    {uploadingPopupImg ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {popupInfoImagemUrl ? "Trocar imagem" : "Enviar imagem do banner"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recomendado: imagem em formato retrato ou quadrado, até 2MB.
                </p>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {!trialStatus.isExpired && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={handleSave} disabled={saving || !loja} className="gap-2 shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </Button>
        </div>
      )}
    </div>
  );
};

export default Settings;
