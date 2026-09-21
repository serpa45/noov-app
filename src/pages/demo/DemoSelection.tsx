import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, ShoppingCart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DemoMenuModal from "@/components/landing/DemoMenuModal";
import DemoPanelModal from "@/components/landing/DemoPanelModal";

const DemoSelection = () => {
  const navigate = useNavigate();
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);

  return (
    <>
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <div className="container pt-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="max-w-2xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-3xl md:text-4xl font-extrabold font-display text-primary-foreground mb-3">
              Escolha sua experiência
            </h1>
            <p className="text-primary-foreground/70 text-lg">
              Teste o sistema completo sem criar conta
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card
                onClick={() => setDemoPanelOpen(true)}
                className="cursor-pointer group border-2 border-transparent hover:border-primary transition-all hover:shadow-elevated bg-card"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Store className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold font-display mb-2">Lojista</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Veja o painel completo: gerencie produtos, pedidos, entregas e muito mais.
                  </p>
                  <Button className="w-full">
                    Explorar Painel <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card
                onClick={() => setDemoMenuOpen(true)}
                className="cursor-pointer group border-2 border-transparent hover:border-secondary transition-all hover:shadow-elevated bg-card"
              >
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="w-8 h-8 text-secondary" />
                  </div>
                  <h2 className="text-xl font-bold font-display mb-2">Cliente</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Navegue pelo cardápio, adicione itens ao carrinho e veja como seus clientes compram.
                  </p>
                  <Button variant="secondary" className="w-full">
                    Ver Cardápio <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    <DemoMenuModal open={demoMenuOpen} onClose={() => setDemoMenuOpen(false)} />
    <DemoPanelModal open={demoPanelOpen} onClose={() => setDemoPanelOpen(false)} />
    </>
  );
};

export default DemoSelection;
