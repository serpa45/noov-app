import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  Ticket as TicketIcon, 
  Plus, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  store_id: string;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
  ticket_number: number;
  store_read_at: string | null;
}


interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'store' | 'admin';
  message: string;
  created_at: string;
}

const SupportTickets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);


  const { data: store } = useQuery({
    queryKey: ["my-store-support", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lojas").select("id, nome").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ["support-tickets", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!store?.id,
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

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !message.trim() || !store?.id) return;
      
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          store_id: store.id,
          subject: subject.trim(),
          status: 'open'
        })
        .select()
        .single();
      
      if (ticketError) throw ticketError;

      const { error: msgError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user!.id,
          sender_role: 'store',
          message: message.trim()
        });
      
      if (msgError) throw msgError;
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setNewTicketOpen(false);
      setSubject("");
      setMessage("");
      toast.success("Ticket de suporte aberto com sucesso!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao abrir ticket de suporte.");
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!replyMessage.trim() || !selectedTicketId) return;
      
      const { error: msgError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicketId,
          sender_id: user!.id,
          sender_role: 'store',
          message: replyMessage.trim()
        });
      
      if (msgError) throw msgError;

      // Update ticket status back to open when store replies
      const { error: ticketError } = await supabase
        .from("support_tickets")
        .update({ status: 'open', admin_read_at: null })

        .eq("id", selectedTicketId);
      
      if (ticketError) throw ticketError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setReplyMessage("");
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Erro ao enviar mensagem.");
    }
  });

  useEffect(() => {
    if (!store?.id) return;
    const channel = supabase
      .channel("support-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `store_id=eq.${store.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        // Only invalidate if the message belongs to the selected ticket
        if (payload.new.ticket_id === selectedTicketId) {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicketId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, selectedTicketId, queryClient]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'closed': return <CheckCircle2 className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  if (selectedTicketId) {
    const ticket = tickets.find(t => t.id === selectedTicketId);
    return (
      <Card className="border-border/50 shadow-sm flex flex-col h-[600px]">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedTicketId(null)}>
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 flex-wrap">
                {ticket?.ticket_number != null && (
                  <span className="font-mono font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded text-sm">
                    COD.{String(ticket.ticket_number).padStart(3, '0')}
                  </span>
                )}
                <span>{ticket?.subject}</span>
                {ticket && getStatusBadge(ticket.status)}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Aberto em {new Date(ticket?.created_at || "").toLocaleDateString()}
              </p>


            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'store' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.sender_role === 'store'
                        ? 'bg-green-500/15 text-foreground border border-green-500/30 rounded-tr-none'
                        : 'bg-muted text-foreground rounded-tl-none'
                    }`}>
                      <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-70">
                        {msg.sender_role === 'admin' ? 'Suporte Noov' : store?.nome}
                      </p>
                      <p className="whitespace-pre-line">{msg.message}</p>
                      <p className={`text-[10px] mt-1 opacity-70 ${msg.sender_role === 'store' ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>

                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          {ticket?.status !== 'closed' ? (
            <div className="p-4 border-t bg-card">
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Digite sua mensagem..." 
                  className="resize-none min-h-[44px] max-h-[120px]"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessageMutation.mutate();
                    }
                  }}
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
          ) : (
            <div className="p-4 border-t bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Este ticket está fechado e não aceita novas mensagens.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <CardTitle className="text-sm font-bold">Meus Tickets de Suporte</CardTitle>
        </div>
        
        <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 rounded-full h-8">
              <Plus className="w-4 h-4" /> Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir Novo Ticket de Suporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assunto</label>
                <Input 
                  placeholder="Qual o problema/dúvida?" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mensagem Inicial</label>
                <Textarea 
                  placeholder="Descreva detalhadamente como podemos te ajudar..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTicketOpen(false)}>Cancelar</Button>
              <Button 
                disabled={!subject.trim() || !message.trim() || createTicketMutation.isPending}
                onClick={() => createTicketMutation.mutate()}
              >
                {createTicketMutation.isPending && <Loader2 className="animate-spin mr-2 w-4 h-4" />}
                Abrir Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <div className="p-3 border-b bg-muted/20">
        <Input
          placeholder="Buscar por código do ticket (ex: 021) ou assunto..."
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {loadingTickets ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin inline-block mr-2" /> Carregando tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <TicketIcon className="w-8 h-8 opacity-20" />
              <p className="text-sm">Você ainda não tem nenhum ticket de suporte aberto.</p>
            </div>
          ) : (
            tickets
              .filter((t) => {
                const q = searchCode.trim().toLowerCase().replace(/^#/, '').replace(/^0+/, '');
                if (!q) return true;
                const code = String(t.ticket_number ?? '');
                return (
                  code.includes(q) ||
                  String(t.ticket_number ?? '').padStart(3, '0').includes(searchCode.trim().replace(/^#/, '')) ||
                  t.subject.toLowerCase().includes(searchCode.trim().toLowerCase())
                );
              })
              .map((ticket) => (

              <button
                key={ticket.id}
                onClick={async () => {
                  setSelectedTicketId(ticket.id);
                  await supabase
                    .from("support_tickets")
                    .update({ store_read_at: new Date().toISOString() })
                    .eq("id", ticket.id)
                    .is("store_read_at", null);
                  queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
                  queryClient.invalidateQueries({ queryKey: ["pending-support-count"] });
                }}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center justify-between group"
              >

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    ticket.status === 'closed' ? 'bg-muted' : 'bg-primary/10'
                  }`}>
                    <TicketIcon className={`w-5 h-5 ${
                      ticket.status === 'closed' ? 'text-muted-foreground' : 'text-primary'
                    }`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-primary bg-primary/15 border border-primary/40 px-2 py-0.5 rounded text-[12px]">
                        COD.{String(ticket.ticket_number ?? 0).padStart(3, '0')}
                      </span>


                      {ticket.subject}
                      {!ticket.store_read_at && ticket.status === 'pending' && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">
                          Nova mensagem
                        </span>
                      )}
                    </h4>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                      <div className="flex items-center gap-1">
                        {getStatusIcon(ticket.status)}
                        <span className="text-[10px] font-medium capitalize">
                          {ticket.status === 'open' ? 'Aberto' : ticket.status === 'pending' ? 'Pendente' : 'Fechado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SupportTickets;