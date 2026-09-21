import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bluetooth, BluetoothConnected, Loader2, Lock, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import {
  bluetoothPrintService,
  getBluetoothSettings,
  saveBluetoothSettings,
  BluetoothPrinterSettings as BTSettings,
} from "@/utils/bluetoothPrint";

const BluetoothPrinterSettings = () => {
  const [settings, setSettings] = useState<BTSettings>({ paperWidth: 58, autoPrint: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const { user } = useAuth();
  const { isExpired, daysRemaining, trialDays } = useTrialStatus();
  const isInTrial = !isExpired && trialDays > 0 && daysRemaining > 0;

  const { data: lojaPlan } = useQuery({
    queryKey: ["bt-printer-plan-loja", user?.id],
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
  const planoSlug = (lojaPlan as any)?.planos?.slug || "";
  const mergedLimites = { ...((lojaPlan as any)?.planos?.limites || {}), ...((lojaPlan as any)?.limites_assinado || {}) };
  const isUltra = planoSlug === "ultra" || isInTrial || !!mergedLimites.impressao_automatica;

  useEffect(() => {
    setSupported(bluetoothPrintService.isSupported());
    const s = getBluetoothSettings();
    setSettings(s);
    if (s.deviceName) setConnectedName(s.deviceName);

    // Reconecta automaticamente se já houve pareamento anterior
    if ((s.deviceId || s.deviceName) && !bluetoothPrintService.isConnected()) {
      bluetoothPrintService.tryAutoReconnect().then((ok) => {
        if (ok) setConnectedName(getBluetoothSettings().deviceName || s.deviceName || null);
      }).catch(() => {});
    }

    // Tenta reconectar ao voltar para a aba (ex.: tela desbloqueia)
    const onVisible = () => {
      if (document.visibilityState === "visible" && !bluetoothPrintService.isConnected()) {
        bluetoothPrintService.tryAutoReconnect().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Garante que autoPrint fique desligado se o plano não permitir
  useEffect(() => {
    if (!isUltra && settings.autoPrint) {
      const next = { ...settings, autoPrint: false };
      setSettings(next);
      saveBluetoothSettings(next);
    }
  }, [isUltra, settings.autoPrint]);

  const update = (patch: Partial<BTSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveBluetoothSettings(next);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const name = await bluetoothPrintService.requestDevice();
      setConnectedName(name);
      toast.success(`Conectado a ${name}`);
    } catch (err: any) {
      toast.error(err.message || "Falha ao conectar à impressora Bluetooth");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    bluetoothPrintService.disconnect();
    setConnectedName(null);
    update({ deviceId: undefined, deviceName: undefined });
    toast.info("Impressora desconectada");
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      await bluetoothPrintService.printTest();
      toast.success("Teste enviado para a impressora!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao imprimir teste");
    } finally {
      setIsPrinting(false);
    }
  };

  const isConnected = bluetoothPrintService.isConnected() || !!connectedName;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold font-display text-foreground">
            Mini Print Bluetooth (Android / iOS)
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <BluetoothConnected className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">
                Conectada
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Desconectada
              </span>
            </>
          )}
        </div>
      </div>

      {!supported && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
          Este navegador não suporta Bluetooth Web. <strong>Android:</strong> use o Chrome ou Edge.
          <strong> iOS:</strong> instale o app <em>Bluefy – Web BLE Browser</em> na App Store e abra o sistema por ele.
        </div>
      )}

      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Impressora pareada</Label>
            <p className="text-[11px] text-muted-foreground">
              {connectedName || "Nenhuma impressora conectada"}
            </p>
          </div>
          <div className="flex gap-2">
            {isConnected && (
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting || !supported}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4" />
              )}
              {isConnected ? "Trocar" : "Conectar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 space-y-3">
        <Label className="text-sm font-medium">Largura do papel</Label>
        <Select
          value={String(settings.paperWidth)}
          onValueChange={(v) => update({ paperWidth: Number(v) as 58 | 80 })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="58">58 mm (Mini Print padrão)</SelectItem>
            <SelectItem value="80">80 mm (térmica grande)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Escolha conforme o rolo da sua impressora. A maioria das mini portáteis usa 58mm.
        </p>
      </div>


      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Modo nítido (double-strike)</Label>
          <p className="text-[11px] text-muted-foreground">
            Imprime cada linha duas vezes para um texto mais escuro e legível.
          </p>
        </div>
        <Switch
          checked={!!settings.sharpMode}
          onCheckedChange={(v) => update({ sharpMode: v })}
        />
      </div>

      <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <Printer className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-primary leading-relaxed">
            <strong>Atenção:</strong> apenas uma das opções abaixo pode ficar ativa por vez. Ativar uma desativa a outra automaticamente.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium">Impressão automática</Label>
              {!isUltra && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">
                  Plano Ultra
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isUltra
                ? "Ao receber um pedido neste dispositivo, imprime direto na Bluetooth pareada."
                : "Disponível apenas no Plano Ultra. Faça upgrade para liberar a impressão automática."}
            </p>
          </div>
          <Switch
            checked={isUltra && !!settings.autoPrint}
            disabled={!isUltra}
            onCheckedChange={(v) => update({ autoPrint: v, ...(v ? { printOnAccept: false } : {}) })}
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm font-medium">Imprimir ao aceitar pedido</Label>
              {!isUltra && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20">
                  Plano Ultra
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isUltra
                ? <>Quando ativado, o pedido é impresso ao clicar no status <strong>Aceitar</strong>. Se desativado, só imprime ao clicar no botão da impressora.</>
                : "Disponível apenas no Plano Ultra. Faça upgrade para liberar esta opção."}
            </p>
          </div>
          <Switch
            checked={isUltra && settings.printOnAccept === true && !settings.autoPrint}
            disabled={!isUltra}
            onCheckedChange={(v) => update({ printOnAccept: v, ...(v ? { autoPrint: false } : {}) })}
          />
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3 pointer-events-none md:hidden">
        <Button
          onClick={() => {
            saveBluetoothSettings(settings);
            toast.success("Configurações Bluetooth salvas!");
          }}
          className="pointer-events-auto bg-primary text-primary-foreground h-12 w-12 rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 p-0"
          title="Salvar Configurações"
        >
          <CheckCircle2 className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleTestPrint}
          disabled={!isConnected || isPrinting}
          className="gap-2"
        >
          {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          Imprimir Teste
        </Button>
        <Button
          onClick={() => {
            saveBluetoothSettings(settings);
            toast.success("Configurações Bluetooth salvas!");
          }}
          className="flex-1"
        >
          Salvar Configurações
        </Button>
      </div>

      <div className="p-3 rounded-lg bg-muted/20 border border-border/40 text-[11px] text-muted-foreground leading-relaxed space-y-1">
        <p><strong>Como usar:</strong></p>
        <p>1. Ligue a impressora Bluetooth e ative o Bluetooth do celular/tablet.</p>
        <p>2. Toque em <strong>Conectar</strong> e escolha o dispositivo na lista.</p>
        <p>3. Faça um <strong>teste de impressão</strong> e ative a impressão automática.</p>
        <p>4. Pronto: novos pedidos imprimem direto no seu dispositivo móvel.</p>
      </div>
    </div>
  );
};

export default BluetoothPrinterSettings;
