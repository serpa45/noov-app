import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Mail, Phone, Calendar, Store, UserCheck, Truck, Shield, Loader2, ShoppingBag, Key,
} from "lucide-react";
import { motion } from "framer-motion";

const roleConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Admin", icon: Shield, className: "bg-red-100 text-red-800 border-red-200" },
  lojista: { label: "Lojista", icon: Store, className: "bg-blue-100 text-blue-800 border-blue-200" },
  afiliado: { label: "Afiliado", icon: UserCheck, className: "bg-green-100 text-green-800 border-green-200" },
  entregador: { label: "Entregador", icon: Truck, className: "bg-orange-100 text-orange-800 border-orange-200" },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-roles", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", id!);
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!id,
  });

  const { data: loja } = useQuery({
    queryKey: ["admin-user-loja", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("*")
        .eq("user_id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["admin-user-pedidos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .eq("lojista_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/admin/usuarios")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground text-center py-8">Usuário não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/usuarios")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">
            {profile.full_name || "Sem nome"}
          </h2>
          <p className="text-xs text-muted-foreground">{profile.user_id}</p>
        </div>
      </motion.div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Profile Info */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{profile.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{profile.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Cadastro: {formatDate(profile.created_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {roles.map((role) => {
                const cfg = roleConfig[role];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <Badge key={role} variant="outline" className={`text-[11px] ${cfg.className}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {cfg.label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Codes & PIX */}
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Códigos & PIX</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Key className="w-4 h-4 text-muted-foreground" />
              <span>Código acesso: <span className="font-mono font-semibold">{profile.codigo_acesso || "—"}</span></span>
            </div>
            {profile.codigo_afiliado && (
              <div className="flex items-center gap-2 text-sm">
                <UserCheck className="w-4 h-4 text-green-600" />
                <span>Código afiliado: <span className="font-mono font-semibold">{profile.codigo_afiliado}</span></span>
              </div>
            )}
            {profile.codigo_admin && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-red-600" />
                <span>Código admin: <span className="font-mono font-semibold">{profile.codigo_admin}</span></span>
              </div>
            )}
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs text-muted-foreground">PIX</p>
              <p className="text-sm">Tipo: {profile.pix_tipo || "—"}</p>
              <p className="text-sm">Chave: {profile.pix_chave || "—"}</p>
              <p className="text-sm">Favorecido: {profile.pix_nome_favorecido || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loja */}
      {loja && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Store className="w-4 h-4" /> Loja Vinculada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Nome</p><p className="font-semibold">{loja.nome}</p></div>
              <div><p className="text-xs text-muted-foreground">Slug</p><p className="font-mono">/{loja.slug}</p></div>
              <div><p className="text-xs text-muted-foreground">Segmento</p><p>{loja.segmento}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={loja.ativo ? "default" : "secondary"}>{loja.ativo ? "Ativa" : "Inativa"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pedidos */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Pedidos ({pedidos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pedidos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id.slice(0, 8)}...</TableCell>
                      <TableCell>{p.cliente_nome || "—"}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(p.total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{p.tipo}</TableCell>
                      <TableCell className="text-xs">{formatDate(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserDetail;
