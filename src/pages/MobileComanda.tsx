import { useState, useMemo, useEffect, useRef } from "react";
import { useKeepScreenOn } from "@/hooks/useKeepScreenOn";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePdvUser, ALL_PERMISSIONS, PermissionKey, UserActionPermissions } from "@/contexts/PdvUserContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Loader2,
  Bell,
  ChefHat,
  X,
  Users,
  Smartphone,
  LogOut,
  Fingerprint,
  Store,
  ArrowRight,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  Settings2,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import loginFoodBg from "@/assets/login-food-bg.png";
import PdvAddonModal from "@/components/pdv/PdvAddonModal";

type CartItem = { 
  uid?: string;
  id: string; 
  name: string; 
  price: number; 
  qty: number; 
  image?: string; 
  adicionais?: any[];
  sabores?: any[];
  order_type?: string;
  is_ordered?: boolean;
};

export default function MobileComanda() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  useKeepScreenOn();
  const { pdvUser, setPdvUser, clear: clearPdvUser } = usePdvUser();

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // PDV State
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedMesa, setSelectedMesa] = useState<any>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showActiveOrders, setShowActiveOrders] = useState(false);
  const [showTransferMesa, setShowTransferMesa] = useState(false);
  const [transferTargetMesa, setTransferTargetMesa] = useState<any>(null);
  const [addonProduct, setAddonProduct] = useState<any>(null);

  // Fetch store by slug
  const { data: loja, isLoading: loadingLoja } = useQuery({
    queryKey: ["mobile-comanda-loja", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("id, nome, slug, logo_url, user_id")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      
      // Se temos um usuário PDV de outra loja, limpamos para forçar novo login
      const stored = sessionStorage.getItem("pdv_active_user");
      if (stored) {
        try {
          const storedUser = JSON.parse(stored);
          if (storedUser.loja_id !== data?.id) {
            sessionStorage.removeItem("pdv_active_user");
            // Usamos window.location.reload() apenas se data for válido para garantir que o contexto seja limpo
            if (data?.id) window.location.reload();
          }
        } catch (e) {}
      }
      
      return data;
    },
    enabled: !!slug,
  });

  // Dynamic PWA manifest so the installed icon opens this exact store's comanda page
  useEffect(() => {
    if (!loja || !slug) return;
    const startUrl = `/comanda/${slug}`;
    const icon = loja.logo_url || "/favicon.ico";
    const manifest = {
      name: `Comanda ${loja.nome}`,
      short_name: loja.nome,
      description: `Comanda eletrônica - ${loja.nome}`,
      start_url: startUrl,
      scope: startUrl,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1A1F2C",
      icons: [
        { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
    const url = URL.createObjectURL(blob);
    const link = document.getElementById("manifest-link") as HTMLLinkElement | null;
    const prevHref = link?.getAttribute("href");
    if (link) link.setAttribute("href", url);

    const appleIcon = document.getElementById("apple-touch-icon") as HTMLLinkElement | null;
    const prevAppleHref = appleIcon?.getAttribute("href");
    if (appleIcon && loja.logo_url) appleIcon.setAttribute("href", loja.logo_url);

    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const prevTitle = titleMeta?.getAttribute("content");
    if (titleMeta) titleMeta.setAttribute("content", loja.nome || "Comanda");

    return () => {
      URL.revokeObjectURL(url);
      if (link && prevHref) link.setAttribute("href", prevHref);
      if (appleIcon && prevAppleHref) appleIcon.setAttribute("href", prevAppleHref);
      if (titleMeta && prevTitle) titleMeta.setAttribute("content", prevTitle);
    };
  }, [loja, slug]);

  // Fetch users for this store
  const { data: usuarios = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["mobile-comanda-usuarios", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_usuarios")
        .select("*")
        .eq("loja_id", loja!.id)
        .eq("ativo", true)
        .in("nivel", ["funcionario", "gerente"])
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!loja?.id,
  });

  // Fetch mesas
  const { data: mesas = [], isLoading: loadingMesas } = useQuery({
    queryKey: ["mobile-comanda-mesas", loja?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdv_mesas")
        .select("*")
        .eq("loja_id", loja!.id);

      if (error) {
        console.error("[MobileComanda] erro ao buscar mesas:", error);
        return [];
      }
      if (!data) return [];

      return [...data].sort((a, b) => {
        const nomeA = String(a?.nome ?? "");
        const nomeB = String(b?.nome ?? "");
        const numA = parseInt(nomeA.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(nomeB.replace(/\D/g, ""), 10) || 0;
        return numA - numB || nomeA.localeCompare(nomeB);
      });
    },
    enabled: !!loja?.id && !!pdvUser,
  });

  // Fetch current order if mesa selected
  const { data: activePedido, refetch: refetchActivePedido } = useQuery({
    queryKey: ["mobile-active-pedido", selectedMesa?.pedido_atual_id],
    queryFn: async () => {
      if (!selectedMesa?.pedido_atual_id) return null;
      const { data } = await supabase
        .from("pdv_pedidos")
        .select("*")
        .eq("id", selectedMesa.pedido_atual_id)
        .single();
      return data;
    },
    enabled: !!selectedMesa?.pedido_atual_id,
  });
  
  // Dynamic Manifest and Title for PWA
  useEffect(() => {
    if (loja) {
      // Update Title
      document.title = `Comanda - ${loja.nome}`;
      
      // Update Apple Mobile App Title
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.setAttribute('content', `Comanda ${loja.nome}`);

      // Update Apple Touch Icon
      const appleTouchIcon = document.getElementById('apple-touch-icon');
      if (appleTouchIcon && loja.logo_url) {
        appleTouchIcon.setAttribute('href', loja.logo_url);
      }

      // Update Manifest
      const manifest = {
        name: `Comanda ${loja.nome}`,
        short_name: `Comanda ${loja.nome}`,
        description: `Sistema de Comanda Eletrônica - ${loja.nome}`,
        start_url: window.location.pathname,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#F97316",
        icons: [
          {
            src: loja.logo_url || "/favicon.ico",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: loja.logo_url || "/favicon.ico",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: loja.logo_url || "/favicon.ico",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      };

      const stringManifest = JSON.stringify(manifest);
      const blob = new Blob([stringManifest], {type: 'application/json'});
      const manifestURL = URL.createObjectURL(blob);
      const manifestLink = document.getElementById('manifest-link');
      if (manifestLink) {
        manifestLink.setAttribute('href', manifestURL);
      }
    }
  }, [loja]);

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["mobile-comanda-products", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("loja_id", loja!.id)
        .eq("disponivel", true)
        .order("categoria");
      return data || [];
    },
    enabled: !!loja?.id && !!pdvUser,
  });

  // Fetch open comandas
  const { data: comandas = [] } = useQuery({
    queryKey: ["mobile-comanda-open", loja?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_comandas")
        .select("*, pdv_pedidos(id, items, total, status_cozinha)")
        .eq("loja_id", loja!.id)
        .eq("status", "aberta");
      return data || [];
    },
    enabled: !!loja?.id && !!pdvUser,
  });

  useRealtimeSubscription("pdv_mesas", [["mobile-comanda-mesas"]], loja ? `loja_id=eq.${loja.id}` : undefined);
  useRealtimeSubscription("pdv_comandas", [["mobile-comanda-open"]], loja ? `loja_id=eq.${loja.id}` : undefined);

  // Handle Login
  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const selected = usuarios.find(u => u.id === selectedId);
    if (!selected || pin.length < 4) return;
    
    setSubmitting(true);
    if (pin === selected.pin) {
      setPdvUser({
        id: selected.id,
        loja_id: selected.loja_id,
        nome: selected.nome,
        nivel: selected.nivel as "admin" | "gerente" | "funcionario",
        permissoes: (selected.nivel === "admin" ? ALL_PERMISSIONS : (selected.permissoes || [])) as PermissionKey[],
        permissoes_acoes: selected.permissoes_acoes as Record<string, UserActionPermissions>,
      });
      // Marca que a sessão foi iniciada pelo link da comanda (garçom)
      // Assim, ao abrir o painel lojista, sempre forçamos a tela de seleção de usuário
      try { sessionStorage.setItem("pdv_from_comanda", "1"); } catch {}
      toast.success(`Bem-vindo, ${selected.nome}!`);
    } else {
      toast.error("PIN incorreto");
      setPin("");
    }
    setSubmitting(false);
  };

  const handleLogout = () => {
    clearPdvUser();
    setSelectedId(null);
    setPin("");
  };

  // PDV Logic
  const addToCart = (product: any, options?: any) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((c) => 
        c.id === product.id && 
        JSON.stringify(c.adicionais || []) === JSON.stringify(options?.addons || []) &&
        JSON.stringify(c.sabores || []) === JSON.stringify(options?.sabores || [])
      );

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].qty += (options?.qty || 1);
        return newCart;
      }

      const price = options?.totalPrice || (product.preco_promocional && product.preco_promocional > 0 ? product.preco_promocional : product.preco);
      
      return [...prev, { 
        id: product.id, 
        name: options?.name || product.nome, 
        price: Number(price), 
        qty: options?.qty || 1, 
        image: product.imagem_url,
        adicionais: options?.addons,
        sabores: options?.sabores
      }];
    });
    toast.success(`${product.nome} adicionado`);
  };

  const handleProductClick = (product: any) => {
    const hasAddons = product.adicionais && product.adicionais.length > 0;
    const hasFlavors = (product.max_sabores && product.max_sabores > 1) || ((product.categoria || "").toLowerCase() === "caldos" && Array.isArray(product.sabores) && product.sabores.length > 0);
    const hasSizes = product.tamanhos && product.tamanhos.length > 0;

    if (hasAddons || hasFlavors || hasSizes) {
      setAddonProduct(product);
    } else {
      addToCart(product);
    }
  };

  const sendOrder = useMutation({
    mutationFn: async () => {
      if (!selectedMesa || cart.length === 0 || !loja || !pdvUser) return;
      
      let comanda = comandas.find(c => c.mesa_id === selectedMesa.id);
      let activeOrder = activePedido;
      
      // If table is free in pdv_mesas, we might still have a comanda open for it (though they should be synced)
      // If table is occupied, we use the pedido_atual_id
      
      if (!comanda) {
        const { data, error } = await supabase.from("pdv_comandas").insert({
          loja_id: loja.id,
          mesa_id: selectedMesa.id,
          garcom_id: pdvUser.id,
          status: "aberta"
        }).select().single();
        if (error) throw error;
        comanda = { ...data, pdv_pedidos: [] };
      }

      const cartItems = cart.map(c => ({
        uid: crypto.randomUUID(),
        id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.qty,
        image: c.image,
        addons: c.adicionais || [],
        sabores: c.sabores || [],
        order_type: "mesa_cliente" // Identifica que veio via comanda/celular
      }));

      const totalCart = cart.reduce((acc, c) => acc + c.price * c.qty, 0);

      if (activeOrder) {
        // APPEND to existing order
        const existingItems = Array.isArray(activeOrder.items) ? activeOrder.items : [];
        const updatedItems = [...existingItems, ...cartItems];
        const newTotal = (Number(activeOrder.total) || 0) + totalCart;

        const { error: updateError } = await supabase
          .from("pdv_pedidos")
          .update({ 
            items: updatedItems,
            total: newTotal,
            status_cozinha: "pendente",
            last_added_at: new Date().toISOString(),
            observacoes: activeOrder.observacoes 
              ? `${activeOrder.observacoes}\nGarçom: ${pdvUser.nome}` 
              : `Garçom: ${pdvUser.nome}`
          })
          .eq("id", activeOrder.id);
        
        if (updateError) throw updateError;
      } else {
        // CREATE new order
        const { data: newOrder, error: orderError } = await supabase.from("pdv_pedidos").insert([{
          loja_id: loja.id,
          mesa_id: selectedMesa.id,
          comanda_id: comanda.id,
          items: cartItems as any,
          total: totalCart,
          status_cozinha: "pendente",
          order_type: "mesa_cliente",
          observacoes: `Garçom: ${pdvUser.nome}`
        } as any]).select().single();

        if (orderError) throw orderError;

        // Link table to this order
        await supabase.from("pdv_mesas").update({ 
          status: "ocupada",
          pedido_atual_id: newOrder.id 
        }).eq("id", selectedMesa.id);
      }

      await supabase.from("pdv_comandas")
        .update({ total: (comanda.total || 0) + totalCart })
        .eq("id", comanda.id);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-comanda-mesas"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-comanda-open"] });
      setCart([]);
      setSelectedMesa(null);
      setShowCart(false);
      toast.success("Pedido enviado!");
    },
    onError: (err) => toast.error("Erro ao enviar pedido")
  });

  const handleTransferMesa = useMutation({
    mutationFn: async () => {
      if (!selectedMesa || !transferTargetMesa || !activePedido) return;
      
      const { error: mesaUpdateError } = await supabase
        .from("pdv_mesas")
        .update({ status: "livre", pedido_atual_id: null })
        .eq("id", selectedMesa.id);
      if (mesaUpdateError) throw mesaUpdateError;

      const { error: targetMesaUpdateError } = await supabase
        .from("pdv_mesas")
        .update({ status: "ocupada", pedido_atual_id: activePedido.id })
        .eq("id", transferTargetMesa.id);
      if (targetMesaUpdateError) throw targetMesaUpdateError;

      const { error: pedidoUpdateError } = await supabase
        .from("pdv_pedidos")
        .update({ mesa_id: transferTargetMesa.id })
        .eq("id", activePedido.id);
      if (pedidoUpdateError) throw pedidoUpdateError;

      const comanda = comandas.find(c => c.mesa_id === selectedMesa.id);
      if (comanda) {
        await supabase
          .from("pdv_comandas")
          .update({ mesa_id: transferTargetMesa.id })
          .eq("id", comanda.id);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-comanda-mesas"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-active-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-comanda-open"] });
      toast.success("Mesa transferida com sucesso!");
      setShowTransferMesa(false);
      setTransferTargetMesa(null);
      setSelectedMesa(null);
    },
    onError: () => toast.error("Erro ao transferir mesa")
  });

  const cartTotal = cart.reduce((acc, c) => acc + c.price * c.qty, 0);
  const totalGeral = cartTotal + (activePedido?.total || 0);

  // Categories
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.categoria || "Sem categoria"))];
    return cats.sort();
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (activeCategory) {
      result = result.filter(p => (p.categoria || "Sem categoria") === activeCategory);
    }
    
    if (search) {
      result = result.filter(p => p.nome.toLowerCase().includes(search.toLowerCase()));
    }
    
    return result.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [products, activeCategory, search]);

  const existingItems = useMemo(() => {
    if (!activePedido?.items) return [];
    return (activePedido.items as any[]).map(i => {
      const product = products.find(p => p.id === i.id);
      return {
        ...i,
        category: product?.categoria || "",
        is_ordered: true
      };
    });
  }, [activePedido]);

  if (loadingLoja) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!loja) return <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
      <X className="w-8 h-8" />
    </div>
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-slate-900">Loja não encontrada</h1>
      <p className="text-slate-500 max-w-[250px] mx-auto">O link que você acessou parece estar incorreto ou a loja não existe.</p>
    </div>
    <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
      Voltar para o início
    </Button>
  </div>;

  // Login View
  if (!pdvUser || pdvUser.loja_id !== loja.id) {
    const selected = usuarios.find(u => u.id === selectedId);
    return (
      <div className="min-h-screen bg-gradient-hero relative flex flex-col items-center justify-center p-4 overflow-hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img src={loginFoodBg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" loading="lazy" width={1920} height={1080} />
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>
        <div className="w-full max-w-sm space-y-6 relative z-10">
          <div className="text-center space-y-2">
            {loja.logo_url && <img src={loja.logo_url} className="w-20 h-20 mx-auto rounded-2xl shadow-lg border-2 border-white/20" alt="" />}
            <h1 className="text-2xl font-bold text-white">{loja.nome}</h1>
            <p className="text-white/70 text-sm flex items-center justify-center gap-1">
              <Smartphone className="w-4 h-4" /> Comanda Eletrônica
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acesso do Funcionário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="w-full h-12 px-4 border rounded-lg flex items-center justify-between bg-white"
                >
                  {selected ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{selected.nome}</span>
                    </div>
                  ) : "Selecione seu nome"}
                  <ChevronDown className="w-4 h-4" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                    {usuarios.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedId(u.id); setUserDropdownOpen(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b last:border-0"
                      >
                        <span className="font-medium">{u.nome}</span>
                        {selectedId === u.id && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="PIN de 4 dígitos"
                  className="h-12 text-center text-lg tracking-[0.2em] pl-[0.2em]"
                  maxLength={4}
                  inputMode="numeric"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                />
                <Button 
                  className="w-full h-12 font-bold" 
                  disabled={pin.length < 4 || !selectedId || submitting}
                  onClick={() => handleLogin()}
                >
                  {submitting ? <Loader2 className="animate-spin" /> : "Entrar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main PDV View
  return (
    <div className="min-h-screen bg-slate-50 pb-20 flex flex-col">
      {/* Header */}
      {!selectedMesa && (
        <header className="bg-gradient-hero text-primary-foreground border-b border-primary/20 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-md" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
          <div className="flex items-center gap-3">
            {loja.logo_url ? (
              <img src={loja.logo_url} className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-white/30" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-sm leading-none">{pdvUser.nome}</h2>
              <p className="text-[10px] text-primary-foreground/70 mt-1">{loja.nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Mesas Selector if no mesa selected */}
      {!selectedMesa ? (
        <main className="p-4 space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">Selecione a Mesa</h3>
            <Badge variant="outline" className="text-[10px]">{mesas.length} Mesas</Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {mesas.map(mesa => {
              const comanda = comandas.find(c => c.mesa_id === mesa.id);
              const isOccupied = mesa.status === 'ocupada';
              // Count total items in the current active order for this table
              const itemCount = comanda?.pdv_pedidos?.[0]?.items 
                ? (Array.isArray(comanda.pdv_pedidos[0].items) ? comanda.pdv_pedidos[0].items.length : 0)
                : 0;
              
              return (
                <button
                  key={mesa.id}
                  onClick={() => setSelectedMesa(mesa)}
                  className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all shadow-sm relative ${
                    isOccupied 
                      ? 'border-red-200 bg-red-500 text-white shadow-md' 
                      : 'border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
                  }`}
                >
                  <Users className="w-5 h-5 mb-1 opacity-80" />
                  <span className="text-lg font-bold">{mesa.nome}</span>
                  {isOccupied && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold mt-1">
                        R$ {Number(comanda?.total || 0).toFixed(2)}
                      </span>
                      <span className="text-[9px] opacity-90 font-medium">
                        {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  )}
                  {!isOccupied && (
                    <span className="text-[9px] font-medium opacity-70">Livre</span>
                  )}
                </button>
              );
            })}
          </div>
        </main>
      ) : (
        /* Products View */
        <main className="flex-1 flex flex-col">
          <div className="p-4 bg-white border-b space-y-3 shadow-sm sticky top-0 z-30" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedMesa(null)} 
                  className="h-8 w-8 text-slate-500 hover:text-primary"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </Button>
                <Badge className="bg-primary text-sm px-3 h-8">{selectedMesa.nome}</Badge>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 rounded-lg text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                  onClick={() => setShowTransferMesa(true)}
                >
                  Mudar Mesa
                </Button>
              </div>
              
              <div className="text-right flex flex-col items-end">
                <span className="text-2xl font-black text-primary leading-none">
                  R$ {totalGeral.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Categories Menu (inside sticky header) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              <button
                onClick={() => setActiveCategory(null)}
                className={`h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap border shadow-sm transition-colors ${
                  !activeCategory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap border shadow-sm transition-colors ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>


          <div className="flex-1 p-4 flex flex-col gap-3 pb-32">

            {filteredProducts.map((p: any) => {
              const hasOptions = (Array.isArray(p.adicionais) && p.adicionais.length > 0) || 
                               (p.max_sabores && Number(p.max_sabores) > 1) || 
                               (Array.isArray(p.tamanhos) && p.tamanhos.length > 0) ||
                               ((p.categoria || "").toLowerCase() === "caldos" && Array.isArray(p.sabores) && p.sabores.length > 0);
              
              return (
                <Card key={p.id} className="overflow-hidden border-0 shadow-sm" onClick={() => handleProductClick(p)}>
                  <CardContent className="p-0 flex h-24">
                    {p.imagem_url && <img src={p.imagem_url} className="w-16 h-full object-cover" alt="" />}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-sm line-clamp-1">{p.nome}</h4>
                          {hasOptions && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1 flex items-center gap-0.5">
                              <Settings2 className="w-2 h-2" /> Opções
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.descricao}</p>
                        {(p.categoria || "").toLowerCase() === "caldos" && Array.isArray(p.sabores) && p.sabores.length > 0 && (
                          <p className="text-[9px] text-slate-500 mt-1 line-clamp-1">
                            <span className="font-semibold text-slate-600">Sabores:</span> {p.sabores.filter((s: any) => s.disponivel !== false).map((s: any) => s.nome).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-bold">R$ {Number(p.preco).toFixed(2)}</span>
                        <div className="flex items-center gap-2">
                          {cart.find(c => c.id === p.id) && (
                            <>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-7 w-7 rounded-full border-primary text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCart(prev => prev.map(c => c.id === p.id ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0));
                                }}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="font-bold text-xs w-4 text-center">
                                {cart.find(c => c.id === p.id)?.qty}
                              </span>
                            </>
                          )}
                          <Button 
                            size="icon" 
                            className="h-7 w-7 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductClick(p);
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      )}

      {/* Addon Modal */}
      <PdvAddonModal
        open={!!addonProduct}
        onClose={() => setAddonProduct(null)}
        product={addonProduct}
        flavorProducts={
          (addonProduct?.categoria || "").toLowerCase() === "caldos" && Array.isArray(addonProduct?.sabores)
            ? addonProduct.sabores
                .filter((s: any) => s.disponivel !== false)
                .map((s: any, idx: number) => ({
                  id: `sabor-${idx}`,
                  nome: s.nome,
                  preco: Number(s.valorExtra || 0),
                  imagem_url: null
                }))
            : []
        }
        onConfirm={(data) => {
          addToCart(addonProduct, data);
        }}
      />


      {/* Cart Sheet / Dialog */}
      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed inset-0 z-[60] bg-white flex flex-col"
          >
            <header className="p-4 border-b flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
              <h2 className="font-bold text-xl">Pedido {selectedMesa?.nome}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                <X className="w-6 h-6" />
              </Button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <h4 className="font-bold">{item.name}</h4>
                    {item.sabores && item.sabores.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-semibold">{item.sabores.length === 1 ? "Sabor:" : "Sabores:"}</span> {item.sabores.join(", ")}
                      </p>
                    )}
                    {item.adicionais && item.adicionais.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">Adicionais: {item.adicionais.map(a => a.nome).join(", ")}</p>
                    )}
                    <p className="text-sm text-primary font-medium">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="font-bold w-4 text-center">{item.qty}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => setCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t space-y-4">
              <div className="flex items-center justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {cartTotal.toFixed(2)}</span>
              </div>
              <Button 
                className="w-full h-14 font-bold text-lg" 
                disabled={sendOrder.isPending}
                onClick={() => sendOrder.mutate()}
              >
                {sendOrder.isPending ? <Loader2 className="animate-spin mr-2" /> : <ChefHat className="w-5 h-5 mr-2" />}
                Enviar para Cozinha
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Orders Modal */}
      <Dialog open={showActiveOrders} onOpenChange={setShowActiveOrders}>
        <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              Pedidos Atuais - {selectedMesa?.nome}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4">
            {existingItems.length > 0 ? (
              <div className="space-y-4">
                {existingItems.map((item: any, idx: number) => (
                  <div key={item.uid || idx} className="border-b border-dashed border-slate-200 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-800">{item.quantity || item.qtd || 1}x {item.name || item.nome}</h4>
                        <div className="pl-4 space-y-0.5 mt-1">
                          {item.sabores && item.sabores.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              <span className="font-semibold">{Array.isArray(item.sabores) && item.sabores.length === 1 ? "Sabor:" : "Sabores:"}</span> {Array.isArray(item.sabores) ? item.sabores.map((s: any) => typeof s === 'string' ? s : s.nome).join(", ") : item.sabores}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              <span className="font-semibold">Adicionais:</span>
                              <div className="pl-2 space-y-0.5 mt-0.5">
                                {item.addons.map((a: any, aidx: number) => (
                                  <p key={aidx}>+ {a.nome} (R$ {Number(a.preco || 0).toFixed(2)})</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.observation && (
                            <p className="text-[10px] text-muted-foreground italic mt-1">Obs: {item.observation}</p>
                          )}
                          {((item.addons && item.addons.length > 0) || (item.sabores && item.sabores.length > 0)) && (
                            <div className="flex justify-end mt-2">
                              <p className="text-xs text-slate-800 font-bold">
                                Subtotal: R$ {((Number(item.price || item.preco || 0) + (item.addons?.reduce((acc: number, a: any) => acc + Number(a.preco || 0), 0) || 0)) * (item.quantity || item.qtd || 1)).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-800 whitespace-nowrap">R$ {Number(item.price || item.preco || 0).toFixed(2)}</p>
                        <button 
                          onClick={() => {
                            if (window.confirm(`Deseja realmente excluir "${item.name || item.nome}" do pedido?`)) {
                              (async () => {
                                try {
                                  const { data: currentPedido } = await supabase
                                    .from('pdv_pedidos')
                                    .select('items, total, comanda_id')
                                    .eq('id', activePedido.id)
                                    .single();

                                  if (!currentPedido) return;

                                  const currentItems = Array.isArray(currentPedido.items) ? currentPedido.items : [];
                                  const updatedItems = currentItems.filter((i: any) => i.uid !== item.uid);
                                  
                                  const itemTotal = (Number(item.price || item.preco || 0) + (item.addons?.reduce((acc: number, a: any) => acc + Number(a.preco || 0), 0) || 0)) * (item.quantity || item.qtd || 1);
                                  const newTotal = Math.max(0, (Number(currentPedido.total) || 0) - itemTotal);

                                  const { error: updateError } = await supabase
                                    .from('pdv_pedidos')
                                    .update({ 
                                      items: updatedItems,
                                      total: newTotal
                                    })
                                    .eq('id', activePedido.id);

                                  if (updateError) throw updateError;

                                  if (currentPedido.comanda_id) {
                                    const { data: comanda } = await supabase
                                      .from('pdv_comandas')
                                      .select('total')
                                      .eq('id', currentPedido.comanda_id)
                                      .single();
                                    
                                    if (comanda) {
                                      await supabase
                                        .from('pdv_comandas')
                                        .update({ total: Math.max(0, (Number(comanda.total) || 0) - itemTotal) })
                                        .eq('id', currentPedido.comanda_id);
                                    }
                                  }

                                  toast.success("Item removido com sucesso");
                                  refetchActivePedido();
                                  queryClient.invalidateQueries({ queryKey: ["mobile-active-pedido"] });
                                  queryClient.invalidateQueries({ queryKey: ["mobile-comanda-open"] });
                                } catch (err) {
                                  toast.error("Erro ao remover item");
                                }
                              })();
                            }
                          }}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                          title="Remover item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500">Nenhum pedido lançado nesta mesa.</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t space-y-2">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-700">Total Geral</span>
              <span className="font-bold text-lg text-slate-800">R$ {(activePedido?.total || 0).toFixed(2)}</span>
            </div>
            <Button className="w-full rounded-xl h-12 font-bold" onClick={() => setShowActiveOrders(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Mesa Dialog */}
      <Dialog open={showTransferMesa} onOpenChange={setShowTransferMesa}>
        <DialogContent className="max-w-[90vw] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-white sticky top-0 z-10">
            <DialogTitle className="text-lg font-bold">Transferir para qual mesa?</DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[60vh] overflow-y-auto bg-slate-50">
            <div className="grid grid-cols-3 gap-3">
              {mesas
                .filter(m => m.id !== selectedMesa?.id && m.status === 'livre')
                .map(mesa => (
                  <button
                    key={mesa.id}
                    onClick={() => setTransferTargetMesa(mesa)}
                    className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all shadow-sm ${
                      transferTargetMesa?.id === mesa.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                    }`}
                  >
                    <span className="text-lg font-bold">{mesa.nome}</span>
                    <span className="text-[10px] opacity-70">Livre</span>
                  </button>
                ))}
            </div>
          </div>
          <div className="p-4 bg-white border-t sticky bottom-0 z-10 flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setShowTransferMesa(false)}>
              Cancelar
            </Button>
            <Button 
              className="flex-1 rounded-xl h-12 font-bold" 
              disabled={!transferTargetMesa || handleTransferMesa.isPending}
              onClick={() => handleTransferMesa.mutate()}
            >
              {handleTransferMesa.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button */}
      {selectedMesa && !showActiveOrders && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          className="fixed bottom-6 left-4 right-4 z-[40]"
        >
          {cart.length > 0 ? (
            /* New Order / Cart Button (Green) */
            <Button
              onClick={() => setShowCart(true)}
              className="w-full h-16 rounded-2xl bg-[#00A859] text-white shadow-lg border-0 p-0 overflow-hidden flex items-stretch"
            >
              <div className="flex-1 flex items-center px-4 gap-3 border-r border-white/20">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 bg-white text-[#00A859] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#00A859]/20">
                    {cart.reduce((acc, c) => acc + c.qty, 0)}
                  </span>
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold">Novo Item</span>
                  <span className="text-[11px] opacity-90">
                    Novo: R$ {cartTotal.toFixed(2)} • Total: R$ {totalGeral.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="px-6 flex items-center gap-2 hover:bg-white/10 transition-colors">
                <span className="text-sm font-bold">Enviar</span>
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </div>
            </Button>
          ) : activePedido ? (
            /* View Current Orders Button (Blue) */
            <Button
              onClick={() => setShowActiveOrders(true)}
              className="w-full h-16 rounded-2xl bg-blue-600 text-white shadow-lg border-0 p-0 overflow-hidden flex items-stretch"
            >
              <div className="flex-1 flex items-center px-4 gap-3 border-r border-white/20">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 bg-white text-blue-600 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-blue-600/20">
                    {Array.isArray(activePedido.items) ? activePedido.items.length : 0}
                  </span>
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold">Pedido Mesa</span>
                  <span className="text-sm font-extrabold opacity-90">
                    R$ {(activePedido?.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="px-6 flex items-center gap-2 hover:bg-white/10 transition-colors">
                <span className="text-sm font-bold whitespace-nowrap">Ver Pedido</span>
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </div>
            </Button>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}
