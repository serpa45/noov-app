import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  Store,
  UserCheck,
  Truck,
  Shield,
  Loader2,
  Mail,
  Phone,
  Calendar,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Admin", icon: Shield, className: "bg-red-100 text-red-800 border-red-200" },
  lojista: { label: "Lojista", icon: Store, className: "bg-blue-100 text-blue-800 border-blue-200" },
  afiliado: { label: "Afiliado", icon: UserCheck, className: "bg-green-100 text-green-800 border-green-200" },
  entregador: { label: "Entregador", icon: Truck, className: "bg-orange-100 text-orange-800 border-orange-200" },
};

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleDelete = async (e: React.MouseEvent, userId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir o usuário "${name}"?`)) return;
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-all-roles"] });
    toast.success("Usuário excluído com sucesso");
  };

  // Fetch all profiles
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch all roles
  const { data: allRoles = [] } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role");
      return data ?? [];
    },
  });

  // Fetch all stores
  const { data: lojas = [] } = useQuery({
    queryKey: ["admin-all-lojas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, nome, slug, user_id, segmento");
      return data ?? [];
    },
  });

  // Build role map
  const roleMap: Record<string, string[]> = {};
  allRoles.forEach((r) => {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push(r.role);
  });

  // Build store map
  const storeMap: Record<string, typeof lojas[0]> = {};
  lojas.forEach((l) => {
    storeMap[l.user_id] = l;
  });

  // Filter
  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const roles = roleMap[p.user_id] || [];
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      roles.some((r) => r.includes(q)) ||
      storeMap[p.user_id]?.nome?.toLowerCase().includes(q)
    );
  });

  // Stats
  const totalUsers = profiles.length;
  const totalLojistas = Object.values(roleMap).filter((r) => r.includes("lojista")).length;
  const totalAfiliados = Object.values(roleMap).filter((r) => r.includes("afiliado")).length;
  const totalEntregadores = Object.values(roleMap).filter((r) => r.includes("entregador")).length;

  const stats = [
    { label: "Total Usuários", value: totalUsers, icon: Users, color: "text-primary" },
    { label: "Lojistas", value: totalLojistas, icon: Store, color: "text-blue-600" },
    { label: "Afiliados", value: totalAfiliados, icon: UserCheck, color: "text-green-600" },
    { label: "Entregadores", value: totalEntregadores, icon: Truck, color: "text-orange-600" },
  ];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  if (loadingProfiles) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-muted-foreground mt-1">
          Visualize e controle todos os usuários da plataforma.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="border-border/50 shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email, telefone, role ou loja..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users table */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Usuário</TableHead>
                   <TableHead>Tipo</TableHead>
                   <TableHead>Senha</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const roles = roleMap[p.user_id] || [];
                    const loja = storeMap[p.user_id];
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/usuarios/${p.user_id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {(p.full_name || "U")[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {p.full_name || "Sem nome"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              roles.map((role) => {
                                const cfg = roleConfig[role];
                                if (!cfg) return null;
                                const Icon = cfg.icon;
                                return (
                                  <Badge key={role} variant="outline" className={`text-[10px] ${cfg.className}`}>
                                    <Icon className="w-3 h-3 mr-1" />
                                    {cfg.label}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-foreground">
                            {p.codigo_acesso || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {loja ? (
                            <div>
                              <p className="text-[11px] text-muted-foreground capitalize">{loja.segmento}</p>
                              <p className="text-sm font-medium text-foreground">/{loja.slug}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {p.codigo_afiliado && (
                              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                                AF: {p.codigo_afiliado}
                              </Badge>
                            )}
                            {p.codigo_admin && (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                                ADM: {p.codigo_admin}
                              </Badge>
                            )}
                            {!p.codigo_afiliado && !p.codigo_admin && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(p.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDelete(e, p.user_id, p.full_name || "Sem nome")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
