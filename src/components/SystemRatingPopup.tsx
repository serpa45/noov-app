import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import avaliacaoImg from "@/assets/avaliacao-sistema.png";

type RatingValue = "ruim" | "bom" | "otimo";

interface Props {
  clientData: { id?: string; nome?: string; whatsapp?: string; telefone?: string } | null;
}

export function SystemRatingPopup({ clientData, lojaId }: Props & { lojaId?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RatingValue | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [optOut, setOptOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phone = clientData?.whatsapp || clientData?.telefone;

  useEffect(() => {
    if (!clientData || !phone) return;
    let cancelled = false;

    // Track login count per client phone — only show popup from the 2nd login onwards.
    // The first login is for the user to explore the system; from the second on they can rate it.
    const loginCountKey = `system_rating_login_count_${phone}`;
    const lastSessionKey = `system_rating_last_session_${phone}`;
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30min = nova sessão/login

    let loginCount = parseInt(localStorage.getItem(loginCountKey) || "0", 10);
    const lastSession = parseInt(localStorage.getItem(lastSessionKey) || "0", 10);
    const now = Date.now();
    if (now - lastSession > SESSION_GAP_MS) {
      loginCount += 1;
      localStorage.setItem(loginCountKey, String(loginCount));
    }
    localStorage.setItem(lastSessionKey, String(now));

    if (loginCount < 2) return;

    (async () => {
      // Check if enabled
      const { data: settings } = await supabase
        .from("system_rating_settings")
        .select("enabled")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled || !settings?.enabled) return;

      // Check status
      const { data } = await supabase.rpc("system_rating_status", { _telefone: phone });
      if (cancelled) return;
      const status = Array.isArray(data) ? data[0] : data;
      if (status?.has_voted || status?.has_opted_out) return;
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [phone, clientData]);

  const submit = async () => {
    if (!phone) return;
    if (optOut) {
      setSubmitting(true);
      const { error } = await supabase.from("system_rating_optouts").insert({
        cliente_telefone: phone,
        cliente_nome: (clientData as any)?.nome_completo || (clientData as any)?.nome || null,
        loja_id: lojaId || null,
      });
      setSubmitting(false);
      if (error) return toast.error("Erro ao salvar.");
      toast.success("Você não verá esta mensagem novamente.");
      setOpen(false);
      return;
    }
    if (!selected) {
      toast.error("Escolha uma avaliação ou marque a opção de não votar.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("system_ratings").insert({
      cliente_telefone: phone,
      cliente_nome: (clientData as any)?.nome_completo || (clientData as any)?.nome || null,
      loja_id: lojaId || null,
      rating: selected,
      observacoes: observacoes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      if ((error as any).code === "23505") {
        toast.info("Você já enviou uma avaliação.");
        setOpen(false);
        return;
      }
      return toast.error("Erro ao enviar avaliação.");
    }
    toast.success("Obrigado pela sua avaliação!");
    setOpen(false);
  };

  const options: { value: RatingValue; cropX: string; cropW: string; label: string }[] = [
    { value: "ruim", cropX: "0%", cropW: "33.33%", label: "Ruim" },
    { value: "bom", cropX: "33.33%", cropW: "33.33%", label: "Bom" },
    { value: "otimo", cropX: "66.66%", cropW: "33.33%", label: "Ótimo" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="bg-black/20 backdrop-blur-[2px]" />
        <DialogContent className="max-w-[340px] p-0 overflow-hidden bg-[#000000] border-white/10 rounded-[24px] [&>button]:text-white">
        <div className="relative overflow-hidden">
          <img 
            src={avaliacaoImg} 
            alt="Avaliação do Sistema" 
            className="w-full h-auto block" 
          />
          {/* Clickable hotspots over each face */}
          <div className="absolute inset-x-0 bottom-[12%] flex px-4">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`flex-1 aspect-square mx-1 transition-all ${
                  selected === opt.value
                    ? "scale-110"
                    : "hover:scale-105"
                }`}
                aria-label={opt.label}
              />
            ))}
          </div>
        </div>

        <div className="p-4 pt-1 space-y-3 bg-[#000000]">
          {selected && (
            <p className="text-sm text-white text-center font-semibold -mt-2">
              Você escolheu: <span className="text-secondary uppercase">{selected === "otimo" ? "Ótimo" : selected === "bom" ? "Bom" : "Ruim"}</span>
            </p>
          )}
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações sobre sua avaliação (opcional)"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none min-h-[70px]"
            maxLength={500}
          />
          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold h-11"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : optOut ? (
              "Não quero votar"
            ) : (
              "Enviar avaliação"
            )}
          </Button>
          <label className="flex items-center justify-center gap-2 text-xs text-white/80 cursor-pointer pt-1">
            <Checkbox
              checked={optOut}
              onCheckedChange={(v) => setOptOut(!!v)}
              className="border-white/30"
            />
            Não quero votar (não mostrar novamente)
          </label>
        </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
