import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearErrorLogs, errorLogKeys, fetchErrorLogs } from "@/utils/errorLogQueries";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { errorMessage } from "@/utils/errorLogger";
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
  const queryClient = useQueryClient();
  useRealtimeSubscription("error_logs", [ [...errorLogKeys.list], [...errorLogKeys.count] ]);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPaused, setIsPaused] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin-error-logs-paused") === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("admin-error-logs-paused", String(isPaused));
  }, [isPaused]);

  const { data: logs = [], isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: errorLogKeys.list,
    queryFn: fetchErrorLogs,
    refetchInterval: isPaused ? false : 30000,
  });

  const clearLogs = async () => {
    if (isClearing || !confirm("Tem certeza que deseja limpar todos os logs?")) return;
    setIsClearing(true);
    try {
      const deleted = await clearErrorLogs();
      toast.success(deleted > 0 ? `${deleted} log(s) excluído(s) com sucesso` : "Nenhum log anterior para excluir.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: errorLogKeys.list }),
        queryClient.invalidateQueries({ queryKey: errorLogKeys.count }),
      ]);
      setIsClearing(false);
    }
  };

  const filteredLogs = logs.filter((log: any) => 
    log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.lojas?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.url?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="w-6 h-6 text-destructive" />
              Logs de Erros do Sistema
            </h1>
            <p className="text-muted-foreground">
              {isPaused
                ? "Atualização automática pausada. Clique em Retomar para voltar a sincronizar."
                : "Erros do aplicativo registrados no Supabase do Noov."}
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
            <Button variant="destructive" size="sm" onClick={clearLogs} disabled={isClearing} className="gap-2">
              <Trash2 className="w-4 h-4" />
              {isClearing ? "Limpando..." : "Limpar Logs"}
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
            Últimas 200 ocorrências. Expanda os detalhes para investigar cada erro.
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
                {isError ? (
                  <TableRow><TableCell colSpan={5}>
                    <div role="alert" className="py-6 text-destructive">
                      <p>Não foi possível carregar os logs do Supabase.</p>
                      <p className="text-sm">{errorMessage(loadError)}</p>
                      <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
                    </div>
                  </TableCell></TableRow>
                ) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      {searchTerm ? "Nenhuma ocorrência corresponde à busca." : "Nenhum erro registrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log: any) => (
                    <TableRow key={log.id} className="group cursor-help">
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.lojas?.nome || "Sistema / sem loja"}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-destructive break-words">{log.message}</span>
                          <details><summary className="text-xs cursor-pointer">Detalhes técnicos</summary>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                              {log.stack || "Sem stack trace."}{"\n"}{JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
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
