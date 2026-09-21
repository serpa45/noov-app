import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Ticket as TicketIcon, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Store as StoreIcon,
  Trash2,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SupportTicket {
  id: string;
  ticket_number?: number;
  store_id: string | null;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  description?: string | null;
  source?: string | null;
  lojas?: {
    nome: string;
    logo_url: string | null;
  };
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'store' | 'admin';
  message: string;
  created_at: string;
}

const AdminTickets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, lojas(nome, logo_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["support-messages", selectedTicketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicketId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicketId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!replyMessage.trim() || !selectedTicketId) return;
      
      const { error: msgError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicketId,
          sender_id: user!.id,
          sender_role: 'admin',
          message: replyMessage.trim()
        });
      
      if (msgError) throw msgError;

      // Update ticket status to pending (admin answered)
      const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({ status: 'pending', store_read_at: null })
        .eq("id", selectedTicketId);
      
      if (ticketError) throw ticketError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      setReplyMessage("");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao enviar resposta.");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: 'open' | 'closed' | 'pending' }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Status do ticket atualizado.");
    }
  });
  
  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete messages first
      await supabase.from("support_messages").delete().eq("ticket_id", id);
      // Delete ticket
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast.success("Ticket excluído com sucesso.");
      setTicketToDelete(null);
      if (selectedTicketId === ticketToDelete) setSelectedTicketId(null);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao excluir ticket.");
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-support-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        if (payload.new.ticket_id === selectedTicketId) {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicketId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicketId, queryClient]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 50);
    return () => clearTimeout(t);
  }, [messages, selectedTicketId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-blue-500">Aberto</Badge>;
      case 'pending': return <Badge className="bg-yellow-500">Pendente</Badge>;
      case 'closed': return <Badge className="bg-gray-500">Fechado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.lojas?.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (selectedTicketId) {
    const ticket = tickets.find(t => t.id === selectedTicketId);
    return (
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <Card className="border-border/50 shadow-sm flex flex-col h-full">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedTicketId(null)}>
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">COD.{String(ticket?.ticket_number ?? 0).padStart(3, '0')}</span>
                  {ticket?.subject}
                  {ticket && getStatusBadge(ticket.status)}
                </CardTitle>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <StoreIcon className="w-3 h-3" /> {ticket?.lojas?.nome} • 
                  Aberto em {new Date(ticket?.created_at || "").toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {ticket?.status !== 'closed' ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => updateStatusMutation.mutate({ id: ticket!.id, status: 'closed' })}
                >
                  Fechar Ticket
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ id: ticket!.id, status: 'open' })}
                >
                  Reabrir Ticket
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                        msg.sender_role === 'admin'
                          ? 'bg-green-500/15 text-foreground border border-green-500/30 rounded-tr-none'
                          : 'bg-muted text-foreground rounded-tl-none'
                      }`}>
                        <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">
                          {msg.sender_role === 'admin' ? 'Suporte Noov' : ticket?.lojas?.nome}
                        </p>
                        <p className="whitespace-pre-line">{msg.message}</p>
                        <p className={`text-[10px] mt-1 opacity-70 ${msg.sender_role === 'admin' ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                  ))
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Digite sua resposta..." 
                  className="resize-none min-h-[44px] max-h-[120px]"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="shrink-0 h-[44px] w-[44px]" 
                  disabled={!replyMessage.trim() || sendMessageMutation.isPending}
                  onClick={() => sendMessageMutation.mutate()}
                >
                  {sendMessageMutation.isPending ? <Loader2 className="animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-primary" /> Tickets de Suporte
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie as solicitações de suporte dos lojistas.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button 
          variant={statusFilter === "all" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("all")}
          className="rounded-full"
        >
          Todos
        </Button>
        <Button 
          variant={statusFilter === "open" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("open")}
          className="rounded-full"
        >
          Aberto
        </Button>
        <Button 
          variant={statusFilter === "pending" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("pending")}
          className="rounded-full"
        >
          Pendente
        </Button>
        <Button 
          variant={statusFilter === "closed" ? "default" : "outline"} 
          size="sm"
          onClick={() => setStatusFilter("closed")}
          className="rounded-full"
        >
          Fechado
        </Button>
      </div>

      <div className="grid gap-4">
        {loadingTickets ? (
          <div className="py-12 text-center"><Loader2 className="animate-spin inline-block" /></div>
        ) : filteredTickets.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <TicketIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum ticket encontrado.</p>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className="hover:border-primary/30 transition-all cursor-pointer overflow-hidden group relative"
              onClick={async () => {
                setSelectedTicketId(ticket.id);
                if (!(ticket as any).admin_read_at) {
                  await supabase
                    .from("support_tickets")
                    .update({ admin_read_at: new Date().toISOString() })
                    .eq("id", ticket.id);
                  queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-tickets-pendentes-count"] });
                }
              }}

            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    ticket.status === 'closed' ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    {ticket.lojas?.logo_url ? (
                      <img src={ticket.lojas.logo_url} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <StoreIcon className={`w-6 h-6 ${
                        ticket.status === 'closed' ? 'text-muted-foreground' : 'text-primary'
                      }`} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                        COD.{String(ticket.ticket_number ?? 0).padStart(3, '0')}
                      </span>

                      <h3 className="font-bold text-base group-hover:text-primary transition-colors">
                        {ticket.subject}
                      </h3>
                      {!(ticket as any).admin_read_at && ticket.status !== 'closed' && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">
                          Nova mensagem
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {ticket.lojas?.nome || ticket.guest_name || ticket.guest_email || 'Visitante'}
                      {!ticket.store_id && <span className="ml-1 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Guest</span>}
                      {' • '}Aberto em {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-end">
                    {getStatusBadge(ticket.status)}
                    <span className="text-[10px] text-muted-foreground mt-1">
                      Última atualização: {new Date(ticket.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTicketToDelete(ticket.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o ticket e todas as suas mensagens. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => ticketToDelete && deleteTicketMutation.mutate(ticketToDelete)}
              disabled={deleteTicketMutation.isPending}
            >
              {deleteTicketMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTickets;