import { useState } from "react";
import { motion } from "framer-motion";
import { Download, MessageCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AffiliateMarketing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["affiliate-code", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("codigo_afiliado")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: banners = [], isLoading: loadingBanners } = useQuery({
    queryKey: ["affiliate-materiais-disponiveis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("materiais_afiliado")
        .select("*")
        .eq("disponivel", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const affiliateLink = profile?.codigo_afiliado
    ? `https://noov.app.br/cadastro?ref=${profile.codigo_afiliado}`
    : "";

  const handleWhatsAppShare = (banner: any) => {
    if (!affiliateLink) {
      toast({ title: "Link de afiliado não encontrado", variant: "destructive" });
      return;
    }
    const fullText = `${banner.texto_whatsapp}\n${affiliateLink}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
    window.open(url, "_blank");
  };

  const handleDownload = async (banner: any) => {
    setDownloadingId(banner.id);
    try {
      const response = await fetch(banner.imagem_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noov-banner-${banner.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Banner baixado com sucesso! ✅" });
    } catch {
      toast({ title: "Erro ao baixar banner", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const isLoading = loadingProfile || loadingBanners;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <ImageIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-extrabold font-display text-foreground">Marketing</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Baixe os banners e envie pelo WhatsApp para atrair novos lojistas com seu link de afiliado.
        </p>
      </motion.div>

      {affiliateLink && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Seu link de afiliado (incluído automaticamente)</p>
            <p className="text-sm font-semibold text-primary break-all">{affiliateLink}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {banners.map((banner: any, i: number) => (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-border/50 shadow-card overflow-hidden">
              <div className="relative aspect-square">
                {banner.imagem_url ? (
                  <img
                    src={banner.imagem_url}
                    alt={banner.titulo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <div>
                  <h3 className="text-sm font-bold font-display text-foreground leading-tight">{banner.titulo}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{banner.descricao}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white text-[11px] h-7 w-full"
                    onClick={() => handleWhatsAppShare(banner)}
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp
                  </Button>
                  {banner.imagem_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px] h-7 w-full"
                      onClick={() => handleDownload(banner)}
                      disabled={downloadingId === banner.id}
                    >
                      {downloadingId === banner.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      Baixar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {banners.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            Nenhum material disponível no momento.
          </p>
        )}
      </div>
    </div>
  );
};

export default AffiliateMarketing;
