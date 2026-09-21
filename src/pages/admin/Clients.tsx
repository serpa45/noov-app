import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Phone, Eye, MapPin, Calendar, ShoppingCart, TrendingUp, Cake, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/utils";

export default function Clients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  
  const [birthdayFilter, setBirthdayFilter] = useState(false);

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-cadastrados"] });
      toast.success("Cliente removido");
    },
    onError: () => toast.error("Erro ao remover cliente"),
  });


  const { data: currentStore } = useQuery({
    queryKey: ["current-store-for-clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes-cadastrados", currentStore?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("loja_id", currentStore?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentStore?.id,
  });

  // Fetch all orders to compute per-client stats
  const { data: pedidos = [] } = useQuery({
    queryKey: ["all-orders-for-clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("cliente_telefone, total")
        .eq("lojista_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Build a map: telefone -> { count, total }
  const orderStats = new Map<string, { count: number; total: number }>();
  pedidos.forEach((p) => {
    const tel = p.cliente_telefone || "";
    const existing = orderStats.get(tel) || { count: 0, total: 0 };
    existing.count++;
    existing.total += Number(p.total);
    orderStats.set(tel, existing);
  });

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  

  const filtered = clientes.filter((c) => {
    // Birthday filter
    if (birthdayFilter) {
      if (!c.data_nascimento) return false;
      const [, m] = c.data_nascimento.split("-");
      if (m !== currentMonth) return false;
    }


    if (!search || search === "__all__") return true;
    return c.nome_completo === search;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const statsA = orderStats.get(a.telefone) || orderStats.get(a.whatsapp || "") || { count: 0, total: 0 };
    const statsB = orderStats.get(b.telefone) || orderStats.get(b.whatsapp || "") || { count: 0, total: 0 };
    return statsB.total - statsA.total;
  });

  const birthdayCount = clientes.filter((c) => {
    if (!c.data_nascimento) return false;
    const [, m] = c.data_nascimento.split("-");
    return m === currentMonth;
  }).length;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const formatBirthday = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };

  const goToDetail = (telefone: string) => {
    navigate(`/lojista/clientes/${encodeURIComponent(telefone)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} cadastrado{clientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/60">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{clientes.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Cadastrados</p>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Search + Birthday filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={search} onValueChange={setSearch}>
          <SelectTrigger className="w-full sm:max-w-[200px]">
            <SelectValue placeholder="Cliente..." />
          </SelectTrigger>
          <SelectContent>
            <div className="sticky top-0 bg-popover p-2 z-10 border-b">
              <Input
                autoFocus
                placeholder="Buscar cliente..."
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-8"
              />
            </div>
            <SelectItem value="__all__">Todos os clientes</SelectItem>
            {[...clientes]
              .filter((c) => (c.nome_completo || "").toLowerCase().includes(clienteSearch.toLowerCase()))
              .sort((a, b) => (a.nome_completo || "").localeCompare(b.nome_completo || "", "pt-BR"))
              .map((c) => (
                <SelectItem key={c.id} value={c.nome_completo}>
                  {c.nome_completo}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>


        <Button
          variant={birthdayFilter ? "default" : "outline"}
          size="sm"
          className="gap-1.5 text-xs w-full sm:w-auto"
          onClick={() => setBirthdayFilter(!birthdayFilter)}
        >
          <Cake className="w-3.5 h-3.5" />
          Aniversariantes ({birthdayCount})
        </Button>
      </div>

      <Card className="border rounded-lg overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : sortedFiltered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-[11px]">
                    <TableHead className="py-2 px-3 font-semibold">Cliente</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">WhatsApp</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Bairro</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Nascimento</TableHead>
                    <TableHead className="py-2 px-3 font-semibold">Cadastro</TableHead>
                    <TableHead className="py-2 px-3 font-semibold text-center">Pedidos</TableHead>
                    <TableHead className="py-2 px-3 font-semibold text-right">Total</TableHead>
                    <TableHead className="py-2 px-3 font-semibold text-center w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiltered.map((c, idx) => {
                    const stats = orderStats.get(c.telefone) || orderStats.get(c.whatsapp || "") || { count: 0, total: 0 };
                    return (
                      <TableRow
                        key={c.id}
                        className={`cursor-pointer hover:bg-primary/5 text-xs ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                        onClick={() => goToDetail(c.telefone)}
                      >
                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {c.foto_url ? (
                              <img src={c.foto_url} alt={c.nome_completo} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                                {c.nome_completo?.charAt(0)?.toUpperCase() || "C"}
                              </div>
                            )}
                            <span className="font-medium text-foreground truncate max-w-[160px]">{c.nome_completo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">{c.whatsapp ? formatPhone(c.whatsapp) : "—"}</TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {c.endereco_bairro || "—"}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Cake className="w-3 h-3 shrink-0" /> {formatBirthday(c.data_nascimento)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-muted-foreground">
                          {formatDate(c.created_at)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <Badge variant={stats.count > 5 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">{stats.count}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right font-semibold text-emerald-600">
                          R$ {stats.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {(c.whatsapp || c.telefone) && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const phone = (c.whatsapp || c.telefone).replace(/\D/g, "");
                                  window.open(`https://wa.me/55${phone}`, "_blank");
                                }}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); goToDetail(c.telefone); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Remover ${c.nome_completo}?`)) {
                                  deleteClient.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
