import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { qzService } from "@/utils/qzService";
import { Printer, Loader2, RefreshCw, CheckCircle2, Settings2, FileUp, Download, Monitor, ExternalLink } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MarginEditor from "./MarginEditor";
import BluetoothPrinterSettings from "./BluetoothPrinterSettings";
import { getBluetoothSettings, saveBluetoothSettings } from "@/utils/bluetoothPrint";
import { Info } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pedido recebido (Pendente)" },
  { value: "aceito", label: "Pedido aceito" },
  { value: "preparando", label: "Em preparo" },
];

const PrinterSettings = () => {
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(false);
  const [isPrintOnAcceptEnabled, setIsPrintOnAcceptEnabled] = useState(false);
  const [isTwoCopiesEnabled, setIsTwoCopiesEnabled] = useState(false);
  const [statusGatilho, setStatusGatilho] = useState<string>("aceito");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMarginEditorOpen, setIsMarginEditorOpen] = useState(false);
  const [qzCertificate, setQzCertificate] = useState<string | null>(null);
  const [qzProgramUrl, setQzProgramUrl] = useState<string | null>(null);
  const [isDoubleStrikeEnabled, setIsDoubleStrikeEnabled] = useState(false);
  const [margens, setMargens] = useState({
    superior: 0,
    inferior: 0,
    esquerda: 3,
    direita: 3
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: lojaPlan } = useQuery({
    queryKey: ["printer-plan-loja", user?.id],
    queryFn: async () => {
      const { data: loja } = await supabase
        .from("lojas")
        .select("id")
        .eq("user_id", user!.id)
        .single();
      if (!loja) return null;
      const { data } = await supabase
        .from("loja_planos")
        .select("limites_assinado, planos:plano_id(slug, limites)")
        .eq("loja_id", loja.id)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const { isExpired, daysRemaining, trialDays } = useTrialStatus();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;
  const planoSlug = (lojaPlan as any)?.planos?.slug || "";
  const overrideLimites = (lojaPlan as any)?.limites_assinado;
  const hasOverride = overrideLimites && Object.keys(overrideLimites).length > 0;
  const limites = hasOverride ? overrideLimites : ((lojaPlan as any)?.planos?.limites || {});
  const isUltra = planoSlug === "ultra" || isInTrial;
  const canAutoPrint = isUltra || !!limites.impressao_automatica;
  const canTwoCopies = isUltra || !!limites.impressao_duas_vias;

  useEffect(() => {
    const savedPrinter = localStorage.getItem("qz-selected-printer");
    if (savedPrinter) {
      setSelectedPrinter(savedPrinter);
    }
    // Lê printOnAccept das configs Bluetooth (flag compartilhada)
    const bt = getBluetoothSettings();
    setIsPrintOnAcceptEnabled(bt.printOnAccept !== false);
    loadStoredSettings();
  }, [user]);

  const loadStoredSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lojas")
      .select("impressao_automatica_qz, impressora_qz_nome, impressao_status_gatilho, impressao_duas_vias, margem_superior, margem_inferior, margem_esquerda, margem_direita, qz_certificate, qz_program_url, qz_double_strike")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setIsAutoPrintEnabled((data as any).impressao_automatica_qz || false);
      setIsTwoCopiesEnabled((data as any).impressao_duas_vias || false);
      setStatusGatilho((data as any).impressao_status_gatilho || "aceito");
      setQzCertificate((data as any).qz_certificate || null);
      setQzProgramUrl((data as any).qz_program_url || null);
      setIsDoubleStrikeEnabled((data as any).qz_double_strike || false);
      const dbPrinter = (data as any).impressora_qz_nome;
      if (dbPrinter) {
        setSelectedPrinter(dbPrinter);
        localStorage.setItem("qz-selected-printer", dbPrinter);
      }
      setMargens({
        superior: (data as any).margem_superior || 0,
        inferior: (data as any).margem_inferior || 0,
        esquerda: (data as any).margem_esquerda || 0,
        direita: (data as any).margem_direita || 0
      });
    }
  };

  const checkConnection = async () => {
    setIsConnecting(true);
    try {
      await qzService.connect();
      setIsConnected(true);
      loadPrinters();
    } catch (err) {
      setIsConnected(false);
      console.warn("QZ Tray not found");
    } finally {
      setIsConnecting(false);
    }
  };

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const list = await qzService.listPrinters();
      setPrinters(list);

      // Auto-seleciona a impressora se não houver nenhuma selecionada ainda
      setSelectedPrinter((current) => {
        if (current && list.includes(current)) return current;
        const saved = localStorage.getItem("qz-selected-printer");
        if (saved && list.includes(saved)) return saved;
        // Prioriza impressoras EPSON / TM / Thermal / Receipt
        const preferred = list.find((p) => /epson|tm-|receipt|thermal/i.test(p));
        const chosen = preferred || list[0] || current;
        if (chosen) {
          localStorage.setItem("qz-selected-printer", chosen);
          return chosen;
        }
        return "";
      });
    } catch (err) {
      console.warn("Erro ao listar impressoras:", err);
      toast.error("Erro ao carregar impressoras");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPrinter) {
      toast.error("Selecione uma impressora");
      return;
    }

    setIsLoading(true);
    try {
      localStorage.setItem("qz-selected-printer", selectedPrinter);
      try {
        const bt = getBluetoothSettings();
        saveBluetoothSettings({ ...bt, printOnAccept: isPrintOnAcceptEnabled });
      } catch {}

      
      if (user) {
        await supabase
          .from("lojas")
          .update({ 
            impressao_automatica_qz: isAutoPrintEnabled,
            impressora_qz_nome: selectedPrinter,
            impressao_status_gatilho: statusGatilho,
            impressao_duas_vias: isTwoCopiesEnabled,
            margem_superior: margens.superior,
            margem_inferior: margens.inferior,
            margem_esquerda: margens.esquerda,
            margem_direita: margens.direita,
            qz_certificate: qzCertificate,
            qz_program_url: qzProgramUrl,
            qz_double_strike: isDoubleStrikeEnabled,
          } as any)
          .eq("user_id", user.id);
      }
      
      toast.success("Configurações de impressão salvas!");
    } catch (err) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const testPrint = async () => {
    if (!selectedPrinter) {
      toast.error("Selecione uma impressora primeiro");
      return;
    }

    setIsLoading(true);
    try {
      const content = `
        <div class="text-center">
          <p class="font-bold text-base">TESTE DE IMPRESSÃO</p>
          <p>SISTEMA NOOV</p>
          <div class="border-t my-2"></div>
          <p>Se você está lendo isso, sua impressora</p>
          <p>está configurada corretamente!</p>
          <div class="border-t my-2"></div>
          <p>${new Date().toLocaleString()}</p>
        </div>
      `;
      await qzService.printHTML(content, selectedPrinter, {
        top: margens.superior,
        bottom: margens.inferior,
        left: margens.esquerda,
        right: margens.direita,
        doubleStrike: isDoubleStrikeEnabled
      });
      toast.success("Teste enviado para a impressora!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao imprimir teste");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCertificate = () => {
    const cert = qzCertificate || "";
    if (!cert) {
      toast.error("Nenhum certificado disponível para download");
      return;
    }
    const blob = new Blob([cert], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "digital-certificate.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadCertificate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        setQzCertificate(content);
        
        await supabase
          .from("lojas")
          .update({ qz_certificate: content } as any)
          .eq("user_id", user.id);
          
        toast.success("Certificado atualizado com sucesso!");
      };
      reader.readAsText(file);
    } catch (err) {
      toast.error("Erro ao processar certificado");
    }
  };

  const uploadQZProgram = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `qz_programs/${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('loja-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('loja-assets')
        .getPublicUrl(filePath);

      setQzProgramUrl(publicUrl);
      
      await supabase
        .from("lojas")
        .update({ qz_program_url: publicUrl } as any)
        .eq("user_id", user.id);
        
      toast.success("Programa QZ Tray carregado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao subir o programa");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pc" className="w-full">
        <TabsList className="inline-flex h-auto justify-start gap-6 bg-transparent p-0 mb-4 border-b border-border/50 rounded-none w-full">
          <TabsTrigger value="pc" className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground">Impressora PC</TabsTrigger>
          <TabsTrigger value="bluetooth" className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground">Mini Print Bluetooth</TabsTrigger>
        </TabsList>
        <TabsContent value="pc" className="space-y-6 mt-0">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold font-display text-foreground">Impressora Térmica (QZ Tray)</h3>
        </div>
        <div className="flex items-center gap-3">
          
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-2 text-xs"
              onClick={() => navigate("/lojista/configuracoes/impressora-tutorial")}
            >
              <Download className="w-3.5 h-3.5" />
              Downloads Necessários
            </Button>

          <div className="flex items-center gap-1.5 border-l pl-3">
            {isConnecting ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isConnecting ? "Conectando..." : isConnected ? "QZ Tray Ativo" : "QZ Tray Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-px bg-border/50 my-2" />
        {!isConnected ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-5 items-start">
              <div className="flex-1 space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <span>Atenção: Permissão do QZ Tray</span>
                </div>
                <h4 className="text-base font-bold text-foreground">
                  Apareceu a janela "Action Required" na sua tela?
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Para que o sistema possa imprimir sem confirmações em cada pedido, o software <strong>QZ Tray</strong> precisa de sua permissão na primeira conexão:
                </p>

                <div className="space-y-2 bg-background/80 p-3 rounded-xl border border-border/60 text-xs text-foreground">
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-700 font-bold">1</span>
                    <span>
                      Baixe o certificado de segurança clicando no botão abaixo e <strong>copie o arquivo</strong> para a pasta <code className="bg-muted px-1 rounded">C:\Program Files\QZ Tray\</code> (o Windows pedirá permissão de administrador).
                    </span>
                  </div>
                  <div className="pl-7 pb-1">
                    <a
                      href="/qz-certificate.crt"
                      download="override.crt"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Baixar override.crt
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-800 font-bold">2</span>
                    <span>Feche o QZ Tray (clique direito no ícone verde perto do relógio → <strong>Exit</strong>) e abra novamente.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-800 font-bold">3</span>
                    <span>Recarregue esta página (<strong>F5</strong>). O popup vai aparecer com fundo <strong>verde</strong> (confiável).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 font-bold">4</span>
                    <span>Marque <strong>"Remember this decision"</strong> e clique em <strong>"Allow"</strong>. Pronto, nunca mais aparecerá!</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button 
                    variant="default" 
                    size="sm"
                    className="gap-2"
                    onClick={checkConnection}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {isConnecting ? "Conectando ao QZ Tray..." : "Tentar Conectar"}
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/lojista/configuracoes/impressora-tutorial")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver Passo a Passo Completo
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    asChild
                  >
                    <a href="https://github.com/qzind/tray/releases/download/v2.3.0/qz-tray-2.3.0-x86_64.exe" target="_blank" rel="noreferrer">
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Baixar Instalador QZ Tray
                    </a>
                  </Button>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center gap-2 w-full md:w-auto">
                <div className="rounded-xl overflow-hidden border border-border/80 shadow-md bg-white max-w-[270px]">
                  <img 
                    src="/printer-tutorial/qz-tray-allow-popup.png" 
                    alt="Exemplo da janela Action Required do QZ Tray com botão Allow e Remember this decision"
                    className="w-full h-auto object-contain"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground text-center">
                  Janela que aparece no Windows
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Selecione a Impressora</Label>
                {selectedPrinter && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Selecionada: <strong>{selectedPrinter}</strong>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Select 
                  value={selectedPrinter || undefined} 
                  onValueChange={(val) => {
                    setSelectedPrinter(val);
                    localStorage.setItem("qz-selected-printer", val);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma impressora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((printer) => (
                      <SelectItem key={printer} value={printer}>
                        {printer}
                      </SelectItem>
                    ))}
                    {selectedPrinter && !printers.includes(selectedPrinter) && (
                      <SelectItem value={selectedPrinter}>
                        {selectedPrinter}
                      </SelectItem>
                    )}
                    {printers.length === 0 && !selectedPrinter && (
                      <SelectItem value="EPSON TM-T20 Receipt">
                        EPSON TM-T20 Receipt (Padrão Windows)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={loadPrinters}
                  disabled={isLoading}
                  title="Atualizar lista de impressoras"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Botão de atalho rápido caso não apareça ou queira selecionar a Epson direto */}
              {(!selectedPrinter || printers.length === 0) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Detectada no Windows:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => {
                      setSelectedPrinter("EPSON TM-T20 Receipt");
                      localStorage.setItem("qz-selected-printer", "EPSON TM-T20 Receipt");
                      toast.success("EPSON TM-T20 Receipt selecionada!");
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Usar "EPSON TM-T20 Receipt"
                  </Button>
                </div>
              )}
            </div>

            {isAutoPrintEnabled && canAutoPrint && (
              <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                <Label className="text-sm font-medium">Imprimir quando o pedido for...</Label>
                <p className="text-[11px] text-muted-foreground -mt-1">A impressão dispara apenas na transição para este status.</p>
                <Select value={statusGatilho} onValueChange={setStatusGatilho}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
              <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Apenas uma das opções abaixo pode ficar ativa por vez. Ao ligar uma, a outra é desligada automaticamente.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-sm font-medium">Impressão Automática</Label>
                    {!canAutoPrint && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">Plano Ultra</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Imprimir pedidos automaticamente via QZ Tray ao chegar</p>
                </div>
                <Switch 
                  checked={canAutoPrint && isAutoPrintEnabled} 
                  onCheckedChange={(v) => {
                    setIsAutoPrintEnabled(v);
                    if (v) setIsPrintOnAcceptEnabled(false);
                  }}
                  disabled={!canAutoPrint}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-sm font-medium">Imprimir ao aceitar pedido</Label>
                    {!canAutoPrint && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">Plano Ultra</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Imprime somente ao clicar em <strong>Aceitar</strong> o pedido</p>
                </div>
                <Switch 
                  checked={canAutoPrint && isPrintOnAcceptEnabled} 
                  onCheckedChange={(v) => {
                    setIsPrintOnAcceptEnabled(v);
                    if (v) setIsAutoPrintEnabled(false);
                  }}
                  disabled={!canAutoPrint}
                />
              </div>
            </div>


            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Imprimir duas vias</Label>
                  {!canTwoCopies && (
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">Plano Ultra</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Estabelecimento e entregador</p>
              </div>
              <Switch 
                checked={canTwoCopies && isTwoCopiesEnabled} 
                onCheckedChange={setIsTwoCopiesEnabled}
                disabled={!canTwoCopies}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Modo nítido (double-strike)</Label>
                <p className="text-[11px] text-muted-foreground">Melhora a legibilidade em impressoras gastas</p>
              </div>
              <Switch 
                checked={isDoubleStrikeEnabled} 
                onCheckedChange={setIsDoubleStrikeEnabled}
              />
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Margens do Papel</Label>
                  <p className="text-[11px] text-muted-foreground">Ajuste as margens de impressão visualmente</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsMarginEditorOpen(true)}
                  className="gap-2"
                >
                  <Settings2 className="w-4 h-4" />
                  Ajustar Margens
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="text-[8px] uppercase text-muted-foreground">Sup</div>
                  <div className="text-xs font-bold">{Number(margens.superior).toFixed(1)}mm</div>
                </div>
                <div className="p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="text-[8px] uppercase text-muted-foreground">Inf</div>
                  <div className="text-xs font-bold">{Number(margens.inferior).toFixed(1)}mm</div>
                </div>
                <div className="p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="text-[8px] uppercase text-muted-foreground">Esq</div>
                  <div className="text-xs font-bold">{Number(margens.esquerda).toFixed(1)}mm</div>
                </div>
                <div className="p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="text-[8px] uppercase text-muted-foreground">Dir</div>
                  <div className="text-xs font-bold">{Number(margens.direita).toFixed(1)}mm</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                <h4 className="text-sm font-bold">Prévia do Recibo</h4>
              </div>
              <div 
                className="mx-auto bg-white shadow-sm border border-border/30 overflow-hidden" 
                style={{ width: "200px", minHeight: "150px" }}
              >
                <div 
                  className="p-3 font-mono text-[9px] text-black space-y-2 opacity-80"
                  style={{ 
                    paddingLeft: `${Number(margens.esquerda) * 1.5}px`,
                    paddingRight: `${Number(margens.direita) * 1.5}px`,
                    paddingTop: `${Number(margens.superior) * 1.5}px`,
                    paddingBottom: `${Number(margens.inferior) * 1.5}px`,
                  }}
                >
                  <div className="text-center font-bold border-b border-gray-200 pb-1 mb-1">LOJA EXEMPLO</div>
                  <div className="flex justify-between">
                    <span>1x Pizza Grande</span>
                    <span>R$ 55,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Coca 2L</span>
                    <span>R$ 12,00</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 pt-1 mt-1 font-bold flex justify-between">
                    <span>TOTAL</span>
                    <span>R$ 67,00</span>
                  </div>
                  <div className="text-[7px] text-center text-gray-400 mt-2">
                    Ajuste as margens para ver o efeito aqui
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Visualização aproximada da área de impressão
              </p>
            </div>

            <MarginEditor 
              isOpen={isMarginEditorOpen}
              onClose={() => setIsMarginEditorOpen(false)}
              margens={margens}
              onSave={(novasMargens) => {
                setMargens(novasMargens);
                setIsMarginEditorOpen(false);
                toast.success("Margens ajustadas! Lembre-se de salvar as configurações.");
              }}
            />

            <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none md:hidden">
              <button 
                onClick={handleSave} 
                disabled={!selectedPrinter || isLoading}
                className="pointer-events-auto bg-primary text-primary-foreground h-12 w-12 rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-transform active:scale-95"
                title="Salvar Configurações"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button 
                onClick={handleSave} 
                disabled={!selectedPrinter || isLoading}
                className="flex-1 bg-primary text-primary-foreground h-9 px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center whitespace-nowrap"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Configurações
              </button>
              <Button 
                variant="outline" 
                onClick={testPrint} 
                disabled={!selectedPrinter || isLoading}
              >
                Imprimir Teste
              </Button>
            </div>
            
            <p className="text-[11px] text-muted-foreground italic leading-tight">
              Dica: Após salvar, esta impressora será usada por padrão em todos os pedidos e no PDV deste dispositivo.
            </p>
          </>
        )}
      </div>
        </TabsContent>
        <TabsContent value="bluetooth" className="mt-0">
          <BluetoothPrinterSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PrinterSettings;
