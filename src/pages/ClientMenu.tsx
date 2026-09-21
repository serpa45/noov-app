import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, ShoppingCart, X, ChevronRight, Star, Check, LogIn, Loader2, Scale, Banknote, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AppDownloadPopup } from "@/components/AppDownloadPopup";

// ── Data types ──
type Segment = "hamburgueria" | "pizzaria" | "acaiteria" | "lanchonete";

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface PizzaFlavor {
  id: string;
  name: string;
  price: number;
}

interface AcaiComplement {
  id: string;
  name: string;
  included: number; // how many free
}

interface MenuItem {
  id: any;
  name: string;
  desc: string;
  price: number;
  category: string;
  emoji: string;
  rating: number;
  segment: Segment;
  unidade_medida?: string;
  is_featured?: boolean;
  // Segment-specific
  addons?: Addon[];
  sizes?: { id: string; name: string; price: number }[];
  maxFlavors?: number;
  flavors?: PizzaFlavor[];
  bordas?: { id: string; nome: string; preco: number }[];
  maxSaboresBorda?: number;
  complements?: AcaiComplement[];
  includedComplements?: number;
  sabores?: { nome: string; valorExtra: number; disponivel?: boolean }[];
  disponivel?: boolean;
}


// ── Mock data ──
const pizzaFlavors: PizzaFlavor[] = [
  { id: "cal", name: "Calabresa", price: 45 },
  { id: "marg", name: "Margherita", price: 42 },
  { id: "4q", name: "4 Queijos", price: 52 },
  { id: "frang", name: "Frango c/ Catupiry", price: 48 },
  { id: "port", name: "Portuguesa", price: 46 },
  { id: "pep", name: "Pepperoni", price: 50 },
];

const burgerAddons: Addon[] = [
  { id: "bacon", name: "Bacon extra", price: 5 },
  { id: "cheddar", name: "Queijo cheddar", price: 4 },
  { id: "egg", name: "Ovo", price: 3 },
  { id: "onion", name: "Cebola caramelizada", price: 4 },
  { id: "salad", name: "Salada extra", price: 2 },
  { id: "molho", name: "Molho especial", price: 3 },
];

const acaiComplements: AcaiComplement[] = [
  { id: "gran", name: "Granola", included: 1 },
  { id: "ninho", name: "Leite Ninho", included: 1 },
  { id: "morango", name: "Morango", included: 1 },
  { id: "banana", name: "Banana", included: 1 },
  { id: "choco", name: "Chocolate granulado", included: 1 },
  { id: "pacocaC", name: "Paçoca", included: 1 },
  { id: "cond", name: "Leite condensado", included: 1 },
  { id: "mel", name: "Mel", included: 1 },
];

const categories = ["Todos", "Hambúrgueres", "Pizzas", "Açaí", "Acompanhamentos", "Bebidas", "Combos"];

const menuItems: MenuItem[] = [
  {
    id: 1, name: "X-Bacon Especial", desc: "Pão, hambúrguer 180g, bacon crocante, queijo, alface, tomate",
    price: 32.9, category: "Hambúrgueres", emoji: "🍔", rating: 4.8, segment: "hamburgueria",
    addons: burgerAddons, is_featured: true,
  },
  {
    id: 2, name: "X-Salada Premium", desc: "Pão, hambúrguer 180g, queijo, alface, tomate, cebola",
    price: 28.9, category: "Hambúrgueres", emoji: "🍔", rating: 4.6, segment: "hamburgueria",
    addons: burgerAddons,
  },
  {
    id: 10, name: "Smash Duplo", desc: "2 carnes smash 90g, cheddar, pickles, molho especial",
    price: 36.9, category: "Hambúrgueres", emoji: "🍔", rating: 4.9, segment: "hamburgueria",
    addons: burgerAddons,
  },
  {
    id: 3, name: "Pizza Grande", desc: "Escolha até 2 sabores • Borda recheada disponível",
    price: 0, category: "Pizzas", emoji: "🍕", rating: 4.9, segment: "pizzaria", is_featured: true,
    sizes: [
      { id: "m", name: "Média (6 fatias)", price: 38 },
      { id: "g", name: "Grande (8 fatias)", price: 48 },
      { id: "gg", name: "Gigante (12 fatias)", price: 62 },
    ],
    maxFlavors: 2, flavors: pizzaFlavors,
    bordas: [
      { id: "cheddar", nome: "Cheddar", preco: 8 },
      { id: "catupiry", nome: "Catupiry", preco: 8 },
      { id: "chocolate", nome: "Chocolate", preco: 10 },
    ],
    maxSaboresBorda: 1,
  },
  {
    id: 4, name: "Pizza Broto", desc: "1 sabor • Ideal para 1 pessoa",
    price: 0, category: "Pizzas", emoji: "🍕", rating: 4.7, segment: "pizzaria",
    sizes: [{ id: "broto", name: "Broto (4 fatias)", price: 28 }],
    maxFlavors: 1, flavors: pizzaFlavors,
    bordas: [
      { id: "cheddar", nome: "Cheddar", preco: 8 },
      { id: "catupiry", nome: "Catupiry", preco: 8 },
    ],
    maxSaboresBorda: 1,
  },
  {
    id: 5, name: "Açaí 500ml", desc: "Açaí batido com banana • Escolha 3 complementos grátis",
    price: 22.0, category: "Açaí", emoji: "🍧", rating: 4.8, segment: "acaiteria",
    complements: acaiComplements, includedComplements: 3,
  },
  {
    id: 6, name: "Açaí 700ml", desc: "Açaí batido com banana • Escolha 5 complementos grátis",
    price: 28.0, category: "Açaí", emoji: "🍧", rating: 4.9, segment: "acaiteria",
    complements: acaiComplements, includedComplements: 5,
  },
  {
    id: 11, name: "Açaí 300ml", desc: "Açaí batido com banana • Escolha 2 complementos grátis",
    price: 16.0, category: "Açaí", emoji: "🍧", rating: 4.6, segment: "acaiteria",
    complements: acaiComplements, includedComplements: 2,
  },
  {
    id: 7, name: "Batata Frita G", desc: "Batata frita crocante com cheddar e bacon",
    price: 18.0, category: "Acompanhamentos", emoji: "🍟", rating: 4.5, segment: "lanchonete",
  },
  {
    id: 8, name: "Refrigerante Lata", desc: "Coca, Guaraná, Fanta",
    price: 7.0, category: "Bebidas", emoji: "🥤", rating: 4.3, segment: "lanchonete",
  },
  {
    id: 9, name: "Combo Família", desc: "4x X-Bacon + 2x Batata G + 4x Refri",
    price: 89.9, category: "Combos", emoji: "🍱", rating: 4.9, segment: "lanchonete",
  },
  {
    id: 12, name: "Açaí por Peso (Montar)", desc: "Monte do seu jeito! R$ 50,00 por quilo.",
    price: 50.0, category: "Açaí", emoji: "🍧", rating: 4.9, segment: "acaiteria",
    unidade_medida: "kg", complements: acaiComplements, includedComplements: 0,
  },
];

// ── Cart types ──
interface CartItem {
  uid: string; // unique per customization
  id: any;
  name: string;
  price: number;
  qty: number;
  emoji: string;
  customLabel?: string;
  weight?: string;
  weightMode?: "weight" | "value";
}

// ── Helpers ──
const formatPrice = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const ClientMenu = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [activePizzaSize, setActivePizzaSize] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<MenuItem[]>([]);
  // Derived: categories ordered with fully sold-out categories last
  const categoriesList = useMemo(() => {
    const uniqueCats = Array.from(new Set(products.map(p => p.category)));
    const available: string[] = [];
    const soldOut: string[] = [];
    for (const cat of uniqueCats) {
      const items = products.filter(p => p.category === cat);
      const allSoldOut = items.length > 0 && items.every(p => p.disponivel === false);
      if (allSoldOut) soldOut.push(cat); else available.push(cat);
    }
    return ["Todos", ...available, ...soldOut];
  }, [products]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryStyles, setCategoryStyles] = useState<Record<string, "lista" | "horizontal" | "grid2">>({});

  // Customization state
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedBordas, setSelectedBordas] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedComplements, setSelectedComplements] = useState<string[]>([]);
  const [weightMode, setWeightMode] = useState<"weight" | "value">("weight");
  const [weightInput, setWeightInput] = useState<string>("");
  const [observation, setObservation] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");

  // Force status bar color to match header gradient (like /comanda)
  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = themeMeta?.getAttribute('content');
    if (themeMeta) themeMeta.setAttribute('content', '#1a75ff');

    const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const prevStatusBar = statusBarMeta?.getAttribute('content');
    if (statusBarMeta) statusBarMeta.setAttribute('content', 'black-translucent');

    return () => {
      if (themeMeta && prevTheme) themeMeta.setAttribute('content', prevTheme);
      if (statusBarMeta && prevStatusBar) statusBarMeta.setAttribute('content', prevStatusBar);
    };
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from("produtos")
          .select("*")
          .order('nome');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const mapped: MenuItem[] = data.map(p => ({
            id: p.id,
            name: p.nome,
            desc: p.descricao || "",
            price: Number(p.preco),
            category: p.categoria || "Geral",
            emoji: p.imagem_url || "🍽️",
            rating: 4.8,
            segment: (p.categoria?.toLowerCase().includes("pizza") ? "pizzaria" :
                     p.categoria?.toLowerCase().includes("açaí") ? "acaiteria" : "hamburgueria") as Segment,
            unidade_medida: p.unidade_medida || undefined,
            is_featured: p.tag_destaque || false,
            addons: (p.adicionais as any) || [],
            sizes: (p.tamanhos as any) || [],
            sabores: (p.sabores as any) || [],
            disponivel: (p as any).disponivel !== false,
          }));

          setProducts(mapped);
        } else {
          setProducts(menuItems);
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        setProducts(menuItems);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();

    const fetchStyles = async () => {
      // Find the current store by slug from URL
      const path = window.location.pathname;
      const slugMatch = path.match(/\/([^/]+)$/);
      const slug = slugMatch ? slugMatch[1] : null;

      if (slug) {
        const { data } = await supabase
          .from("lojas")
          .select("categorias_estilo")
          .eq("slug", slug)
          .maybeSingle();
        
        if (data?.categorias_estilo && typeof data.categorias_estilo === "object" && !Array.isArray(data.categorias_estilo)) {
          setCategoryStyles(data.categorias_estilo as Record<string, "lista" | "horizontal" | "grid2">);
        }
      }
    };
    fetchStyles();


    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'produtos' },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = products.filter(
    (item) =>
      (activeCategory === "Todos" || item.category === activeCategory) &&
      item.name.toLowerCase().includes(search.toLowerCase()) &&
      (activeCategory !== "Pizzas" || !activePizzaSize || item.sizes?.some(s => s.name === activePizzaSize))
  );

  const pizzaSizes = activeCategory === "Pizzas" 
    ? [...new Set(products.filter(p => p.category === "Pizzas").flatMap(p => p.sizes?.map(s => s.name) || []))]
    : [];

  const openItem = (item: MenuItem) => {
    setSelectedItem(item);
    
    // For pizzas, if a size filter is active, pre-select that size
    if (item.category === "Pizzas" && activePizzaSize) {
      const sizeMatch = item.sizes?.find(s => s.name === activePizzaSize);
      setSelectedSize(sizeMatch?.id ?? item.sizes?.[0]?.id ?? "");
    } else {
      setSelectedSize(item.sizes?.[0]?.id ?? "");
    }
    
    setSelectedFlavors([]);
    setSelectedBordas([]);
    setSelectedAddons([]);
    setSelectedComplements([]);
    setWeightMode("weight");
    setWeightInput("");
    setObservation("");
  };

  // Calculate price for current selection
  const calcPrice = (): number => {
    if (!selectedItem) return 0;
    let price = selectedItem.price;

    if (selectedItem.unidade_medida === "kg") {
      const val = Number(weightInput) || 0;
      if (weightMode === "value") {
        return val;
      } else {
        return (val / 1000) * price;
      }
    }
    if (selectedItem.category === "Caldos" && selectedItem.sabores) {
      const selected = selectedFlavors[0];
      if (selected) {
        const flavor = selectedItem.sabores.find(s => s.nome === selected);
        if (flavor) price += Number(flavor.valorExtra);
      }
    }

    if (selectedItem.segment === "pizzaria" && selectedItem.sizes && selectedItem.flavors) {
      const size = selectedItem.sizes.find((s) => s.id === selectedSize);

      if (size) {
        if (selectedFlavors.length > 0) {
          const flavorPrices = selectedFlavors.map(
            (fid) => selectedItem.flavors!.find((f) => f.id === fid)?.price ?? 0
          );
          const maxFlavorPrice = Math.max(...flavorPrices);
          const baseRatio = size.price / 48;
          price = maxFlavorPrice * baseRatio;
        } else {
          price = size.price;
        }
      }
      if (selectedItem.bordas && selectedBordas.length > 0) {
        for (const bid of selectedBordas) {
          const borda = selectedItem.bordas.find((b) => b.id === bid);
          if (borda) price += borda.preco;
        }
      }
    }

    if (selectedItem.segment === "hamburgueria" && selectedItem.addons) {
      for (const addonId of selectedAddons) {
        const addon = selectedItem.addons.find((a) => a.id === addonId);
        if (addon) price += addon.price;
      }
    }

    if (selectedItem.segment === "acaiteria" && selectedItem.complements) {
      const extras = Math.max(0, selectedComplements.length - (selectedItem.includedComplements ?? 0));
      price += extras * 2;
    }

    return price;
  };

  const getCustomLabel = (): string => {
    if (!selectedItem) return "";
    const parts: string[] = [];

    if (selectedItem.category === "Caldos" && selectedFlavors.length > 0) {
      parts.push(`Sabor: ${selectedFlavors[0]}`);
    }


    if (selectedItem.unidade_medida === "kg") {
      const val = Number(weightInput) || 0;
      if (weightMode === "value") {
        const grams = ((val / selectedItem.price) * 1000).toFixed(0);
        parts.push(`Por Valor: ${formatPrice(val)} (${grams}g)`);
      } else {
        parts.push(`Por Grama: ${val}g`);
      }
    }

















    if (selectedItem.segment === "pizzaria") {
      const size = selectedItem.sizes?.find((s) => s.id === selectedSize);
      if (size) parts.push(size.name);
      if (selectedFlavors.length > 0) {
        const names = selectedFlavors.map((fid) => selectedItem.flavors?.find((f) => f.id === fid)?.name ?? "");
        parts.push(names.join(" / "));
      }
      if (selectedBordas.length > 0) {
        const bordaNames = selectedBordas.map((bid) => selectedItem.bordas?.find((b) => b.id === bid)?.nome ?? "").filter(Boolean);
        parts.push("Borda: " + bordaNames.join(", "));
      }
    }
    if (selectedItem.segment === "hamburgueria" && selectedAddons.length > 0) {
      const names = selectedAddons.map((aid) => selectedItem.addons?.find((a) => a.id === aid)?.name ?? "");
      parts.push("+" + names.join(", "));
    }
    if (selectedItem.segment === "acaiteria" && selectedComplements.length > 0) {
      const names = selectedComplements.map((cid) => selectedItem.complements?.find((c) => c.id === cid)?.name ?? "");
      parts.push(names.join(", "));
    }
    return parts.join(" • ");
  };

  const addToCart = () => {
    if (!selectedItem) return;
    const price = calcPrice();
    const uid = `${selectedItem.id}-${Date.now()}`;
    
    let weightValue = "";
    if (selectedItem.unidade_medida === "kg") {
      if (weightMode === "weight") {
        weightValue = weightInput;
      } else {
        const val = Number(weightInput) || 0;
        weightValue = ((val / selectedItem.price) * 1000).toFixed(0);
      }
    }

    setCart((prev) => [
      ...prev,
      {
        uid,
        id: selectedItem.id,
        name: selectedItem.name,
        price,
        qty: 1,
        emoji: selectedItem.emoji,
        customLabel: getCustomLabel(),
        weight: weightValue || undefined,
        weightMode: selectedItem.unidade_medida === "kg" ? weightMode : undefined,
      },
    ]);
    setSelectedItem(null);
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.uid === uid ? { ...c, qty: Math.max(0, c.qty + delta) } : c)).filter((c) => c.qty > 0)
    );
  };

  const total = cart.reduce((acc, c) => acc + c.price * c.qty, 0);
  const totalItems = cart.reduce((acc, c) => acc + c.qty, 0);

  const handleCheckout = async () => {
    if (!clientName || !clientPhone || !clientAddress) {
      toast({ title: "Ops!", description: "Preencha seus dados para finalizar o pedido", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // For demo purposes, we'll use the first store ID we find or a fallback
      const { data: stores } = await supabase.from("lojas").select("id, user_id").limit(1);
      const loja = stores?.[0];

      if (!loja) throw new Error("Nenhuma loja encontrada para receber o pedido.");

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("pedidos")
        .insert({
          lojista_id: loja.user_id,
          cliente_nome: clientName,
          cliente_telefone: clientPhone,
          endereco_entrega: clientAddress,
          total: total,
          items: cart as any,
          status: "pendente",
          // Mocking coordinates for the map demo
          latitude_entrega: -23.5505 + (Math.random() - 0.5) * 0.01,
          longitude_entrega: -46.6333 + (Math.random() - 0.5) * 0.01,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Delivery record is now created only when the merchant chooses to "send to delivery"
      // to avoid premature notifications to drivers.

      toast({ title: "Pedido realizado!", description: "Acompanhe o status agora." });
      navigate(`/rastreio/${order.id}`);
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canAdd = (): boolean => {
    if (!selectedItem) return false;
    if (selectedItem.segment === "pizzaria") {
      return selectedFlavors.length > 0 && !!selectedSize;
    }
    if (selectedItem.category === "Caldos") {
      const selected = selectedFlavors[0];
      if (!selected) return false;
      const flavor = selectedItem.sabores?.find(s => s.nome === selected);
      return flavor?.disponivel !== false;
    }

    return true;
  };

  const toggleFlavor = (fid: string) => {
    setSelectedFlavors((prev) => {
      if (prev.includes(fid)) return prev.filter((f) => f !== fid);
      if (prev.length >= (selectedItem?.maxFlavors ?? 1)) return prev;
      return [...prev, fid];
    });
  };

  const displayPrice = (item: MenuItem) => {
    if (item.unidade_medida === "kg") {
      return `R$ ${item.price.toFixed(2).replace(".", ",")}/kg`;
    }
    return formatPrice(item.price);
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-hero text-primary-foreground sticky top-0 z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container pt-4 pb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-card shadow-elevated overflow-hidden flex items-center justify-center text-xl">
                🍔
              </div>
              <h1 className="text-2xl font-extrabold font-display tracking-tight">Burger House</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.location.href = "/login"} className="p-2 hover:bg-primary-foreground/10 rounded-lg transition-colors">
                <LogIn className="w-5 h-5" />
              </button>
              <button onClick={() => setCartOpen(true)} className="relative p-2">
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary text-accent-foreground rounded-full text-xs font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
            </div>
          </div>
          <h2 className="text-xl font-bold font-display mb-1">Burger House 🍔</h2>
          <p className="text-sm text-primary-foreground/70">Aberto • Entrega em 30-45 min</p>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no cardápio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="container">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setActivePizzaSize(null);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border-0 ${
                  activeCategory === cat
                    ? "bg-card text-foreground shadow-elevated font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Pizza Size Filter */}
          {activeCategory === "Pizzas" && pizzaSizes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-2 border-t border-border/50 scrollbar-hide">
              <button
                onClick={() => setActivePizzaSize(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activePizzaSize === null
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Todos os tamanhos
              </button>
              {pizzaSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setActivePizzaSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    activePizzaSize === size
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Featured Products */}
      {!isLoading && products.some(p => p.is_featured) && activeCategory === "Todos" && !search && (
        <div className="container pt-6 pb-2">
          <h2 className="text-xl font-bold font-display mb-4 px-1">🔥 Destaques da Casa</h2>
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 snap-x">
            {products.filter(p => p.is_featured).map((item) => (
              <motion.div
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => openItem(item)}
                className="flex-shrink-0 w-[220px] snap-start cursor-pointer"
              >
                <div className="relative aspect-[4/3] rounded-2xl bg-muted overflow-hidden mb-3 shadow-lg border border-border/50">
                  {item.emoji.startsWith("http") ? (
                    <img src={item.emoji} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-muted to-muted/50">
                      {item.emoji}
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-secondary text-accent-foreground border-0 shadow-sm font-bold">
                      DESTAQUE
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium mb-0.5">
                      <Star className="w-3 h-3 fill-secondary text-secondary" /> {item.rating}
                    </div>
                    <p className="text-white font-bold text-lg leading-tight truncate">{item.name}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-1">
                  <p className="text-lg font-extrabold text-primary">{item.category === "Pizzas" ? "" : displayPrice(item)}</p>
                  <Button size="sm" className="h-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border-0">
                    Adicionar
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}


      <div className="container py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Carregando cardápio...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeCategory === "Pizzas" && !search ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {products.filter(p => p.category === "Pizzas").slice(0, 1).map((item) => (
                  item.sizes?.map((size, idx) => (
                    <motion.div
                      key={`${item.id}-${size.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => {
                        setSelectedItem(item);
                        setSelectedSize(size.id);
                        setSelectedFlavors([]);
                        setSelectedBordas([]);
                        setSelectedAddons([]);
                        setSelectedComplements([]);
                        setWeightMode("weight");
                        setWeightInput("");
                        setObservation("");
                      }}
                      className="flex flex-col items-center p-6 rounded-3xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all cursor-pointer group"
                    >
                      <div className="relative w-full aspect-square mb-4 rounded-2xl overflow-hidden bg-muted">
                        <img 
                          src={item.emoji.startsWith("http") ? item.emoji : "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=500"} 
                          alt={size.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
                      </div>
                      <h3 className="font-bold text-xl text-center font-display">{size.name.charAt(0)}</h3>
                      <p className="text-sm text-muted-foreground text-center mt-1">Toque para escolher sabores</p>
                    </motion.div>
                  ))
                ))}
              </div>
            ) : (() => {
              // Helpers to render each style
              const renderListItem = (item: MenuItem, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => openItem(item)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold font-display text-foreground truncate">{item.name}</h3>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); openItem(item); }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="w-8 h-[2px] rounded-full mt-0.5 mb-1 bg-primary/30" />
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{item.desc}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-lg font-bold text-primary">
                        {item.category === "Pizzas" ? "" : displayPrice(item)}
                      </p>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-secondary text-secondary" /> {item.rating}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {item.emoji.startsWith("http") ? (
                      <img src={item.emoji} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl">{item.emoji}</span>
                    )}
                  </div>
                </motion.div>
              );

              const renderHorizontalItem = (item: MenuItem, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => openItem(item)}
                  className="flex-shrink-0 snap-start cursor-pointer rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all overflow-hidden"
                  style={{ width: "calc((100% - 1.5rem) / 2.3)" }}
                >
                  <div className="relative aspect-square bg-muted">
                    {item.emoji.startsWith("http") ? (
                      <img src={item.emoji} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl">{item.emoji}</div>
                    )}
                    <Button
                      size="icon"
                      className="absolute top-0 right-0 h-7 w-7 rounded-full text-primary hover:bg-primary/20 shadow-md border-0"
                      style={{ 
                        backgroundColor: 'rgba(var(--primary-rgb), 0.15)',
                        color: 'hsl(var(--primary))'
                      }}
                      onClick={(e) => { e.stopPropagation(); openItem(item); }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-semibold font-display text-foreground text-sm leading-tight line-clamp-1">{item.name}</h3>
                    <div className="w-8 h-[2px] rounded-full mt-0.5 mb-1 bg-primary/30" />
                    {item.desc && (
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{item.desc}</p>
                    )}
                    <p className="text-base font-bold text-primary pt-1">
                      {item.category === "Pizzas" ? "" : displayPrice(item)}
                    </p>
                  </div>
                </motion.div>
              );

              const renderHorizontalRow = (items: MenuItem[]) => (
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
                  {items.map((it, i) => renderHorizontalItem(it, i))}
                </div>
              );




              if (activeCategory === "Todos" && !search) {
                // Group by category and render each according to its style
                const cats = categoriesList.filter(c => c !== "Todos");
                return (
                  <div className="space-y-8">
                    {cats.map(cat => {
                      const items = filtered.filter(p => p.category === cat);
                      if (items.length === 0) return null;
                      const style = categoryStyles[cat] || "lista";
                      return (
                        <div key={cat}>
                          <h2 className="text-lg font-bold font-display mb-3 px-1">{cat}</h2>
                          {style === "horizontal" ? (
                            renderHorizontalRow(items)
                          ) : style === "grid2" ? (
                            <div className="grid grid-cols-2 gap-3">
                              {items.map((it, i) => (
                                <div key={it.id} onClick={() => openItem(it)} className="cursor-pointer rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all overflow-hidden">
                                  <div className="relative aspect-square bg-muted">
                                    {it.emoji.startsWith("http") ? (
                                      <img src={it.emoji} alt={it.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-5xl">{it.emoji}</div>
                                    )}
                                    <Button
                                      size="icon"
                                      className="absolute top-0 right-0 h-7 w-7 rounded-full text-primary hover:bg-primary/20 shadow-md border-0"
                                      style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.15)', color: 'hsl(var(--primary))' }}
                                      onClick={(e) => { e.stopPropagation(); openItem(it); }}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <div className="p-3 space-y-1">
                                    <h3 className="font-semibold font-display text-foreground text-sm leading-tight line-clamp-1">{it.name}</h3>
                                    <div className="w-8 h-[2px] rounded-full mt-0.5 mb-1 bg-primary/30" />
                                    {it.desc && (
                                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{it.desc}</p>
                                    )}
                                    <p className="text-base font-bold text-primary pt-1">
                                      {it.category === "Pizzas" ? "" : displayPrice(it)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-3">{items.map((it, i) => renderListItem(it, i))}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const activeStyle = categoryStyles[activeCategory] || "lista";
              if (activeStyle === "horizontal" && !search) {
                return renderHorizontalRow(filtered);
              }
              if (activeStyle === "grid2" && !search) {
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {filtered.map((it, i) => (
                      <div key={it.id} onClick={() => openItem(it)} className="cursor-pointer rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all overflow-hidden">
                        <div className="relative aspect-square bg-muted">
                          {it.emoji.startsWith("http") ? (
                            <img src={it.emoji} alt={it.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-5xl">{it.emoji}</div>
                          )}
                          <Button
                            size="icon"
                            className="absolute top-0 right-0 h-7 w-7 rounded-full text-primary hover:bg-primary/20 shadow-md border-0"
                            style={{ backgroundColor: 'rgba(var(--primary-rgb), 0.15)', color: 'hsl(var(--primary))' }}
                            onClick={(e) => { e.stopPropagation(); openItem(it); }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="p-3 space-y-1">
                          <h3 className="font-semibold font-display text-foreground text-sm leading-tight line-clamp-1">{it.name}</h3>
                          <div className="w-8 h-[2px] rounded-full mt-0.5 mb-1 bg-primary/30" />
                          {it.desc && (
                            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{it.desc}</p>
                          )}
                          <p className="text-base font-bold text-primary pt-1">
                            {it.category === "Pizzas" ? "" : displayPrice(it)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return <div className="space-y-3">{filtered.map((it, i) => renderListItem(it, i))}</div>;
            })()}
          </div>
      )}
    </div>

      {/* Floating Cart */}
      {totalItems > 0 && !cartOpen && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-4 left-4 right-4 z-30">
          <Button
            onClick={() => setCartOpen(true)}
            className="w-full py-6 rounded-2xl bg-gradient-cta text-accent-foreground font-bold text-base shadow-elevated border-0"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Ver Carrinho ({totalItems}) — {formatPrice(total)}
          </Button>
        </motion.div>
      )}

      {/* ── Product Detail Modal ── */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/50 flex items-end sm:items-center justify-center"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                    {selectedItem.emoji.startsWith("http") ? (
                      <img src={selectedItem.emoji} alt={selectedItem.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">{selectedItem.emoji}</span>
                    )}
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-1 rounded-full hover:bg-muted">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <h3 className="text-xl font-bold font-display text-foreground">{selectedItem.name}</h3>
                <div className="w-12 h-[2.5px] rounded-full mt-1.5 mb-2 bg-primary/30" />
                <p className="text-sm text-muted-foreground mt-1">{selectedItem.desc}</p>

                {/* ── WEIGHT CUSTOMIZATION ── */}
                {selectedItem.unidade_medida === "kg" && (
                  <div className="mt-5 space-y-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Escolha por Peso ou Valor</p>
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        Preço/kg: R$ {selectedItem.price.toFixed(2).replace(".", ",")}
                      </Badge>
                    </div>
                    
                    <Tabs value={weightMode} onValueChange={(v) => setWeightMode(v as any)} className="w-full">
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="weight" className="flex items-center gap-2">
                          <Scale className="w-4 h-4" /> Por Grama
                        </TabsTrigger>
                        <TabsTrigger value="value" className="flex items-center gap-2">
                          <Banknote className="w-4 h-4" /> Por Valor
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          {weightMode === "value" ? "R$" : ""}
                        </span>
                        <Input
                          type="number"
                          placeholder={weightMode === "value" ? "0,00" : "0"}
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          className={`pl-${weightMode === "value" ? "9" : "3"} text-lg font-bold`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                          {weightMode === "weight" ? "g" : ""}
                        </span>
                      </div>
                    </div>

                    {weightInput && (
                      <p className="text-xs text-muted-foreground text-center animate-in fade-in slide-in-from-top-1">
                        {weightMode === "value" 
                          ? `Equivale a aprox. ${((Number(weightInput) / selectedItem.price) * 1000).toFixed(0)}g` 
                          : `Custo do produto: R$ ${((Number(weightInput) / 1000) * selectedItem.price).toFixed(2).replace(".", ",")}`}
                      </p>
                    )}
                  </div>
                )}









                {/* ── ADDONS CUSTOMIZATION ── */}
                {selectedItem.addons && selectedItem.addons.length > 0 && (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      🍔 Adicionais <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Opcional</Badge>
                    </p>
                    <div className="space-y-2">
                      {selectedItem.addons.map((addon) => {
                        const isSelected = selectedAddons.includes(addon.id);
                        return (
                          <button
                            key={addon.id}
                            onClick={() => {
                              setSelectedAddons((prev) =>
                                prev.includes(addon.id)
                                  ? prev.filter((id) => id !== addon.id)
                                  : [...prev, addon.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <span className="text-sm font-medium text-foreground">{addon.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-primary">+{formatPrice(addon.price)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── CALDOS CUSTOMIZATION ── */}
                {selectedItem.category === "Caldos" && selectedItem.sabores && selectedItem.sabores.length > 0 && (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      🍲 Escolha o sabor <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                    </p>
                    <div className="space-y-2">
                      {selectedItem.sabores.map((sabor) => {
                        const isSelected = selectedFlavors.includes(sabor.nome);
                        const isUnavailable = sabor.disponivel === false;
                        
                        return (
                          <button
                            key={sabor.nome}
                            onClick={() => !isUnavailable && setSelectedFlavors([sabor.nome])}
                            disabled={isUnavailable}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : isUnavailable
                                ? "border-border opacity-60 cursor-not-allowed bg-muted/20"
                                : "border-border hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? "border-primary" : "border-muted-foreground/30"
                              }`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                              </div>
                              <span className={`text-sm font-medium ${isUnavailable ? "text-muted-foreground" : "text-foreground"}`}>
                                {sabor.nome}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {Number(sabor.valorExtra) > 0 && (
                                <span className="text-xs font-semibold text-primary">
                                  +{formatPrice(Number(sabor.valorExtra))}
                                </span>
                              )}
                              {isUnavailable && (
                                <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-600 border-red-200 uppercase font-bold">
                                  Indisponível
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedItem.segment === "pizzaria" && (
                  <div className="mt-5 space-y-5">
                    {/* Size */}
                    {selectedItem.sizes && (
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          📏 Escolha o tamanho <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                        </p>
                        <div className="space-y-2">
                          {selectedItem.sizes.map((size) => (
                            <button
                              key={size.id}
                              onClick={() => setSelectedSize(size.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                selectedSize === size.id
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/30"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  selectedSize === size.id ? "border-primary" : "border-muted-foreground/30"
                                }`}>
                                  {selectedSize === size.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                </div>
                                <span className="text-sm font-medium text-foreground">{size.name}</span>
                              </div>
                              <span className="text-sm font-semibold text-primary">{formatPrice(size.price)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Flavors */}
                    {selectedItem.flavors && (
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          🍕 Escolha até {selectedItem.maxFlavors} sabor{(selectedItem.maxFlavors ?? 1) > 1 ? "es" : ""}
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          ⚡ Regra: valor cobrado é do sabor mais caro
                        </p>
                        <div className="space-y-2">
                          {selectedItem.flavors.map((flavor) => {
                            const isSelected = selectedFlavors.includes(flavor.id);
                            const isDisabled = !isSelected && selectedFlavors.length >= (selectedItem.maxFlavors ?? 1);
                            return (
                              <button
                                key={flavor.id}
                                onClick={() => !isDisabled && toggleFlavor(flavor.id)}
                                disabled={isDisabled}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : isDisabled
                                    ? "border-border opacity-40 cursor-not-allowed"
                                    : "border-border hover:border-primary/30"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                  </div>
                                  <span className="text-sm text-foreground">{flavor.name}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">{formatPrice(flavor.price)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bordas */}
                    {selectedItem.segment === "pizzaria" && selectedItem.bordas && selectedItem.bordas.length > 0 && (
                      <div className="mt-5">
                        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          🥖 Deseja borda recheada?
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Opcional</Badge>
                        </p>
                        <div className="space-y-2">
                          {selectedItem.bordas.map((borda) => {
                            const isSelected = selectedBordas.includes(borda.id);
                            return (
                              <button
                                key={borda.id}
                                onClick={() => {
                                  setSelectedBordas(prev => 
                                    prev.includes(borda.id) ? [] : [borda.id]
                                  );
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/30"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    isSelected ? "border-primary" : "border-muted-foreground/30"
                                  }`}>
                                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                  </div>
                                  <span className="text-sm text-foreground">{borda.nome}</span>
                                </div>
                                <span className="text-sm text-primary">+{formatPrice(borda.preco)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Observation */}
                <div className="mt-5">
                  <label className="text-sm font-medium text-foreground">Observações</label>
                  <Input
                    placeholder="Ex: sem cebola, bem passado..."
                    className="mt-1"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                  />
                </div>

                {/* Price + Add Button */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total do item</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold font-display text-primary block">
                        {formatPrice(calcPrice())}
                        {selectedItem.unidade_medida === "kg" && weightInput && (
                          <span className="text-lg font-medium opacity-80">
                            /{weightMode === "value" 
                              ? ((Number(weightInput) / selectedItem.price) * 1000).toFixed(0) 
                              : weightInput}g
                          </span>
                        )}
                      </span>
                      {selectedSize && (
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          / {selectedItem.sizes?.find(s => s.id === selectedSize)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={addToCart}
                    disabled={!canAdd()}
                    className="w-full py-6 bg-gradient-cta text-accent-foreground font-bold rounded-xl text-base border-0 disabled:opacity-50"
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Adicionar ao Carrinho
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Drawer ── */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/50"
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 bottom-0 w-full sm:max-w-sm bg-card shadow-elevated"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-bold font-display text-foreground">Seu Carrinho</h2>
                <button onClick={() => setCartOpen(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 350px)" }}>
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">Seu carrinho está vazio</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.uid} className="p-3 rounded-xl bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {item.qty}x {item.weight ? `(${item.weight}g) ` : ""}{item.emoji} {item.name}
                            </p>
                            {item.customLabel && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.customLabel}</p>
                            )}
                            <p className="text-xs text-primary font-semibold mt-1">
                              {formatPrice(item.price * item.qty)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              onClick={() => updateQty(item.uid, -1)}
                              className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                            <button
                              onClick={() => updateQty(item.uid, 1)}
                              className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-border space-y-4">
                  <div className="space-y-3">
                    <Input 
                      placeholder="Seu nome" 
                      value={clientName} 
                      onChange={(e) => setClientName(e.target.value)} 
                    />
                    <Input 
                      placeholder="Seu WhatsApp" 
                      value={clientPhone} 
                      onChange={(e) => setClientPhone(e.target.value)} 
                    />
                    <Input 
                      placeholder="Endereço de entrega" 
                      value={clientAddress} 
                      onChange={(e) => setClientAddress(e.target.value)} 
                    />
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold font-display text-primary">{formatPrice(total)}</span>
                  </div>
                  <Button 
                    onClick={handleCheckout} 
                    disabled={isSubmitting}
                    className="w-full py-6 bg-gradient-cta text-accent-foreground font-bold rounded-xl text-base border-0"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        Finalizar Pedido
                        <ChevronRight className="w-5 h-5 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feito por NOOV */}
      <div className="pb-8 text-center">
        <a href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Feito por <span className="font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
        </a>
      </div>
      <AppDownloadPopup />
    </div>
  );
};

export default ClientMenu;
