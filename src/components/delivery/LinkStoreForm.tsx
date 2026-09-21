import { useState } from "react";
import { Store, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LinkStoreFormProps {
  onLinked: () => void;
}

const LinkStoreForm = ({ onLinked }: LinkStoreFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);

    try {
      // Find store by invite code
      const { data: loja, error: lojaError } = await (supabase as any)
        .from("lojas")
        .select("id, nome")
        .eq("codigo_convite", code.trim().toLowerCase())
        .single();

      if (lojaError || !loja) {
        toast({ title: "Código inválido", description: "Nenhuma loja encontrada com esse código.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Link entregador to store
      const { error: linkError } = await (supabase as any)
        .from("loja_entregadores")
        .insert({ loja_id: loja.id, entregador_id: user.id });

      if (linkError) {
        if (linkError.code === "23505") {
          toast({ title: "Já vinculado", description: `Você já está vinculado a ${loja.nome}.` });
        } else {
          throw linkError;
        }
      } else {
        toast({ title: "Vinculado! 🎉", description: `Você foi vinculado à loja ${loja.nome}.` });
      }

      onLinked();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/50 shadow-elevated">
        <CardContent className="p-6 space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">Vincular à loja</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Digite o código de convite da loja para começar a receber entregas.
            </p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Ex: a1b2c3"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={10}
              className="text-center text-lg tracking-widest uppercase"
            />
            <Button
              onClick={handleLink}
              disabled={!code.trim() || loading}
              className="w-full bg-gradient-cta border-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Vincular
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkStoreForm;
