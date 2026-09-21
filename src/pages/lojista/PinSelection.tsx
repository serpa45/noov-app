import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser, PermissionKey, ALL_PERMISSIONS } from "@/contexts/PdvUserContext";
import {
  Loader2,
  Shield,
  BriefcaseBusiness,
  UserRound,
  LogOut,
  Store,
  Fingerprint,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import loginFoodBg from "@/assets/login-food-bg.png";

const NIVEL_META = {
  admin: {
    label: "Administrador",
    icon: Shield,
    color: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-red-500",
    accent: "border-red-400 ring-red-200/60 bg-red-50/40",
  },
  gerente: {
    label: "Gerente",
    icon: BriefcaseBusiness,
    color: "bg-amber-50 text-amber-600 border-amber-200",
    dot: "bg-amber-500",
    accent: "border-amber-400 ring-amber-200/60 bg-amber-50/40",
  },
  funcionario: {
    label: "Funcionário",
    icon: UserRound,
    color: "bg-blue-50 text-blue-600 border-blue-200",
    dot: "bg-blue-500",
    accent: "border-blue-400 ring-blue-200/60 bg-blue-50/40",
  },
} as const;

export default function PinSelection() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setPdvUser } = usePdvUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: loja } = useQuery({
    queryKey: ["pin-loja", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome, logo_url").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["pin-usuarios", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_usuarios" as any)
        .select("*")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .order("nivel", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!loja?.id,
  });

  useEffect(() => {
    if (loja?.id && !isLoading && usuarios.length === 0) {
      navigate("/lojista", { replace: true });
    }
  }, [loja?.id, isLoading, usuarios.length, navigate]);




  const selected = usuarios.find((u) => u.id === selectedId);

  const handleSelectUser = (id: string) => {
    setSelectedId(id);
    setPin("");
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleConfirm = useCallback(async () => {
    if (!selected || pin.length < 4) return;
    setSubmitting(true);
    try {
      if (pin !== selected.pin) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        toast.error("Senha incorreta. Tente novamente.");
        setPin("");
        inputRef.current?.focus();
        setSubmitting(false);
        return;
      }
      const perms: PermissionKey[] =
        selected.nivel === "admin" ? ALL_PERMISSIONS : ((selected.permissoes as PermissionKey[]) || []);
      setPdvUser({
        id: selected.id,
        loja_id: selected.loja_id,
        nome: selected.nome,
        nivel: selected.nivel,
        permissoes: perms,
        permissoes_acoes: selected.permissoes_acoes,
      });
      toast.success(`Bem-vindo, ${selected.nome}!`);
      navigate("/lojista", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }, [selected, pin, setPdvUser, navigate]);

  if (isLoading || !loja) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  


  return (
    <div className="min-h-screen bg-gradient-hero relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={loginFoodBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" loading="lazy" width={1920} height={1080} />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <div className={`bg-card border border-border rounded-2xl shadow-elevated overflow-hidden ${shake ? "animate-shake" : ""}`}>
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-secondary" />

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              {loja.logo_url ? (
                <img
                  src={loja.logo_url}
                  alt={loja.nome}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-primary/10 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/10">
                  <Store className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground truncate leading-tight">
                  {loja.nome}
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Fingerprint className="w-3 h-3" />
                  Identifique-se para continuar
                </p>
              </div>
            </div>
          </div>

          {/* Dropdown de usuário (estilo choice) */}
          <div className="px-6 pt-5 pb-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Usuário do sistema
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`w-full h-12 px-3 rounded-lg border bg-card flex items-center gap-3 text-left transition-all hover:border-primary/40 ${
                  open ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                {selected ? (
                  <>
                    {(() => {
                      const meta = NIVEL_META[selected.nivel as keyof typeof NIVEL_META];
                      const Icon = meta.icon;
                      return (
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${meta.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate leading-tight">
                        {selected.nome}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {NIVEL_META[selected.nivel as keyof typeof NIVEL_META].label}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="flex-1 text-sm text-muted-foreground">Selecione um usuário</span>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-lg shadow-elevated overflow-hidden max-h-[260px] overflow-y-auto">
                  {usuarios.map((u) => {
                    const meta = NIVEL_META[u.nivel as keyof typeof NIVEL_META];
                    const Icon = meta.icon;
                    const isSelected = selectedId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u.id)}
                        className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/60 text-foreground"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate leading-tight">{u.nome}</div>
                          <div className={`text-[11px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {meta.label}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Password field */}
          <div className="px-6 pt-4 pb-6">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Senha de acesso
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              className="space-y-3"
            >
              <div className="relative">
                <Input
                  ref={inputRef}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={6}
                  placeholder={selected ? "Digite sua senha" : "Selecione um usuário acima"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={!selected || submitting}
                  className="h-12 pr-11 text-base font-mono text-center tracking-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((s) => !s)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={!selected}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="submit"
                disabled={!selected || pin.length < 4 || submitting}
                className="w-full h-12 text-sm font-semibold gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Entrar no sistema
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/lojista/login");
            }}
            className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair desta conta
          </Button>
        </div>
      </motion.div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
