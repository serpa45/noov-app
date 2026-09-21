import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, ArrowLeft, MessageSquare, Loader2, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterType = "dia" | "mes" | "ano" | "todos";

export default function Reviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<FilterType>("todos");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: allReviews = [], isLoading } = useQuery({
    queryKey: ["all-reviews", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, avaliacao, avaliacao_comentario, cliente_nome, created_at, numero_diario")
        .eq("lojista_id", user!.id)
        .not("avaliacao", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Filter reviews based on selected filter
  const reviews = allReviews.filter((r: any) => {
    if (filterType === "todos") return true;
    const reviewDate = new Date(r.created_at);
    if (filterType === "dia") {
      return reviewDate >= startOfDay(selectedDate) && reviewDate <= endOfDay(selectedDate);
    }
    if (filterType === "mes") {
      return reviewDate >= startOfMonth(selectedDate) && reviewDate <= endOfMonth(selectedDate);
    }
    if (filterType === "ano") {
      return reviewDate >= startOfYear(selectedDate) && reviewDate <= endOfYear(selectedDate);
    }
    return true;
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r: any) => sum + r.avaliacao, 0) / reviews.length
    : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter((r: any) => r.avaliacao === star).length,
    pct: reviews.length > 0
      ? (reviews.filter((r: any) => r.avaliacao === star).length / reviews.length) * 100
      : 0,
  }));

  const filterLabel = () => {
    if (filterType === "todos") return "Todos";
    if (filterType === "dia") return format(selectedDate, "dd/MM/yyyy");
    if (filterType === "mes") return format(selectedDate, "MMMM yyyy", { locale: ptBR });
    if (filterType === "ano") return format(selectedDate, "yyyy");
    return "";
  };

  // Generate month options
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(selectedDate.getFullYear(), i, 1);
    return { value: i, label: format(d, "MMMM", { locale: ptBR }) };
  });

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold font-display text-foreground">Avaliações</h1>
          <p className="text-sm text-muted-foreground">{reviews.length} avaliações — {filterLabel()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", "dia", "mes", "ano"] as FilterType[]).map((f) => (
          <Button
            key={f}
            variant={filterType === f ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs capitalize"
            onClick={() => setFilterType(f)}
          >
            {f === "todos" ? "Todos" : f === "dia" ? "Por dia" : f === "mes" ? "Por mês" : "Por ano"}
          </Button>
        ))}

        {filterType === "dia" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}

        {filterType === "mes" && (
          <div className="flex items-center gap-2">
            <Select
              value={String(selectedDate.getMonth())}
              onValueChange={(v) => {
                const d = new Date(selectedDate);
                d.setMonth(Number(v));
                setSelectedDate(d);
              }}
            >
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={String(m.value)} className="capitalize">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedDate.getFullYear())}
              onValueChange={(v) => {
                const d = new Date(selectedDate);
                d.setFullYear(Number(v));
                setSelectedDate(d);
              }}
            >
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {filterType === "ano" && (
          <Select
            value={String(selectedDate.getFullYear())}
            onValueChange={(v) => {
              const d = new Date(selectedDate);
              d.setFullYear(Number(v));
              setSelectedDate(d);
            }}
          >
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {filterType === "todos" ? "Nenhuma avaliação recebida ainda" : "Nenhuma avaliação neste período"}
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="text-center">
                  <p className="text-5xl font-bold font-display text-foreground">{avgRating.toFixed(1)}</p>
                  <div className="flex items-center gap-0.5 mt-1 justify-center">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-5 h-5 ${s <= Math.round(avgRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{reviews.length} avaliações</p>
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  {ratingCounts.map(rc => (
                    <div key={rc.star} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-4 text-right">{rc.star}</span>
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${rc.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{rc.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviews list */}
          <div className="space-y-3">
            {reviews.map((review: any, i: number) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-4 h-4 ${s <= review.avaliacao ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Nº {review.numero_diario ? String(review.numero_diario).padStart(3, "0") : review.id.slice(0, 6)}
                          </Badge>
                        </div>
                        {review.avaliacao_comentario && (
                          <p className="text-sm text-foreground mt-1">"{review.avaliacao_comentario}"</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">{review.cliente_nome || "Cliente"}</span>
                          <span>·</span>
                          <span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
