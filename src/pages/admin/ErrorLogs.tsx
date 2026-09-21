import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Terminal, Search, Trash2, Pause, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ErrorLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-error-logs-paused") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin-error-logs-paused", String(isPaused));
  }, [isPaused]);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-error-logs"],
    queryFn: async () => {
      // Cast to any to bypass type issues until regeneration
      const { data, error } = await (supabase as any)
        .from("error_logs")
        .select(`
          *,
          lojas (
            nome_fantasia
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: isPaused ? false : 30000,
  });

  const clearLogs = async () => {
    if (!confirm("Tem certeza que deseja limpar todos os logs?")) return;
    
    const { error } = await (supabase as any)
      .from("error_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (error) {
      toast.error("Erro ao limpar logs");
    } else {
      toast.success("Logs limpos com sucesso");
      refetch();
    }
  };

  const filteredLogs = logs.filter((log: any) => 
    log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.lojas?.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="w-6 h-6 text-destructive" />
              Logs de Erros do Catálogo
            </h1>
            <p className="text-muted-foreground">
              {isPaused
                ? "Atualização automática pausada. Clique em Retomar para voltar a sincronizar."
                : "Monitoramento de erros em tempo real no cardápio público."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isPaused ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsPaused(p => !p)}
              className="gap-2"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? "Retomar" : "Pausar"}
            </Button>
            <Button variant="destructive" size="sm" onClick={clearLogs} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Limpar Logs
            </Button>
          </div>
        </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Histórico de Ocorrências</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por mensagem ou loja..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <CardDescription>
            Logs capturados desde o acesso ao catálogo até a finalização do pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Nenhum erro registrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log: any) => (
                    <TableRow key={log.id} className="group cursor-help">
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.lojas?.nome_fantasia || "N/A"}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-destructive line-clamp-1">{log.message}</span>
                          {log.stack && (
                            <pre className="text-[10px] bg-muted p-2 rounded hidden group-hover:block overflow-x-auto max-h-32">
                              {log.stack}
                            </pre>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {log.url}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.metadata?.type || "Erro"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorLogs;
