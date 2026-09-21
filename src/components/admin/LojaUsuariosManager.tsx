import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, Shield, BriefcaseBusiness, UserRound,
  Eye, EyeOff, AlertCircle, Settings2, Check, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ALL_PERMISSIONS, PERMISSION_LABELS, PermissionKey } from "@/contexts/PdvUserContext";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";

type Nivel = "admin" | "gerente" | "funcionario";

interface UserActionPermissions {
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  tabs?: string[]; // Para abas de configurações
}

interface LojaUsuario {
  id: string;
  loja_id: string;
  nome: string;
  pin: string;
  nivel: Nivel;
  ativo: boolean;
  permissoes: PermissionKey[];
  permissoes_acoes?: Record<string, UserActionPermissions>;
  created_at: string;
}

const NIVEL_INFO: Record<Nivel, { label: string; desc: string; icon: typeof Shield; color: string; ring: string }> = {
  admin: {
    label: "Admin",
    desc: "Acesso total a todas as áreas",
    icon: Shield,
    color: "bg-red-50 text-red-700 border-red-200",
    ring: "data-[active=true]:border-red-500 data-[active=true]:bg-red-50",
  },
  gerente: {
    label: "Gerente",
    desc: "Acesso intermediário — escolha as áreas",
    icon: BriefcaseBusiness,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    ring: "data-[active=true]:border-amber-500 data-[active=true]:bg-amber-50",
  },
  funcionario: {
    label: "Funcionário",
    desc: "Acesso restrito — escolha as áreas",
    icon: UserRound,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    ring: "data-[active=true]:border-blue-500 data-[active=true]:bg-blue-50",
  },
};

// Map permission keys to plan flags. Keys not in this map are always available.
const PERM_TO_PLAN: Partial<Record<PermissionKey, keyof ReturnType<typeof useStorePlanLimits>["limits"]>> = {
  dashboard: "dashboard",
  pedidos: "pedidos",
  produtos: "produtos",
  entregas: "entregas",
  financeiro: "financeiro",
  pdv: "pdv",
  pdv_mesas: "pdv",
  pdv_balcao: "pdv",
  comandas: "pdv",
  relatorios: "relatorios",
};

interface Props {
  lojaId: string;
}

export default function LojaUsuariosManager({ lojaId }: Props) {
  const qc = useQueryClient();
  const { limits } = useStorePlanLimits();

  const availablePerms = useMemo<PermissionKey[]>(() => {
    return ALL_PERMISSIONS.filter((k) => {
      const planKey = PERM_TO_PLAN[k];
      if (!planKey) return true;
      return !!(limits as any)?.[planKey];
    });
  }, [limits]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [permsDialogOpen, setPermsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LojaUsuario | null>(null);
  const [confirmDel, setConfirmDel] = useState<LojaUsuario | null>(null);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});

  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [nivel, setNivel] = useState<Nivel>("admin");
  const [ativo, setAtivo] = useState(true);
  const [permissoes, setPermissoes] = useState<PermissionKey[]>([]);
  const [permissoesAcoes, setPermissoesAcoes] = useState<Record<string, UserActionPermissions>>({
    produtos: { create: true, edit: true, delete: true },
    configuracoes: { create: true, edit: true, delete: true }
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["loja-usuarios", lojaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_usuarios" as any)
        .select("*")
        .eq("loja_id", lojaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as LojaUsuario[];
    },
    enabled: !!lojaId,
  });

  const hasAdmin = usuarios.some((u) => u.nivel === "admin");

  function resetForm() {
    setNome("");
    setPin("");
    setNivel(usuarios.length === 0 || !hasAdmin ? "admin" : "funcionario");
    setAtivo(true);
    setPermissoes([]);
    setPermissoesAcoes({
      produtos: { create: true, edit: true, delete: true },
      configuracoes: { create: true, edit: true, delete: true }
    });
    setEditing(null);
  }

  function openNew() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(u: LojaUsuario) {
    setEditing(u);
    setNome(u.nome);
    setPin(u.pin);
    setNivel(u.nivel);
    setAtivo(u.ativo);
    setPermissoes(((u.permissoes as PermissionKey[]) || []).filter((p) => availablePerms.includes(p)));
    setPermissoesAcoes(u.permissoes_acoes || {
      produtos: { create: true, edit: true, delete: true },
      configuracoes: { create: true, edit: true, delete: true }
    });
    setDialogOpen(true);
  }

  function togglePerm(key: PermissionKey) {
    setPermissoes((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome obrigatório");
      if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN deve ter 4 a 6 dígitos");

      if (!editing && !hasAdmin && nivel !== "admin") {
        throw new Error("O primeiro usuário cadastrado deve ser do nível Admin.");
      }

      const finalPerms =
        nivel === "admin" ? availablePerms : permissoes.filter((p) => availablePerms.includes(p));
      const payload = { 
        nome: nome.trim(), 
        pin, 
        nivel, 
        ativo, 
        permissoes: finalPerms,
        permissoes_acoes: permissoesAcoes 
      };

      if (editing) {
        const { error } = await supabase.from("loja_usuarios" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loja_usuarios" as any).insert({ loja_id: lojaId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Usuário atualizado" : "Usuário criado");
      qc.invalidateQueries({ queryKey: ["loja-usuarios", lojaId] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: async (u: LojaUsuario) => {
      const { error } = await supabase.from("loja_usuarios" as any).delete().eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["loja-usuarios", lojaId] });
      setConfirmDel(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Usuários da Loja</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre acessos com PIN e escolha as áreas liberadas para cada pessoa.
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed bg-muted/40 border border-border/60 rounded-md p-2.5">
            <strong className="text-foreground">Dica:</strong> caso deseje que outros usuários do sistema não tenham acesso aos valores financeiros, cadastre um usuário <strong>Administrador</strong> (com acesso total) e um <strong>outro usuário</strong> onde você escolhe exatamente o que ele pode visualizar.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      {!hasAdmin && usuarios.length === 0 && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Sem usuários cadastrados</AlertTitle>
          <AlertDescription>
            Enquanto não houver usuários, o sistema abre sem bloqueio. Ao cadastrar o primeiro usuário, ele deve ser
            <strong> Admin</strong> com acesso total — depois você cria Gerentes e Funcionários com permissões personalizadas.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>
        ) : (
          <div className="divide-y divide-border/60">
            {usuarios.map((u) => {
              const info = NIVEL_INFO[u.nivel];
              const Icon = info.icon;
              const shown = showPins[u.id];
              const permsCount = u.nivel === "admin" ? availablePerms.length : (u.permissoes?.length || 0);
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${info.color} border`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{u.nome}</p>
                        {!u.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{info.label}</span>
                        <span>·</span>
                        <span className="font-mono">PIN: {shown ? u.pin : "••••"}</span>
                        <button onClick={() => setShowPins((s) => ({ ...s, [u.id]: !s[u.id] }))} className="hover:text-foreground">
                          {shown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <span>·</span>
                        <span>{permsCount} {permsCount === 1 ? "área" : "áreas"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDel(u)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog principal — dados + nivel */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              Defina o nome, PIN de acesso e o nível desse usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" />
              </div>
              <div className="space-y-1.5">
                <Label>PIN (4 a 6 dígitos)</Label>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="1234"
                  inputMode="numeric"
                  className="font-mono tracking-widest"
                />
              </div>
            </div>

            {/* Nivel cards */}
            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(NIVEL_INFO) as Nivel[]).map((k) => {
                  const meta = NIVEL_INFO[k];
                  const Icon = meta.icon;
                  const active = nivel === k;
                  const disabled = !editing && !hasAdmin && k !== "admin";
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={disabled}
                      data-active={active}
                      onClick={() => setNivel(k)}
                      className={`relative rounded-lg border-2 border-border bg-background p-3 text-left transition-all hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed ${meta.ring}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${meta.color} mb-2`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{meta.desc}</p>
                      {active && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {!editing && !hasAdmin && (
                <p className="text-xs text-amber-600">Obrigatório: o primeiro usuário cadastrado deve ser Admin.</p>
              )}
            </div>

            {/* Areas liberadas — popup trigger */}
            <div className="space-y-2">
              <Label>Áreas liberadas</Label>
              {nivel === "admin" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Admin tem acesso total a todas as <strong>{availablePerms.length}</strong> áreas do plano contratado.</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPermsDialogOpen(true)}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background hover:bg-muted/30 px-3 py-2.5 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium">Configurar acessos</p>
                      <p className="text-xs text-muted-foreground">
                        {permissoes.length === 0
                          ? "Nenhuma área selecionada"
                          : `${permissoes.length} de ${availablePerms.length} áreas liberadas`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Editar</Badge>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Desative para bloquear o acesso temporariamente</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup de permissões */}
      <Dialog open={permsDialogOpen} onOpenChange={setPermsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Áreas liberadas</DialogTitle>
            <DialogDescription>
              Marque o que esse usuário poderá acessar. Itens bloqueados não estão incluídos no plano contratado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between text-xs px-1 py-2">
            <span className="text-muted-foreground">
              {permissoes.length} de {availablePerms.length} selecionadas
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setPermissoes([...availablePerms])}
              >
                Selecionar todas
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setPermissoes([])}
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 divide-y divide-border/60">
            {ALL_PERMISSIONS.map((key) => {
              const meta = PERMISSION_LABELS[key];
              const isActionRestricted = ["produtos", "configuracoes"].includes(key);
              const isSelected = permissoes.includes(key);

              return (
                <div key={key} className="space-y-0">
                  <label
                    className={`flex items-start gap-3 p-3 transition hover:bg-muted/50 cursor-pointer ${
                      !isSelected ? "opacity-60" : ""
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => togglePerm(key)}
                      className="mt-1"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    </div>
                  </label>

                  {isSelected && (key === "produtos" || key === "configuracoes") && (
                    <div className="bg-muted/30 px-9 pb-3 space-y-4 pt-2">
                      {key === "produtos" && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Ações permitidas</p>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <Checkbox
                                checked={permissoesAcoes[key]?.create !== false}
                                onCheckedChange={(checked) => setPermissoesAcoes(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], create: !!checked }
                                }))}
                              />
                              <span className="text-xs group-hover:text-primary transition-colors">Adicionar</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <Checkbox
                                checked={permissoesAcoes[key]?.edit !== false}
                                onCheckedChange={(checked) => setPermissoesAcoes(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], edit: !!checked }
                                }))}
                              />
                              <span className="text-xs group-hover:text-primary transition-colors">Editar</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <Checkbox
                                checked={permissoesAcoes[key]?.delete !== false}
                                onCheckedChange={(checked) => setPermissoesAcoes(prev => ({
                                  ...prev,
                                  [key]: { ...prev[key], delete: !!checked }
                                }))}
                              />
                              <span className="text-xs group-hover:text-primary transition-colors">Excluir</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {key === "configuracoes" && (
                        <div className="space-y-3 pt-2 border-t border-border/40">
                          <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Abas liberadas</p>
                          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                            {[
                              { id: "horario", label: "Horário" },
                              { id: "impressora", label: "Impressora" },
                              { id: "entrega", label: "Entrega" },
                              { id: "avaliacoes", label: "Avaliações" },
                              { id: "pagamento", label: "Pagamento" },
                              { id: "cupons", label: "Cupons" },
                              { id: "usuarios", label: "Usuários" },
                            ].map((tab) => (
                              <label key={tab.id} className="flex items-center gap-2 cursor-pointer group">
                                <Checkbox
                                  checked={!permissoesAcoes[key]?.tabs || permissoesAcoes[key].tabs?.includes(tab.id)}
                                  onCheckedChange={(checked) => {
                                    const currentTabs = permissoesAcoes[key]?.tabs || ["horario", "impressora", "entrega", "avaliacoes", "pagamento", "cupons", "usuarios"];
                                    const nextTabs = checked 
                                      ? [...currentTabs, tab.id]
                                      : currentTabs.filter(t => t !== tab.id);
                                    
                                    setPermissoesAcoes(prev => ({
                                      ...prev,
                                      [key]: { ...prev[key], tabs: nextTabs }
                                    }));
                                  }}
                                />
                                <span className="text-xs group-hover:text-primary transition-colors">{tab.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setPermsDialogOpen(false)} className="w-full sm:w-auto">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente o acesso de <strong>{confirmDel?.nome}</strong>.
              {confirmDel?.nivel === "admin" &&
                usuarios.filter((x) => x.id !== confirmDel?.id && x.nivel === "admin").length === 0 && (
                <span className="block mt-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-amber-800 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                  Este é o último Admin. Sem nenhum usuário Admin, e se não restarem outros usuários, o sistema voltará a abrir sem bloqueio de PIN.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
