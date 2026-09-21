import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Eye, EyeOff } from "lucide-react";

interface EditLojistaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loja: any;
  profile: any;
}

export const EditLojistaSheet = ({
  open,
  onOpenChange,
  loja,
  profile,
}: EditLojistaSheetProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome_loja: "",
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    if (loja && profile) {
      setFormData({
        nome_loja: loja.nome || "",
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        password: "",
      });
    }
  }, [loja, profile, open]);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^\w\s-]/g, "") // Remove non-word chars
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/--+/g, "-") // Replace multiple - with single -
      .trim();
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setLoading(true);
      try {
        // 1. Update Store Name and Slug
        if (data.nome_loja !== loja.nome) {
          const newSlug = generateSlug(data.nome_loja);
          const { error: storeError } = await supabase
            .from("lojas")
            .update({ 
              nome: data.nome_loja,
              slug: newSlug
            })
            .eq("id", loja.id);
          if (storeError) throw storeError;
        }


        // 2. Update Profile
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: data.full_name,
            phone: data.phone,
            email: data.email,
          })
          .eq("user_id", loja.user_id);
        if (profileError) throw profileError;

        // 3. Update Auth User (Email and/or Password)
        // We always try to update email if it changed, even if password is blank
        if (data.email !== profile.email || data.password) {
          const updateData: any = {};
          if (data.email !== profile.email) updateData.email = data.email;
          if (data.password) updateData.password = data.password;

          // Using an edge function would be safer for admin updates, but if we don't have one,
          // auth.updateUser() works for the CURRENTLY logged in user.
          // Since this is an admin editing ANOTHER user, we typically need a service_role function.
          // However, the previous code was attempting to call "admin-update-user".
          // If it doesn't exist, we should inform about it or use an alternative if available.
          
          const { error: authError } = await supabase.functions.invoke("admin-update-user", {
            body: { 
              userId: loja.user_id,
              ...updateData
            }
          });
          
          // If the function doesn't exist, we might get a 404 or similar error
          if (authError) {
            console.error("Auth update error:", authError);
            // If it's a critical change (password/email), we should probably fail if the auth doesn't update
            throw new Error("Não foi possível atualizar os dados de acesso (E-mail/Senha). Verifique se a função administrativa está configurada.");
          }
        }

      } finally {
        setLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-loja-detail", loja.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-loja-profile", loja.user_id] });
      toast.success("Dados do lojista atualizados com sucesso");
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error updating lojista:", error);
      toast.error("Erro ao atualizar dados: " + (error.message || "Erro desconhecido"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Dados do Lojista</SheetTitle>
          <SheetDescription>
            Altere as informações cadastrais da loja e do responsável.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome_loja">Nome da Loja</Label>
              <Input
                id="nome_loja"
                value={formData.nome_loja}
                onChange={(e) => setFormData({ ...formData, nome_loja: e.target.value })}
                placeholder="Ex: Pizzaria do João"
                required
              />
              {formData.nome_loja && (
                <p className="text-xs text-muted-foreground">
                  Link da loja: <span className="font-medium">/{generateSlug(formData.nome_loja)}</span>
                </p>
              )}
            </div>


            <div className="space-y-2">
              <Label htmlFor="full_name">Nome do Responsável</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail de Acesso</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="password">Nova Senha (deixe em branco para não alterar)</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};
