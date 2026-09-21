import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, Star, Clock, Bike, Plus, Minus, ShoppingCart, Flame, ArrowLeft, RefreshCw, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import segmentHamburgueria from "@/assets/demo/segment-hamburgueria.jpg";
import segmentPizzaria from "@/assets/demo/segment-pizzaria.jpg";
import segmentAcaiteria from "@/assets/demo/segment-acaiteria.jpg";
import segmentLanchonete from "@/assets/demo/segment-lanchonete.jpg";
import acai300img from "@/assets/demo/acai-300ml.jpg";
import acai500img from "@/assets/demo/acai-500ml.jpg";
import acai700img from "@/assets/demo/acai-700ml.jpg";
import smoothieMorangoImg from "@/assets/demo/smoothie-morango.jpg";
import aguaCocoImg from "@/assets/demo/agua-coco.jpg";

// ── Types ──

type Segment = "hamburgueria" | "pizzaria" | "acaiteria" | "lanchonete";

interface Addon { id: string; name: string; price: number }
interface PizzaFlavor { id: string; name: string; price: number }
interface AcaiComplement { id: string; name: string }
interface PizzaSize { id: string; name: string; price: number }

interface DemoProduct {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  preco_promocional?: number | null;
  categoria: string;
  imagem_url: string;
  tag_destaque?: boolean;
  tag_novo?: boolean;
  segment: Segment;
  // Burger
  addons?: Addon[];
  // Pizza
  sizes?: PizzaSize[];
  maxFlavors?: number;
  flavors?: PizzaFlavor[];
  hasBordaRecheada?: boolean;
  bordaPrice?: number;
  // Açaí
  complements?: AcaiComplement[];
  includedComplements?: number;
}

interface CartItem {
  uid: string;
  product: DemoProduct;
  quantidade: number;
  customLabel: string;
  totalPrice: number;
}

// ── Shared data ──

const burgerAddons: Addon[] = [
  { id: "bacon", name: "Bacon extra", price: 5 },
  { id: "cheddar", name: "Queijo cheddar", price: 4 },
  { id: "egg", name: "Ovo", price: 3 },
  { id: "onion", name: "Cebola caramelizada", price: 4 },
  { id: "salad", name: "Salada extra", price: 2 },
  { id: "molho", name: "Molho especial", price: 3 },
];

const pizzaFlavors: PizzaFlavor[] = [
  { id: "cal", name: "Calabresa", price: 45 },
  { id: "marg", name: "Margherita", price: 42 },
  { id: "4q", name: "4 Queijos", price: 52 },
  { id: "frang", name: "Frango c/ Catupiry", price: 48 },
  { id: "port", name: "Portuguesa", price: 46 },
  { id: "pep", name: "Pepperoni", price: 50 },
];

const acaiComplements: AcaiComplement[] = [
  { id: "gran", name: "Granola" },
  { id: "ninho", name: "Leite Ninho" },
  { id: "morango", name: "Morango" },
  { id: "banana", name: "Banana" },
  { id: "choco", name: "Chocolate granulado" },
  { id: "pacoca", name: "Paçoca" },
  { id: "cond", name: "Leite condensado" },
  { id: "mel", name: "Mel" },
  { id: "nutella", name: "Nutella" },
  { id: "amendoim", name: "Amendoim" },
];

const lanchoneteAddons: Addon[] = [
  { id: "queijo", name: "Queijo extra", price: 3 },
  { id: "presunto", name: "Presunto extra", price: 3 },
  { id: "bacon", name: "Bacon", price: 5 },
  { id: "ovo", name: "Ovo", price: 3 },
];

// ── Segment configs ──

interface SegmentConfig {
  label: string;
  icon: string;
  image: string;
  description: string;
  storeName: string;
  emoji: string;
  deliveryTime: string;
  freight: number;
  categories: string[];
  products: DemoProduct[];
}

const SEGMENTS: Record<Segment, SegmentConfig> = {
  hamburgueria: {
    label: "Hamburgueria",
    icon: "🍔",
    image: segmentHamburgueria,
    description: "Ideal para pedidos rápidos e combos",
    storeName: "Burger House",
    emoji: "🍔",
    deliveryTime: "30-40 min",
    freight: 5.99,
    categories: ["Combos", "Hambúrgueres", "Bebidas", "Sobremesas"],
    products: [
      { id: "h1", nome: "Smash Burger Clássico", descricao: "Pão brioche, 2 smash 90g, cheddar, cebola caramelizada e molho especial", preco: 28.90, categoria: "Hambúrgueres", imagem_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop", tag_destaque: true, segment: "hamburgueria", addons: burgerAddons },
      { id: "h2", nome: "Bacon Supreme", descricao: "Pão australiano, burger 180g, bacon crocante, queijo prato e maionese da casa", preco: 34.90, preco_promocional: 29.90, categoria: "Hambúrgueres", imagem_url: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop", tag_novo: true, segment: "hamburgueria", addons: burgerAddons },
      { id: "h3", nome: "Chicken Burger", descricao: "Frango empanado crocante, coleslaw e molho ranch", preco: 26.90, categoria: "Hambúrgueres", imagem_url: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop", segment: "hamburgueria", addons: burgerAddons },
      { id: "h4", nome: "Combo Duplo", descricao: "2 Smash Burgers + Batata + 2 Refris", preco: 59.90, categoria: "Combos", imagem_url: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&h=300&fit=crop", tag_destaque: true, segment: "hamburgueria" },
      { id: "h5", nome: "Coca-Cola 350ml", descricao: "Lata gelada", preco: 6.00, categoria: "Bebidas", imagem_url: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=300&fit=crop", segment: "hamburgueria" },
      { id: "h6", nome: "Brownie com Sorvete", descricao: "Brownie quentinho com sorvete de creme", preco: 18.90, categoria: "Sobremesas", imagem_url: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop", segment: "hamburgueria" },
    ],
  },
  pizzaria: {
    label: "Pizzaria",
    icon: "🍕",
    image: segmentPizzaria,
    description: "Pizzas tradicionais e sabores especiais",
    storeName: "Pizza Nova",
    emoji: "🍕",
    deliveryTime: "40-55 min",
    freight: 7.99,
    categories: ["Pizzas", "Bebidas"],
    products: [
      { id: "p1", nome: "Pizza Grande", descricao: "Escolha até 3 sabores • Borda recheada disponível", preco: 0, categoria: "Pizzas", imagem_url: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop", tag_destaque: true, segment: "pizzaria", sizes: [{ id: "m", name: "Média (6 fatias)", price: 38 }, { id: "g", name: "Grande (8 fatias)", price: 48 }, { id: "gg", name: "Gigante (12 fatias)", price: 62 }], maxFlavors: 3, flavors: pizzaFlavors, hasBordaRecheada: true, bordaPrice: 8 },
      { id: "p2", nome: "Pizza Broto", descricao: "1 sabor • Ideal para 1 pessoa", preco: 0, categoria: "Pizzas", imagem_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop", segment: "pizzaria", sizes: [{ id: "broto", name: "Broto (4 fatias)", price: 28 }], maxFlavors: 1, flavors: pizzaFlavors, hasBordaRecheada: false },
      { id: "p3", nome: "Guaraná 1L", descricao: "Garrafa gelada", preco: 8.00, categoria: "Bebidas", imagem_url: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&h=300&fit=crop", segment: "pizzaria" },
    ],
  },
  acaiteria: {
    label: "Açaiteria",
    icon: "🥤",
    image: segmentAcaiteria,
    description: "Açaí, smoothies e bowls naturais",
    storeName: "Açaí da Serra",
    emoji: "🫐",
    deliveryTime: "20-30 min",
    freight: 4.99,
    categories: ["Açaí", "Smoothies", "Bebidas"],
    products: [
      { id: "a1", nome: "Açaí 300ml", descricao: "Açaí batido com banana • Escolha 2 complementos grátis", preco: 16.00, categoria: "Açaí", imagem_url: acai300img, segment: "acaiteria", complements: acaiComplements, includedComplements: 2 },
      { id: "a2", nome: "Açaí 500ml", descricao: "Açaí batido com banana • Escolha 3 complementos grátis", preco: 22.00, categoria: "Açaí", imagem_url: acai500img, tag_destaque: true, segment: "acaiteria", complements: acaiComplements, includedComplements: 3 },
      { id: "a3", nome: "Açaí 700ml", descricao: "Açaí batido com banana • Escolha 5 complementos grátis", preco: 28.00, categoria: "Açaí", imagem_url: acai700img, tag_novo: true, segment: "acaiteria", complements: acaiComplements, includedComplements: 5 },
      { id: "a4", nome: "Smoothie de Morango", descricao: "Morango, banana, iogurte e mel — 400ml", preco: 16.90, categoria: "Smoothies", imagem_url: smoothieMorangoImg, segment: "acaiteria" },
      { id: "a5", nome: "Água de Coco 500ml", descricao: "Natural e refrescante", preco: 7.00, categoria: "Bebidas", imagem_url: aguaCocoImg, segment: "acaiteria" },
    ],
  },
  lanchonete: {
    label: "Lanchonete",
    icon: "🥪",
    image: segmentLanchonete,
    description: "Lanches variados e porções rápidas",
    storeName: "Lanche & Cia",
    emoji: "🥪",
    deliveryTime: "25-35 min",
    freight: 4.99,
    categories: ["Lanches", "Porções", "Bebidas", "Sobremesas"],
    products: [
      { id: "l1", nome: "Misto Quente Especial", descricao: "Pão de forma, presunto, queijo derretido e orégano", preco: 12.90, categoria: "Lanches", imagem_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop", tag_destaque: true, segment: "lanchonete", addons: lanchoneteAddons },
      { id: "l2", nome: "Hot Dog Completo", descricao: "Salsicha, purê, vinagrete, batata palha e molhos", preco: 16.90, categoria: "Lanches", imagem_url: "https://images.unsplash.com/photo-1612392166886-ee8475b03af2?w=400&h=300&fit=crop", segment: "lanchonete", addons: lanchoneteAddons },
      { id: "l3", nome: "Coxinha de Frango (6un)", descricao: "Coxinhas crocantes recheadas de frango desfiado", preco: 19.90, categoria: "Porções", imagem_url: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop", tag_novo: true, segment: "lanchonete" },
      { id: "l4", nome: "Batata Frita Grande", descricao: "Porção generosa com molho especial", preco: 22.90, categoria: "Porções", imagem_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop", segment: "lanchonete" },
      { id: "l5", nome: "Suco de Laranja 500ml", descricao: "Natural, feito na hora", preco: 10.00, categoria: "Bebidas", imagem_url: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop", segment: "lanchonete" },
      { id: "l6", nome: "Pudim Caseiro", descricao: "Pudim de leite condensado cremoso", preco: 9.90, categoria: "Sobremesas", imagem_url: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400&h=300&fit=crop", segment: "lanchonete" },
    ],
  },
};

const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

// ── Component ──

interface DemoMenuModalProps {
  open: boolean;
  onClose: () => void;
}

const DemoMenuModal = ({ open, onClose }: DemoMenuModalProps) => {
  const [segment, setSegment] = useState<Segment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Product detail state
  const [productDetail, setProductDetail] = useState<DemoProduct | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [bordaRecheada, setBordaRecheada] = useState(false);
  const [selectedComplements, setSelectedComplements] = useState<string[]>([]);
  const [obs, setObs] = useState("");
  const [detailQty, setDetailQty] = useState(1);
  const [titleVisible, setTitleVisible] = useState(true);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !productDetail) return;
    const checkTitle = () => {
      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setTitleVisible(rect.bottom > containerRect.top + 160);
      }
    };
    container.addEventListener("scroll", checkTitle, { passive: true });
    checkTitle();
    return () => container.removeEventListener("scroll", checkTitle);
  }, [productDetail]);

  const config = segment ? SEGMENTS[segment] : null;

  const filtered = useMemo(() => {
    if (!config) return [];
    return config.products.filter((p) => {
      if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCat && p.categoria !== selectedCat) return false;
      return true;
    });
  }, [config, search, selectedCat]);

  const cartTotal = cart.reduce((acc, i) => acc + i.totalPrice * i.quantidade, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantidade, 0);

  // ── Price calc ──
  const calcPrice = (): number => {
    if (!productDetail) return 0;
    let price = productDetail.preco_promocional || productDetail.preco;

    if (productDetail.segment === "pizzaria" && productDetail.sizes && productDetail.flavors) {
      const size = productDetail.sizes.find((s) => s.id === selectedSize);
      if (size) {
        if (selectedFlavors.length > 0) {
          const flavorPrices = selectedFlavors.map((fid) => productDetail.flavors!.find((f) => f.id === fid)?.price ?? 0);
          const maxFlavorPrice = Math.max(...flavorPrices);
          const baseRatio = size.price / 48;
          price = maxFlavorPrice * baseRatio;
        } else {
          price = size.price;
        }
      }
      if (bordaRecheada && productDetail.bordaPrice) price += productDetail.bordaPrice;
    }

    if (productDetail.addons) {
      for (const aid of selectedAddonIds) {
        const addon = productDetail.addons.find((a) => a.id === aid);
        if (addon) price += addon.price;
      }
    }

    if (productDetail.segment === "acaiteria" && productDetail.complements) {
      const extras = Math.max(0, selectedComplements.length - (productDetail.includedComplements ?? 0));
      price += extras * 2;
    }

    return price;
  };

  const getCustomLabel = (): string => {
    if (!productDetail) return "";
    const parts: string[] = [];
    if (productDetail.segment === "pizzaria") {
      const size = productDetail.sizes?.find((s) => s.id === selectedSize);
      if (size) parts.push(size.name);
      if (selectedFlavors.length > 0) {
        parts.push(selectedFlavors.map((fid) => productDetail.flavors?.find((f) => f.id === fid)?.name ?? "").join(" / "));
      }
      if (bordaRecheada) parts.push("Borda recheada");
    }
    if (productDetail.addons && selectedAddonIds.length > 0) {
      parts.push("+" + selectedAddonIds.map((aid) => productDetail.addons?.find((a) => a.id === aid)?.name ?? "").join(", "));
    }
    if (productDetail.segment === "acaiteria" && selectedComplements.length > 0) {
      parts.push(selectedComplements.map((cid) => productDetail.complements?.find((c) => c.id === cid)?.name ?? "").join(", "));
    }
    return parts.join(" • ");
  };

  const canAdd = (): boolean => {
    if (!productDetail) return false;
    if (productDetail.segment === "pizzaria") return selectedFlavors.length > 0 && !!selectedSize;
    return true;
  };

  const toggleFlavor = (fid: string) => {
    setSelectedFlavors((prev) => {
      if (prev.includes(fid)) return prev.filter((f) => f !== fid);
      if (prev.length >= (productDetail?.maxFlavors ?? 1)) return prev;
      return [...prev, fid];
    });
  };

  const displayPrice = (item: DemoProduct) => {
    if (item.segment === "pizzaria" && item.sizes) {
      const min = Math.min(...item.sizes.map((s) => s.price));
      return formatPrice(min);
    }
    if (item.preco_promocional) return formatPrice(item.preco_promocional);
    return formatPrice(item.preco);
  };

  const openProductDetail = (p: DemoProduct) => {
    setProductDetail(p);
    setSelectedAddonIds([]);
    setSelectedSize(p.sizes?.[0]?.id ?? "");
    setSelectedFlavors([]);
    setBordaRecheada(false);
    setSelectedComplements([]);
    setObs("");
    setDetailQty(1);
  };

  const confirmProduct = () => {
    if (!productDetail || !canAdd()) return;
    const price = calcPrice();
    const label = getCustomLabel();
    const uid = `${productDetail.id}-${Date.now()}`;
    setCart((prev) => [...prev, { uid, product: productDetail, quantidade: detailQty, customLabel: label, totalPrice: price }]);
    toast.success(`${detailQty}x ${productDetail.nome} adicionado!`);
    setProductDetail(null);
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.uid !== uid) return i;
      const q = i.quantidade + delta;
      return q <= 0 ? null! : { ...i, quantidade: q };
    }).filter(Boolean));
  };

  const resetToSegments = () => {
    setSegment(null);
    setCart([]);
    setCartOpen(false);
    setSearch("");
    setSelectedCat(null);
    setProductDetail(null);
  };

  const handleClose = () => {
    resetToSegments();
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {!segment ? (
            /* ── STEP 1: Segment Selection ── */
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-2xl border border-border/50">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-extrabold font-display mb-2">👉 Escolha um modelo para visualizar</h2>
                <p className="text-sm text-muted-foreground">Veja como ficaria o cardápio do seu negócio</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(SEGMENTS) as [Segment, SegmentConfig][]).map(([key, seg]) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSegment(key); setSelectedCat(null); setSearch(""); }}
                    className="relative p-5 rounded-2xl border-2 text-left transition-all border-border hover:border-primary/40 hover:bg-primary/5 bg-card"
                  >
                    <span className="text-3xl mb-2 block">{seg.icon}</span>
                    <p className="font-semibold font-display text-foreground text-sm">{seg.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{seg.description}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* ── STEP 2: Phone Frame Menu ── */
            <div className="flex justify-center">
              <div className="w-[375px] bg-black rounded-[2.5rem] p-3 shadow-2xl border-4 border-gray-800 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />

                <div className="bg-background rounded-[2rem] overflow-hidden h-[680px] flex flex-col relative">
                  {/* Phone Header */}
                  <div className="relative shrink-0">
                    <div className="h-36 bg-gradient-to-br from-primary to-primary/80 relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute top-8 left-3 right-3 flex items-center justify-between z-10">
                        <button onClick={resetToSegments} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button onClick={resetToSegments} className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-medium">
                          <RefreshCw className="w-3 h-3" /> Trocar segmento
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl bg-white shadow flex items-center justify-center text-xl">{config!.emoji}</div>
                        <div>
                          <h3 className="text-white font-bold text-sm font-display">{config!.storeName}</h3>
                          <div className="flex items-center gap-2 text-white/80 text-[10px]">
                            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Aberto</span>
                            <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-yellow-400" /> 4.8</span>
                            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {config!.deliveryTime}</span>
                            <span className="flex items-center gap-0.5"><Bike className="w-2.5 h-2.5" /> R$ {config!.freight.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-3 py-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar no cardápio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs rounded-lg" />
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="px-3 shrink-0">
                    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                      <button onClick={() => setSelectedCat(null)} className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${!selectedCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Todos</button>
                      {config!.categories.map((cat) => (
                        <button key={cat} onClick={() => setSelectedCat(cat === selectedCat ? null : cat)} className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${cat === selectedCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{cat}</button>
                      ))}
                    </div>
                  </div>

                  {/* Products */}
                  <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-2">
                    {filtered.map((product) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-2.5 p-2.5 bg-card rounded-xl border border-border/40 shadow-sm cursor-pointer active:scale-[0.98] transition-transform"
                        onClick={() => openProductDetail(product)}
                      >
                        <img src={product.imagem_url} alt={product.nome} className="w-20 h-20 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-semibold text-xs font-display truncate">{product.nome}</p>
                              {product.tag_destaque && <Flame className="w-3 h-3 text-orange-500 shrink-0" />}
                              {product.tag_novo && <Badge className="text-[8px] px-1 py-0 h-3.5 bg-green-100 text-green-800 shrink-0">Novo</Badge>}
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{product.descricao}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1.5">
                              {product.preco_promocional ? (
                                <>
                                  <span className="text-[10px] line-through text-muted-foreground">{formatPrice(product.preco)}</span>
                                  <span className="text-xs font-bold text-primary">{formatPrice(product.preco_promocional)}</span>
                                </>
                              ) : (
                                <span className="text-xs font-bold text-primary">{displayPrice(product)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Cart FAB */}
                  {cartCount > 0 && (
                    <div className="absolute bottom-3 left-3 right-3 z-30">
                      <button onClick={() => setCartOpen(true)} className="w-full h-11 bg-primary text-primary-foreground rounded-xl flex items-center justify-between px-4 font-bold text-sm shadow-lg active:scale-[0.97] transition-transform">
                        <span className="flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Ver Carrinho ({cartCount})</span>
                        <span>{formatPrice(cartTotal)}</span>
                      </button>
                    </div>
                  )}

                  {/* ── Product Detail ── */}
                  <AnimatePresence>
                    {productDetail && (
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="absolute inset-0 bg-background z-40 flex flex-col overflow-y-auto"
                        ref={scrollContainerRef}
                      >
                        {/* Sticky image */}
                        <div className="sticky top-0 z-10 shrink-0">
                          <div className="relative h-48">
                            <img src={productDetail.imagem_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <button onClick={() => setProductDetail(null)} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center z-20">
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            {/* Title appears on image when scrolled */}
                            <AnimatePresence>
                              {!titleVisible && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 8 }}
                                  className="absolute bottom-2 left-3 right-3"
                                >
                                  <p className="text-white font-bold text-sm font-display drop-shadow-lg truncate">{productDetail.nome}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1">
                          <div className="p-4">
                            <h3 ref={titleRef} className="font-bold text-base font-display">{productDetail.nome}</h3>
                          <p className="text-xs text-muted-foreground mt-1">{productDetail.descricao}</p>
                          {productDetail.preco > 0 && (
                            <div className="mt-2">
                              {productDetail.preco_promocional ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm line-through text-muted-foreground">{formatPrice(productDetail.preco)}</span>
                                  <span className="text-lg font-bold text-primary">{formatPrice(productDetail.preco_promocional)}</span>
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-primary">{formatPrice(productDetail.preco)}</span>
                              )}
                            </div>
                          )}

                          {/* ── PIZZA: Size + Flavors + Borda ── */}
                          {productDetail.segment === "pizzaria" && (
                            <div className="mt-4 space-y-4">
                              {productDetail.sizes && (
                                <div>
                                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                                    📏 Tamanho <Badge variant="outline" className="text-[8px] border-destructive/30 text-destructive">Obrigatório</Badge>
                                  </p>
                                  <div className="space-y-1.5">
                                    {productDetail.sizes.map((size) => (
                                      <button
                                        key={size.id}
                                        onClick={() => setSelectedSize(size.id)}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all text-xs ${selectedSize === size.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedSize === size.id ? "border-primary" : "border-muted-foreground/30"}`}>
                                            {selectedSize === size.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                          </div>
                                          <span className="font-medium">{size.name}</span>
                                        </div>
                                        <span className="font-semibold text-primary">{formatPrice(size.price)}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {productDetail.flavors && (
                                <div>
                                  <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                                    🍕 Até {productDetail.maxFlavors} sabor{(productDetail.maxFlavors ?? 1) > 1 ? "es" : ""}
                                    <Badge variant="outline" className="text-[8px] border-destructive/30 text-destructive">Obrigatório</Badge>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mb-2">⚡ Valor cobrado é do sabor mais caro</p>
                                  <div className="space-y-1.5">
                                    {productDetail.flavors.map((flavor) => {
                                      const isSel = selectedFlavors.includes(flavor.id);
                                      const isDis = !isSel && selectedFlavors.length >= (productDetail.maxFlavors ?? 1);
                                      return (
                                        <button
                                          key={flavor.id}
                                          onClick={() => !isDis && toggleFlavor(flavor.id)}
                                          disabled={isDis}
                                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all text-xs ${isSel ? "border-primary bg-primary/5" : isDis ? "border-border opacity-40" : "border-border hover:border-primary/30"}`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                              {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                            </div>
                                            <span>{flavor.name}</span>
                                          </div>
                                          <span className="text-muted-foreground">{formatPrice(flavor.price)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {productDetail.hasBordaRecheada && (
                                <button
                                  onClick={() => setBordaRecheada(!bordaRecheada)}
                                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all text-xs ${bordaRecheada ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${bordaRecheada ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                      {bordaRecheada && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                    </div>
                                    <span className="font-medium">🧀 Borda recheada</span>
                                  </div>
                                  <span className="text-primary font-semibold">+{formatPrice(productDetail.bordaPrice ?? 0)}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* ── BURGER / LANCHONETE: Addons ── */}
                          {productDetail.addons && productDetail.addons.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                                {productDetail.segment === "hamburgueria" ? "🍔" : "🥪"} Adicionais
                                <Badge variant="outline" className="text-[8px] border-muted-foreground/30 text-muted-foreground">Opcional</Badge>
                              </p>
                              <div className="space-y-1.5">
                                {productDetail.addons.map((addon) => {
                                  const isSel = selectedAddonIds.includes(addon.id);
                                  return (
                                    <button
                                      key={addon.id}
                                      onClick={() => setSelectedAddonIds((prev) => isSel ? prev.filter((a) => a !== addon.id) : [...prev, addon.id])}
                                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all text-xs ${isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                          {isSel && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                        </div>
                                        <span>{addon.name}</span>
                                      </div>
                                      <span className="text-primary font-semibold">+{formatPrice(addon.price)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── AÇAÍ: Complements ── */}
                          {productDetail.segment === "acaiteria" && productDetail.complements && (
                            <div className="mt-4">
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                                🍧 Complementos
                                <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-600">{productDetail.includedComplements} grátis</Badge>
                              </p>
                              <p className="text-[10px] text-muted-foreground mb-2">
                                {selectedComplements.length} de {productDetail.includedComplements} grátis
                                {selectedComplements.length > (productDetail.includedComplements ?? 0) && (
                                  <span className="text-primary font-semibold"> • +{formatPrice((selectedComplements.length - (productDetail.includedComplements ?? 0)) * 2)} extra</span>
                                )}
                              </p>
                              <div className="grid grid-cols-2 gap-1.5">
                                {productDetail.complements.map((comp) => {
                                  const isSel = selectedComplements.includes(comp.id);
                                  const freeRemaining = (productDetail.includedComplements ?? 0) - selectedComplements.filter((c) => c !== comp.id).length;
                                  const wouldBeFree = !isSel && freeRemaining > 0;
                                  return (
                                    <button
                                      key={comp.id}
                                      onClick={() => setSelectedComplements((prev) => isSel ? prev.filter((c) => c !== comp.id) : [...prev, comp.id])}
                                      className={`flex items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-left text-xs ${isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                                    >
                                      <div className={`w-3.5 h-3.5 rounded shrink-0 border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                                        {isSel && <Check className="w-2 h-2 text-primary-foreground" />}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="block truncate">{comp.name}</span>
                                        {!wouldBeFree && !isSel && <span className="text-[9px] text-primary">+R$ 2,00</span>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Observation */}
                          <div className="mt-4">
                            <label className="text-xs font-medium">Observações</label>
                            <textarea
                              value={obs}
                              onChange={(e) => setObs(e.target.value)}
                              placeholder="Ex: sem cebola, ponto da carne..."
                              className="w-full h-14 text-xs p-2.5 mt-1 rounded-lg border border-border/50 bg-muted/30 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          </div>
                        </div>

                        {/* Add Button - fixed at bottom */}
                        <div className="p-4 border-t shrink-0 bg-background/80 backdrop-blur-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Total do item</span>
                            <span className="text-lg font-bold">{formatPrice(calcPrice() * detailQty)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                                className="w-9 h-9 rounded-full border-2 border-muted-foreground/30 bg-background flex items-center justify-center active:scale-90 transition-transform"
                              >
                                <Minus className="w-4 h-4 text-muted-foreground" />
                              </button>
                              <motion.span key={detailQty} initial={{ scale: 1.4, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="text-base font-bold w-6 text-center inline-block">{detailQty}</motion.span>
                              <button
                                onClick={() => setDetailQty((q) => q + 1)}
                                className="w-9 h-9 rounded-full border-2 border-primary bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <button
                              onClick={confirmProduct}
                              disabled={!canAdd()}
                              className="flex-1 max-w-[200px] h-11 bg-primary text-primary-foreground rounded-full font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Adicionar
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Cart Sheet ── */}
                  <AnimatePresence>
                    {cartOpen && (
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="absolute inset-0 bg-background z-40 flex flex-col"
                      >
                        <div className="flex items-center justify-between p-4 border-b shrink-0">
                          <h3 className="font-bold text-sm font-display">Seu Pedido</h3>
                          <button onClick={() => setCartOpen(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                          {cart.map((item) => (
                            <div key={item.uid} className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-lg">
                              <img src={item.product.imagem_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{item.product.nome}</p>
                                {item.customLabel && <p className="text-[9px] text-muted-foreground line-clamp-2">{item.customLabel}</p>}
                                <p className="text-[10px] text-primary font-bold">{formatPrice(item.totalPrice)}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => updateQty(item.uid, -1)} className="w-6 h-6 rounded-full border bg-background flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                <span className="text-xs font-bold w-4 text-center">{item.quantidade}</span>
                                <button onClick={() => updateQty(item.uid, 1)} className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-4 border-t shrink-0 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>{formatPrice(cartTotal)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Taxa de entrega</span>
                            <span>R$ {config!.freight.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-sm pt-1 border-t">
                            <span>Total</span>
                            <span>{formatPrice(cartTotal + config!.freight)}</span>
                          </div>
                          <button
                            onClick={() => toast.info("🎯 Modo demonstração — esta função não está disponível", { duration: 3000 })}
                            className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-bold text-sm mt-2 active:scale-[0.97] transition-transform"
                          >
                            Finalizar Pedido
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoMenuModal;