import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Minus, X, Clock, Bike, Search, Star, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDemoRequired } from "@/contexts/DemoContext";
import DemoBanner from "@/components/demo/DemoBanner";
import { toast } from "sonner";
import bannerHamburgueria from "@/assets/banner-hamburgueria.jpg";

interface CartItem {
  uid: string;
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem_url?: string | null;
}

const DemoClientMenu = () => {
  const navigate = useNavigate();
  const { store, products } = useDemoRequired();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const catBarRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(products.filter((p) => p.disponivel).map((p) => p.categoria).filter(Boolean))] as string[];
    return cats;
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!p.disponivel) return false;
      if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCat && p.categoria !== selectedCat) return false;
      return true;
    });
  }, [products, search, selectedCat]);

  const cartTotal = cart.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantidade, 0);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { uid: `cart-${Date.now()}`, id: product.id, nome: product.nome, preco: product.preco_promocional || product.preco, quantidade: 1, imagem_url: product.imagem_url }];
    });
    toast.success(`${product.nome} adicionado ao carrinho`);
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.uid === uid) {
        const newQty = i.quantidade + delta;
        return newQty <= 0 ? null! : { ...i, quantidade: newQty };
      }
      return i;
    }).filter(Boolean));
  };

  const removeFromCart = (uid: string) => {
    setCart((prev) => prev.filter((i) => i.uid !== uid));
  };

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />

      {/* Header/Banner */}
      <div className="relative h-48 md:h-56">
        <img src={bannerHamburgueria} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white shadow-lg flex items-center justify-center text-2xl">🍔</div>
            <div>
              <h1 className="text-xl font-bold text-white font-display">{store.nome}</h1>
              <div className="flex items-center gap-3 text-white/80 text-xs">
                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" /> 4.8</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {store.tempo_entrega_min}-{store.tempo_entrega_max} min</span>
                <span className="flex items-center gap-1"><Bike className="w-3 h-3" /> R$ {store.frete_valor_fixo?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="container max-w-3xl mx-auto px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Categories */}
      <div className="container max-w-3xl mx-auto px-4">
        <div ref={catBarRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${!selectedCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat === selectedCat ? null : cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${cat === selectedCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="container max-w-3xl mx-auto px-4 py-4 space-y-3 pb-24">
        {filtered.map((product) => (
          <motion.div
            key={product.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 p-3 bg-card rounded-xl border border-border/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => addToCart(product)}
          >
            {product.imagem_url && (
              <img src={product.imagem_url} alt={product.nome} className="w-24 h-24 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm font-display">{product.nome}</p>
                  {product.tag_destaque && <Badge className="bg-orange-100 text-orange-800 text-[10px] mb-1"><Flame className="w-2.5 h-2.5 mr-0.5" />Destaque</Badge>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{product.descricao}</p>
              <div className="flex items-center gap-2 mt-2">
                  {product.preco_promocional ? (
                    <>
                      <span className="text-xs line-through text-muted-foreground">R$ {product.preco.toFixed(2)}</span>
                      <span className="text-sm font-bold text-primary">R$ {product.preco_promocional.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-primary">R$ {product.preco.toFixed(2)}</span>
                  )}
                </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
          <Button
            className="w-full h-14 text-base font-bold shadow-elevated gap-3 rounded-xl"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="w-5 h-5" />
            Ver Carrinho ({cartCount})
            <span className="ml-auto">R$ {cartTotal.toFixed(2)}</span>
          </Button>
        </div>
      )}

      {/* Cart Sheet */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setCartOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-elevated max-h-[80vh] overflow-auto"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold font-display">Seu Pedido</h2>
                  <button onClick={() => setCartOpen(false)} className="p-1 rounded hover:bg-muted">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.uid} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                      {item.imagem_url && (
                        <img src={item.imagem_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">R$ {item.preco.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.uid, -1)} className="w-7 h-7 rounded-full bg-background border flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <motion.span key={`${item.uid}-${item.quantidade}`} initial={{ scale: 1.4, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="text-sm font-bold w-5 text-center inline-block">{item.quantidade}</motion.span>
                        <button onClick={() => updateQty(item.uid, 1)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.uid)} className="p-1 text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-4 pt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Subtotal</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span>Taxa de entrega</span>
                    <span>R$ {store.frete_valor_fixo?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>R$ {(cartTotal + (store.frete_valor_fixo || 0)).toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full mt-4 h-12 text-base font-bold"
                  onClick={() => {
                    toast.info("🎯 Essa é uma demonstração. Pedidos não são enviados.", { duration: 4000 });
                  }}
                >
                  Finalizar Pedido
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemoClientMenu;
