import { useParams } from "react-router-dom";
import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";

import { useStoreTrialStatus } from "@/hooks/useTrialStatus";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { usePublicStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setupGlobalErrorLogging } from "@/utils/errorLogger";
import { formatPhone, maskPhoneInput } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ShoppingCart, Plus, Minus, X, Send, Star, Clock, Bike, Search, ChevronLeft, Check, Flame, ChevronDown, MapPin, Navigation, User, Pencil, Camera, CreditCard, Banknote, Smartphone, QrCode, ClipboardList, Package, ChefHat, Truck, CircleCheck, Map, FileText, Ban, MessageCircle, Instagram, Phone, Share2, Ticket, History, UtensilsCrossed, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SystemRatingPopup } from "@/components/SystemRatingPopup";
import { EventCountdown } from "@/components/EventCountdown";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoryImages } from "@/constants/categoryImages";
// TrackingMap removed
import DeliveryMap from "@/components/delivery/DeliveryMap";
import { AppDownloadPopup } from "@/components/AppDownloadPopup";

// ── Segment banner images ──
import bannerPizzaria from "@/assets/banner-pizzaria.jpg";
import bannerHamburgueria from "@/assets/banner-hamburgueria.jpg";
import bannerAcaiteria from "@/assets/banner-acaiteria.jpg";
import bannerLanchonete from "@/assets/banner-lanchonete.jpg";

const segmentBanners: Record<string, string> = {
  pizzaria: bannerPizzaria,
  hamburgueria: bannerHamburgueria,
  acaiteria: bannerAcaiteria,
  lanchonete: bannerLanchonete,
};

// ── Types ──
interface CartItem {
  uid: string;
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  customLabel?: string;
  imagem_url?: string | null;
  addons?: ProductAddon[];
  observation?: string;
  sabores?: string[];
  quantidade_sabores?: number;
  caldo_sabor?: { nome: string; valorExtra: number } | null;

  tamanho?: string;
  bordas?: string[];
  quantidade_bordas?: number;
  editingUid?: string;
  gratis_ate?: number;
  weight?: number;
  unidade_medida?: string;
  unit_price?: number;
}

interface ProductAddon {
  nome: string;
  preco: string | number;
}

interface PizzaSize {
  nome: string;
  preco: number;
  max_sabores?: number;
  max_sabores_borda?: number;
}

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  categoria: string | null;
  imagem_url: string | null;
  banner_url?: string | null;
  disponivel: boolean;
  oculto?: boolean;
  loja_id: string;
  tag_novo: boolean;
  tag_sugestao: boolean;
  tag_destaque: boolean;
  preco_promocional: number | null;
  promocao_validade: string | null;
  adicionais: ProductAddon[] | null;
  tamanhos: PizzaSize[] | null;
  max_sabores: number | null;
  max_adicionais?: number | null;
  max_sabores_borda?: number | null;
  unidade_medida: string;
  rating_average?: number;
  rating_count?: number;
  pedidos_count?: number;
  sabores_caldo?: { nome: string; valorExtra: number; disponivel?: boolean }[] | null;
}


// ── Segment emoji ──

const segmentEmoji: Record<string, string> = {
  pizzaria: "🍕",
  hamburgueria: "🍔",
  acaiteria: "🍧",
  lanchonete: "🥪",
};

const categoryIcons: Record<string, string> = {
  "Hambúrgueres": "🍔",
  "Pizzas": "🍕",
  "Bebidas": "🥤",
  "Açaí": "🍧",
  "Acompanhamentos": "🍟",
  "Combos": "🍱",
  "Sobremesas": "🍰",
  "Promoções": "🔥",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const isPromoActive = (product: Product | null) => {
  if (!product || !product.preco_promocional) return false;
  if (!product.promocao_validade) return true;
  return new Date(product.promocao_validade) >= new Date();
};

const getSizeFatias = (nome: string): string => {
  const n = nome.toLowerCase().trim();
  if (n === "p" || n.includes("pequena")) return "4 fatias";
  if (n === "m" || n.includes("médi") || n.includes("media")) return "6 fatias";
  if (n === "gg" || n.includes("gigant")) return "12 fatias";
  if (n === "g" || n.includes("grand") || n.includes("famili")) return "8 fatias";
  if (n.includes("broto")) return "4 fatias";
  return "";
};

const getFirstLetter = (name: string) => name; // Just return the name instead of first letter as requested by user

const hexToRgb = (hex: string): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const StoreMenu = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useState(new URLSearchParams(window.location.search));
  const mesaId = searchParams.get("mesa");
  const mesaNomeParam = searchParams.get("mesaNome");

  const [mesaConfirmOrder, setMesaConfirmOrder] = useState(false);
  const [showPreReceipt, setShowPreReceipt] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [unavailableProductsModal, setUnavailableProductsModal] = useState<{ isOpen: boolean; products: string[]; type: "cart" | "detail" }>({ isOpen: false, products: [], type: "cart" });
  const [showCouponPopup, setShowCouponPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ observacoes: "" });
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "retirada" | "mesa" | null>(mesaId ? "mesa" : null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(mesaId ? "local" : null);
  const [needsChange, setNeedsChange] = useState<boolean | null>(null);
  const [changeAmount, setChangeAmount] = useState("");
  const [paymentStepDone, setPaymentStepDone] = useState(!!mesaId);

  const [comprovante, setComprovante] = useState<any>(null);
  const [deliveryAddressConfirmed, setDeliveryAddressConfirmed] = useState(false);
  const [editingDeliveryAddress, setEditingDeliveryAddress] = useState(false);
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState({
    endereco_rua: "", endereco_numero: "", endereco_bairro: "", endereco_cidade: "", endereco_complemento: "", endereco_cep: "",
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [selectedBordas, setSelectedBordas] = useState<string[]>([]);
  const [observation, setObservation] = useState("");
  const [selectedPizzaSize, setSelectedPizzaSize] = useState<string>("");
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedCaldoSabor, setSelectedCaldoSabor] = useState<string>("");

  const [infoTab, setInfoTab] = useState<"horario" | "local" | "entrega" | "contato">("horario");
  const [productQty, setProductQty] = useState(1);
  const [productWeight, setProductWeight] = useState("");
  const [productValue, setProductValue] = useState("");
  const [editingCartUid, setEditingCartUid] = useState<string | null>(null);
  const [openedFromCart, setOpenedFromCart] = useState(false);
  const [hasAddedCurrentProduct, setHasAddedCurrentProduct] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [showStickyNav, setShowStickyNav] = useState(false);
  const [detailTitleVisible, setDetailTitleVisible] = useState(true);
  const [detailScrollY, setDetailScrollY] = useState(0);
  const detailTitleRef = useRef<HTMLHeadingElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const [showStoreInfo, setShowStoreInfo] = useState(false);
  const [showQrOrderInfo, setShowQrOrderInfo] = useState(!!mesaId);

  // Force dark status bar (light icons) on mobile while the public menu is mounted
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prev = meta?.getAttribute("content") || "#ffffff";
    if (meta) meta.setAttribute("content", "#000000");
    return () => {
      if (meta) meta.setAttribute("content", prev);
    };
  }, []);

  const [clientData, setClientData] = useState<any>(null);
  const [showClientAuth, setShowClientAuth] = useState(false);
  const [clientAuthMode, setClientAuthMode] = useState<"login" | "register">("login");
  const [showClientLimitPopup, setShowClientLimitPopup] = useState(false);
  const [clientPhone, setClientPhone] = useState(mesaId ? "00000000000" : "");
  const [clientAddress, setClientAddress] = useState(mesaId ? "Consumo Local" : "");
  const [clientName, setClientName] = useState("");

  const [registerForm, setRegisterForm] = useState({
    nome_completo: "", whatsapp: "", data_nascimento: "", instagram: "",
    endereco_rua: "", endereco_numero: "", endereco_complemento: "",
    endereco_bairro: "", endereco_cidade: "", endereco_estado: "", endereco_cep: "",
  });

  const { data: mesaData } = useQuery({
    queryKey: ["mesa-info", mesaId],
    queryFn: async () => {
      if (!mesaId) return null;
      const { data, error } = await supabase
        .from("pdv_mesas")
        .select("nome")
        .eq("id", mesaId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!mesaId,
  });

  useEffect(() => {
    if (mesaId) {
      const mesaTargetId = `mesa-${mesaId}`;
      const currentName = mesaNomeParam || mesaData?.nome || "Mesa";
      
      if (!clientData || clientData.id !== mesaTargetId) {
        const newMesaData = {
          id: mesaTargetId,
          nome_completo: currentName,
          telefone: "00000000000",
          whatsapp: "00000000000",
          is_mesa_guest: true
        };
        setClientData(newMesaData);
        setClientName(currentName);
        localStorage.setItem("noov_client", JSON.stringify(newMesaData));
      } else if (clientData.is_mesa_guest && mesaData?.nome && clientData.nome_completo !== mesaData.nome) {
        const updated = { ...clientData, nome_completo: mesaData.nome };
        setClientData(updated);
        setClientName(mesaData.nome);
        localStorage.setItem("noov_client", JSON.stringify(updated));
      }
    }
  }, [mesaData, mesaId, clientData, mesaNomeParam]);

  // Realtime subscription for mesa guest name changes
  useEffect(() => {
    if (mesaId && clientData?.is_mesa_guest) {
      const channel = supabase
        .channel(`mesa-update-${mesaId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "pdv_mesas", filter: `id=eq.${mesaId}` },
          (payload) => {
            const updatedMesa = payload.new as any;
            if (updatedMesa.nome && updatedMesa.nome !== clientData.nome_completo) {
              const updated = { ...clientData, nome_completo: updatedMesa.nome };
              setClientData(updated);
              setClientName(updatedMesa.nome);
              localStorage.setItem("noov_client", JSON.stringify(updated));
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [mesaId, clientData]);
  const [clientLoading, setClientLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrdersTab, setMyOrdersTab] = useState<"pedidos" | "historico">("pedidos");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [driverLoc, setDriverLoc] = useState<[number, number] | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [storeLoc, setStoreLoc] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [geocodedCustomerLoc, setGeocodedCustomerLoc] = useState<[number, number] | null>(null);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [showProductRatingModal, setShowProductRatingModal] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [weeklyTopSellers, setWeeklyTopSellers] = useState<Record<string, number>>({});
  const pendingAutoRatingOrderIdRef = useRef<string | null>(null);
  const handledRatingOrderIdsRef = useRef<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  // ── Highlight carousel state ──
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const highlightContainerRef = useRef<HTMLDivElement>(null);
  const highlightAutoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  // Fetch linked products for the selected product
  const { data: linkedProductsData } = useQuery({
    queryKey: ["linked-products", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from("linked_products")
        .select(`
          linked_product_id,
          produtos!linked_product_id (
            id,
            nome,
            descricao,
            preco,
            categoria,
            imagem_url,
            disponivel,
            loja_id,
            tag_novo,
            tag_sugestao,
            tag_destaque,
            preco_promocional,
            promocao_validade,
            adicionais,
            tamanhos,
            max_sabores,
            unidade_medida,
            sabores
          )
        `)
        .eq("product_id", selectedProduct.id);
      
      if (error) {
        console.error("Error fetching linked products:", error);
        return [];
      }
      
      return data.map((d: any) => d.produtos).filter((p: any) => p && p.disponivel && !p.oculto);
    },
    enabled: !!selectedProduct,
  });
  
  // Check if current client has already rated the selected product
  const { data: userProductRating } = useQuery({
    queryKey: ["user-product-rating", selectedProduct?.id, clientData?.whatsapp || clientData?.telefone],
    queryFn: async () => {
      if (!selectedProduct || (!clientData?.whatsapp && !clientData?.telefone)) return null;
      const phone = clientData?.whatsapp || clientData?.telefone;
      const { data, error } = await supabase
        .from("product_ratings")
        .select("rating")
        .eq("product_id", selectedProduct.id)
        .eq("customer_phone", phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Error fetching product rating:", error);
        return null;
      }
      return data;
    },
    enabled: !!selectedProduct && (!!clientData?.whatsapp || !!clientData?.telefone),
  });

  // Cart localStorage key based on slug + client
  const getCartKey = (clientId?: string) => `noov_cart_${slug}_${clientId || "guest"}`;

  // Load saved client and cart from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("noov_client");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setClientData(parsed);
        if (parsed.endereco_rua) {
          setClientAddress([parsed.endereco_rua, parsed.endereco_numero, parsed.endereco_complemento, parsed.endereco_bairro, parsed.endereco_cidade].filter(Boolean).join(", "));
        }
        // Load persisted cart for this client+store
        const savedCart = localStorage.getItem(`noov_cart_${slug}_${parsed.id}`);
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            if (Array.isArray(parsedCart) && parsedCart.length > 0) {
              setCart(parsedCart);
              setTimeout(() => {
                toast.info(`Você tem ${parsedCart.length} ${parsedCart.length === 1 ? "item" : "itens"} no carrinho pendente 🛒`, {
                  duration: 4000,
                  action: { label: "Ver carrinho", onClick: () => setShowCart(true) },
                  style: { background: "hsl(0 84% 60%)", color: "white", border: "none" },
                });
              }, 1000);
            }
          } catch {}
        }
      } catch {}
    }
  }, [slug]);
  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    const key = getCartKey(clientData?.id);
    if (cart.length > 0) {
      localStorage.setItem(key, JSON.stringify(cart));
    } else {
      localStorage.removeItem(key);
    }
  }, [cart, clientData, slug]);

  const handleClientLogin = async () => {
    const normalizedPhone = clientPhone.replace(/\D/g, "");
    if (!normalizedPhone) { toast.error("Informe seu telefone."); return; }
    setClientLoading(true);
    try {
      // First try to find by normalized phone
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefone", normalizedPhone)
        .eq("loja_id", store?.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setClientData(data);
        localStorage.setItem("noov_client", JSON.stringify(data));
        if (data.endereco_rua) {
          setClientAddress([data.endereco_rua, data.endereco_numero, data.endereco_complemento, data.endereco_bairro, data.endereco_cidade].filter(Boolean).join(", "));
        }
        const savedCart = localStorage.getItem(getCartKey(data.id));
        if (savedCart) { try { setCart(JSON.parse(savedCart)); } catch {} }
        setShowClientAuth(false);
        toast.success(`Bem-vindo, ${data.nome_completo}! 👋`, { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
      } else {
        // Try one more time without normalization just in case
        const { data: rawData } = await supabase
          .from("clientes")
          .select("*")
          .eq("telefone", clientPhone.trim())
          .eq("loja_id", store?.id)
          .maybeSingle();

        if (rawData) {
          setClientData(rawData);
          localStorage.setItem("noov_client", JSON.stringify(rawData));
          if (rawData.endereco_rua) {
            setClientAddress([rawData.endereco_rua, rawData.endereco_numero, rawData.endereco_complemento, rawData.endereco_bairro, rawData.endereco_cidade].filter(Boolean).join(", "));
          }
          setShowClientAuth(false);
          toast.success(`Bem-vindo, ${rawData.nome_completo}! 👋`, { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
        } else {
          if (clientesLimitReached) {
            setShowClientAuth(false);
            setShowClientLimitPopup(true);
          } else {
            toast.error("Telefone não encontrado. Cadastre-se!");
            setClientAuthMode("register");
            setRegisterForm(f => ({ ...f, whatsapp: normalizedPhone }));
          }
        }
      }
    } catch { toast.error("Erro ao buscar. Tente novamente."); }
    finally { setClientLoading(false); }
  };

  const handleClientRegister = async () => {
    const { nome_completo, whatsapp, endereco_rua, endereco_bairro, endereco_cidade, endereco_estado, endereco_numero, endereco_cep } = registerForm;
    const normalizedWhatsapp = whatsapp.replace(/\D/g, "");
    
    if (!nome_completo.trim() || !normalizedWhatsapp) { 
      toast.error("Preencha seu nome e um WhatsApp válido."); 
      return; 
    }
    
    // Check if we have a store ID. If not, something is wrong with the store loading.
    if (!store?.id) {
      toast.error("Erro ao carregar dados da loja. Tente atualizar a página.");
      return;
    }

    if (clientesLimitReached) {
      setShowClientAuth(false);
      setShowClientLimitPopup(true);
      return;
    }

    setClientLoading(true);
    try {
      const { data, error } = await supabase.from("clientes").insert({
        telefone: normalizedWhatsapp,
        nome_completo: nome_completo.trim(),
        whatsapp: normalizedWhatsapp,
        loja_id: store.id,
        data_nascimento: registerForm.data_nascimento?.length === 10
          ? `${registerForm.data_nascimento.slice(6, 10)}-${registerForm.data_nascimento.slice(3, 5)}-${registerForm.data_nascimento.slice(0, 2)}`
          : null,
        endereco_rua: endereco_rua || null,
        endereco_numero: registerForm.endereco_numero || null,
        endereco_complemento: registerForm.endereco_complemento || null,
        endereco_bairro: endereco_bairro || null,
        endereco_cidade: endereco_cidade || null,
        endereco_estado: endereco_estado || null,
        endereco_cep: endereco_cep || null,
      } as any).select().single();

      if (error) {
        if (error.code === "23505") { 
          toast.error("Esse telefone já está cadastrado nesta loja. Faça login!"); 
          setClientAuthMode("login"); 
          setClientPhone(normalizedWhatsapp); 
        } else {
          console.error("Erro ao cadastrar cliente:", error);
          throw error;
        }
        return;
      }
      
      setClientData(data);
      localStorage.setItem("noov_client", JSON.stringify(data));
      if (data.endereco_rua) {
        setClientAddress([data.endereco_rua, data.endereco_numero, data.endereco_complemento, data.endereco_bairro, data.endereco_cidade].filter(Boolean).join(", "));
      }
      setShowClientAuth(false);
      toast.success(`Cadastro realizado! Bem-vindo, ${data.nome_completo}! 🎉`, { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
    } catch (e) { 
      console.error("Exception during registration:", e);
      toast.error("Erro ao cadastrar. Tente novamente."); 
    } finally { 
      setClientLoading(false); 
    }
  };

  const handleClientLogout = () => {
    const key = getCartKey(clientData?.id);
    setClientData(null);
    setCart([]);
    localStorage.removeItem("noov_client");
    localStorage.removeItem(key);
    toast.success("Você saiu da sua conta.");
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!clientData) {
      toast.error("Faça login para aplicar o cupom.");
      setShowClientAuth(true);
      return;
    }
    setIsApplyingCoupon(true);
    try {
      const { data: coupon, error } = await supabase
        .from("cupons")
        .select("*")
        .eq("loja_id", store?.id)
        .eq("codigo", couponCode.trim().toUpperCase())
        .eq("ativo", true)
        .maybeSingle();

      if (error || !coupon) {
        toast.error("Cupom inválido ou inexistente.");
        return;
      }

      const now = new Date();
      if (coupon.validade_inicio && new Date(coupon.validade_inicio) > now) {
        toast.error("Cupom ainda não está válido.");
        return;
      }
      if (coupon.validade_fim && new Date(coupon.validade_fim) < now) {
        toast.error("Cupom expirado.");
        return;
      }
      if (coupon.limite_total && coupon.usos_count >= coupon.limite_total) {
        toast.error("Cupom esgotado.");
        return;
      }

      const phone = clientData?.whatsapp || clientData?.telefone;
      
      if (coupon.tipo === 'cliente_novo') {
        const { count } = await supabase
          .from("pedidos")
          .select("*", { count: 'exact', head: true })
          .eq("lojista_id", store!.user_id)
          .eq("cliente_telefone", phone);
        
        if (count && count > 0) {
          toast.error("Este cupom é exclusivo para o primeiro pedido.");
          return;
        }
      }
      if (cartTotal < Number(coupon.valor_minimo)) {
        toast.error(`Valor mínimo para este cupom: ${formatCurrency(Number(coupon.valor_minimo))}`);
        return;
      }

      if (!coupon.tipo_publico) {
        const { data: isLinked } = await supabase
          .from("cupom_clientes")
          .select("*")
          .eq("cupom_id", coupon.id)
          .eq("cliente_identificador", phone)
          .maybeSingle();

        if (!isLinked) {
          toast.error("Este cupom é exclusivo para clientes específicos.");
          return;
        }
      }

      // Se uso_unico estiver desativado, o cliente pode usar o cupom ilimitadamente
      if (coupon.uso_unico) {
        const { count: userUses } = await supabase
          .from("uso_cupons")
          .select("*", { count: 'exact', head: true })
          .eq("cupom_id", coupon.id)
          .eq("cliente_identificador", phone);

        if (userUses !== null && userUses >= 1) {
          toast.error("Este cupom é de uso único e você já o utilizou.");
          return;
        }
      }

      setAppliedCoupon(coupon);
      toast.success("Cupom aplicado com sucesso! 🎉");
    } catch {
      toast.error("Erro ao validar cupom.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleMesaPreReceipt = () => {
    if (cart.length === 0) {
      toast.error("Seu carrinho está vazio!");
      return;
    }

    setComprovante({
      subtotal: cartTotal,
      total: totalWithDiscount,
      items: cart.map((i) => {
        const prod = products.find(p => p.id === i.id);
        const isAcai = store?.segmento === "acaiteria";
        const gratisAte = isAcai ? (prod?.max_sabores ?? 0) : 0;
        return {
          nome: i.nome,
          quantidade: i.quantidade,
          preco: i.preco,
          addons: i.addons,
          observation: i.observation,
          sabores: i.sabores,
          quantidade_sabores: i.quantidade_sabores,
          tamanho: i.tamanho,
          bordas: i.bordas,
          quantidade_bordas: i.quantidade_bordas,
          caldo_sabor: i.caldo_sabor,
          gratis_ate: gratisAte, 
          weight: i.weight, 
          unidade_medida: i.unidade_medida, 
          unit_price: i.unit_price,
        };
      }),
      storeName: store?.nome || "Loja",
      storeLogo: store?.logo_url,
      clientName: clientData?.nome_completo || "Cliente Mesa",
      createdAt: new Date().toLocaleString("pt-BR"),
      appliedCoupon: appliedCoupon ? {
        codigo: appliedCoupon.codigo,
        tipo: appliedCoupon.tipo,
        valor: appliedCoupon.tipo === 'frete_gratis' ? 0 : finalDiscountValue
      } : null,
      selectedPayment: "Consumo Local",
      deliveryMode: "mesa",
      is_pre_receipt: true
    });
    setMesaConfirmOrder(true);
    setShowCart(false);
  };

  const { data: store, isLoading: loadingStore, isError: storeError } = useQuery({
    queryKey: ["store", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  useEffect(() => {
    if (store?.id) {
      return setupGlobalErrorLogging(store.id);
    }
  }, [store?.id]);


  const { data: storeProfile } = useQuery({
    queryKey: ["store-profile", store?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("pix_chave, pix_tipo, pix_nome_favorecido, phone")
        .eq("user_id", store!.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!store?.user_id,
  });

  // Check store plan limits
  const { data: storePlanData } = useQuery({
    queryKey: ["store-plan", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loja_planos")
        .select("id, ativo, plano_id, limites_assinado, planos:plano_id(slug, limites)")
        .eq("loja_id", store!.id)
        .eq("ativo", true)
        .maybeSingle();

      return data;
    },
    enabled: !!store?.id,
  });

  // Global event image (admin-managed) — shown at top-right of header
  const { data: eventImageSettings } = useQuery({
    queryKey: ["public-event-image"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_rating_settings")
        .select("event_image_url")
        .eq("id", 1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });
  const eventImageUrl: string | null = eventImageSettings?.event_image_url ?? null;

  // Realtime: refresh event image when admin updates it
  useEffect(() => {
    const channel = supabase
      .channel("public-event-image-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_rating_settings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public-event-image"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: firstOrderCoupon } = useQuery({
    queryKey: ["first-order-coupon", store?.id, clientData?.id],
    queryFn: async () => {
      if (!store?.id || !clientData) return null;
      
      // Check if client has any orders
      const phone = clientData.whatsapp || clientData.telefone;
      const { count } = await supabase
        .from("pedidos")
        .select("*", { count: 'exact', head: true })
        .eq("lojista_id", store.user_id)
        .eq("cliente_telefone", phone);
      
      if (count && count > 0) return null;

      // Find a "cliente_novo" type coupon
      const { data } = await supabase
        .from("cupons")
        .select("*")
        .eq("loja_id", store.id)
        .eq("tipo", "cliente_novo")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data;
    },
    enabled: !!store?.id && !!clientData,
  });

  // Public discount coupons (percentual or valor_fixo) - to display info above coupon input
  const { data: publicDiscountCoupon } = useQuery({
    queryKey: ["public-discount-coupon", store?.id],
    queryFn: async () => {
      if (!store?.id) return null;
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("cupons")
        .select("*")
        .eq("loja_id", store.id)
        .eq("ativo", true)
        .eq("tipo_publico", true)
        .in("tipo", ["percentual", "fixo", "frete_gratis"])
        .or(`validade_fim.is.null,validade_fim.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!store?.id && !!store?.cupons_ativos,
  });

  // Show coupon popup once per session if enabled
  useEffect(() => {
    if (!publicDiscountCoupon || !(store as any)?.cupom_popup_ativo || !store?.cupons_ativos) return;
    const key = `coupon-popup-shown-${store.id}-${publicDiscountCoupon.codigo}`;
    if (sessionStorage.getItem(key)) return;
    const t = setTimeout(() => {
      setShowCouponPopup(true);
      sessionStorage.setItem(key, "1");
    }, 1200);
    return () => clearTimeout(t);
  }, [publicDiscountCoupon, store?.id, (store as any)?.cupom_popup_ativo, store?.cupons_ativos]);

  // Show informative popup once per session if enabled and within date limit
  useEffect(() => {
    const s = store as any;
    if (!s?.popup_informativo_ativo || !s?.popup_informativo_imagem_url) return;
    if (s?.popup_informativo_data_limite && new Date(s.popup_informativo_data_limite) < new Date()) return;
    const key = `info-popup-shown-${store?.id}`;
    if (sessionStorage.getItem(key)) return;
    const t = setTimeout(() => {
      setShowInfoPopup(true);
      sessionStorage.setItem(key, "1");
    }, 1500);
    return () => clearTimeout(t);
  }, [store?.id, (store as any)?.popup_informativo_ativo, (store as any)?.popup_informativo_imagem_url, (store as any)?.popup_informativo_data_limite]);

  const { isInTrial: storeIsInTrial, limits: publicLimits } = usePublicStorePlanLimits(store?.id);
  const storePlanLimites = (storePlanData as any)?.planos?.limites || (storePlanData as any)?.limites_assinado || {};
  const canSendWhatsapp = storeIsInTrial ? false : storePlanLimites?.enviar_whatsapp !== false;
  const canSendPanel = storeIsInTrial ? true : !!storePlanLimites?.enviar_painel;
  const isStartPlan = !storePlanData && !storeIsInTrial ? true : (!canSendPanel && canSendWhatsapp);
  const entregasEnabled = publicLimits.entregas;

  // Limite de clientes da loja → bloqueia novos cadastros
  const { data: clientesCount = 0 } = useQuery({
    queryKey: ["store-clientes-count", store?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("loja_id", store!.id);
      return count || 0;
    },
    enabled: !!store?.id,
    staleTime: 30_000,
  });
  const clientesLimitReached =
    publicLimits.max_clientes !== -1 && (clientesCount as number) >= publicLimits.max_clientes;
  const lojistaWhatsapp = ((store as any)?.whatsapp || (store as any)?.telefone || "").replace(/\D/g, "");
  const storePlanSlug = (storePlanData as any)?.planos?.slug;
  const canShowRanking = ((store as any)?.ranking_ativo === true) && (storePlanSlug === "ultra" || storeIsInTrial || !!(publicLimits as any)?.ranking_produtos);

  // Fetch top sellers (last 7 days) — used na seção "Mais vendidos da semana" do cardápio
  useEffect(() => {
    if (!store?.user_id) return;
    let cancelled = false;
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("pedidos")
        .select("items")
        .eq("lojista_id", store.user_id)
        .gte("created_at", sevenDaysAgo)
        .in("status", ["concluido", "finalizado", "entregue"]);
      if (error || cancelled || !data) return;
      const counts: Record<string, number> = {};
      for (const p of data as any[]) {
        const items = Array.isArray(p.items) ? p.items : [];
        for (const it of items) {
          const pid = it?.id;
          const qty = Number(it?.quantity || it?.quantidade || it?.qtd || 1) || 1;
          if (pid) counts[pid] = (counts[pid] || 0) + qty;
        }
      }
      setWeeklyTopSellers(counts);
    })();
    return () => { cancelled = true; };
  }, [store?.user_id]);


  // Realtime: auto-refresh store data when settings change
  useRealtimeSubscription(
    "lojas",
    [["store", slug || ""], ["public-store-data", store?.id || ""], ["store-plan", store?.id || ""]],
    store?.id ? `id=eq.${store.id}` : undefined
  );
  useRealtimeSubscription(
    "loja_planos",
    [["store-plan", store?.id || ""], ["public-plan-limits", store?.id || ""]],
    store?.id ? `loja_id=eq.${store.id}` : undefined
  );
  useRealtimeSubscription(
    "produtos",
    [["store-products", store?.id || ""]],
    store?.id ? `loja_id=eq.${store.id}` : undefined
  );


  const { data: customCatImages = {} } = useQuery({
    queryKey: ["store-category-images", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_categoria_imagens")
        .select("categoria, imagem_url")
        .eq("loja_id", store!.id);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) map[row.categoria] = row.imagem_url;
      return map;
    },
    enabled: !!store?.id,
  });

  // Fetch neighborhood shipping fees from loja_frete_bairros table
  const { data: freteBairrosDb = [] } = useQuery({
    queryKey: ["store-frete-bairros", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_frete_bairros")
        .select("bairro, valor")
        .eq("loja_id", store!.id);
      if (error) throw error;
      return (data || []) as { bairro: string; valor: number }[];
    },
    enabled: !!store?.id,
  });

  const getCategoryImage = (cat: string): string | undefined =>
    customCatImages[cat] || categoryImages[cat];

  const { data: pizzariaConfig } = useQuery({
    queryKey: ["pizzaria-config", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizzaria_configuracoes" as any)
        .select("*")
        .eq("loja_id", store!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!store?.id && store.segmento === "pizzaria",
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["store-products", store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("loja_id", store!.id)
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []).filter((p: any) => !p.oculto).map(p => ({
        ...p,
        adicionais: Array.isArray(p.adicionais) ? p.adicionais as unknown as ProductAddon[] : null,
        tamanhos: Array.isArray(p.tamanhos) ? p.tamanhos as unknown as PizzaSize[] : null,
        sabores_caldo: Array.isArray((p as any).sabores)
          ? ((p as any).sabores as any[]).filter(Boolean).map((s: any) => ({ 
              nome: String(s.nome || s.name || ""), 
              valorExtra: Number(s.valorExtra ?? s.valor_extra ?? 0),
              disponivel: s.disponivel !== false
            }))
          : null,

      })) as Product[];

    },
    enabled: !!store?.id,
  });

  const totalStoreRating = useMemo(() => {
    const productsWithRatings = products.filter(p => p.rating_count && p.rating_count > 0);
    if (productsWithRatings.length === 0) return { average: 0, count: 0 };
    
    const totalCount = productsWithRatings.reduce((sum, p) => sum + (p.rating_count || 0), 0);
    const weightedSum = productsWithRatings.reduce((sum, p) => sum + ((p.rating_average || 0) * (p.rating_count || 0)), 0);
    
    return {
      average: totalCount > 0 ? weightedSum / totalCount : 0,
      count: totalCount
    };
  }, [products]);

  // Monitor cart for unavailable products in real-time
  useEffect(() => {
    if (cart.length === 0 || !products.length) return;

    const unavailableItems = cart.filter(item => {
      const product = products.find(p => p.id === item.id);
      return product && (!product.disponivel || (product as any).oculto);
    });

    if (unavailableItems.length > 0) {
      const unavailableNames = Array.from(new Set(unavailableItems.map(i => i.nome)));
      
      // Just show the modal informing about the unavailability
      // The user is responsible for removing the item from the cart
      setUnavailableProductsModal({
        isOpen: true,
        products: unavailableNames,
        type: "cart"
      });
      setShowCart(true); // Automatically open the cart when the popup appears
      setShowForm(false); // Ensure we are on the first screen (cart list)
    }
  }, [products, cart.length]); // only run when products change or cart length changes (initial load)

  // Monitor selected product for availability
  useEffect(() => {
    if (!selectedProduct) return;
    
    const product = products.find(p => p.id === selectedProduct.id);
    if (product && (!product.disponivel || (product as any).oculto)) {
      setSelectedProduct(null);
      setUnavailableProductsModal({
        isOpen: true,
        products: [product.nome],
        type: "detail"
      });
    }
  }, [products, selectedProduct?.id]);

  const highlights = useMemo(() => {
    const items = products.filter(p => (p.tag_destaque || p.tag_novo || p.tag_sugestao) && p.disponivel);
    if (slug === 'alloha-acaiteria') {
      return [...items].sort(() => Math.random() - 0.5);
    }
    return items;
  }, [products, slug]);

  // ── Highlight carousel auto-play + scroll spy ──
  useEffect(() => {
    const container = highlightContainerRef.current;
    if (!container || highlights.length <= 1) return;

    let programmaticScroll = false;
    let programmaticTimeout: ReturnType<typeof setTimeout> | null = null;

    const scrollToIndex = (index: number) => {
      const card = container.children[index] as HTMLElement | undefined;
      if (!card) return;
      // Center the card within the container (matches snap-center)
      const target = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
      programmaticScroll = true;
      if (programmaticTimeout) clearTimeout(programmaticTimeout);
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      programmaticTimeout = setTimeout(() => {
        programmaticScroll = false;
      }, 700);
    };

    const findNearestIndex = () => {
      const center = container.scrollLeft + container.clientWidth / 2;
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < container.children.length; i++) {
        const child = container.children[i] as HTMLElement;
        const childCenter = child.offsetLeft + child.clientWidth / 2;
        const dist = Math.abs(childCenter - center);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      return nearest;
    };

    const handleScroll = () => {
      if (programmaticScroll) return;
      setActiveHighlightIndex(findNearestIndex());
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    highlightAutoPlayRef.current = setInterval(() => {
      setActiveHighlightIndex((prev) => {
        const next = (prev + 1) % highlights.length;
        scrollToIndex(next);
        return next;
      });
    }, 3000);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (highlightAutoPlayRef.current) clearInterval(highlightAutoPlayRef.current);
      if (programmaticTimeout) clearTimeout(programmaticTimeout);
    };
  }, [highlights.length]);

  // Realtime: auto-refresh products when updated
  useEffect(() => {
    if (!store?.id) return;
    const channel = supabase
      .channel(`produtos-realtime-${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "produtos", filter: `loja_id=eq.${store.id}` },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["store-products", store.id] });
          
          // Check if any product in cart became unavailable
          if (payload.event === 'UPDATE') {
            const updatedProduct = payload.new;
            const isUnavailable = !updatedProduct.disponivel || updatedProduct.oculto;
            
            if (isUnavailable) {
              setCart(prevCart => {
                const affectedItem = prevCart.find(item => item.id === updatedProduct.id);
                if (affectedItem) {
                  // Just show the modal informing about the unavailability
                  // The user is responsible for removing the item from the cart
                  setUnavailableProductsModal({
                    isOpen: true,
                    products: [updatedProduct.nome],
                    type: "cart"
                  });
                  setShowCart(true); // Automatically open the cart when the popup appears
                  setShowForm(false); // Ensure we are on the first screen (cart list)
                  return prevCart;
                }
                return prevCart;
              });
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, queryClient]);

  // Client orders query
  const { data: clientOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["client-orders", clientData?.telefone, store?.user_id, mesaId],
    queryFn: async () => {
      if (!store) return [];
      
      const phone = clientData?.whatsapp || clientData?.telefone;
      let orders: any[] = [];

      if (phone && !clientData?.is_mesa_guest) {
        const { data, error } = await supabase
          .from("pedidos")
          .select("*")
          .eq("lojista_id", store.user_id)
          .eq("cliente_telefone", phone)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!error && data) orders = [...data];
      }

      if (mesaId) {
        const { data: pdvOrders, error: pdvError } = await supabase
          .from("pdv_pedidos")
          .select("*")
          .eq("loja_id", store.id)
          .eq("mesa_id", mesaId)
          .neq("status", "finalizado")
          .eq("order_type", "mesa_cliente")
          .order("created_at", { ascending: false });
        
        if (!pdvError && pdvOrders) {
          const formattedPdvOrders = pdvOrders.map(o => ({
            ...o,
            tipo: 'mesa',
            // Map pdv fields to standard order fields if needed for display
          }));
          orders = [...orders, ...formattedPdvOrders];
        }
      }

      return orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    enabled: (!!clientData || !!mesaId) && !!store,
    refetchInterval: 10000, // Refresh every 10s to catch status updates
  });

  const hasActiveOrder = clientOrders.some((o: any) => !["finalizado", "entregue", "cancelado"].includes(o.status));

  // Geocode store address once
  useEffect(() => {
    if (!store) return;
    const s = store as any;
    const addr = [s.endereco_rua, s.endereco_numero, s.endereco_bairro, s.endereco_cidade, s.endereco_estado].filter(Boolean).join(", ");
    if (!addr) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`)
      .then(r => r.json())
      .then(data => { if (data?.[0]) setStoreLoc([Number(data[0].lat), Number(data[0].lon)]); })
      .catch(() => {});
  }, [store]);

  // Real-time driver location tracking for client
  useEffect(() => {
    if (!trackingOrderId) { setDriverLoc(null); setDriverName(null); setGeocodedCustomerLoc(null); return; }
    const fetchLoc = async () => {
      const { data } = await supabase.from("entregas").select("latitude_atual, longitude_atual, entregador_id").eq("pedido_id", trackingOrderId).maybeSingle();
      if (data?.latitude_atual && data?.longitude_atual) setDriverLoc([Number(data.latitude_atual), Number(data.longitude_atual)]);
      if (data?.entregador_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", data.entregador_id).maybeSingle();
        if (profile?.full_name) setDriverName(profile.full_name);
      }
    };
    fetchLoc();

    // Geocode delivery address if order doesn't have coordinates
    const trackedOrder = clientOrders.find((o: any) => o.id === trackingOrderId);
    if (trackedOrder && !trackedOrder.latitude_entrega && trackedOrder.endereco_entrega) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trackedOrder.endereco_entrega)}&limit=1`)
        .then(r => r.json())
        .then(data => { if (data?.[0]) setGeocodedCustomerLoc([Number(data[0].lat), Number(data[0].lon)]); })
        .catch(() => {});
    }

    const channel = supabase.channel(`driver-track-${trackingOrderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "entregas", filter: `pedido_id=eq.${trackingOrderId}` }, (payload: any) => {
        const d = payload.new;
        if (d?.latitude_atual && d?.longitude_atual) setDriverLoc([Number(d.latitude_atual), Number(d.longitude_atual)]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trackingOrderId, clientOrders]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Realtime: auto-refresh client orders + notify on status change
  useEffect(() => {
    if (!store?.user_id || !clientData) return;
    const phone = clientData?.whatsapp || clientData?.telefone;
    const channel = supabase
      .channel(`client-orders-realtime-${store.user_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `lojista_id=eq.${store.user_id}` },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          if (updated.cliente_telefone === phone && updated.status !== old.status) {
            const statusLabels: Record<string, string> = {
              pendente: "📦 Pedido enviado",
              aceito: "✅ Pedido aceito",
              preparando: "👨‍🍳 Em preparo",
              aceita: "🛵 Aguarda Coleta",
              saiu_entrega: "🛵 Saiu para entrega",
              em_transito: "🛵 A caminho de você",
              entregue: "✅ Entregue",
              finalizado: "✅ Entregue",
              cancelado: "❌ Cancelado",
            };
            const statusColors: Record<string, string> = {
              pendente: "hsl(48 96% 53%)",        // yellow-500
              aceito: "hsl(217 91% 60%)",         // blue-500
              preparando: "hsl(25 95% 53%)",      // orange-500
              aceita: "hsl(271 91% 65%)",         // purple-500
              saiu_entrega: "hsl(28 74% 26%)",    // amber-800 (marrom)
              em_transito: "hsl(28 74% 26%)",     // amber-800 (marrom)
              entregue: "hsl(142 71% 45%)",       // green-500
              finalizado: "hsl(142 71% 45%)",     // green-500
              cancelado: "hsl(0 84% 60%)",        // red / destructive
            };
            const label = statusLabels[updated.status] || updated.status;
            const bg = statusColors[updated.status] || "hsl(217 91% 60%)";
            toast.success(`Seu pedido foi atualizado: ${label}`, {
              duration: 6000,
              style: { background: bg, color: "white", border: "none" },
            });

            if (store?.avaliacoes_ativas !== false && (updated.status === "finalizado" || updated.status === "entregue") && !updated.avaliacao && !handledRatingOrderIdsRef.current.has(updated.id)) {
              pendingAutoRatingOrderIdRef.current = updated.id;
            }

            // Browser push notification
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(store?.nome || "Pedido atualizado", {
                  body: label,
                  icon: store?.logo_url || "/placeholder.svg",
                  tag: `order-${updated.id}`,
                });
              } catch (e) { /* silent */ }
            }

            // Play notification sound
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 880;
              osc.type = "sine";
              gain.gain.value = 0.3;
              osc.start();
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.stop(ctx.currentTime + 0.5);
            } catch (e) { /* silent */ }
          }
          refetchOrders();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos", filter: `lojista_id=eq.${store.user_id}` },
        () => { refetchOrders(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.user_id, clientData, refetchOrders]);

  // Top sellers all-time (soma quantidade em pedidos finalizados/entregues/concluídos + PDV)
  const { data: topSellerCounts = {} } = useQuery({
    queryKey: ["top-sellers-alltime", store?.user_id, store?.id],
    enabled: !!store?.user_id && !!store?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const counts: Record<string, number> = {};

      const [pedidosRes, pdvRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select("items")
          .eq("lojista_id", store!.user_id)
          .in("status", ["concluido", "finalizado", "entregue"]),
        supabase
          .from("pdv_pedidos")
          .select("items")
          .eq("loja_id", store!.id)
          .in("status", ["finalizado", "fechado"]),
      ]);

      const accumulate = (rows: any[] | null) => {
        if (!rows) return;
        for (const p of rows) {
          const items = Array.isArray(p.items) ? p.items : [];
          for (const it of items) {
            const id = it?.id;
            if (!id) continue;
            const qty = Number(it?.quantity || it?.quantidade || it?.qtd || 1) || 1;
            counts[id] = (counts[id] || 0) + qty;
          }
        }
      };

      accumulate(pedidosRes.data as any[]);
      accumulate(pdvRes.data as any[]);
      return counts;
    },
  });





  // Auto-show rating only for orders delivered in the current realtime session
  useEffect(() => {
    for (const order of clientOrders) {
      if (order.avaliacao) {
        handledRatingOrderIdsRef.current.add(order.id);
      }
    }

    if (store?.avaliacoes_ativas !== false && !ratingOrderId && pendingAutoRatingOrderIdRef.current) {
      const pendingOrder = clientOrders.find((o: any) => o.id === pendingAutoRatingOrderIdRef.current);

      if (
        pendingOrder &&
        (pendingOrder.status === "finalizado" || pendingOrder.status === "entregue") &&
        !pendingOrder.avaliacao &&
        !handledRatingOrderIdsRef.current.has(pendingOrder.id)
      ) {
        setRatingOrderId(pendingOrder.id);
        setRatingStars(0);
        setRatingComment("");
        setShowMyOrders(true);
        setActiveBottomTab("pedidos");
      }

      pendingAutoRatingOrderIdRef.current = null;
    }

    if (ratingOrderId) {
      const currentRatingOrder = clientOrders.find((o: any) => o.id === ratingOrderId);
      if (currentRatingOrder?.avaliacao) {
        handledRatingOrderIdsRef.current.add(currentRatingOrder.id);
        setRatingOrderId(null);
        setRatingStars(0);
        setRatingComment("");
      }
    }
  }, [clientOrders, ratingOrderId]);

  useEffect(() => {
    if (!store) return;
    // Cache-busting version derived from updated_at so PWA icon refreshes on logo change
    const ver = encodeURIComponent(String((store as any).updated_at || (store as any).atualizado_em || store.logo_url || Date.now()));
    const iconUrl = store.logo_url ? `${store.logo_url}${store.logo_url.includes("?") ? "&" : "?"}v=${ver}` : "";
    const manifest = {
      name: store.nome,
      short_name: store.nome,
      start_url: `/${store.slug}?v=${ver}`,
      id: `/${store.slug}`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: (store as any).cor_primaria || "#2563EB",
      icons: iconUrl
        ? [
            { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "maskable" },
          ]
        : [],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    let link = document.getElementById("manifest-link") as HTMLLinkElement;
    if (!link) {
      link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]') as HTMLLinkElement;
      if (link) {
        link.id = "manifest-link";
      } else {
        link = document.createElement("link");
        link.id = "manifest-link";
        link.rel = "manifest";
        document.head.appendChild(link);
      }
    }
    link.href = url;

    // Apple meta tags for iOS PWA
    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name='${name}']`);
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };
    updateMeta("apple-mobile-web-app-title", store.nome);
    updateMeta("apple-mobile-web-app-capable", "yes");
    updateMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    updateMeta("mobile-web-app-capable", "yes");
    updateMeta("theme-color", (store as any).cor_primaria || "#2563EB");

    // Apple touch icons (multiple sizes, versioned for cache refresh on logo change)
    if (iconUrl) {
      const sizes = ["", "180x180", "152x152", "120x120", "167x167"];
      sizes.forEach((size) => {
        const id = size ? `apple-touch-icon-${size}` : "apple-touch-icon";
        let appleIcon = document.getElementById(id) as HTMLLinkElement | null;
        if (!appleIcon) {
          appleIcon = document.createElement("link");
          appleIcon.id = id;
          appleIcon.rel = "apple-touch-icon";
          if (size) appleIcon.setAttribute("sizes", size);
          document.head.appendChild(appleIcon);
        }
        appleIcon.href = iconUrl;
      });
      // Standard favicon
      let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = iconUrl;
    }

    return () => URL.revokeObjectURL(url);
  }, [store]);


  // Show sticky nav reliably on mobile when header scrolls past the top area
  useEffect(() => {
    const updateStickyNav = () => {
      const el = headerRef.current;
      if (!el) {
        setShowStickyNav(false);
        return;
      }

      const headerBottom = el.getBoundingClientRect().bottom;
      setShowStickyNav(headerBottom <= 64);
    };

    updateStickyNav();
    window.addEventListener("scroll", updateStickyNav, { passive: true });
    window.addEventListener("resize", updateStickyNav);

    return () => {
      window.removeEventListener("scroll", updateStickyNav);
      window.removeEventListener("resize", updateStickyNav);
    };
  }, [store?.id, loadingStore]);

  // Apply store custom colors as CSS variables
  useEffect(() => {
    if (!store) return;
    const root = document.documentElement;
    const corPrimaria = (store as any).cor_primaria;
    const corSecundaria = (store as any).cor_secundaria;

    if (corPrimaria) {
      root.style.setProperty("--store-primary", corPrimaria);
      root.style.setProperty("--store-primary-rgb", hexToRgb(corPrimaria));
    }
    if (corSecundaria) {
      root.style.setProperty("--store-secondary", corSecundaria);
      root.style.setProperty("--store-secondary-rgb", hexToRgb(corSecundaria));
    }

    return () => {
      root.style.removeProperty("--store-primary");
      root.style.removeProperty("--store-primary-rgb");
      root.style.removeProperty("--store-secondary");
      root.style.removeProperty("--store-secondary-rgb");
    };
  }, [store]);

  // Track title visibility in product detail for sticky image overlay
  useEffect(() => {
    const container = detailScrollRef.current;
    if (!container || !selectedProduct) { setDetailTitleVisible(true); setDetailScrollY(0); return; }
    const check = () => {
      setDetailScrollY(container.scrollTop);
      if (detailTitleRef.current) {
        const rect = detailTitleRef.current.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setDetailTitleVisible(rect.bottom > containerRect.top + 200);
      }
    };
    container.addEventListener("scroll", check, { passive: true });
    check();
    return () => container.removeEventListener("scroll", check);
  }, [selectedProduct]);

  const isLoading = loadingStore || loadingProducts;

  // Trial expiry check for public store page
  const { isExpired: storeTrialExpired, isLoading: trialLoading } = useStoreTrialStatus(
    store?.id,
    store?.created_at
  );

  // ── Check if store is currently open (auto-updates every 5s) ──
  const dayMap: Record<number, string> = { 0: "domingo", 1: "segunda", 2: "terca", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sabado" };
  const storeHours = (store as any)?.horario_funcionamento as Record<string, { aberto: boolean; inicio: string; fim: string }> | null;

  const checkStoreOpen = () => {
    if (!storeHours) return true;
    const now = new Date();
    const dayKey = dayMap[now.getDay()];
    const dayConfig = storeHours[dayKey];
    if (!dayConfig || !dayConfig.aberto) return false;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = dayConfig.inicio.split(":").map(Number);
    const [endH, endM] = dayConfig.fim.split(":").map(Number);
    const start = startH * 60 + startM;
    let end = endH * 60 + endM;
    if (end <= start) end += 24 * 60;
    let curr = currentMinutes;
    if (curr < start && end > 24 * 60) curr += 24 * 60;
    return curr >= start && curr <= end;
  };

  const [isStoreOpen, setIsStoreOpen] = useState(checkStoreOpen);
  
  const closingTime = useMemo(() => {
    if (!storeHours) return null;
    const now = new Date();
    const dayKey = dayMap[now.getDay()];
    const dayConfig = storeHours[dayKey];
    return dayConfig?.aberto ? dayConfig.fim : null;
  }, [storeHours]);

  const openingInfo = useMemo(() => {
    if (!storeHours || isStoreOpen) return null;
    const now = new Date();
    const currentDay = now.getDay();
    
    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      const nextDayIndex = (currentDay + i) % 7;
      const nextDayKey = dayMap[nextDayIndex];
      const nextDayConfig = storeHours[nextDayKey];
      
      if (nextDayConfig?.aberto) {
        if (i === 0) {
          const [startH, startM] = nextDayConfig.inicio.split(":").map(Number);
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const startMinutes = startH * 60 + startM;
          if (startMinutes > currentMinutes) {
            return `abre ${nextDayConfig.inicio}`;
          }
        } else if (i === 1) {
          return `abre amanhã ${nextDayConfig.inicio}`;
        } else {
          const daysOfWeek = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
          return `abre ${daysOfWeek[nextDayIndex]} ${nextDayConfig.inicio}`;
        }
      }
    }
    return null;
  }, [storeHours, isStoreOpen, isStoreOpen]); // adding isStoreOpen twice to be safe but the first one is enough


  useEffect(() => {
    const interval = setInterval(() => {
      setIsStoreOpen(checkStoreOpen());
    }, 1000); // re-check every 1 second
    return () => clearInterval(interval);
  }, [storeHours]);

  const storeFreteFixo = (store as any)?.frete_valor_fixo ?? 5;
  const storeFreteTipo = (store as any)?.frete_tipo ?? "fixo";
  const storeFreteBairros = (Array.isArray((store as any)?.frete_bairros) ? (store as any).frete_bairros : []) as { bairro: string; valor: number }[];
  
  const allBairros = useMemo(() => {
    const dbBairros = freteBairrosDb.map(fb => fb.bairro);
    const jsonBairros = storeFreteBairros.map(fb => fb.bairro);
    return Array.from(new Set([...dbBairros, ...jsonBairros])).sort((a, b) => a.localeCompare(b));
  }, [freteBairrosDb, storeFreteBairros]);

  const storeTempoMin = (store as any)?.tempo_entrega_min ?? 30;
  const storeTempoMax = (store as any)?.tempo_entrega_max ?? 40;

  // Compute frete based on client's bairro matching loja_frete_bairros table
  const computedFrete = useMemo(() => {
    // If store is explicitly set to "fixo", ignore neighborhoods and use fixed fee for everyone
    if (storeFreteTipo === "fixo") return Number(storeFreteFixo);

    // If it's by neighborhood, we MUST find a match
    const currentBairro = customDeliveryAddress.endereco_bairro?.trim() || clientData?.endereco_bairro?.trim() || "";
    
    // If no bairro provided yet, we return null to indicate it's not determined
    if (!currentBairro) return null;
    
    const clientBairro = currentBairro.toLowerCase();
    
    // 1. Check database neighborhoods table (highest priority)
    const matchDb = freteBairrosDb.find(fb => fb.bairro.trim().toLowerCase() === clientBairro);
    if (matchDb) return Number(matchDb.valor);
    
    // 2. Check JSON field in store table (fallback)
    const matchJson = storeFreteBairros.find(fb => fb.bairro.trim().toLowerCase() === clientBairro);
    if (matchJson) return Number(matchJson.valor);
    
    // 3. If no match found for neighborhood-based delivery, return null to block
    return null;
  }, [customDeliveryAddress.endereco_bairro, clientData?.endereco_bairro, storeFreteFixo, freteBairrosDb, storeFreteTipo, storeFreteBairros]);

  // Group products by category
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.categoria || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // Sort categories by saved order
  const savedOrder = Array.isArray((store as any)?.categorias_ordem) ? (store as any).categorias_ordem as string[] : [];
  const categoryList = Object.keys(grouped).sort((a, b) => {
    const ia = savedOrder.indexOf(a);
    const ib = savedOrder.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const handleWeightChange = (val: string) => {
    setProductWeight(val);
    setProductValue("");
  };

  const handleValueChange = (val: string) => {
    setProductValue(val);
    setProductWeight("");
  };

  // Filter by search
  const filteredProducts = search.trim()
    ? products.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()))
    : null;




  // Cart helpers
  const addToCart = () => {
    if (!selectedProduct) return;
    
    const _isCaldo = (selectedProduct.categoria || "").toLowerCase() === "caldos" && Array.isArray(selectedProduct.sabores_caldo) && selectedProduct.sabores_caldo!.length > 0;
    const _caldoSaborObj = _isCaldo ? (selectedProduct.sabores_caldo || []).find(s => s.nome === selectedCaldoSabor) : null;
    
    if (_isCaldo && !_caldoSaborObj) {
      toast.error("Escolha um sabor do caldo.");
      return;
    }

    const isWeightBased = selectedProduct.unidade_medida === "kg";
    
    if (isWeightBased && !productWeight && !productValue) {
      toast.error("Informe o peso ou o valor desejado.");
      return;
    }

    const addons = selectedProduct.adicionais || [];
    const selectedAddonObjects = addons
      .filter((a) => selectedAddons.includes(a.nome) || selectedBordas.includes(a.nome))
      .map((a) => {
        const qty = isListAddonSegment && selectedAddons.includes(a.nome)
          ? (addonQuantities[a.nome] || 1)
          : 1;
        return qty > 1 ? { ...a, quantidade: qty } : a;
      });

    // Build price & label
    const finalPrice = calcSelectedPrice();
    const actualPrice = isWeightBased ? finalPrice : finalPrice / productQty;
    const unitPrice = selectedProduct.preco_promocional ? Number(selectedProduct.preco_promocional) : Number(selectedProduct.preco);

    // Build custom label and flavors
    const labelParts: string[] = [];
    let sabores: string[] = [];
    let quantidade_sabores = 0;
    let tamanho = "";
    let bordas: string[] = [];
    let quantidade_bordas = 0;

    if (isWeightBased) {
      const unit = selectedProduct.unidade_medida;
      const amount = productWeight ? `${productWeight}${unit}` : `R$ ${productValue}`;
      labelParts.push(amount);
    }
    
    if (isPizzaProduct) {
      if (selectedPizzaSize) {
        labelParts.push(selectedPizzaSize);
        tamanho = selectedPizzaSize;
      }
      // The pizza itself is the first flavor
      const allFlavorNames = [selectedProduct.nome];
      if (selectedFlavors.length > 0) {
        const extraNames = selectedFlavors.map((fid) => products.find((p) => p.id === fid)?.nome ?? "").filter(Boolean);
        allFlavorNames.push(...extraNames);
      }
      sabores = allFlavorNames;
      quantidade_sabores = allFlavorNames.length;
      labelParts.push(allFlavorNames.join(" / "));
      if (quantidade_sabores > 1) {
        labelParts.push(`${quantidade_sabores} sabores`);
      }

      if (selectedBordas.length > 0) {
        bordas = selectedBordas;
        quantidade_bordas = selectedBordas.length;
        labelParts.push("Borda: " + selectedBordas.join(", "));
      }
    }
    
    if (!isPizzaProduct && selectedAddons.length > 0) {
      const labels = selectedAddons.map((nome) => {
        const qty = isListAddonSegment ? (addonQuantities[nome] || 1) : 1;
        return qty > 1 ? `${nome} x${qty}` : nome;
      });
      labelParts.push(labels.join(", "));
    }
    if (_isCaldo && _caldoSaborObj) {
      const extra = Number(_caldoSaborObj.valorExtra || 0);
      labelParts.unshift(`Sabor: ${_caldoSaborObj.nome}${extra > 0 ? ` (+${formatCurrency(extra)})` : ""}`);
    }
    const customLabel = labelParts.join(" • ") || undefined;
    const caldoSaborForCart = _isCaldo && _caldoSaborObj ? { nome: _caldoSaborObj.nome, valorExtra: Number(_caldoSaborObj.valorExtra || 0) } : null;


    if (editingCartUid) {
      setCart((prev) =>
        prev.map((item) =>
          item.uid === editingCartUid
            ? { ...item, preco: actualPrice, quantidade: isWeightBased ? 1 : productQty, customLabel, addons: selectedAddonObjects, observation, sabores, quantidade_sabores, caldo_sabor: caldoSaborForCart, tamanho, bordas, quantidade_bordas, weight: productWeight ? Number(productWeight) : undefined, unidade_medida: selectedProduct.unidade_medida, unit_price: unitPrice }
            : item
        )
      );
      toast.success("Item atualizado! ✏️");
      setEditingCartUid(null);
    } else {
      const uid = `${selectedProduct.id}-${Date.now()}`;
      setCart((prev) => [
        ...prev,
        {
          uid,
          id: selectedProduct.id,
          nome: selectedProduct.nome,
          preco: actualPrice,
          quantidade: isWeightBased ? 1 : productQty,
          customLabel,
          imagem_url: selectedProduct.imagem_url,
          addons: selectedAddonObjects,
          observation,
          sabores,
          quantidade_sabores,
          caldo_sabor: caldoSaborForCart,

          tamanho,
          bordas,
          quantidade_bordas,
          weight: productWeight ? Number(productWeight) : undefined,
          unidade_medida: selectedProduct.unidade_medida, unit_price: unitPrice
        },
      ]);
      toast.success("Adicionado ao carrinho! 🛒", { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
      setHasAddedCurrentProduct(true);
      
      // Se houver produtos vinculados, não fecha o modal e rola até eles
      if (linkedProductsData && linkedProductsData.length > 0) {
        // Pequeno atraso para garantir que o componente foi renderizado antes de rolar
        setTimeout(() => {
          const isDesktop = window.innerWidth >= 768;
          const targetId = isDesktop ? "linked-products-section-desktop" : "linked-products-section";
          const linkedSection = document.getElementById(targetId);
          if (linkedSection) {
            linkedSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
        return;
      }
    }
    setOpenedFromCart(false);
    setSelectedProduct(null);
  };

  const { data: cartUpsellProducts } = useQuery({
    queryKey: ["cart-upsell", cart.map(i => i.id).join(',')],
    queryFn: async () => {
      if (cart.length === 0) return [];
      
      const productIds = cart.map(item => item.id);
      
      const { data, error } = await supabase
        .from("linked_products")
        .select(`
          linked_product_id,
          produtos!linked_product_id (
            id,
            nome,
            descricao,
            preco,
            categoria,
            imagem_url,
            disponivel,
            loja_id,
            tag_novo,
            tag_sugestao,
            tag_destaque,
            preco_promocional,
            promocao_validade,
            adicionais,
            tamanhos,
            max_sabores,
            unidade_medida,
            sabores
          )
        `)
        .in("product_id", productIds);
      
      if (error) {
        console.error("Error fetching cart upsell products:", error);
        return [];
      }
      
      // Get unique products that are not already in the cart
      const uniqueProducts = new (Map as any)();
      data?.forEach((d: any) => {
        const prod = d.produtos;
        if (prod && !productIds.includes(prod.id)) {
          uniqueProducts.set(prod.id, prod);
        }
      });
      
      return Array.from(uniqueProducts.values());
    },
    enabled: cart.length > 0,
  });

  const editCartItem = (item: CartItem) => {
    const product = products.find((p) => p.id === item.id);
    if (!product) return;
    setSelectedProduct(product);
    setSelectedAddons(item.addons?.filter((a: any) => a.tipo !== 'borda').map((a) => a.nome) || []);
    const restoredQuantities: Record<string, number> = {};
    (item.addons || []).forEach((a: any) => {
      if (a && a.tipo !== 'borda' && Number(a.quantidade) > 1) {
        restoredQuantities[a.nome] = Number(a.quantidade);
      }
    });
    setAddonQuantities(restoredQuantities);
    setSelectedBordas(item.bordas || item.addons?.filter((a: any) => a.tipo === 'borda').map((a) => a.nome) || []);
    setObservation(item.observation || "");
    setProductQty(item.quantidade);
    setEditingCartUid(item.uid);
    setSelectedPizzaSize(item.tamanho || "");
    setSelectedCaldoSabor(item.caldo_sabor?.nome || "");

    
    // Restore flavors
    if (item.sabores && item.sabores.length > 1) {
      // The first flavor is the pizza itself, extras are from index 1 onwards
      const extraFlavorNames = item.sabores.slice(1);
      const extraFlavorIds = extraFlavorNames.map(name => 
        products.find(p => p.nome === name && p.categoria === product.categoria)?.id
      ).filter(id => !!id) as string[];
      setSelectedFlavors(extraFlavorIds);
    } else {
      setSelectedFlavors([]);
    }

    setShowCart(false);
    setOpenedFromCart(true);
  };

  const updateQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.uid === uid ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0)
    );
  };

  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.preco * i.quantidade, 0), [cart]);

  // Auto-remove coupon if subtotal falls below minimum
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.valor_minimo > 0 && cartTotal < Number(appliedCoupon.valor_minimo)) {
      setAppliedCoupon(null);
      setCouponCode("");
      toast.info(`Cupom removido: o valor mínimo do pedido é ${formatCurrency(Number(appliedCoupon.valor_minimo))}`);
    }
  }, [cartTotal, appliedCoupon]);
  
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.tipo === 'fixo' || appliedCoupon.tipo === 'cliente_novo' || appliedCoupon.tipo === 'valor_fixo') return Number(appliedCoupon.valor);
    if (appliedCoupon.tipo === 'percentual') return (cartTotal * Number(appliedCoupon.valor)) / 100;
    return 0;
  }, [appliedCoupon, cartTotal]);

  const finalDiscountValue = Math.min(couponDiscount, cartTotal);
  const totalWithDiscount = Math.max(0, cartTotal - finalDiscountValue);

  const totalComFrete = useMemo(() => {
    const isFreteGratis = appliedCoupon?.tipo === 'frete_gratis';
    const frete = deliveryMode === "delivery" ? (computedFrete ?? 0) : 0;
    const finalFrete = isFreteGratis ? 0 : frete;
    return Math.max(0, totalWithDiscount + finalFrete);
  }, [totalWithDiscount, deliveryMode, computedFrete, appliedCoupon]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantidade, 0);

  const handleSubmitOrder = async () => {
    // If table order and no client logged in, we skip the basic client check
    if (!mesaId && (!clientData || !store || !deliveryMode)) return;
    if (mesaId && (!store || !deliveryMode)) return;

    if (storeTrialExpired) {
      toast.error("O cardápio está temporariamente suspenso.");
      return;
    }

    const currentFreteValor = deliveryMode === "delivery" ? (computedFrete ?? 0) : 0;
    
    // Block if delivery by neighborhood and no match found
    if (deliveryMode === "delivery" && storeFreteTipo === "bairro" && (computedFrete === null || computedFrete === undefined)) {
      toast.error("Seu bairro não esta relacionado na lista de entrega");
      return;
    }

    const useCustomAddr = customDeliveryAddress.endereco_rua?.trim();
    const bairroEntrega = deliveryMode === "delivery"
      ? (useCustomAddr ? customDeliveryAddress.endereco_bairro : clientData?.endereco_bairro)
      : null;
    const endereco = deliveryMode === "delivery"
      ? useCustomAddr
        ? [customDeliveryAddress.endereco_rua, customDeliveryAddress.endereco_numero, customDeliveryAddress.endereco_bairro, customDeliveryAddress.endereco_cidade].filter(Boolean).join(", ")
        : [clientData?.endereco_rua, clientData?.endereco_numero, clientData?.endereco_bairro, clientData?.endereco_cidade].filter(Boolean).join(", ")
      : deliveryMode === "mesa" ? `Mesa: ${clientName}` : "Retirada no local";

    const isFreteGratis = appliedCoupon?.tipo === 'frete_gratis';
    const finalFrete = isFreteGratis ? 0 : currentFreteValor;

    const observacoesCompletas = [
      form.observacoes.trim(),
      selectedPayment ? `Pagamento: ${selectedPayment}` : "",
      selectedPayment === "Dinheiro" && needsChange ? `Troco para: R$ ${changeAmount}` : "",
    ].filter(Boolean).join(" | ");

    setSending(true);
    try {
      // Build WhatsApp message (used for both plans)
      const itemsText = cart.map((i) => {
        let line = `• ${i.quantidade}x ${i.nome}`;
        if (i.tamanho) line += ` (${i.tamanho})`;
        if (i.caldo_sabor) {
          const extra = Number(i.caldo_sabor.valorExtra || 0);
          line += `\n  ﹂Sabor: ${i.caldo_sabor.nome}${extra > 0 ? ` (+${formatCurrency(extra)})` : ""}`;
        }

        if (i.sabores && i.sabores.length > 0) {
          line += `\n  ﹂Sabores (${i.quantidade_sabores || i.sabores.length}): ${i.sabores.join(" / ")}`;
        }
        if (i.bordas && i.bordas.length > 0) {
          line += `\n  ﹂Borda (${i.quantidade_bordas || i.bordas.length}): ${i.bordas.join(", ")}`;
        }
        if (i.addons && i.addons.length > 0) {
          const addonNames = i.addons.map((a: any) => {
            if (typeof a === "string") return a;
            const aQty = Math.max(1, Number(a.quantidade) || 1);
            return aQty > 1 ? `${a.nome} x${aQty}` : a.nome;
          });
          line += `\n  ﹂Adicionais: ${addonNames.join(", ")}`;
        }
        if (i.observation) line += `\n  ﹂Obs: ${i.observation}`;
        line += ` — ${formatCurrency(i.preco * i.quantidade)}`;
        return line;
      }).join("\n");

      const whatsMsg = [
        `---`,
        `🛒 *NOVO PEDIDO*`,
        `🏍️ *${store.nome}*`,
        `---`,
        ``,
        `👤 *Cliente:* ${clientData?.nome_completo || "Cliente Mesa"}`,
        `📱 *Telefone:* ${clientData?.whatsapp || clientData?.telefone || "N/A"}`,
        deliveryMode === "mesa" ? `📍 *Consumo Local:* ${clientName}` : (deliveryMode === "delivery" ? `📍 *Endereço:* ${endereco}${bairroEntrega ? `\n🏘️ *Bairro:* ${bairroEntrega}` : ""}` : "📍 *Retirada no local*"),

        `💳 *Pagamento:* ${selectedPayment || "Não informado"}`,
        selectedPayment === "Dinheiro" && needsChange ? `💰 *Troco para:* R$ ${changeAmount}` : "",
        ``,
        `---`,
        `📦 *ITENS DO PEDIDO*`,
        `---`,
        itemsText,
        ``,
        `---`,
        deliveryMode === "delivery" ? `🏍️ Subtotal: ${formatCurrency(cartTotal)}` : "",
        appliedCoupon && appliedCoupon.tipo !== 'frete_gratis' 
          ? `🎟️ *Cupom de desconto:* -${formatCurrency(finalDiscountValue)}` 
          : "",
        appliedCoupon?.tipo === 'frete_gratis' 
          ? `🚚 *Frete:* Grátis! (${formatCurrency(currentFreteValor)})` 
          : (deliveryMode === "delivery" ? `🏍️ Frete: ${formatCurrency(finalFrete)}` : ""),
        `💵 *TOTAL: ${formatCurrency(totalComFrete)}*`,
        `---`,
        form.observacoes.trim() ? `\n📝 *Obs:* ${form.observacoes.trim()}` : "",
        ``,
        `⏰ ${new Date().toLocaleString("pt-BR")}`,
      ].filter(Boolean).join("\n");

      const storePhone = storeProfile?.phone || "";

      if (isStartPlan && deliveryMode !== "mesa") {
        // Start plan: only send WhatsApp, no DB insert, no receipt
        if (storePhone) {
          const cleanPhone = storePhone.replace(/\D/g, "");
          const whatsUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(whatsMsg)}`;
          window.open(whatsUrl, "_blank");
        } else {
          toast.error("A loja não possui telefone cadastrado para receber pedidos.");
          return;
        }
      } else {
        // Table order OR non-start plan paid order
        if (deliveryMode === "mesa") {
          // Table Order Logic: insert into pdv_pedidos instead of main orders
          try {
            // Check if there's already an active pdv_pedido for this table
            const { data: mesa } = await supabase
              .from("pdv_mesas")
              .select("id, status, pedido_atual_id")
              .eq("id", mesaId)
              .single();

            let targetPedidoId = mesa?.pedido_atual_id;

            if (!targetPedidoId) {
              // Create new PDV order
              const { data: newPdvOrder, error: orderErr } = await supabase
                .from("pdv_pedidos")
                .insert({
                  loja_id: store.id,
                  mesa_id: mesaId,
                  status_cozinha: "pendente",
                  items: cart.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    preco: i.preco,
                    quantidade: i.quantidade,
                    customLabel: i.customLabel,
                    adicionais: i.addons || [],
                    observacao: i.observation || "",
                    sabores: i.sabores || [],
                    quantidade_sabores: i.quantidade_sabores || 0,
                    tamanho: i.tamanho || "",
                    bordas: i.bordas || [],
                    quantidade_bordas: i.quantidade_bordas || 0,
                    caldo_sabor: i.caldo_sabor || null,
                    weight: i.weight,
                    unidade_medida: i.unidade_medida,
                    is_new: false // First order items are not marked as "new additions"
                  })) as any,
                  total: cartTotal,
                  order_type: "mesa_cliente" // Custom flag to identify QR orders
                })
                .select()
                .single();

              if (orderErr) throw orderErr;
              targetPedidoId = newPdvOrder.id;

              // Update mesa status
              await supabase
                .from("pdv_mesas")
                .update({ status: "ocupada", pedido_atual_id: targetPedidoId })
                .eq("id", mesaId);
            } else {
              // Add items to existing PDV order
              const { data: currentPedido } = await supabase
                .from("pdv_pedidos")
                .select("items, total")
                .eq("id", targetPedidoId)
                .single();

              const currentItems = Array.isArray(currentPedido?.items) ? currentPedido.items : [];
              const newItems = cart.map((i) => ({
                id: i.id,
                nome: i.nome,
                preco: i.preco,
                quantidade: i.quantidade,
                customLabel: i.customLabel,
                adicionais: i.addons || [],
                observacao: i.observation || "",
                sabores: i.sabores || [],
                quantidade_sabores: i.quantidade_sabores || 0,
                tamanho: i.tamanho || "",
                bordas: i.bordas || [],
                quantidade_bordas: i.quantidade_bordas || 0,
                caldo_sabor: i.caldo_sabor || null,
                weight: i.weight,
                unidade_medida: i.unidade_medida,
                is_new: true // Identify this item as a new addition to an existing order
              }));

              await supabase
                .from("pdv_pedidos")
                .update({
                  items: [...currentItems, ...newItems] as any,
                  total: (Number(currentPedido?.total) || 0) + cartTotal,
                  status_cozinha: "pendente", // Reset to pending if new items added
                  last_added_at: new Date().toISOString()
                } as any)
                .eq("id", targetPedidoId);
            }

            toast.success("Pedido enviado com sucesso! Bom apetite! 🍽️", { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
            setSelectedProduct(null);
            setCart([]);
            setShowCart(false);
            setSending(false);
            return;
          } catch (err) {
            console.error("Error sending table order:", err);
            toast.error("Erro ao enviar pedido para a mesa.");
            setSending(false);
            return;
          }
        }

        // Regular paid order (non-table)
        let latEntrega: number | null = null;
        let lngEntrega: number | null = null;
        if (deliveryMode === "delivery" && endereco) {
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1`);
            const geoData = await geoRes.json();
            if (geoData?.[0]) {
              latEntrega = Number(geoData[0].lat);
              lngEntrega = Number(geoData[0].lon);
            }
          } catch {}
        }


        // Paid plan: save to DB + show receipt (no WhatsApp)
        // If start plan, order enters as "finalizado" because the orders page is blocked
        const { data: insertedOrder, error } = await supabase.from("pedidos").insert({
          lojista_id: store.user_id,
          cliente_nome: clientData?.nome_completo || "Cliente",
          cliente_telefone: clientData?.whatsapp || clientData?.telefone || "N/A",

          endereco_entrega: endereco,
          bairro_entrega: bairroEntrega,
          latitude_entrega: latEntrega,
          longitude_entrega: lngEntrega,
          observacoes: observacoesCompletas || null,
          tipo: deliveryMode === "delivery" ? "delivery" : "retirada",
          status: publicLimits?.pedidos ? "pendente" : "finalizado",
          total: totalComFrete,
          taxa_entrega: appliedCoupon?.tipo === 'frete_gratis' ? currentFreteValor : (finalFrete || 0),
          cupom_codigo: appliedCoupon?.codigo || null,
          cupom_desconto: appliedCoupon?.tipo === 'frete_gratis' ? currentFreteValor : (finalDiscountValue || 0),
          items: cart.map((i) => {
            const prod = products.find(p => p.id === i.id);
            const isAcai = store?.segmento === "acaiteria";
            const gratisAte = isAcai ? (prod?.max_sabores ?? 0) : 0;
            return {
              id: i.id,
              nome: i.nome,
              preco: i.preco,
              quantidade: i.quantidade,
              customLabel: i.customLabel,
              adicionais: i.addons || [],
              observacao: i.observation || "",
              sabores: i.sabores || [],
              quantidade_sabores: i.quantidade_sabores || 0,
              tamanho: i.tamanho || "",
              bordas: i.bordas || [],
              quantidade_bordas: i.quantidade_bordas || 0,
              caldo_sabor: i.caldo_sabor || null,
              gratis_ate: gratisAte, weight: i.weight, unidade_medida: i.unidade_medida, unit_price: i.unit_price,

            };
          }) as any,
        }).select().single();
        if (error) throw error;
        
        // Registrar uso do cupom
        if (appliedCoupon) {
          try {
            await supabase.from("cupons").update({ usos_count: (appliedCoupon.usos_count || 0) + 1 }).eq("id", appliedCoupon.id);
            await supabase.from("uso_cupons").insert({
              cupom_id: appliedCoupon.id,
              cliente_identificador: clientData?.whatsapp || clientData?.telefone || "N/A",
              pedido_id: insertedOrder.id,
              valor_desconto: finalDiscountValue
            });
          } catch (e) {
            console.error("Erro ao registrar uso do cupom:", e);
          }
        }

        // Close product detail (if open) so receipt shows over the main menu
        setSelectedProduct(null);
        // Save comprovante data with order ID for tracking
        setComprovante({
          orderId: insertedOrder?.id,
          numeroDiario: (insertedOrder as any)?.numero_diario,
          storeName: store.nome,
          storeLogo: store.logo_url,
          clientName: clientData?.nome_completo || "Cliente",
          clientPhone: clientData?.whatsapp || clientData?.telefone || "N/A",

          endereco,
          deliveryMode,
          selectedPayment,
          needsChange,
          changeAmount,
          items: cart.map((i) => {
            const prod = products.find(p => p.id === i.id);
            const isAcai = store?.segmento === "acaiteria";
            const gratisAte = isAcai ? (prod?.max_sabores ?? 0) : 0;
            return {
              nome: i.nome,
              quantidade: i.quantidade,
              preco: i.preco,
              addons: i.addons,
              observation: i.observation,
              sabores: i.sabores,
              quantidade_sabores: i.quantidade_sabores,
              tamanho: i.tamanho,
              bordas: i.bordas,
              quantidade_bordas: i.quantidade_bordas,
              caldo_sabor: i.caldo_sabor,
              gratis_ate: gratisAte, weight: i.weight, unidade_medida: i.unidade_medida, unit_price: i.unit_price,

            };
          }),
          subtotal: cartTotal,
          frete: currentFreteValor,
          appliedCoupon: appliedCoupon ? {
            codigo: appliedCoupon.codigo,
            tipo: appliedCoupon.tipo,
            valor: appliedCoupon.tipo === 'frete_gratis' ? currentFreteValor : finalDiscountValue
          } : null,
          total: totalComFrete,
          createdAt: new Date().toLocaleString("pt-BR"),
        });
      }

      toast.success("Pedido enviado com sucesso! 🎉", { style: { background: "hsl(142 71% 45%)", color: "white", border: "none" } });
      // Refetch client orders so "Meus Pedidos" is up to date
      refetchOrders();
      setCart([]);
      setShowForm(false);
      setShowCart(false);
      setDeliveryMode(null);
      setSelectedPayment(null);
      setNeedsChange(null);
      setChangeAmount("");
      setPaymentStepDone(false);
      setForm({ observacoes: "" });
      setDeliveryAddressConfirmed(false);
      setEditingDeliveryAddress(false);
      setCustomDeliveryAddress({ endereco_rua: "", endereco_numero: "", endereco_bairro: "", endereco_cidade: "", endereco_complemento: "", endereco_cep: "" });
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const openProduct = (product: Product, preSelectedSize?: string) => {
    if (!product.disponivel) {
      toast.error("Produto esgotado no momento.");
      return;
    }
    if (storeTrialExpired) {
      toast.error("O cardápio está temporariamente suspenso.");
      return;
    }
    if (!isStoreOpen) {
      toast.error("A loja está fechada no momento.");
      return;
    }
    if (!clientData) {
      toast("Faça login para adicionar produtos.", { description: "Cadastre-se ou entre com seu telefone." });
      setShowClientAuth(true);
      return;
    }
    setSelectedProduct(product);
    setSelectedAddons([]);
    setAddonQuantities({});
    setSelectedBordas([]);
    setObservation("");
    setProductQty(1);
    setProductWeight("");
    setProductValue("");
    setSelectedPizzaSize(preSelectedSize ?? product.tamanhos?.[0]?.nome ?? "");
    setSelectedFlavors([]);
    setSelectedCaldoSabor("");

    setHasAddedCurrentProduct(false);
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      const isAcai = store?.segmento === "acaiteria";
      const limit = isAcai ? Number(selectedProduct?.max_adicionais || 0) : 0;
      if (limit > 0 && prev.length >= limit) {
        toast.info(`Limite de ${limit} adicionais atingido. Remova um para escolher outro.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const incrementAddonQty = (nome: string) => {
    const isAcai = store?.segmento === "acaiteria";
    const limit = isAcai ? Number(selectedProduct?.max_adicionais || 0) : 0;
    const totalQty = Object.values(addonQuantities).reduce((a, b) => a + b, 0);
    if (limit > 0 && totalQty >= limit) {
      toast.info(`Limite de ${limit} adicionais atingido. Remova um para escolher outro.`);
      return;
    }
    setAddonQuantities((prev) => ({ ...prev, [nome]: (prev[nome] || 0) + 1 }));
    setSelectedAddons((prev) => (prev.includes(nome) ? prev : [...prev, nome]));
  };

  const decrementAddonQty = (nome: string) => {
    setAddonQuantities((prev) => {
      const cur = prev[nome] || 0;
      const next = Math.max(0, cur - 1);
      const copy = { ...prev };
      if (next === 0) delete copy[nome];
      else copy[nome] = next;
      return copy;
    });
    setSelectedAddons((prev) => {
      const cur = (addonQuantities[nome] || 0) - 1;
      if (cur <= 0) return prev.filter((a) => a !== nome);
      return prev;
    });
  };

  // Scroll to category (desconta a altura da barra fixa que aparece ao rolar)
  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(`category-${cat}`);
    if (!el) return;

    const getOffset = () => {
      const wrapper = document.getElementById("sticky-nav-wrapper");
      if (wrapper) return wrapper.getBoundingClientRect().height + 8;
      const stickyBar = document.getElementById("sticky-category-bar");
      // Estima altura total da barra fixa: header (h-16 = 64) + barra de categorias
      return (stickyBar?.offsetHeight ?? 0) + 64 + 8;
    };

    const scrollOnce = () => {
      const top = el.getBoundingClientRect().top + window.scrollY - getOffset();
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    };

    scrollOnce();
    // Após a barra fixa aparecer no fim do scroll, reajusta para não cobrir o título
    window.setTimeout(scrollOnce, 450);
    window.setTimeout(scrollOnce, 850);
  };

  // Click outside categories bar deselects (only when clicking non-interactive areas)
  useEffect(() => {
    if (!activeCategory) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (categoriesRef.current && categoriesRef.current.contains(target)) return;
      const stickyBar = document.getElementById("sticky-category-bar");
      if (stickyBar && stickyBar.contains(target)) return;
      // Ignore clicks on interactive elements (buttons, links, inputs, products)
      if (target.closest("button, a, input, textarea, select, [role='button']")) return;
      setActiveCategory(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeCategory]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
        {store?.logo_url ? (
          <motion.img
            src={store.logo_url}
            alt="Logo"
            className="w-24 h-24 rounded-full object-cover shadow-elevated"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          />
        ) : (
          <motion.div
            className="text-4xl font-extrabold font-display text-primary tracking-tight"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            N<span className="text-secondary">O</span>OV
          </motion.div>
        )}
        <motion.div className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-secondary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </motion.div>
        <p className="text-sm text-muted-foreground">Carregando cardápio...</p>
      </div>
    );
  }

  // ── Store trial expired — show offline popup ──
  if (storeTrialExpired && !trialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm mx-auto"
        >
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store?.nome} className="w-20 h-20 rounded-full object-cover mx-auto mb-6 shadow-elevated" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏪</span>
            </div>
          )}
          <h1 className="text-2xl font-bold font-display text-foreground mb-3">
            Página temporariamente<br />fora do ar
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Estamos passando por ajustes técnicos. Por favor, tente novamente mais tarde.
          </p>
          <p className="text-muted-foreground text-xs mt-4">
            Pedimos desculpas pelo inconveniente.
          </p>
          <a href="https://noov.app.br" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-6 text-xs text-muted-foreground hover:text-primary transition-colors">
            Feito por <span className="font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
          </a>
        </motion.div>
      </div>
    );
  }

  if (!store && !loadingStore) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <ShoppingCart className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold font-display text-foreground">Loja não encontrada</h1>
        <p className="text-muted-foreground mt-2">Verifique o link e tente novamente.</p>
        {storeError && (
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  const isPizzaProduct = store?.segmento === "pizzaria" && selectedProduct?.tamanhos && selectedProduct.tamanhos.length > 0;
  const allAddons = selectedProduct?.adicionais || [];
  const selectedSizeObj = isPizzaProduct ? selectedProduct?.tamanhos?.find((s) => s.nome === selectedPizzaSize) : null;
  const productBordas = isPizzaProduct ? (allAddons as any[]).filter((a: any) => a.tipo === 'borda' && (a.tamanho === selectedPizzaSize || !a.tamanho || a.tamanho === 'Todos')) : [];
  const productAddons = isPizzaProduct ? (allAddons as any[]).filter((a: any) => a.tipo !== 'borda' && (a.tamanho === selectedPizzaSize || !a.tamanho || a.tamanho === 'Todos')) : allAddons;
  
  // Sincroniza a quantidade máxima de bordas com o tamanho selecionado ou configurações do produto
  const maxSaboresBorda = isPizzaProduct 
    ? (selectedSizeObj && selectedSizeObj.max_sabores_borda !== undefined && selectedSizeObj.max_sabores_borda !== null
      ? Number(selectedSizeObj.max_sabores_borda) 
      : (selectedProduct?.max_sabores_borda !== undefined && selectedProduct?.max_sabores_borda !== null
        ? Number(selectedProduct.max_sabores_borda)
        : (productBordas.length > 0 ? Number((productBordas[0] as any)?.max_sabores_borda || 1) : 1)))
    : 1;
  const isAcaiProduct = store?.segmento === "acaiteria";
  const isCaldoProduct = (selectedProduct?.categoria || "").toLowerCase() === "caldos" && Array.isArray(selectedProduct?.sabores_caldo) && (selectedProduct?.sabores_caldo?.length || 0) > 0;
  const caldoSabores = isCaldoProduct ? (selectedProduct?.sabores_caldo || []) : [];
  const selectedCaldoSaborObj = caldoSabores.find(s => s.nome === selectedCaldoSabor) || null;

  const handleSelectCaldoSabor = (nome: string) => {
    setSelectedCaldoSabor(nome);
    if (productAddons && productAddons.length > 0) {
      setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const targetId = isMobile ? "addons-section" : "addons-section-desktop";
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  };

  const isListAddonSegment = (store?.segmento === "hamburgueria" || store?.segmento === "lanchonete") && !isPizzaProduct;
  const freeAddonsCount = isAcaiProduct ? (selectedProduct?.max_sabores ?? 0) : 0;
  const pizzaFlavorProducts = isPizzaProduct
    ? products.filter((p) => p.categoria === selectedProduct?.categoria && p.id !== selectedProduct?.id && p.disponivel)
    : [];
  const maxFlavorsTotal = selectedSizeObj?.max_sabores ?? selectedProduct?.max_sabores ?? 1;
  // The selected pizza itself counts as the first flavor, so extra flavors allowed = total - 1
  const maxExtraFlavors = Math.max(0, maxFlavorsTotal - 1);

  const toggleBorda = (nome: string) => {
    setSelectedBordas((prev) => {
      if (prev.includes(nome)) return prev.filter((b) => b !== nome);
      if (prev.length >= maxSaboresBorda) return prev;
      return [...prev, nome];
    });
  };

  const handlePizzaSizeChange = (sizeName: string) => {
    setSelectedPizzaSize(sizeName);
    // Trim flavors if new size allows fewer
    const newSize = selectedProduct?.tamanhos?.find((s) => s.nome === sizeName);
    const newMaxFlavorsTotal = newSize?.max_sabores ?? selectedProduct?.max_sabores ?? 1;
    const newMaxExtra = Math.max(0, newMaxFlavorsTotal - 1);
    setSelectedFlavors((prev) => prev.slice(0, newMaxExtra));
    
    const newMaxSaboresBorda = newSize && newSize.max_sabores_borda !== undefined && newSize.max_sabores_borda !== null
      ? Number(newSize.max_sabores_borda) 
      : (selectedProduct?.max_sabores_borda !== undefined && selectedProduct?.max_sabores_borda !== null
        ? Number(selectedProduct.max_sabores_borda)
        : (productBordas.length > 0 ? Number((productBordas[0] as any)?.max_sabores_borda || 1) : 1));
    setSelectedBordas((prev) => prev.slice(0, newMaxSaboresBorda));
  };

  const toggleFlavor = (productId: string) => {
    setSelectedFlavors((prev) => {
      if (prev.includes(productId)) return prev.filter((f) => f !== productId);
      if (prev.length >= maxExtraFlavors) return prev;
      const next = [...prev, productId];
      // Auto-scroll to bordas (or addons) when reaching the flavor limit
      if (next.length >= maxExtraFlavors) {
        setTimeout(() => {
          const target =
            document.getElementById("bordas-section") ||
            document.getElementById("addons-section");
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
      return next;
    });
  };

  // Helper: get a flavor product's price for the currently selected pizza size
  const getFlavorPriceForSize = (flavor: Product): number => {
    if (selectedPizzaSize && flavor.tamanhos && flavor.tamanhos.length > 0) {
      const sized = flavor.tamanhos.find((s) => s.nome === selectedPizzaSize);
      if (sized) return Number(sized.preco);
    }
    return Number(flavor.preco);
  };

  const calcSelectedPrice = () => {
    if (!selectedProduct) return 0;

    // Pizza: price based on selected size + highest flavor price ratio or average
    if (isPizzaProduct && selectedProduct.tamanhos) {
      const size = selectedProduct.tamanhos.find((s) => s.nome === selectedPizzaSize);
      // Use the size price when selected, fallback to base product price
      let basePrice = size?.preco ?? Number(selectedProduct.preco);
      
      const flavorPrices = [basePrice]; // Original pizza flavor price
      selectedFlavors.forEach((fid) => {
        const fp = products.find((p) => p.id === fid);
        if (fp) flavorPrices.push(getFlavorPriceForSize(fp));
      });

      const formaCobranca = (pizzariaConfig as any)?.forma_cobranca || (store as any)?.forma_cobranca || "maior_preco";
      let price = basePrice;

      if (formaCobranca === "fracionado") {
        // Average of flavors
        const sum = flavorPrices.reduce((a, b) => a + b, 0);
        price = sum / flavorPrices.length;
      } else {
        // Highest price among flavors
        price = Math.max(...flavorPrices);
      }
      // Add bordas
      for (const nome of selectedBordas) {
        const borda = productBordas.find((b: any) => b.nome === nome);
        if (borda) price += Number(borda.preco);
      }
      // Add addons
      for (const id of selectedAddons) {
        const addon = productAddons.find((a) => a.nome === id);
        if (addon) price += Number(addon.preco);
      }
      return price * productQty;
    }

    const isWeightBased = selectedProduct.unidade_medida === "kg";
    const basePrice = selectedProduct.preco_promocional ? Number(selectedProduct.preco_promocional) : Number(selectedProduct.preco);
    
    let price = basePrice;

    if (isWeightBased) {
      if (productValue) {
        price = Number(productValue);
      } else if (productWeight) {
        price = (basePrice / 1000) * Number(productWeight);
      } else {
        price = 0; // Don't show price if nothing entered for weight-based
      }
    }

    // For açaí: first N add-ons are free, rest are charged
    const sortedSelectedAddons = [...selectedAddons];
    for (let i = 0; i < sortedSelectedAddons.length; i++) {
      if (i < freeAddonsCount) continue; // free addon
      const addon = productAddons.find((a) => a.nome === sortedSelectedAddons[i]);
      if (addon) {
        const qty = isListAddonSegment ? (addonQuantities[addon.nome] || 1) : 1;
        price += Number(addon.preco) * qty;
      }
    }
    // Caldos: somar valor extra do sabor escolhido
    if (isCaldoProduct && selectedCaldoSaborObj) {
      price += Number(selectedCaldoSaborObj.valorExtra || 0);
    }
    return isWeightBased ? price : price * productQty;

  };

  const canAddPizza = !isPizzaProduct || !!selectedPizzaSize;

  // Store custom colors
  const storePrimary = (store as any)?.cor_primaria || "";
  const storePrimaryRgb = storePrimary ? hexToRgb(storePrimary) : "var(--primary)";
  const storeSecondary = (store as any)?.cor_secundaria || undefined;

  return (
    <div className="min-h-screen bg-background pb-36">
      {/* Banner extends edge-to-edge under the iOS status bar (status-bar-style: black-translucent) */}
      
      {/* ═══ FIXED VIEW CART BUTTON ═══ */}

      <AnimatePresence>
        {cart.length > 0 && !showCart && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-0 right-0 z-40 px-2 md:hidden"
          >
            <Button
              onClick={() => setShowCart(true)}
              className="w-full h-14 rounded-2xl shadow-xl border-0 font-bold text-white flex items-center justify-between px-4"
              style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center relative mr-1.5">
                  <ShoppingCart className="w-10 h-10 text-white" />
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-primary text-[9px] font-black flex items-center justify-center" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                    {cart.reduce((sum, item) => sum + item.quantidade, 0)}
                  </span>
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[13px] font-bold">Ver carrinho</span>
                  <span className="text-[10px] font-medium opacity-90">
                    {cart.reduce((sum, item) => sum + item.quantidade, 0)} {cart.reduce((sum, item) => sum + item.quantidade, 0) === 1 ? "item" : "itens"} • {formatCurrency(totalWithDiscount)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="h-6 w-[1px] bg-white/30 mr-1" />
                <span className="text-[12px] font-bold">Finalizar pedido</span>
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BOTTOM NAVIGATION BAR ═══ */}
      {clientData && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] md:hidden">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {!clientData.is_mesa_guest && (
            <button 
              onClick={() => {
                setActiveBottomTab("perfil");
                setClientAuthMode("login");
                setShowClientAuth(true);
              }}
              className={`flex flex-col items-center gap-1 transition-colors flex-1 ${activeBottomTab === "perfil" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <User className="w-5 h-5" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
              <span className="text-[10px] font-medium">Perfil</span>
            </button>
          )}

          {canShowRanking && (
            <button 
              onClick={() => {
                setActiveBottomTab("ranking");
                setShowRanking(true);
              }}
              className={`flex flex-col items-center gap-1 transition-colors flex-1 ${activeBottomTab === "ranking" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <Flame className="w-5 h-5" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
              <span className="text-[10px] font-medium">+ Vendidos</span>
            </button>
          )}

          {(publicLimits?.pedidos || !!mesaId) && (
            <button 
              onClick={() => {
                setActiveBottomTab("pedidos");
                setShowMyOrders(true);
              }}
              className={`flex flex-col items-center gap-1 transition-colors flex-1 relative ${activeBottomTab === "pedidos" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <div className="relative">
                <ClipboardList className="w-5 h-5" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                {(() => {
                  const openOrdersCount = clientOrders.filter((o: any) => !["finalizado", "entregue", "cancelado"].includes(o.status)).length;
                  if (openOrdersCount > 0) {
                    return (
                      <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-background shadow-sm">
                        {openOrdersCount}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <span className="text-[10px] font-medium">Meus pedidos</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div ref={headerRef} className="relative" style={{ marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Banner image as full background — edge to edge, under the iOS status bar */}
        <img
          src={(store as any).banner_url || segmentBanners[store.segmento] || bannerLanchonete}
          alt={`Banner ${store.segmento}`}
          className="absolute inset-0 w-full h-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Event image overlay (admin-managed) — top-right white square */}
        {eventImageUrl && !(store as any)?.ocultar_evento && (
          <div
            className="absolute left-0 right-0 z-10 h-16 sm:h-20 overflow-hidden pointer-events-none"
            style={{ top: 'env(safe-area-inset-top, 0px)' }}
          >

            <img
              src={eventImageUrl}
              alt="Evento"
              className="w-full h-full object-fill"
            />
            <div
              className="absolute inset-0 animate-event-shine"
              style={{
                WebkitMaskImage: `url(${eventImageUrl})`,
                maskImage: `url(${eventImageUrl})`,
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
              }}
            />
          </div>
        )}
        {eventImageUrl && !(store as any)?.ocultar_evento && (
          <EventCountdown
            className="absolute right-3 z-20 pointer-events-none top-[calc(env(safe-area-inset-top,0px)+3.75rem)] sm:top-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
          />
        )}


        <div className="relative container max-w-5xl px-4 pt-12 sm:pt-16 pb-3">
          <div className="flex items-start gap-3">
            {/* Logo — stays behind the event banner */}
            <div className="relative z-[50] w-20 h-20 rounded-2xl bg-card border-[3px] border-card shadow-elevated overflow-hidden flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl bg-muted">
                  {segmentEmoji[store.segmento] || "🏪"}
                </div>
              )}
            </div>

            {/* Info + Cart — stays above the event banner */}
            <div className="relative z-20 flex-1 min-w-0 -mt-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-xl font-bold font-display text-white leading-tight truncate flex-1 min-w-0">{store.nome}</h1>
                    {(!eventImageUrl || (store as any)?.ocultar_evento) && (
                      <button
                        onClick={() => {
                          const shareText = `Confira o cardápio de ${store.nome} no NOOV!`;
                          const shareUrl = window.location.href;
                          if (navigator.share) {
                            navigator.share({ title: store.nome, text: shareText, url: shareUrl }).catch(() => {
                              const msg = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
                              window.open(`https://wa.me/?text=${msg}`, "_blank");
                            });
                          } else {
                            const msg = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
                            window.open(`https://wa.me/?text=${msg}`, "_blank");
                          }
                        }}
                        className="flex-shrink-0 p-1 text-white/80 hover:text-white transition-colors"
                        title="Compartilhar"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {totalStoreRating.count > 0 && (
                        <>
                          <div className="flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-[10px] font-bold text-white">
                              {totalStoreRating.average.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-white/80">({totalStoreRating.count})</span>
                          </div>
                          <span className="text-white text-[10px]">·</span>
                        </>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-white/90">
                        {storeTempoMin}–{storeTempoMax} min
                      </span>
                      {(store as any)?.rating_average && !totalStoreRating.count && (
                        <>
                          <span className="text-white text-[10px]">·</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-[10px] font-bold text-white">{Number((store as any).rating_average).toFixed(1)}</span>
                          </div>
                        </>
                      )}
                      <span className="text-white text-[10px]">·</span>
                      <span className="flex items-center gap-1 text-[10px] text-white/90">
                        {storeFreteTipo === "fixo"
                          ? formatCurrency(storeFreteFixo)
                          : clientData?.endereco_bairro
                            ? (computedFrete === null ? "Bairro não listado" : formatCurrency(computedFrete))
                            : "Por bairro"} taxa
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status row below name/cart */}
              <div className="flex items-center justify-between gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                  {storeTrialExpired ? (
                    <Badge className="bg-destructive/60 text-white border-destructive/50 text-[10px] px-1.5 py-0 font-medium">
                      Suspenso
                    </Badge>
                  ) : isStoreOpen ? (
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-success/40 text-white border-success/50 text-[10px] px-1.5 py-0 font-medium">
                        Aberto
                      </Badge>
                      {closingTime && (
                        <span className="text-white/80 text-[10px] font-medium">até {closingTime}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-destructive/40 text-white border-destructive/50 text-[10px] px-1.5 py-0 font-medium">
                        Fechado
                      </Badge>
                      {openingInfo && (
                        <span className="text-white/80 text-[10px] font-medium">{openingInfo}</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 ml-auto">
                  {canShowRanking && (
                    <button
                      onClick={() => setShowRanking(true)}
                      className="flex items-center gap-1 text-white/80 text-[10px] font-medium md:flex hidden"
                    >
                      <Flame className="w-3 h-3" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                      + Vendidos
                    </button>
                  )}
                  <button
                    onClick={() => setShowStoreInfo(true)}
                    className="flex items-center gap-1 text-white/80 text-[10px] font-medium"
                  >
                    Mais informações
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Removed absolute Info button as it is now inline */}
      </div>

      {/* ═══ STORE INFO (below header banner, overlays menu) ═══ */}
      <div className="relative z-40">
        <AnimatePresence>
          {showStoreInfo && store && (
            <>
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-foreground/40"
                onClick={() => setShowStoreInfo(false)}
              />
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="absolute left-0 right-0 z-40 bg-card shadow-xl rounded-b-2xl overflow-hidden origin-top"
              >
              <div className="container max-w-5xl px-4 py-3">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-bold font-display" style={{ color: storePrimary || 'hsl(var(--primary))' }}>Informações</h2>
                  <button onClick={() => setShowStoreInfo(false)} className="p-1.5 rounded-full hover:bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-3 bg-muted/50 rounded-lg p-0.5">
                  {([
                    { key: "horario", label: "Horário", icon: <Clock className="w-3 h-3" /> },
                    { key: "local", label: "Localização", icon: <MapPin className="w-3 h-3" /> },
                    { key: "entrega", label: "Entrega", icon: <Bike className="w-3 h-3" /> },
                    { key: "contato", label: "Contatos", icon: <Phone className="w-3 h-3" /> },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setInfoTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${
                        infoTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                      }`}
                      style={infoTab === tab.key ? { color: storePrimary || undefined } : undefined}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {infoTab === "horario" && (
                  <div className="space-y-0 text-xs p-3 rounded-xl bg-muted/50 border border-border/50">
                    {storeHours ? (
                      [
                        { key: "segunda", label: "Segunda" },
                        { key: "terca", label: "Terça" },
                        { key: "quarta", label: "Quarta" },
                        { key: "quinta", label: "Quinta" },
                        { key: "sexta", label: "Sexta" },
                        { key: "sabado", label: "Sábado" },
                        { key: "domingo", label: "Domingo" },
                      ].map(({ key, label }, idx, arr) => {
                        const d = storeHours[key];
                        const todayKey = dayMap[new Date().getDay()];
                        const isToday = key === todayKey;
                        return (
                          <div key={key}>
                            <div className={`flex justify-between py-1.5 ${isToday ? "font-bold" : ""}`}>
                              <span className={isToday ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                              <span className={d?.aberto ? (isToday ? "text-foreground" : "text-foreground font-medium") : "text-destructive font-medium"}>
                                {d?.aberto ? `${d.inicio} – ${d.fim}` : "Fechado"}
                              </span>
                            </div>
                            {idx < arr.length - 1 && <div className="border-t border-border/30" />}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground">Horários não cadastrados.</p>
                    )}
                  </div>
                )}

                {infoTab === "local" && (
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                    {((store as any).endereco_rua || (store as any).endereco_cidade) ? (
                      <>
                        {/* Text above map */}
                        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 text-center">
                          Clique na logo para chegar até aqui
                        </p>
                        {/* Map embed - interactive, clipped to hide Maps card */}
                        <div className="relative w-full h-44 rounded-lg overflow-hidden mb-3 border border-border/30" style={{ clipPath: "inset(0 0 22px 0 round 0.5rem)" }}>
                          <iframe
                            title="Localização da loja"
                            width="100%"
                            height="calc(100% + 22px)"
                            style={{ border: 0, height: "calc(100% + 22px)" }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                            src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(
                              [(store as any).endereco_rua, (store as any).endereco_numero, (store as any).endereco_bairro, (store as any).endereco_cidade, (store as any).endereco_estado].filter(Boolean).join(", ")
                            )}&zoom=16`}
                          />
                          {/* Store logo as clickable map pin - opens navigation */}
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              [(store as any).endereco_rua, (store as any).endereco_numero, (store as any).endereco_bairro, (store as any).endereco_cidade, (store as any).endereco_estado].filter(Boolean).join(", ")
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center z-10 cursor-pointer"
                          >
                            <div className="w-14 h-14 rounded-full border-3 border-white shadow-elevated overflow-hidden bg-card active:scale-95 transition-transform">
                              {store.logo_url ? (
                                <img src={store.logo_url} alt={store.nome} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-lg bg-muted">
                                  {segmentEmoji[store.segmento] || "🏪"}
                                </div>
                              )}
                            </div>
                            <div className="w-2 h-2 rotate-45 bg-white shadow-sm -mt-1" />
                          </a>
                        </div>
                        <p className="text-xs text-foreground">
                          {[(store as any).endereco_rua, (store as any).endereco_numero].filter(Boolean).join(", ")}
                          {(store as any).endereco_complemento && ` - ${(store as any).endereco_complemento}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {[(store as any).endereco_bairro, (store as any).endereco_cidade, (store as any).endereco_estado].filter(Boolean).join(" - ")}
                          {(store as any).endereco_cep && ` • CEP: ${(store as any).endereco_cep}`}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Endereço não cadastrado.</p>
                    )}
                  </div>
                )}

                {infoTab === "entrega" && (
                  <div className="space-y-0 text-xs p-3 rounded-xl bg-muted/50 border border-border/50">
                    <div className="flex justify-between py-1.5"><span className="text-muted-foreground">Tempo estimado</span><span className="font-medium text-foreground">{storeTempoMin}–{storeTempoMax} min</span></div>
                    <div className="border-t border-border/30" />
                    {storeFreteTipo === "fixo" ? (
                      <div className="flex justify-between py-1.5"><span className="text-muted-foreground">Taxa de entrega</span><span className="font-medium text-foreground">{formatCurrency(storeFreteFixo)}</span></div>
                    ) : (
                      <>
                        <div className="flex justify-between py-1.5 mb-1"><span className="text-muted-foreground">Taxa de entrega</span><span className="font-medium text-foreground">Por bairro</span></div>
                        {storeFreteBairros.map((fb, i) => (
                          <div key={i}>
                            <div className="flex justify-between pl-2 py-1">
                              <span className="text-muted-foreground">{fb.bairro}</span>
                              <span className="font-medium text-foreground">{formatCurrency(fb.valor)}</span>
                            </div>
                            {i < storeFreteBairros.length - 1 && <div className="border-t border-border/20 ml-2" />}
                          </div>
                        ))}
                        {storeFreteBairros.length === 0 && <p className="text-muted-foreground pl-2 py-1">Nenhum bairro cadastrado.</p>}
                      </>
                    )}
                  </div>
                )}
                
                {infoTab === "contato" && (
                  <div className="space-y-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                    {!(store as any).whatsapp && !(store as any).instagram && !(store as any).telefone && !storeProfile?.phone && (
                      <p className="text-muted-foreground text-center py-4">Contatos não informados.</p>
                    )}
                    
                    {((store as any).whatsapp || (store as any).telefone || storeProfile?.phone) && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">WhatsApp</p>
                            <p className="text-xs font-bold">{formatPhone((store as any).whatsapp || (store as any).telefone || storeProfile?.phone)}</p>
                          </div>
                        </div>
                        <a 
                          href={`https://wa.me/${((store as any).whatsapp || (store as any).telefone || storeProfile?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, sou ${clientData?.nome_completo || "um cliente"}, vim pelo aplicativo`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-full bg-green-500 text-white text-[10px] font-bold hover:bg-green-600 transition-colors"
                        >
                          Conversar
                        </a>
                      </div>
                    )}

                    {(store as any).instagram && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/30">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                            <Instagram className="w-5 h-5 text-pink-600" />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase">Instagram</p>
                            <p className="text-xs font-bold">@{(store as any).instagram.replace("@", "")}</p>
                          </div>
                        </div>
                        <a 
                          href={`https://instagram.com/${(store as any).instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-full bg-pink-500 text-white text-[10px] font-bold hover:bg-pink-600 transition-colors"
                        >
                          Seguir
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* NOOV branding */}
                <a href="https://noov.app.br" target="_blank" rel="noopener noreferrer" className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-border/30 hover:opacity-80 transition-opacity">
                  <span className="text-[10px] text-muted-foreground">Feito por</span>
                  <span className="text-[10px] font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>

      {/* ═══ STICKY NAV (appears on scroll) ═══ */}
      <AnimatePresence>
        {showStickyNav && store && !selectedProduct && !showCart && !showForm && !showPreReceipt && !showInfoPopup && !showCouponPopup && !showStoreInfo && !showClientAuth && !showClientLimitPopup && !showMyOrders && !showProductRatingModal && !showRanking && !unavailableProductsModal.isOpen && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed top-0 left-0 right-0 z-[80] bg-background shadow-lg overflow-hidden"
            style={{ paddingTop: eventImageUrl && !(store as any)?.ocultar_evento ? 'calc(env(safe-area-inset-top, 0px))' : 'env(safe-area-inset-top, 0px)' }}
            id="sticky-nav-wrapper"
          >
            {eventImageUrl && !(store as any)?.ocultar_evento && (
              <div
                className="absolute left-0 right-0 z-0 h-16 sm:h-20 overflow-hidden pointer-events-none"
                style={{ top: 'env(safe-area-inset-top, 0px)' }}
              >
                <img src={eventImageUrl} alt="" className="w-full h-full object-fill" />
                <div
                  className="absolute inset-0 animate-event-shine"
                  style={{
                    WebkitMaskImage: `url(${eventImageUrl})`,
                    maskImage: `url(${eventImageUrl})`,
                    WebkitMaskSize: '100% 100%',
                    maskSize: '100% 100%',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                  }}
                />
                <EventCountdown />
              </div>
            )}
            <div className="container max-w-5xl px-4 h-16 flex items-center justify-between relative z-[2]">
              <div className="flex-1" />

              <div className="flex-1 flex justify-end gap-2">
                {(!eventImageUrl || (store as any)?.ocultar_evento) && (
                  <button
                    onClick={() => {
                      const shareText = `Confira o cardápio de ${store.nome} no NOOV!`;
                      const shareUrl = window.location.href;
                      if (navigator.share) {
                        navigator.share({ title: store.nome, text: shareText, url: shareUrl }).catch(() => {
                          const msg = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
                          window.open(`https://wa.me/?text=${msg}`, "_blank");
                        });
                      } else {
                        const msg = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
                        window.open(`https://wa.me/?text=${msg}`, "_blank");
                      }
                    }}
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors mt-10"
                    title="Compartilhar"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Logo acima do menu categoria e na frente da imagem do evento */}
            <div className="relative z-[90] h-6 bg-background">
              <div className="absolute left-1/2 -translate-x-1/2 -top-[52px]">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.05 }}
                  className="w-20 h-20 rounded-full bg-card border-[3px] border-background shadow-elevated overflow-hidden"
                >
                  {store.logo_url ? (
                    <img src={store.logo_url} alt={store.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl bg-muted">
                      {segmentEmoji[store.segmento] || "🏪"}
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            {/* Category bar inside sticky nav */}
            {categoryList.length > 1 && (
              <div className="bg-background pt-1.5 pb-2" id="sticky-category-bar">
                <div className="container max-w-5xl pl-4 pr-0">
                  <div className="flex gap-2 overflow-x-auto py-1 snap-x snap-mandatory scrollbar-hide pr-0">
                    {categoryList.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => scrollToCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all snap-start flex-shrink-0 border text-white shadow-md`}
                        style={{
                          backgroundColor: activeCategory === cat
                            ? (storeSecondary || 'hsl(var(--secondary))')
                            : (storePrimary || 'hsl(var(--primary))'),
                          borderColor: activeCategory === cat
                            ? (storeSecondary || 'hsl(var(--secondary))')
                            : (storePrimary || 'hsl(var(--primary))'),
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


      {/* ═══ COUPON REMINDER (above Principais Escolhas) ═══ */}
      {!loadingProducts && !search && store?.cupons_ativos && (store as any)?.cupom_lembrete_ativo && publicDiscountCoupon && (
        <div className="container max-w-5xl px-4 mt-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Ticket className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-emerald-700 leading-tight">
                Você tem {publicDiscountCoupon.tipo === 'frete_gratis'
                  ? 'frete grátis'
                  : publicDiscountCoupon.tipo === 'percentual'
                    ? `${Number(publicDiscountCoupon.valor)}% de desconto`
                    : `${formatCurrency(Number(publicDiscountCoupon.valor))} de desconto`}!
              </p>
              <p className="text-[10px] text-emerald-600 font-medium leading-tight mt-0.5">
                Use o código <span className="font-bold text-emerald-700">{publicDiscountCoupon.codigo}</span> no carrinho
                {Number(publicDiscountCoupon.valor_minimo) > 0 && (
                  <> em pedidos a partir de <span className="font-bold text-emerald-700">{formatCurrency(Number(publicDiscountCoupon.valor_minimo))}</span></>
                )}.
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(publicDiscountCoupon.codigo);
                toast.success("Código copiado!");
              }}
              className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 transition-colors flex-shrink-0"
            >
              COPIAR
            </button>
          </div>
        </div>
      )}

      {/* ═══ SAUDAÇÃO CLIENTE ═══ */}
      {(clientData?.nome_completo || mesaId) && !search && (
        <div className="container max-w-5xl pt-1 pb-0 px-4 mx-0 my-0 mt-2">
          {(mesaId || clientData?.is_mesa_guest) ? (
            <p className="text-xl font-bold mb-2" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
              {(() => {
                const nome = mesaNomeParam ?? mesaData?.nome ?? clientData?.nome_completo ?? "";
                const num = String(nome).replace(/mesa/gi, "").trim();
                return num ? `Mesa ${num}` : "Mesa";
              })()}
            </p>
          ) : clientData?.nome_completo && (
            <p className="text-xl font-bold mb-2" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
              {!isStoreOpen
                ? `Olá, ${String(clientData.nome_completo).trim().split(/\s+/)[0]}, estamos fechado!`
                : `Olá, ${String(clientData.nome_completo).trim().split(/\s+/)[0]}, vamos pedir?`}
            </p>
          )}
        </div>
      )}


      {/* ═══ HIGHLIGHTS / DESTAQUES ═══ */}
      {!loadingProducts && highlights.length > 0 && !search && (
        <div className="container max-w-5xl pt-2 pb-2 px-4 mx-0 my-0">



          <div
            ref={highlightContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 -mx-4 snap-x snap-mandatory my-0 [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
          >
            {highlights.map((item) => (
              <motion.div
                key={item.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => openProduct(item)}
                className="flex-shrink-0 w-[calc(100vw-2rem)] max-w-[520px] snap-center cursor-pointer"
              >
                <div className="relative aspect-[3/1] rounded-2xl bg-muted overflow-hidden shadow-lg border border-border/50">
                  {(item.banner_url || item.imagem_url) ? (
                    <img src={item.banner_url || item.imagem_url!} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-muted to-muted/50">
                      {segmentEmoji[store?.segmento || ""] || "📦"}
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {item.tag_destaque && (
                      <Badge className={`border-0 shadow-sm font-bold text-[10px] ${item.banner_url ? 'bg-secondary/30 text-accent-foreground backdrop-blur-sm' : 'bg-secondary text-accent-foreground'}`}>
                        DESTAQUE
                      </Badge>
                    )}
                    {item.tag_novo && (
                      <Badge className={`border-0 shadow-sm font-bold text-[10px] text-white ${item.banner_url ? 'bg-green-500/30 backdrop-blur-sm' : 'bg-green-500'}`}>
                        NOVO
                      </Badge>
                    )}
                    {item.tag_sugestao && (
                      <Badge className={`border-0 shadow-sm font-bold text-[10px] text-white ${item.banner_url ? 'bg-blue-500/30 backdrop-blur-sm' : 'bg-blue-500'}`}>
                        SUGESTÃO
                      </Badge>
                    )}
                  </div>
                  {!item.banner_url && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-white font-bold text-base leading-tight truncate">{item.nome}</p>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-white/90 font-extrabold text-sm flex items-center gap-1.5">
                            {store?.segmento === "pizzaria" 
                              ? "" 
                              : item.tamanhos && Array.isArray(item.tamanhos) && item.tamanhos.length > 0 
                              ? formatCurrency(Math.min(...(item.tamanhos as any[]).map(s => s.preco)))
                              : item.preco_promocional ? (
                                <>
                                  <span className="line-through text-white/60 font-medium text-xs">{formatCurrency(item.preco)}</span>
                                  <span>{formatCurrency(item.preco_promocional)}</span>
                                </>
                              ) : formatCurrency(item.preco)}
                          </p>
                          {store?.avaliacoes_produtos_ativas && item.rating_count && item.rating_count > 0 ? (
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                                <span className="text-[10px] font-bold text-white">{Number(item.rating_average).toFixed(1)}</span>
                              </div>
                              <span className="text-[10px] text-white/60">({item.rating_count})</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          {/* Carousel dots indicator */}
          {highlights.length > 1 && (
            <div className="flex justify-center items-center gap-2 mt-2">
              {highlights.map((_, idx) => {
                const isActive = idx === activeHighlightIndex;
                const accent = storePrimary || "hsl(220 90% 50%)";
                return (
                  <div
                    key={idx}
                    className={`h-2 rounded-full overflow-hidden transition-all duration-300 ease-out ${
                      isActive ? "w-6" : "w-2 bg-black/20"
                    }`}
                    style={isActive ? { backgroundColor: `${accent}33` } : undefined}
                  >
                    {isActive && (
                      <motion.div
                        key={`progress-${activeHighlightIndex}`}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, ease: "linear" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ CATEGORY SCROLL ═══ */}
      {categoryList.length > 1 && (
        <div className="bg-background">
          <div className="container max-w-5xl px-4" ref={categoriesRef}>
            <div className="flex gap-3 overflow-x-auto pt-3 pb-2 snap-x snap-mandatory scrollbar-hide pl-2 pr-0 -mr-4">
              {categoryList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`flex flex-col items-center gap-0 px-2 py-0.5 rounded-3xl transition-all snap-start flex-shrink-0 min-w-[84px] w-[84px] shadow-sm ${
                    activeCategory === cat
                      ? "bg-white border-2"
                      : "bg-white border-2 border-transparent"
                  }`}
                  style={activeCategory === cat ? { borderColor: storePrimary || "hsl(var(--primary))" } : undefined}
                >
                  <div className="flex flex-col items-center w-full">
                    {getCategoryImage(cat) ? (
                      <img src={getCategoryImage(cat)!} alt={cat} className="w-16 h-16 md:w-14 md:h-14 rounded-full object-cover aspect-square ring-2 ring-white shadow-md mb-1" />
                    ) : (
                      <span className="w-16 h-16 md:w-14 md:h-14 rounded-full aspect-square flex items-center justify-center text-3xl md:text-2xl bg-muted ring-2 ring-white shadow-md mb-1">{categoryIcons[cat] || "📦"}</span>
                    )}
                    <span className={`text-[10px] md:text-[8px] lowercase tracking-tight font-bold max-w-[80px] md:max-w-[76px] truncate ${activeCategory === cat ? 'text-primary' : 'text-muted-foreground'}`} style={activeCategory === cat && storePrimary ? { color: storePrimary } : undefined}>
                      {cat}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOP 5 MAIS VENDIDOS ═══ */}
      {!loadingProducts && !search && (store as any)?.mais_vendidos_ativo !== false && (() => {
        const counts = weeklyTopSellers as Record<string, number>;
        const topSellers = [...products]
          .filter((p) => p.disponivel && (counts[p.id] || 0) > 0)
          .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
          .slice(0, 5);
        if (topSellers.length === 0) return null;
        return (
          <div className="container max-w-5xl pt-3 pb-2 px-4">
            <h2 className="text-lg font-bold font-display mb-2 flex items-center gap-2 text-foreground">
              <Flame className="w-5 h-5 text-secondary animate-pulse" />
              Mais vendidos da semana
            </h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pl-2 pr-0 -mr-4 snap-x snap-mandatory">
              {topSellers.map((item, idx) => (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openProduct(item)}
                  className="flex-shrink-0 w-[100px] snap-start cursor-pointer"
                >
                  <div className="relative aspect-square rounded-xl bg-muted overflow-hidden shadow-md border border-border/50">
                    {item.imagem_url ? (
                      <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-muted to-muted/50">
                        {segmentEmoji[store?.segmento || ""] || "📦"}
                      </div>
                    )}
                    <Badge
                      className={`absolute top-1 left-1 border-0 shadow-md font-bold text-[9px] px-1.5 py-0 ${
                        idx === 0
                          ? "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950"
                          : idx === 1
                          ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900"
                          : idx === 2
                          ? "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-50"
                          : "bg-secondary text-accent-foreground"
                      }`}
                    >
                      {idx + 1}º
                    </Badge>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">

                      <p className="text-white font-bold text-[10px] leading-tight truncate">{item.nome}</p>

                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══ PRODUCTS ═══ */}
      <div className={`container max-w-5xl px-4 pb-4 ${activeCategory ? "pt-6" : "pt-0 -mt-2"}`}>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-4">🍽️</span>
            <p className="text-muted-foreground">Este cardápio ainda está sendo montado.</p>
            <p className="text-muted-foreground text-sm">Volte em breve!</p>
          </div>
        ) : (
          categoryList.map((category) => {
            const items = [...(grouped[category] || [])].sort((a, b) => {
              if (a.disponivel === b.disponivel) return 0;
              return a.disponivel ? -1 : 1;
            });
            const categoriasEstilo = (store as any)?.categorias_estilo || {};
            const style = categoriasEstilo[category] || "lista";

            if (style === "horizontal") {
              return (
                <div key={category} id={`category-${category}`} className="mb-8 my-[20px]">

                  <h2 className="text-lg font-bold font-display text-foreground mb-3 flex items-center gap-2 pl-1">
                    {getCategoryImage(category) ? (
                      <img src={getCategoryImage(category)!} alt={category} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span>{categoryIcons[category] || "📦"}</span>
                    )}
                    {category}
                    <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                  </h2>
                  <div className="flex gap-3 overflow-x-auto pb-0 pr-0 -mr-4 snap-x snap-mandatory scrollbar-hide my-0">
                    {items.map((product, i) => (
                      <HorizontalProductCard 
                        key={product.id} 
                        product={product} 
                        index={i} 
                        cart={cart} 
                        onAdd={(size) => openProduct(product, size)} 
                        storePrimary={storePrimary} 
                        segmento={store?.segmento}
                        avaliacoesProdutosAtivas={store?.avaliacoes_produtos_ativas}
                      />
                    ))}
                    <div className="flex-shrink-0 w-1" />
                  </div>
                </div>
              );
            }

            if (style === "grid2") {
              return (
                <div key={category} id={`category-${category}`} className="mb-8 my-[20px]">
                  <h2 className="text-lg font-bold font-display text-foreground mb-3 flex items-center gap-2 pl-1">
                    {getCategoryImage(category) ? (
                      <img src={getCategoryImage(category)!} alt={category} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span>{categoryIcons[category] || "📦"}</span>
                    )}
                    {category}
                    <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map((product, i) => (
                      <HorizontalProductCard
                        key={product.id}
                        product={product}
                        index={i}
                        cart={cart}
                        onAdd={(size) => openProduct(product, size)}
                        storePrimary={storePrimary}
                        segmento={store?.segmento}
                        avaliacoesProdutosAtivas={store?.avaliacoes_produtos_ativas}
                        fullWidth
                      />
                    ))}
                  </div>
                </div>
              );
            }

            return (
            <div key={category} id={`category-${category}`} className="mb-8 my-[20px]">
              <h2 className="text-lg font-bold font-display text-foreground mb-3 flex items-center gap-2">
                {getCategoryImage(category) ? (
                  <img src={getCategoryImage(category)!} alt={category} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <span>{categoryIcons[category] || "📦"}</span>
                )}
                {category}
                <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
                {items.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} cart={cart} onAdd={(size) => openProduct(product, size)} storePrimary={storePrimary} segmento={store?.segmento} avaliacoesProdutosAtivas={store?.avaliacoes_produtos_ativas} />
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* ═══ POWERED BY ═══ */}
      <div className="container max-w-5xl pb-8 text-center">
        <a href="https://noov.app.br" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          Feito com <span className="font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
        </a>
      </div>

      <SystemRatingPopup clientData={clientData} lojaId={store?.id} />

      {/* ═══ FLOATING CART BUTTON ═══ */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && !selectedProduct && !comprovante && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-0 right-0 px-6 z-30"
          >
            <button
              onClick={() => setShowCart(true)}
              className="w-full max-w-sm mx-auto h-12 rounded-full text-white font-bold text-sm shadow-elevated flex items-center justify-between px-6 active:scale-[0.98] transition-transform"
              style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Ver carrinho • {cartCount} {cartCount === 1 ? "item" : "itens"}
              </span>
              <span className="flex items-center gap-1">
                {finalDiscountValue > 0 && (
                  <span className="text-[11px] line-through opacity-70">{formatCurrency(cartTotal)}</span>
                )}
                <span>{formatCurrency(totalWithDiscount)}</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PRODUCT DETAIL MODAL ═══ */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-foreground/50 flex items-end md:items-center justify-center"
            onClick={() => {
              const wasFromCart = openedFromCart;
              setSelectedProduct(null);
              setEditingCartUid(null);
              setOpenedFromCart(false);
              if (wasFromCart) setShowCart(true);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-lg md:max-w-3xl bg-card md:rounded-2xl md:max-h-[85vh] flex flex-col md:m-4 relative h-full md:h-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  const wasFromCart = openedFromCart;
                  setSelectedProduct(null);
                  setEditingCartUid(null);
                  setOpenedFromCart(false);
                  if (wasFromCart) setShowCart(true);
                }}
                className="absolute right-3 z-30 w-11 h-11 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg top-[calc(env(safe-area-inset-top,0px)+0.25rem)]"
              >
                {openedFromCart ? <ChevronLeft className="w-6 h-6" /> : <X className="w-6 h-6" />}
              </button>

              {/* Mobile: full page with hero image */}
              <div className="md:hidden flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch" ref={detailScrollRef}>
                {/* Hero image - sticky behind content */}
                {selectedProduct.imagem_url && (
                  <>
                    <div className="sticky top-0 z-0 h-[40vh] bg-muted overflow-hidden" style={{ opacity: Math.max(0, 1 - detailScrollY / 400) }}>
                      <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="w-full h-full object-cover will-change-transform" style={{ transform: `scale(${1 + detailScrollY * 0.003})`, transformOrigin: 'center center' }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      
                      {/* Rating inside image (Mobile) */}
                      {store?.avaliacoes_produtos_ativas && (
                        <div className="absolute bottom-6 right-3 z-10">
                          {userProductRating ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-lg">
                              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-bold">{Number(selectedProduct.rating_average || userProductRating.rating).toFixed(1)}</span>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                if (!clientData) {
                                  toast("Faça login para avaliar produtos.", { description: "Cadastre-se ou entre com seu telefone." });
                                  setShowClientAuth(true);
                                  return;
                                }
                                setShowProductRatingModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400 text-black hover:bg-yellow-500 transition-all shadow-lg active:scale-95 font-bold text-xs"
                            >
                              <Star className="w-3.5 h-3.5 fill-black" />
                              Avaliar
                            </button>
                          )}
                        </div>
                      )}

                      {(selectedProduct.tag_novo || selectedProduct.tag_sugestao || selectedProduct.tag_destaque || isPromoActive(selectedProduct)) && (
                        <div className="absolute top-12 left-3 flex flex-col gap-1">
                          {selectedProduct.tag_novo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500 text-white shadow-sm">🆕 NOVO</span>}
                          {selectedProduct.tag_sugestao && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white shadow-sm">⭐ SUGESTÃO</span>}
                          {selectedProduct.tag_destaque && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary text-accent-foreground shadow-sm">🔥 DESTAQUE</span>}
                          {isPromoActive(selectedProduct) && (
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-sm border border-orange-600/50">
                              <Flame className="w-3.5 h-3.5 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      )}
                      {!selectedProduct.disponivel && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm">ESGOTADO</span>
                        </div>
                      )}
                    </div>
                  </>
                )}


                {!selectedProduct.imagem_url && (
                  <div className="flex w-14 h-14 rounded-xl bg-muted items-center justify-center text-3xl m-5 mb-0 mt-12">
                    {segmentEmoji[store.segmento] || "📦"}
                  </div>
                )}
                  {/* White card that scrolls up over the image */}
                  <motion.div
                    ref={detailTitleRef}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", damping: 22, stiffness: 200, delay: 0.15 }}
                    className={`relative z-20 bg-card p-5 pt-3 min-h-[70vh] ${selectedProduct.imagem_url ? "rounded-t-[24px] -mt-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" : ""}`}
                  >
                    {/* Pull handle */}
                    <div className="flex justify-center mb-3">
                      <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                    </div>
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-foreground leading-tight">{selectedProduct.nome}</h2>
                      </div>
                    </div>
                    <div className="w-12 h-[2px] rounded-full mt-1 mb-2" style={{ backgroundColor: storePrimary || 'hsl(var(--secondary))' }} />
                    {selectedProduct.descricao && (
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.descricao}
                        {isAcaiProduct && freeAddonsCount > 0 && ` • Escolha ${freeAddonsCount} complementos grátis`}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        {isPromoActive(selectedProduct) && (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatCurrency(Number(selectedProduct.preco))}
                          </span>
                        )}
                        <p className="text-lg font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                          {formatCurrency(Number(selectedProduct.preco_promocional ?? selectedProduct.preco))}
                        </p>
                      </div>
                    </div>

                    {selectedProduct.unidade_medida === "kg" && (
                      <div className="mt-4 space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex flex-col gap-1">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            {selectedProduct.unidade_medida === "kg" ? "⚖️ Peso desejado" : "🧪 Volume desejado"}
                            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedProduct.unidade_medida === "kg" 
                              ? "Para 1kg digite 1000g (ou o valor em R$)" 
                              : "Para 1L digite 1000ml (ou o valor em R$)"}
                          </p>
                        </div>
                        
                        <div className={selectedProduct.unidade_medida === "kg" ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"}>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Quantidade ({selectedProduct.unidade_medida === "kg" ? "g" : "ml"})</Label>
                            <Input 
                              type="number" 
                              placeholder={selectedProduct.unidade_medida === "kg" ? "Ex: 500" : "Ex: 300"}
                              value={productWeight}
                              onChange={(e) => handleWeightChange(e.target.value)}
                              className="rounded-xl"
                            />
                          </div>
                          {selectedProduct.unidade_medida === "kg" && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Valor (R$)</Label>
                              <Input 
                                type="number" 
                                placeholder="Ex: 25.00"
                                value={productValue}
                                onChange={(e) => handleValueChange(e.target.value)}
                                className="rounded-xl"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── PIZZA: Size picker ── */}
                    {isPizzaProduct && selectedProduct.tamanhos && (
                      <div className="mt-4">
                        <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                          📏 Tamanho
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                        </h4>
                        <div className="space-y-2">
                          {selectedProduct.tamanhos.map((size) => (
                            <button
                              key={size.nome}
                              onClick={() => handlePizzaSizeChange(size.nome)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedPizzaSize === size.nome ? "bg-primary/5" : "border-border hover:border-primary/30"}`}
                              style={selectedPizzaSize === size.nome ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPizzaSize === size.nome ? "" : "border-muted-foreground/30"}`} style={selectedPizzaSize === size.nome ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                  {selectedPizzaSize === size.nome && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-foreground">{getFirstLetter(size.nome)}</span>
                                  {getSizeFatias(size.nome) && <span className="text-xs text-muted-foreground ml-1">({getSizeFatias(size.nome)})</span>}
                                </div>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(size.preco)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── PIZZA: Flavor picker ── */}
                    {isPizzaProduct && pizzaFlavorProducts.length > 0 && maxExtraFlavors >= 1 && (
                      <div className="mt-4">
                        <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                          🍕 Você pode adicionar {maxExtraFlavors} {maxExtraFlavors === 1 ? 'sabor extra' : 'sabores extras'}
                          <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">+{selectedFlavors.length}/{maxExtraFlavors}</span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mb-2">
                          ⚡ {((pizzariaConfig as any)?.forma_cobranca || (store as any)?.forma_cobranca || "maior_preco") === "fracionado" 
                            ? "Valor cobrado pela média dos sabores." 
                            : "Valor cobrado é do sabor mais caro."}
                        </p>
                        <div className="space-y-2">
                          {pizzaFlavorProducts.map((flavor) => {
                            const isSelected = selectedFlavors.includes(flavor.id);
                            const isDisabled = !isSelected && selectedFlavors.length >= maxExtraFlavors;
                            return (
                              <button
                                key={flavor.id}
                                onClick={() => !isDisabled && toggleFlavor(flavor.id)}
                                disabled={isDisabled}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? "bg-primary/5" : isDisabled ? "border-border opacity-40 cursor-not-allowed" : "border-border hover:border-primary/30"}`}
                                style={isSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "" : "border-muted-foreground/30"}`} style={isSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-foreground truncate">{flavor.nome}</span>
                                    <span className="text-sm font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(getFlavorPriceForSize(flavor))}</span>
                                  </div>
                                  {flavor.descricao && <span className="text-[10px] text-muted-foreground block line-clamp-2 leading-tight">{flavor.descricao}</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bordas for pizza */}
                    {isPizzaProduct && productBordas.length > 0 && (
                      <div className="mt-4" id="bordas-section">
                        <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                          🧀 Você pode adicionar {maxSaboresBorda} {maxSaboresBorda === 1 ? 'borda' : 'bordas'}
                          <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">+{selectedBordas.length}/{maxSaboresBorda}</span>
                        </h4>
                        <div className="space-y-2">
                          {productBordas.map((borda: any) => {
                            const isBordaSelected = selectedBordas.includes(borda.nome);
                            const isBordaDisabled = !isBordaSelected && selectedBordas.length >= maxSaboresBorda;
                            return (
                              <button 
                                key={borda.nome} 
                                onClick={() => !isBordaDisabled && toggleBorda(borda.nome)} 
                                disabled={isBordaDisabled} 
                                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isBordaSelected ? "bg-primary/5" : isBordaDisabled ? "border-border opacity-40 cursor-not-allowed" : "border-border hover:border-primary/30"}`} 
                                style={isBordaSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isBordaSelected ? "" : "border-muted-foreground/30"}`} style={isBordaSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                  {isBordaSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-foreground truncate">{borda.nome}</span>
                                    <span className="text-sm font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{Number(borda.preco) > 0 ? `+ ${formatCurrency(Number(borda.preco))}` : "Grátis"}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Observações — acima dos adicionais */}
                    <div className="mt-4">
                      <h4 className="text-sm text-foreground mb-2 font-bold">Observações</h4>
                      <Textarea
                        placeholder={store?.segmento === "pizzaria" ? "Ex: sem tomate, bem assada..." : "Ex: sem cebola, ponto da carne..."}
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        rows={2}
                        className="rounded-xl border-border/50 min-h-0 py-1.5 resize-none"
                      />
                    </div>

                    {/* Sabores — somente para Caldos */}
                    {isCaldoProduct && (
                      <div className="mt-4">
                        <h4 className="text-sm text-foreground mb-1 font-bold flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            🍲 Sabores
                            <Badge variant="outline" className="text-[10px]">Obrigatório</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{selectedCaldoSabor ? "1/1" : "0/1"}</span>
                        </h4>
                        <div className="divide-y divide-border/40">
                          {caldoSabores.map((s) => {
                            const isSel = selectedCaldoSabor === s.nome;
                            const isIndisponivel = (s as any).disponivel === false;
                            return (
                              <button
                                key={s.nome}
                                type="button"
                                disabled={isIndisponivel}
                                onClick={() => handleSelectCaldoSabor(s.nome)}
                                className={`w-full flex items-center justify-between gap-3 transition py-[10px] text-left ${isIndisponivel ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-primary' : 'border-border'} ${isIndisponivel ? 'bg-muted border-muted-foreground/20' : ''}`} style={isSel && !isIndisponivel ? { borderColor: storePrimary || undefined } : undefined}>
                                    {isSel && !isIndisponivel && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }} />}
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-sm font-medium truncate ${isIndisponivel ? 'text-muted-foreground' : 'text-foreground'}`}>{s.nome}</span>
                                      {isIndisponivel && (
                                        <Badge variant="outline" className="text-[9px] bg-red-50 text-red-500 border-red-200 shrink-0 h-4 px-1">Esgotado</Badge>
                                      )}
                                    </div>
                                    {Number(s.valorExtra) > 0 && (
                                      <span className="text-[11px] font-semibold" style={{ color: isIndisponivel ? undefined : (storePrimary || 'hsl(var(--primary))') }}>
                                        +{formatCurrency(Number(s.valorExtra))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {Number(s.valorExtra) > 0 && (
                                  <span className="text-[11px] font-semibold text-foreground flex-shrink-0">
                                    valor adicional
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                      </div>
                    )}

                    {/* Addons (mobile) — for pizza shows extras after bordas */}
                    {productAddons.length > 0 && (

                      <div className="mt-4 md:mx-0 mx-0" id="addons-section">
                          {(() => {
                            const isAcai = store?.segmento === "acaiteria";
                            const maxAdd = isAcai ? Number(selectedProduct?.max_adicionais || 0) : 0;
                            const totalAddQty = isListAddonSegment
                              ? Object.values(addonQuantities).reduce((a, b) => a + b, 0)
                              : selectedAddons.length;
                            const limitReached = maxAdd > 0 && totalAddQty >= maxAdd;
                            return (
                              <>
                                <div className="w-full bg-gray-100 py-2 px-4 mb-2 flex items-center justify-between rounded-lg">
                                  <h4 className="text-sm text-foreground flex items-center gap-2 font-bold m-0 p-0">
                                    <Plus className="w-4 h-4" /> Você pode adicionar
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    {freeAddonsCount > 0 && (
                                      <Badge className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `rgba(${storePrimaryRgb}, 0.1)`, color: storePrimary || 'hsl(var(--primary))', border: `1px solid rgba(${storePrimaryRgb}, 0.2)` }}>
                                        {freeAddonsCount} grátis
                                      </Badge>
                                    )}
                                    {maxAdd > 0 && (
                                      <span className="text-xs font-bold text-foreground tabular-nums">{totalAddQty}/{maxAdd}</span>
                                    )}
                                  </div>
                                </div>
                                {maxAdd > 0 && (
                                  <p className="text-[11px] text-muted-foreground mb-3">
                                    Você pode adicionar até {maxAdd} {maxAdd === 1 ? "item" : "itens"} no total.
                                  </p>
                                )}
                                {freeAddonsCount > 0 && (
                                  <p className="text-xs text-muted-foreground mb-3">
                                    {Math.min(selectedAddons.length, freeAddonsCount)} de {freeAddonsCount} grátis
                                  </p>
                                )}
                                {isListAddonSegment ? (
                                  <div className="divide-y divide-border/40">
                                    {productAddons.map((addon) => {
                                      const qty = addonQuantities[addon.nome] || 0;
                                      const dim = limitReached && qty === 0;
                                      return (
                                        <div
                                          key={addon.nome}
                                          className={`flex items-center gap-3 transition-colors py-[10px] ${dim ? "opacity-40" : ""}`}
                                        >
                                          <div className="flex-1 min-w-0 flex flex-col">
                                            <span className="text-sm font-medium text-foreground truncate">{addon.nome}</span>
                                            {Number(addon.preco) > 0 && (
                                              <span className="text-[11px] font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                                +{formatCurrency(Number(addon.preco))}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => decrementAddonQty(addon.nome)}
                                              disabled={qty === 0}
                                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
                                            >
                                              <Minus className="w-3 h-3 text-foreground" />
                                            </button>
                                            <span className="w-6 text-center text-sm font-bold text-foreground">{qty}</span>
                                            <button
                                              type="button"
                                              onClick={() => incrementAddonQty(addon.nome)}
                                              disabled={dim}
                                              className="w-6 h-6 rounded-full flex items-center justify-center active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                              style={{ backgroundColor: `rgba(${storePrimaryRgb}, 0.1)`, color: storePrimary || 'hsl(var(--primary))' }}
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    {productAddons.map((addon) => {
                                      const isSelected = selectedAddons.includes(addon.nome);
                                      const addonIndex = selectedAddons.indexOf(addon.nome);
                                      const isFree = addonIndex >= 0 && addonIndex < freeAddonsCount;
                                      const allFreeUsed = selectedAddons.length >= freeAddonsCount;
                                      const showPrice = !isSelected && allFreeUsed && Number(addon.preco) > 0;
                                      const dim = limitReached && !isSelected;
                                      return (
                                        <button
                                          key={addon.nome}
                                          onClick={() => toggleAddon(addon.nome)}
                                          disabled={dim}
                                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                              ? "bg-primary/5"
                                              : "border-border hover:border-primary/20"
                                          } ${dim ? "opacity-40 cursor-not-allowed" : ""}`}
                                          style={isSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                        >
                                          <div
                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                              isSelected ? "" : "border-muted-foreground/30"
                                            }`}
                                            style={isSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                          >
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-foreground truncate">{addon.nome}</span>
                                            {showPrice && (
                                              <span className="text-[11px] font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>+{formatCurrency(Number(addon.preco))}</span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                      </div>
                    )}




                    {linkedProductsData && linkedProductsData.length > 0 && hasAddedCurrentProduct && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0,
                          boxShadow: ["0px 0px 0px rgba(0,0,0,0)", `0px 0px 20px rgba(${storePrimaryRgb}, 0.2)`, "0px 0px 0px rgba(0,0,0,0)"]
                        }}
                        transition={{ 
                          duration: 0.6, 
                          ease: "easeOut",
                          boxShadow: { delay: 0.5, duration: 1, times: [0, 0.5, 1] }
                        }}
                        className="mt-5 p-2 rounded-2xl transition-colors duration-500" 
                        id="linked-products-section"
                        style={{ backgroundColor: hasAddedCurrentProduct ? `rgba(${storePrimaryRgb}, 0.05)` : 'transparent' }}
                      >
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          💡 Que tal levar também?
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                          {linkedProductsData.map((p, index) => (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 + 0.2 }}
                              key={p.id}
                              onClick={() => {
                                setSelectedProduct(p);
                                // Reset scroll if in mobile
                                if (detailScrollRef.current) detailScrollRef.current.scrollTo(0, 0);
                              }}
                              className="flex-shrink-0 w-32 bg-card rounded-xl border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform shadow-sm"
                            >
                              <div className="aspect-square bg-muted relative">
                                {p.imagem_url ? (
                                  <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-2xl">
                                    {segmentEmoji[store?.segmento || ""] || "📦"}
                                  </div>
                                )}
                              </div>
                              <div className="p-2 space-y-0.5">
                                <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 min-h-[28px]">{p.nome}</p>
                                <p className="text-[10px] font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                  {formatCurrency(p.preco_promocional || p.preco)}
                                </p>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <div className="pb-36" />

                  </motion.div>
                </div>

                {/* Desktop: reorganized layout */}
                <div className="hidden md:block md:flex-1 md:overflow-y-auto p-6">
                  {/* Top: image square + product info */}
                  <div className="flex gap-6 mb-6">
                    <div className="w-64 h-64 rounded-2xl overflow-hidden bg-muted flex-shrink-0 relative">
                      {selectedProduct.imagem_url ? (
                        <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">
                          {segmentEmoji[store.segmento] || "📦"}
                        </div>
                      )}

                      {/* Rating inside image (Desktop) */}
                      {store?.avaliacoes_produtos_ativas && (
                        <div className="absolute bottom-3 right-3 z-10">
                          {userProductRating ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-lg">
                              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-bold">{Number(selectedProduct.rating_average || userProductRating.rating).toFixed(1)}</span>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                if (!clientData) {
                                  toast("Faça login para avaliar produtos.", { description: "Cadastre-se ou entre com seu telefone." });
                                  setShowClientAuth(true);
                                  return;
                                }
                                setShowProductRatingModal(true);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400 text-black hover:bg-yellow-500 transition-all shadow-lg active:scale-95 font-bold text-sm"
                            >
                              <Star className="w-4 h-4 fill-black" />
                              Avaliar
                            </button>
                          )}
                        </div>
                      )}

                      {(selectedProduct.tag_novo || selectedProduct.tag_sugestao || selectedProduct.tag_destaque || isPromoActive(selectedProduct)) && (
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {selectedProduct.tag_novo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500 text-white shadow-sm">🆕 NOVO</span>}
                          {selectedProduct.tag_sugestao && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white shadow-sm">⭐ SUGESTÃO</span>}
                          {selectedProduct.tag_destaque && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary text-accent-foreground shadow-sm">🔥 DESTAQUE</span>}
                          {isPromoActive(selectedProduct) && (
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-sm border border-orange-600/50">
                              <Flame className="w-3.5 h-3.5 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      )}
                      {!selectedProduct.disponivel && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-lg">ESGOTADO</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pt-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold font-display text-foreground">{selectedProduct.nome}</h3>
                        </div>
                      </div>
                      <div className="w-12 h-[2px] rounded-full mt-2" style={{ backgroundColor: storePrimary || 'hsl(var(--secondary))' }} />
                      {selectedProduct.descricao && (
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                          {selectedProduct.descricao}
                          {isAcaiProduct && freeAddonsCount > 0 && ` • Escolha ${freeAddonsCount} complementos grátis`}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3">
                          {isPromoActive(selectedProduct) && (
                            <span className="text-lg text-muted-foreground line-through">
                              {formatCurrency(Number(selectedProduct.preco))}
                            </span>
                          )}
                          <p className="text-2xl font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                            {formatCurrency(calcSelectedPrice() / productQty)}
                          </p>
                        </div>
                      </div>

                      
                    </div>
                  </div>

                  {selectedProduct.unidade_medida === "kg" && (
                    <div className="mb-6 space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {selectedProduct.unidade_medida === "kg" ? "⚖️ Peso desejado" : "🧪 Volume desejado"}
                          <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedProduct.unidade_medida === "kg" 
                            ? "Para 1kg digite 1000g (ou o valor em R$)" 
                            : "Para 1L digite 1000ml (ou o valor em R$)"}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Quantidade ({selectedProduct.unidade_medida === "kg" ? "g" : "ml"})</Label>
                          <Input 
                            type="number" 
                            placeholder={selectedProduct.unidade_medida === "kg" ? "Ex: 500" : "Ex: 300"}
                            value={productWeight}
                            onChange={(e) => handleWeightChange(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Valor (R$)</Label>
                          <Input 
                            type="number" 
                            placeholder="Ex: 25.00"
                            value={productValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  )}


                  {/* ── PIZZA: Desktop Size + Flavor picker ── */}
                  {isPizzaProduct && selectedProduct.tamanhos && (
                    <>
                      <div className="my-4 h-px bg-border" />
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                            📏 Tamanho
                            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Obrigatório</Badge>
                          </h4>
                          <div className="space-y-2">
                            {selectedProduct.tamanhos.map((size) => (
                              <button
                                key={size.nome}
                                onClick={() => handlePizzaSizeChange(size.nome)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedPizzaSize === size.nome ? "bg-primary/5" : "border-border hover:border-primary/30"}`}
                                style={selectedPizzaSize === size.nome ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPizzaSize === size.nome ? "" : "border-muted-foreground/30"}`} style={selectedPizzaSize === size.nome ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                    {selectedPizzaSize === size.nome && <div className="w-2 h-2 rounded-full bg-white" />}
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-foreground">{getFirstLetter(size.nome)}</span>
                                    {getSizeFatias(size.nome) && <span className="text-xs text-muted-foreground ml-1">({getSizeFatias(size.nome)})</span>}
                                    
                                  </div>
                                </div>
                                <span className="text-sm font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(size.preco)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        {pizzaFlavorProducts.length > 0 && maxExtraFlavors >= 1 && (
                          <div>
                            <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                              🍕 Você pode adicionar {maxExtraFlavors} {maxExtraFlavors === 1 ? 'sabor extra' : 'sabores extras'}
                              <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                              <span className="text-xs text-muted-foreground ml-auto">+{selectedFlavors.length}/{maxExtraFlavors}</span>
                            </h4>
                            <p className="text-[11px] text-muted-foreground mb-2">⚡ Valor cobrado é do sabor mais caro.</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {pizzaFlavorProducts.map((flavor) => {
                                const isSelected = selectedFlavors.includes(flavor.id);
                                const isDisabled = !isSelected && selectedFlavors.length >= maxExtraFlavors;
                                return (
                                  <button
                                    key={flavor.id}
                                    onClick={() => !isDisabled && toggleFlavor(flavor.id)}
                                    disabled={isDisabled}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? "bg-primary/5" : isDisabled ? "border-border opacity-40 cursor-not-allowed" : "border-border hover:border-primary/30"}`}
                                    style={isSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                  >
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "" : "border-muted-foreground/30"}`} style={isSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-sm font-medium text-foreground truncate">{flavor.nome}</span>
                                        <span className="text-sm font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(getFlavorPriceForSize(flavor))}</span>
                                      </div>
                                      {flavor.descricao && <span className="text-[10px] text-muted-foreground block line-clamp-2 leading-tight">{flavor.descricao}</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Separator + Bottom: addons left, observation right */}
                  <div className="my-4 h-px bg-border" />
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      {/* Sabores (desktop) — somente Caldos */}
                      {isCaldoProduct && (
                        <div className="mb-4">
                          <h4 className="text-sm text-foreground mb-1 font-bold flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              🍲 Sabores
                              <Badge variant="outline" className="text-[10px]">Obrigatório</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{selectedCaldoSabor ? "1/1" : "0/1"}</span>
                          </h4>
                          <div className="divide-y divide-border/40">
                            {caldoSabores.map((s) => {
                              const isSel = selectedCaldoSabor === s.nome;
                              const isIndisponivel = (s as any).disponivel === false;
                              return (
                                <button
                                  key={s.nome}
                                  type="button"
                                  disabled={isIndisponivel}
                                  onClick={() => handleSelectCaldoSabor(s.nome)}
                                  className={`w-full flex items-center justify-between py-3 transition-all text-left ${isIndisponivel ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? '' : 'border-muted-foreground/30'} ${isIndisponivel ? 'bg-muted border-muted-foreground/20' : ''}`} style={isSel && !isIndisponivel ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                      {isSel && !isIndisponivel && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }} />}
                                    </div>
                                    <span className={`text-sm font-medium truncate ${isIndisponivel ? 'text-muted-foreground' : 'text-foreground'}`}>{s.nome}</span>
                                    {isIndisponivel && (
                                      <Badge variant="outline" className="text-[9px] bg-red-50 text-red-500 border-red-200 shrink-0 h-4 px-1">Esgotado</Badge>
                                    )}
                                    {Number(s.valorExtra) > 0 && (
                                      <span className="text-sm font-semibold flex-shrink-0" style={{ color: isIndisponivel ? undefined : (storePrimary || 'hsl(var(--primary))') }}>
                                        +{formatCurrency(Number(s.valorExtra))}
                                      </span>
                                    )}
                                  </div>
                                  {Number(s.valorExtra) > 0 && (
                                    <span className="text-sm font-semibold text-foreground flex-shrink-0">
                                      valor adicional
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {(isPizzaProduct || productAddons.length > 0) && <div className="my-4 h-px bg-border" />}
                        </div>
                      )}

                      {/* Bordas for pizza (desktop) */}

                      {isPizzaProduct && productBordas.length > 0 && (
                        <div id="bordas-section-desktop">
                          <h4 className="text-sm text-foreground mb-2 flex items-center gap-2 font-bold">
                            🧀 Você pode adicionar {maxSaboresBorda} {maxSaboresBorda === 1 ? 'borda' : 'bordas'}
                            <Badge variant="outline" className="text-[10px]">Opcional</Badge>
                            {selectedBordas.length > 0 && <span className="text-xs text-muted-foreground ml-auto">{selectedBordas.length}/{maxSaboresBorda}</span>}
                          </h4>
                          <div className="space-y-2">
                            {productBordas.map((borda: any) => {
                              const isBordaSelected = selectedBordas.includes(borda.nome);
                              const isBordaDisabled = !isBordaSelected && selectedBordas.length >= maxSaboresBorda;
                              return (
                                <button key={borda.nome} onClick={() => !isBordaDisabled && toggleBorda(borda.nome)} disabled={isBordaDisabled} className={`w-full flex items-center p-3 rounded-xl border-2 transition-all ${isBordaSelected ? "bg-primary/5" : isBordaDisabled ? "border-border opacity-40 cursor-not-allowed" : "border-border hover:border-primary/30"}`} style={isBordaSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isBordaSelected ? "" : "border-muted-foreground/30"}`} style={isBordaSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}>
                                      {isBordaSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-left">
                                      <span className="text-sm font-medium text-foreground">{borda.nome}</span>
                                      <span className="text-sm font-semibold text-muted-foreground">{Number(borda.preco) > 0 ? `+ ${formatCurrency(Number(borda.preco))}` : "Grátis"}</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Addons (desktop) — for pizza shows extras after bordas */}
                      {productAddons.length > 0 && (
                        <div id="addons-section-desktop" className="-mx-6">
                          {(() => {
                            const isAcai = store?.segmento === "acaiteria";
                            const maxAdd = isAcai ? Number(selectedProduct?.max_adicionais || 0) : 0;
                            const totalAddQty = isListAddonSegment
                              ? Object.values(addonQuantities).reduce((a, b) => a + b, 0)
                              : selectedAddons.length;
                            const limitReached = maxAdd > 0 && totalAddQty >= maxAdd;
                            return (
                              <>
                                <div className="w-full bg-gray-100 py-2 px-6 mb-2 flex items-center justify-between rounded-lg">
                                  <h4 className="text-sm text-foreground flex items-center gap-2 font-bold m-0 p-0">
                                    <Plus className="w-4 h-4" /> Você pode adicionar
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    {freeAddonsCount > 0 && (
                                      <Badge className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `rgba(${storePrimaryRgb}, 0.1)`, color: storePrimary || 'hsl(var(--primary))', border: `1px solid rgba(${storePrimaryRgb}, 0.2)` }}>
                                        {freeAddonsCount} grátis
                                      </Badge>
                                    )}
                                    {maxAdd > 0 && (
                                      <span className="text-xs font-bold text-foreground tabular-nums">{totalAddQty}/{maxAdd}</span>
                                    )}
                                  </div>
                                </div>
                                {maxAdd > 0 && (
                                  <p className="text-[11px] text-muted-foreground mb-3 px-6">
                                    Você pode adicionar até {maxAdd} {maxAdd === 1 ? "item" : "itens"} no total.
                                  </p>
                                )}
                                {freeAddonsCount > 0 && (
                                  <p className="text-xs text-muted-foreground mb-3 px-6">
                                    {Math.min(selectedAddons.length, freeAddonsCount)} de {freeAddonsCount} grátis
                                  </p>
                                )}
                                {isListAddonSegment ? (
                                  <div className="space-y-2 px-6">
                                    {productAddons.map((addon) => {
                                      const qty = addonQuantities[addon.nome] || 0;
                                      const dim = limitReached && qty === 0;
                                      return (
                                        <div
                                          key={addon.nome}
                                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${qty > 0 ? "bg-primary/5" : "border-border"} ${dim ? "opacity-40" : ""}`}
                                          style={qty > 0 ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-foreground block truncate">{addon.nome}</span>
                                            {Number(addon.preco) > 0 && (
                                              <span className="text-[11px] font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                                +{formatCurrency(Number(addon.preco))}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => decrementAddonQty(addon.nome)}
                                              disabled={qty === 0}
                                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
                                            >
                                              <Minus className="w-3 h-3 text-foreground" />
                                            </button>
                                            <span className="w-6 text-center text-sm font-bold text-foreground">{qty}</span>
                                            <button
                                              type="button"
                                              onClick={() => incrementAddonQty(addon.nome)}
                                              disabled={dim}
                                              className="w-6 h-6 rounded-full flex items-center justify-center active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                              style={{ backgroundColor: `rgba(${storePrimaryRgb}, 0.1)`, color: storePrimary || 'hsl(var(--primary))' }}
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 px-6">
                                    {productAddons.map((addon) => {
                                      const isSelected = selectedAddons.includes(addon.nome);
                                      const addonIndex = selectedAddons.indexOf(addon.nome);
                                      const isFree = addonIndex >= 0 && addonIndex < freeAddonsCount;
                                      const allFreeUsed = selectedAddons.length >= freeAddonsCount;
                                      const showPrice = !isSelected && allFreeUsed && Number(addon.preco) > 0;
                                      const dim = limitReached && !isSelected;
                                      return (
                                        <button
                                          key={addon.nome}
                                          onClick={() => toggleAddon(addon.nome)}
                                          disabled={dim}
                                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                              ? "bg-primary/5"
                                              : "border-border hover:border-primary/20"
                                          } ${dim ? "opacity-40 cursor-not-allowed" : ""}`}
                                          style={isSelected ? { borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                        >
                                          <div
                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                              isSelected ? "" : "border-muted-foreground/30"
                                            }`}
                                            style={isSelected ? { backgroundColor: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' } : undefined}
                                          >
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-sm font-medium text-foreground truncate">{addon.nome}</span>
                                            {showPrice && (
                                              <span className="text-[11px] font-semibold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>+{formatCurrency(Number(addon.preco))}</span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm text-foreground mb-2 font-bold">Alguma observação??</h4>
                      <Textarea placeholder={store?.segmento === "pizzaria" ? "Ex: sem tomate, bem assada..." : "Ex: sem cebola, ponto da carne..."} value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} className="rounded-xl border-border/50" />
                    </div>

                  </div>

                  {linkedProductsData && linkedProductsData.length > 0 && hasAddedCurrentProduct && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        boxShadow: ["0px 0px 0px rgba(0,0,0,0)", `0px 0px 25px rgba(${storePrimaryRgb}, 0.15)`, "0px 0px 0px rgba(0,0,0,0)"]
                      }}
                      transition={{ 
                        duration: 0.6, 
                        ease: "easeOut",
                        boxShadow: { delay: 0.5, duration: 1.2, times: [0, 0.5, 1] }
                      }}
                      className="mt-5 p-4 rounded-2xl transition-colors duration-500" 
                      id="linked-products-section-desktop"
                      style={{ backgroundColor: hasAddedCurrentProduct ? `rgba(${storePrimaryRgb}, 0.03)` : 'transparent' }}
                    >
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        💡 Que tal levar também?
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                        {linkedProductsData.map((p, index) => (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 + 0.2 }}
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className="flex-shrink-0 w-32 bg-card rounded-xl border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform shadow-sm"
                          >
                            <div className="aspect-square bg-muted relative">
                              <Badge className="absolute top-1 left-1 z-10 px-1 py-0 h-4 text-[9px] font-bold bg-amber-500 text-white border-0 hover:bg-amber-500">
                                ⭐ Melhor com este
                              </Badge>
                              {p.imagem_url ? (
                                <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                  {segmentEmoji[store?.segmento || ""] || "📦"}
                                </div>
                              )}
                            </div>
                            <div className="p-2 space-y-0.5">
                              <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 min-h-[28px]">{p.nome}</p>
                              <p className="text-[10px] font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                {formatCurrency(p.preco_promocional || p.preco)}
                              </p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}



                {isPizzaProduct && (
                  <div className="mt-4 p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resumo da Pizza</p>
                    {selectedPizzaSize && (
                      <p className="text-sm text-foreground flex justify-between">
                        <span className="font-medium">Tamanho:</span> 
                        <span className="text-primary font-bold">{selectedPizzaSize}</span>
                      </p>
                    )}
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Sabores ({selectedFlavors.length + 1}):</span> 
                      <span className="block mt-0.5 text-muted-foreground leading-relaxed">
                        • {selectedProduct.nome}
                        {selectedFlavors.map(fid => {
                          const f = products.find(p => p.id === fid);
                          return f ? `\n• ${f.nome}` : "";
                        }).join("")}
                      </span>
                    </p>
                    {selectedBordas.length > 0 && (
                      <p className="text-sm text-foreground flex justify-between">
                        <span className="font-medium">Bordas ({selectedBordas.length}):</span> 
                        <span className="text-primary font-bold">{selectedBordas.join(", ")}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed footer: Quantity + Add button */}
              <div className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t border-border/50 p-4 pb-6 space-y-3 md:sticky md:bottom-0 md:rounded-b-2xl md:relative md:backdrop-blur-none md:pb-4 py-px border-double border-slate-200 rounded-3xl" style={{ backgroundColor: `rgba(${storePrimaryRgb}, 0.1)` }}>
                <div className="flex items-center justify-between gap-4 px-1">
                  <div 
                    className="flex-1 py-1 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                    onClick={() => setShowCart(true)}
                  >
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-[13px] font-bold text-foreground">Ver carrinho</span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {cartCount} {cartCount === 1 ? 'item' : 'itens'} • {formatCurrency(totalWithDiscount)}
                      </span>
                    </div>
                    <div 
                      className="flex items-center gap-1 font-bold text-xs transition-colors"
                      style={{ color: storePrimary || 'hsl(var(--primary))' }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      ver carrinho
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedProduct.unidade_medida !== "kg" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setProductQty((q) => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-full border-2 border-border flex items-center justify-center hover:bg-background transition-colors active:scale-90"
                      >
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <motion.span key={`qty-${productQty}`} initial={{ scale: 1.4, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="text-base font-bold text-foreground w-7 text-center">{productQty}</motion.span>
                      <button
                        onClick={() => setProductQty((q) => q + 1)}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-90 transition-colors active:scale-90 text-white"
                        style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <Button
                    onClick={addToCart}
                    disabled={!canAddPizza}
                    className="flex-1 h-12 rounded-full text-white font-bold text-sm border-0 shadow-md hover:shadow-lg transition-shadow active:scale-[0.98] disabled:opacity-50 px-4"
                    style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" /> 
                        <span>{editingCartUid ? "Atualizar" : "Adicionar"}</span>
                      </div>
                      <div className="flex items-center gap-2 pl-3 border-l border-white/20">
                        <span>{formatCurrency(calcSelectedPrice())}</span>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CART SHEET ═══ */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 z-[80] flex items-end justify-center"
            onClick={() => { setShowCart(false); setShowForm(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-5xl rounded-t-3xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto flex-1">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold font-display text-foreground">
                    {showForm ? "📋 Finalizar Pedido" : "🛒 Seu Carrinho"}
                  </h2>
                  <button onClick={() => { setShowCart(false); setShowForm(false); }} className="p-2 rounded-full hover:bg-muted">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {!showForm ? (
                  <>
                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <span className="text-5xl block mb-3">🛒</span>
                        <p className="text-muted-foreground">Carrinho vazio</p>
                        <p className="text-sm text-muted-foreground">Adicione itens do cardápio!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50 mb-4">
                        {cart.map((item) => {
                          const product = products.find(p => p.id === item.id);
                          const isUnavailable = product && (!product.disponivel || (product as any).oculto);
                          
                          return (
                            <div
                              key={item.uid}
                              className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:opacity-80 transition-opacity ${isUnavailable ? "opacity-70" : ""}`}
                              onClick={() => !isUnavailable && editCartItem(item)}
                            >
                              <div className="relative flex-shrink-0">
                                {item.imagem_url ? (
                                  <img 
                                    src={item.imagem_url} 
                                    alt={item.nome} 
                                    className={`w-14 h-14 rounded-xl object-cover ${isUnavailable ? "grayscale" : ""}`} 
                                  />
                                ) : (
                                  <div className={`w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl ${isUnavailable ? "grayscale" : ""}`}>
                                    {segmentEmoji[store.segmento] || "📦"}
                                  </div>
                                )}
                                {isUnavailable && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                                    <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Esgotado</span>
                                  </div>
                                )}
                              </div>
                            <div className="flex-1 min-w-0">
                              {store?.segmento === "pizzaria" && item.tamanho ? (
                                <p className="font-bold text-foreground text-sm truncate">Pizza {item.tamanho}</p>
                              ) : (
                                <>
                                  <p className="font-bold text-foreground text-sm truncate">{item.nome}</p>
                                  {item.caldo_sabor && (
                                    <p className="text-[11px] font-bold text-muted-foreground mt-[-2px]">Sabor {item.caldo_sabor.nome}</p>
                                  )}
                                  {item.weight && (
                                    <p className="text-[10px] text-muted-foreground font-semibold">Peso: {item.weight}{item.unidade_medida === "kg" ? "g" : "ml"}</p>
                                  )}
                                  {item.unidade_medida === "kg" && item.unit_price && (<p className="text-[10px] text-muted-foreground font-semibold">Preço/Kg: {formatCurrency(item.unit_price)}</p>)}
                                  {item.tamanho && (
                                    <p className="text-[10px] text-muted-foreground font-semibold">Tamanho: {item.tamanho}</p>
                                  )}

                                </>
                              )}
                              {item.sabores && item.sabores.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">Sabores ({item.quantidade_sabores || item.sabores.length}): {item.sabores.join(" / ")}</p>
                              )}
                              {item.bordas && item.bordas.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">Borda ({item.quantidade_bordas || item.bordas.length}): {item.bordas.join(", ")}</p>
                              )}
                              {item.addons && item.addons.length > 0 && !isPizzaProduct && (
                                <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                    +{item.addons.length} {item.addons.length === 1 ? "adicional" : "adicionais"}
                                  </span>
                                </div>
                              )}
                              {item.observation && (
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5 italic">"{item.observation}"</p>
                              )}
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(item.preco * item.quantidade)}</p>
                                
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {isUnavailable ? (
                                    <button
                                      onClick={() => setCart(prev => prev.filter(i => i.uid !== item.uid))}
                                      className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors active:scale-90"
                                      title="Remover produto esgotado"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  ) : item.unidade_medida !== "kg" ? (
                                    <>
                                      <button
                                        onClick={() => updateQty(item.uid, -1)}
                                        className={`w-7 h-7 rounded-full border border-border flex items-center justify-center transition-colors active:scale-90 ${item.quantidade === 1 ? 'hover:bg-red-50 text-red-500' : 'hover:bg-muted'}`}
                                      >
                                        {item.quantidade === 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-2.5 w-2.5" />}
                                      </button>
                                      <span className="text-xs font-bold w-5 text-center">{item.quantidade}</span>
                                      <button
                                        onClick={() => updateQty(item.uid, 1)}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-colors active:scale-90"
                                        style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                                      >
                                        <Plus className="h-2.5 w-2.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => updateQty(item.uid, -1)}
                                      className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-red-50 text-red-500 transition-colors"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Upsell in Cart */}
                    {cart.length > 0 && cartUpsellProducts && cartUpsellProducts.length > 0 && (
                      <div className="mb-6 p-4 rounded-2xl bg-muted/30 border border-border/50">
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          💡 Que tal levar também?
                        </h4>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                          {cartUpsellProducts.map((p: any) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedProduct(p);
                                setShowCart(false);
                                setOpenedFromCart(false);
                              }}
                              className="flex-shrink-0 w-32 bg-card rounded-xl border border-border/50 overflow-hidden text-left active:scale-[0.98] transition-transform shadow-sm"
                            >
                              <div className="aspect-square bg-muted relative">
                                {p.imagem_url ? (
                                  <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-2xl">
                                    {segmentEmoji[store?.segmento || ""] || "📦"}
                                  </div>
                                )}
                              </div>
                              <div className="p-2 space-y-0.5">
                                <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 min-h-[28px]">{p.nome}</p>
                                <p className="text-[10px] font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                  {formatCurrency(p.preco_promocional || p.preco)}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Delivery info */}
                    {cart.length > 0 && (
                      <>
                        {/* Coupon Section */}
                        {store?.cupons_ativos && (
                          <div className="border-t border-border pt-4 pb-2 space-y-2">
                            {firstOrderCoupon && !appliedCoupon && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mb-2">
                                <p className="text-[11px] text-emerald-700 font-bold mb-1 flex items-center gap-1">
                                  <Ticket className="w-3 h-3" /> PRESENTE DE BOAS-VINDAS! 🎁
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[10px] text-emerald-600 font-medium leading-tight">
                                      Use o código <span className="font-bold text-emerald-700">{firstOrderCoupon.codigo}</span> no seu primeiro pedido.
                                    </p>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                      setCouponCode(firstOrderCoupon.codigo);
                                      // Trigger a small delay to make the interaction feel natural
                                      setTimeout(() => handleApplyCoupon(), 100);
                                    }}
                                    className="h-7 text-[10px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 font-bold"
                                  >
                                    COPIAR E USAR
                                  </Button>
                                </div>
                              </div>
                            )}

                            {!appliedCoupon ? (
                              <div className="flex flex-col gap-1.5">
                                {publicDiscountCoupon && !firstOrderCoupon && (
                                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mb-1">
                                    <p className="text-[11px] text-emerald-700 font-bold mb-1 flex items-center gap-1">
                                      <Ticket className="w-3 h-3" /> CUPOM DE DESCONTO DISPONÍVEL!
                                    </p>
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-[10px] text-emerald-600 font-medium leading-tight">
                                        {publicDiscountCoupon.tipo === 'frete_gratis'
                                          ? 'Ganhe frete grátis'
                                          : publicDiscountCoupon.tipo === 'percentual'
                                            ? `Ganhe ${Number(publicDiscountCoupon.valor)}% de desconto`
                                            : `Ganhe ${formatCurrency(Number(publicDiscountCoupon.valor))} de desconto`}
                                        {' '}usando o código{' '}
                                        <span className="font-bold text-emerald-700">{publicDiscountCoupon.codigo}</span>.
                                        {Number(publicDiscountCoupon.valor_minimo) > 0 && (
                                          <> Válido em pedidos a partir de <span className="font-bold text-emerald-700">{formatCurrency(Number(publicDiscountCoupon.valor_minimo))}</span>.</>
                                        )}
                                        {' '}Copie e cole abaixo.
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCouponCode(publicDiscountCoupon.codigo);
                                          setTimeout(() => handleApplyCoupon(), 100);
                                        }}
                                        className="h-7 text-[10px] border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-700 font-bold whitespace-nowrap"
                                      >
                                        COPIAR E USAR
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Input 
                                    placeholder="Cupom de desconto" 
                                    value={couponCode} 
                                    onChange={(e) => setCouponCode(e.target.value.replace(/\s/g, "").toUpperCase())}
                                    className="h-10 rounded-xl uppercase"
                                  />
                                  <Button 
                                    size="sm" 
                                    onClick={handleApplyCoupon}
                                    disabled={isApplyingCoupon || !couponCode.trim()}
                                    className="rounded-xl px-4 text-white"
                                    style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                                  >
                                    {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5 bg-primary/10 p-3 rounded-xl border border-primary/20">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <Ticket className="w-4 h-4 text-primary" />
                                      <span className="text-sm font-bold text-primary">{appliedCoupon.codigo}</span>
                                    </div>
                                    {appliedCoupon.tipo === 'frete_gratis' && (
                                      <p className="text-[10px] text-primary/80 font-medium italic mt-0.5">
                                        * O valor do desconto será descontado no valor do frete
                                      </p>
                                    )}
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 text-primary hover:bg-primary/20"
                                    onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="border-t border-border pt-4 space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium text-foreground">{formatCurrency(cartTotal)}</span>
                          </div>
                          {appliedCoupon && appliedCoupon.tipo !== 'frete_gratis' && (
                            <div className="flex justify-between text-sm text-primary">
                              <span className="font-medium">Desconto ({appliedCoupon.codigo})</span>
                              <span className="font-bold">-{formatCurrency(finalDiscountValue)}</span>
                            </div>
                          )}
                          {appliedCoupon?.tipo === 'frete_gratis' && deliveryMode === "delivery" && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Taxa de Entrega</span>
                              <span className="font-bold text-emerald-500">Grátis (Cupom)</span>
                            </div>
                          )}
                          <div className="flex justify-between text-base font-bold pt-2">
                            <span className="text-foreground">Total</span>
                            <span style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(totalWithDiscount)}</span>
                          </div>
                        </div>

                        <Button
                          className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                          style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}
                          onClick={() => {
                            if (cart.length === 0) {
                              toast.error("Seu carrinho está vazio!");
                              return;
                            }

                            // Check for unavailable products
                            const unavailableInCart = cart.filter(item => {
                              const prod = products.find(p => p.id === item.id);
                              return !prod || !prod.disponivel || prod.oculto;
                            });

                            if (unavailableInCart.length > 0) {
                              toast.error(`Existem ${unavailableInCart.length > 1 ? 'produtos esgotados' : 'um produto esgotado'} no carrinho e não poderá enviar o pedido até o produto ser removido.`);
                              setUnavailableProductsModal({
                                isOpen: true,
                                products: unavailableInCart.map(i => i.nome),
                                type: "cart"
                              });
                              setShowCart(true); // Automatically open the cart when the popup appears
                              setShowForm(false); // Ensure we are on the first screen (cart list)
                              return;
                            }

                            if (mesaId) {
                              handleMesaPreReceipt();
                            } else {
                              setDeliveryMode(null);
                              setShowForm(true);
                            }
                          }}
                          disabled={sending}
                        >
                          {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <><Send className="h-5 w-5 mr-2" /> {mesaId ? "Conferir seu pedido" : "Finalizar Pedido"}</>
                          )}
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="space-y-2 pb-2">
                    <div className="space-y-2">
                    {/* Delivery mode chooser */}
                    {!deliveryMode ? (
                      /* Step 1: Delivery mode */
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground text-center">Como deseja receber seu pedido?</p>
                        <div className="grid grid-cols-2 gap-3">
                          <motion.button
                            onClick={() => { 
                              setDeliveryMode("delivery"); 
                              setDeliveryAddressConfirmed(false); 
                              if (!clientData?.endereco_rua) {
                                setEditingDeliveryAddress(true);
                              }
                            }}
                            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-border hover:border-primary transition-colors bg-card"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <motion.div
                              animate={{ x: [0, 6, 0, -6, 0] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            >
                              <Bike className="w-8 h-8" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                            </motion.div>
                            <span className="font-bold text-foreground">Delivery</span>
                            <span className="text-xs text-muted-foreground">Entrega no seu endereço</span>
                          </motion.button>
                          <motion.button
                            onClick={() => { setDeliveryMode("retirada"); setDeliveryAddressConfirmed(true); }}
                            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-border hover:border-primary transition-colors bg-card"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <motion.div
                              animate={{ y: [0, -4, 0] }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            >
                              <MapPin className="w-8 h-8" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                            </motion.div>
                            <span className="font-bold text-foreground">Retirada</span>
                            <span className="text-xs text-muted-foreground">Buscar na loja</span>
                          </motion.button>
                        </div>
                      </div>
                    ) : deliveryMode === "delivery" && editingDeliveryAddress ? (
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-foreground text-center uppercase tracking-tight">Novo endereço de entrega</p>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">CEP</label>
                            <Input 
                              placeholder="CEP" 
                              value={customDeliveryAddress.endereco_cep || ""} 
                              onChange={async (e) => {
                                const cep = e.target.value.replace(/\D/g, "");
                                const formatted = cep.length > 5 ? cep.slice(0, 5) + "-" + cep.slice(5, 8) : cep;
                                setCustomDeliveryAddress(a => ({ ...a, endereco_cep: formatted }));
                                if (cep.length === 8) {
                                  try {
                                    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                                    const data = await res.json();
                                    if (!data.erro) {
                                      setCustomDeliveryAddress(a => ({
                                        ...a,
                                        endereco_rua: data.logradouro || a.endereco_rua,
                                        endereco_bairro: data.bairro || a.endereco_bairro,
                                        endereco_cidade: data.localidade || a.endereco_cidade,
                                      }));
                                    }
                                  } catch {}
                                }
                              }} 
                              maxLength={9}
                              className="rounded-xl h-11" 
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Rua</label>
                            <Input placeholder="Rua" value={customDeliveryAddress.endereco_rua} onChange={(e) => setCustomDeliveryAddress(a => ({ ...a, endereco_rua: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-semibold text-foreground mb-1 block">Número</label>
                              <Input placeholder="Número" value={customDeliveryAddress.endereco_numero} onChange={(e) => setCustomDeliveryAddress(a => ({ ...a, endereco_numero: e.target.value }))} className="rounded-xl h-11" />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-foreground mb-1 block">Complemento</label>
                              <Input placeholder="Complemento" value={customDeliveryAddress.endereco_complemento} onChange={(e) => setCustomDeliveryAddress(a => ({ ...a, endereco_complemento: e.target.value }))} className="rounded-xl h-11" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Bairro</label>
                            {allBairros.length > 0 ? (
                              <Select 
                                value={customDeliveryAddress.endereco_bairro} 
                                onValueChange={(val) => setCustomDeliveryAddress(a => ({ ...a, endereco_bairro: val }))}
                              >
                                <SelectTrigger className="rounded-xl h-11 bg-background border-border relative z-[100]">
                                  <SelectValue placeholder="Escolha o bairro" />
                                </SelectTrigger>
                                <SelectContent className="z-[150]">
                                  {allBairros.map(b => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="relative group">
                                <Input 
                                  list="custom-bairros-list"
                                  placeholder="Bairro" 
                                  value={customDeliveryAddress.endereco_bairro} 
                                  onChange={(e) => setCustomDeliveryAddress(a => ({ ...a, endereco_bairro: e.target.value }))} 
                                  className="rounded-xl h-11 pr-10" 
                                />
                                {customDeliveryAddress.endereco_bairro && (
                                  <button
                                    onClick={() => setCustomDeliveryAddress(a => ({ ...a, endereco_bairro: "" }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                                    type="button"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                                <datalist id="custom-bairros-list">
                                  {allBairros.map(b => (
                                    <option key={b} value={b} />
                                  ))}
                                </datalist>
                              </div>
                            )}
                            {storeFreteTipo === "bairro" && (
                              <p className="text-[10px] text-muted-foreground mt-1">Só entregamos nos bairros relacionado da lista.</p>
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Cidade</label>
                            <Input placeholder="Cidade" value={customDeliveryAddress.endereco_cidade} onChange={(e) => setCustomDeliveryAddress(a => ({ ...a, endereco_cidade: e.target.value }))} className="rounded-xl h-11" />
                          </div>
                        </div>
                    ) : deliveryMode === "delivery" && !deliveryAddressConfirmed ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground text-center">Esse endereço é o da entrega? Caso não, altere no lápis.</p>
                        <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 space-y-2">
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                            <div className="space-y-0.5 flex-1">
                              <p className="font-semibold text-sm text-foreground">
                                {[clientData?.endereco_rua, clientData?.endereco_numero].filter(Boolean).join(", ") || "Endereço não cadastrado"}
                              </p>
                              {clientData?.endereco_bairro && <p className="text-xs text-muted-foreground">{clientData.endereco_bairro}</p>}
                              {clientData?.endereco_cidade && <p className="text-xs text-muted-foreground">{clientData.endereco_cidade}</p>}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setCustomDeliveryAddress({
                                    endereco_rua: clientData?.endereco_rua || "",
                                    endereco_numero: clientData?.endereco_numero || "",
                                    endereco_bairro: clientData?.endereco_bairro || "",
                                    endereco_cidade: clientData?.endereco_cidade || "",
                                    endereco_complemento: clientData?.endereco_complemento || "",
                                    endereco_cep: clientData?.endereco_cep || "",
                                  });
                                  setEditingDeliveryAddress(true);
                                }}
                                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors flex flex-col items-center gap-1"
                                title="Editar endereço"
                              >
                                <Pencil className="w-4 h-4" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                                <span className="text-[9px] font-bold uppercase" style={{ color: storePrimary || 'hsl(var(--primary))' }}>Editar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 py-1"
                          onClick={() => {
                            setCustomDeliveryAddress({
                              endereco_rua: "",
                              endereco_numero: "",
                              endereco_bairro: "",
                              endereco_cidade: "",
                              endereco_complemento: "",
                              endereco_cep: "",
                            });
                            setEditingDeliveryAddress(true);
                          }}
                        >
                          <Plus className="w-3 h-3" /> NOVO ENDEREÇO DE ENTREGA
                        </Button>
                      </div>
                    ) : !selectedPayment ? (
                      /* Step 2: Payment method */
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground text-center">Escolha a forma de pagamento</p>
                        <div className="space-y-2">
                          {(((store as any)?.formas_pagamento || ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"]) as any[]).map((raw: any) => { const method = typeof raw === "string" ? raw : raw?.nome; const isActive = typeof raw === "string" ? true : raw?.ativo !== false; if (!method || !isActive) return null; return method; }).filter(Boolean).map((method: string) => {
                            const iconMap: Record<string, any> = {
                              "Dinheiro": Banknote,
                              "PIX": Smartphone,
                              "Cartão de Crédito": CreditCard,
                              "Cartão de Débito": CreditCard,
                            };
                            const Icon = iconMap[method] || CreditCard;
                            return (
                              <button
                                key={method}
                                onClick={() => {
                                  setSelectedPayment(method);
                                  setNeedsChange(null);
                                  setChangeAmount("");
                                  // For methods that don't need extra steps, go straight to summary
                                  if (method !== "Dinheiro" && method !== "PIX") {
                                    setPaymentStepDone(true);
                                  } else {
                                    setPaymentStepDone(false);
                                  }
                                }}
                                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary transition-colors bg-card text-left"
                              >
                                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="font-medium text-foreground">{method}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : !paymentStepDone ? (
                      /* Step 2.5: Payment details (Dinheiro / PIX) */
                      <div className="space-y-4">
                        {selectedPayment === "Dinheiro" ? (
                          <>
                             <div className="space-y-4 pt-2">
                               <div className="space-y-2">
                                 <div className="flex flex-col items-center">
                                   <p className="text-base font-bold text-foreground">Resumo do pedido</p>
                                 </div>
                                 <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">Subtotal</span>
                                  <span className="font-semibold">{formatCurrency(cartTotal)}</span>
                                </div>
                                {appliedCoupon && appliedCoupon.tipo !== 'frete_gratis' && (
                                  <div className="flex justify-between items-center text-sm text-primary">
                                    <span className="font-medium">Desconto ({appliedCoupon.codigo})</span>
                                    <span className="font-bold">-{formatCurrency(finalDiscountValue)}</span>
                                  </div>
                                )}
                                {deliveryMode === "delivery" && (
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Taxa de Entrega</span>
                                    {appliedCoupon?.tipo === 'frete_gratis' ? (
                                      <span className="font-bold text-emerald-500">Grátis (Cupom)</span>
                                    ) : (
                                      <span className="font-semibold">{computedFrete === null ? "Bairro não listado" : (computedFrete > 0 ? formatCurrency(computedFrete) : "Grátis")}</span>
                                    )}
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-border/40">
                                  <span className="font-bold">Total Geral</span>
                                  <span className="font-bold text-lg" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                    {formatCurrency(totalComFrete)}
                                  </span>
                                </div>
                                {needsChange && changeAmount && Number(changeAmount) > totalComFrete && (
                                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/40 text-success">
                                    <span className="text-sm font-bold">Seu Troco</span>
                                    <span className="font-bold">{formatCurrency(Number(changeAmount) - totalComFrete)}</span>
                                  </div>
                                )}
                                   </div>
                                 </div>

                              {needsChange === null ? (
                                <>
                                  <p className="text-sm font-medium text-foreground text-center">Precisa de troco?</p>
                                  <div className="grid grid-cols-2 gap-3">
                                  <Button
                                    variant="outline"
                                    className="h-14 rounded-xl text-base font-bold"
                                    onClick={() => { setNeedsChange(false); setPaymentStepDone(true); }}
                                  >
                                    Não preciso
                                  </Button>
                                  <Button
                                    className="h-14 rounded-xl text-base font-bold text-white border-0"
                                    style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                                    onClick={() => setNeedsChange(true)}
                                  >
                                    Sim, preciso
                                  </Button>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium text-foreground mb-1.5 block">Troco para quanto?</label>
                                    <Input
                                      type="number"
                                      placeholder="Ex: 50"
                                      value={changeAmount}
                                      onChange={(e) => setChangeAmount(e.target.value)}
                                      className="rounded-xl h-12 text-base"
                                      inputMode="numeric"
                                    />
                                  </div>
                                  
                                  {changeAmount && Number(changeAmount) <= (cartTotal + (deliveryMode === "delivery" ? computedFrete : 0)) && Number(changeAmount) > 0 && (
                                    <p className="text-[10px] text-destructive text-center font-medium">O valor deve ser maior que o total do pedido.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        ) : selectedPayment === "PIX" ? (
                          (() => {
                            const freteValorPix = deliveryMode === "delivery" ? computedFrete : 0;
                            const totalPix = cartTotal + freteValorPix;
                            // Generate PIX BR Code payload
                            const generatePixPayload = () => {
                              const pixKey = storeProfile?.pix_chave || "";
                              const name = (storeProfile?.pix_nome_favorecido || store?.nome || "Loja").substring(0, 25);
                              const city = (store as any)?.endereco_cidade || "CIDADE";
                              const amount = totalComFrete.toFixed(2);
                              // EMV PIX format
                              const tlv = (id: string, val: string) => id + String(val.length).padStart(2, "0") + val;
                              const gui = tlv("00", "br.gov.bcb.pix");
                              const key = tlv("01", pixKey);
                              const mai = tlv("26", gui + key);
                              let payload =
                                tlv("00", "01") +        // format indicator
                                mai +                     // merchant account info
                                tlv("52", "0000") +       // merchant category
                                tlv("53", "986") +        // currency BRL
                                tlv("54", amount) +       // amount
                                tlv("58", "BR") +         // country
                                tlv("59", name.toUpperCase()) +
                                tlv("60", city.substring(0, 15).toUpperCase()) +
                                tlv("62", tlv("05", "***"));
                              payload += "6304";
                              // CRC16 CCITT
                              let crc = 0xFFFF;
                              for (let i = 0; i < payload.length; i++) {
                                crc ^= payload.charCodeAt(i) << 8;
                                for (let j = 0; j < 8; j++) {
                                  crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
                                  crc &= 0xFFFF;
                                }
                              }
                              return payload + crc.toString(16).toUpperCase().padStart(4, "0");
                            };
                            const pixPayload = storeProfile?.pix_chave ? generatePixPayload() : "";
                            return (
                              <div className="space-y-4">
                                {/* Resumo (igual ao Dinheiro) */}
                                <div className="space-y-2">
                                  <div className="flex flex-col items-center">
                                    <p className="text-base font-bold text-foreground">Resumo do pedido</p>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-semibold">{formatCurrency(cartTotal)}</span>
                                  </div>
                                  {appliedCoupon && appliedCoupon.tipo !== 'frete_gratis' && (
                                    <div className="flex justify-between items-center text-sm text-primary">
                                      <span className="font-medium">Desconto ({appliedCoupon.codigo})</span>
                                      <span className="font-bold">-{formatCurrency(finalDiscountValue)}</span>
                                    </div>
                                  )}
                                  {deliveryMode === "delivery" && (
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="text-muted-foreground">Taxa de Entrega</span>
                                      {appliedCoupon?.tipo === 'frete_gratis' ? (
                                        <span className="font-bold text-emerald-500">Grátis (Cupom)</span>
                                      ) : (
                                        <span className="font-semibold">{computedFrete === null ? "Bairro não listado" : (computedFrete > 0 ? formatCurrency(computedFrete) : "Grátis")}</span>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                                    <span className="font-bold">Total Geral</span>
                                    <span className="font-bold text-lg" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                      {formatCurrency(totalComFrete)}
                                    </span>
                                  </div>
                                  </div>
                                </div>

                                {storeProfile?.pix_chave ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-col items-center gap-2">
                                      <p className="text-base font-bold text-foreground">Pague via PIX</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                                    {/* Dados PIX */}
                                    <div className="px-5 py-4 space-y-3">
                                      {storeProfile.pix_nome_favorecido && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">Favorecido</span>
                                          <span className="text-sm font-medium text-foreground">{storeProfile.pix_nome_favorecido}</span>
                                        </div>
                                      )}
                                      {storeProfile.pix_tipo && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">Tipo da chave</span>
                                          <span className="text-sm font-medium uppercase text-foreground">{storeProfile.pix_tipo}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Chave PIX</span>
                                        <span className="text-sm font-medium text-foreground break-all text-right">{storeProfile.pix_chave}</span>
                                      </div>
                                      <div className="pt-2">
                                        <Button
                                          variant="outline"
                                          size="default"
                                          className="w-full h-10 px-4 rounded-xl text-sm font-bold border-2"
                                          style={{ color: storePrimary || 'hsl(var(--primary))', borderColor: storePrimary || 'hsl(var(--primary))' }}
                                          onClick={() => {
                                            navigator.clipboard.writeText(storeProfile.pix_chave!);
                                            toast.success("Chave PIX copiada!");
                                          }}
                                        >
                                          Copiar chave PIX
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                  <div className="p-6 rounded-2xl bg-muted/50 text-center">
                                    <p className="text-sm text-muted-foreground">Chave PIX não cadastrada pela loja.</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : null}
                      </div>
                    ) : (
                      /* Step 3: Card-based summary & confirm */
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="text-center pb-1">
                          {store?.logo_url && (
                            <img src={store.logo_url} alt="" className="w-10 h-10 rounded-full mx-auto object-cover mb-1" />
                          )}
                          <h3 className="text-base font-bold text-foreground">{store?.nome}</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>

                        {/* Card: Produtos */}
                        <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5" /> Produtos
                          </h4>
                          <div className="space-y-1">
                            {cart.map((item, idx) => {
                              const gratisAte = Number(item.gratis_ate) || 0;
                              const addons = (item.addons || []).map((add: any, i: number) => {
                                const addName = typeof add === "string" ? add : add.nome || add;
                                const addPrice = typeof add === "object" ? Number(add.preco) || 0 : 0;
                                const addQty = typeof add === "object" ? Math.max(1, Number(add.quantidade) || 1) : 1;
                                const isFree = i < gratisAte;
                                return { nome: addName, preco: addPrice, quantidade: addQty, isFree };
                              });
                              const addonsTotal = addons.reduce((s: number, a: any) => s + (a.isFree ? 0 : a.preco * a.quantidade), 0);
                              const basePrice = Math.max((item.preco || 0) - addonsTotal, 0);
                              const itemSubtotal = (item.preco || 0) * item.quantidade;
                              const hasExtras = addons.length > 0 || (item.bordas && item.bordas.length > 0);

                              return (
                                <div key={item.uid} className="p-1.5 rounded-lg bg-background/60">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-foreground leading-tight">
                                        <span className="text-primary font-bold">{item.quantidade}x </span> {item.nome}
                                      </p>
                                      {item.caldo_sabor && (
                                        <p className="text-[10px] font-bold text-muted-foreground mt-[-2px]">Sabor {item.caldo_sabor.nome}</p>
                                      )}
                                      {item.unidade_medida === "kg" && item.unit_price && (<p className="text-[10px] text-muted-foreground font-semibold">Preço/Kg: {formatCurrency(item.unit_price)}</p>)}
                              {item.tamanho && (
                                        <p className="text-[10px] font-bold text-primary mt-0.5 uppercase">Tamanho: {item.tamanho}</p>
                                      )}
                                      {item.sabores && item.sabores.length > 0 && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Sabores ({item.quantidade_sabores || item.sabores.length}): {item.sabores.join(", ")}</p>
                                      )}
                                      {item.bordas && item.bordas.length > 0 && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Bordas ({item.quantidade_bordas || item.bordas.length}): {item.bordas.join(", ")}</p>
                                      )}
                                    </div>
                                    <span className="text-xs font-bold text-foreground flex-shrink-0">{formatCurrency(basePrice)}</span>
                                  </div>
                                  {addons.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {addons.map((add: any, i: number) => {
                                        const lineLabel = add.quantidade > 1 ? `${add.nome} x${add.quantidade}` : add.nome;
                                        const lineTotal = add.preco * add.quantidade;
                                        return (
                                          <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground pl-2 border-l-2 border-primary/20">
                                            <span>+ {lineLabel}</span>
                                            <span className="text-foreground font-medium">
                                              {add.isFree ? "Grátis" : (lineTotal > 0 ? formatCurrency(lineTotal) : "Grátis")}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {hasExtras && (
                                    <div className="flex justify-between mt-1 pt-1 border-t border-border/30">
                                      <span className="text-[10px] text-muted-foreground">Subtotal</span>
                                      <span className="text-xs font-bold text-primary">{formatCurrency(itemSubtotal)}</span>
                                    </div>
                                  )}
                                  {item.observation && (
                                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400 mt-1 italic">💬 {item.observation}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="border-t border-border/30 mt-2 pt-2 flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="text-foreground font-mono">{formatCurrency(cartTotal)}</span>
                          </div>
                          {appliedCoupon?.tipo === 'frete_gratis' && deliveryMode === "delivery" && (
                            <div className="flex justify-between text-xs font-semibold mt-1">
                              <span className="text-muted-foreground">Taxa de Entrega</span>
                              <span className="font-mono font-bold text-emerald-500">Grátis (Cupom)</span>
                            </div>
                          )}
                        </div>

                        {/* Card: Entrega */}
                        <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5" /> Entrega
                          </h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Tipo</span>
                              <span className="text-foreground font-medium">
                                {deliveryMode === "delivery" ? "🛵 Delivery" : "📍 Retirada"}
                              </span>
                            </div>
                            {deliveryMode === "delivery" && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Endereço</span>
                                  <span className="text-foreground font-medium text-right max-w-[55%] text-[11px]">
                                    {customDeliveryAddress.endereco_rua?.trim()
                                      ? [customDeliveryAddress.endereco_rua, customDeliveryAddress.endereco_numero, customDeliveryAddress.endereco_bairro].filter(Boolean).join(", ")
                                      : [clientData?.endereco_rua, clientData?.endereco_numero, clientData?.endereco_bairro].filter(Boolean).join(", ") || "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Taxa de Entrega</span>
                                  {appliedCoupon?.tipo === 'frete_gratis' ? (
                                    <span className="font-mono font-bold text-emerald-600">
                                      Grátis (Cupom)
                                    </span>
                                  ) : (
                                    <span className={`font-mono font-medium ${computedFrete === null ? 'text-destructive' : 'text-foreground'}`}>
                                      {computedFrete === null ? 'Bairro não listado' : formatCurrency(computedFrete)}
                                    </span>
                                  )}
                                </div>

                              </>
                            )}
                          </div>
                        </div>

                        {/* Card: Pagamento */}
                        <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Pagamento
                          </h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Forma</span>
                              <span className="text-foreground font-medium">💳 {selectedPayment}</span>
                            </div>
                            {selectedPayment === "Dinheiro" && needsChange && changeAmount && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Troco</span>
                                <span className="text-foreground font-medium">
                                  💵 {formatCurrency(Math.max(0, Number(changeAmount) - totalComFrete))}
                                </span>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Card: Cupom de Desconto */}
                        {appliedCoupon && (
                          <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Ticket className="w-3.5 h-3.5" /> Cupom de Desconto
                            </h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Código</span>
                                <span className="text-foreground font-bold">{appliedCoupon.codigo}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo</span>
                                <span className="text-foreground font-medium">
                                  {appliedCoupon.tipo === 'frete_gratis' && '🚚 Frete Grátis'}
                                  {appliedCoupon.tipo === 'percentual' && `📊 Percentual (${Number(appliedCoupon.valor)}%)`}
                                  {(appliedCoupon.tipo === 'valor_fixo' || appliedCoupon.tipo === 'fixo') && '💰 Valor Fixo'}
                                  {appliedCoupon.tipo === 'cliente_novo' && '🎁 Cliente Novo'}
                                  {!['frete_gratis','percentual','valor_fixo','fixo','cliente_novo'].includes(appliedCoupon.tipo) && appliedCoupon.tipo}
                                </span>
                              </div>
                              {appliedCoupon.tipo === 'frete_gratis' ? (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Desconto no Frete</span>
                                  <span className="font-mono font-bold text-emerald-600">FRETE GRÁTIS</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-mono text-foreground">{formatCurrency(cartTotal)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Desconto Aplicado</span>
                                    <span className="font-mono font-bold text-emerald-600">-{formatCurrency(finalDiscountValue)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Total */}
                        <div className="bg-foreground/5 rounded-xl p-4 border border-border/40">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span className="font-mono text-foreground">{formatCurrency(cartTotal)}</span>
                            </div>
                            {appliedCoupon && appliedCoupon.tipo !== 'frete_gratis' && (
                              <div className="flex justify-between text-xs text-emerald-600">
                                <span className="font-medium">Desconto ({appliedCoupon.codigo})</span>
                                <span className="font-mono font-bold">-{formatCurrency(finalDiscountValue)}</span>
                              </div>
                            )}
                            {deliveryMode === "delivery" && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Taxa de Entrega</span>
                                {appliedCoupon?.tipo === 'frete_gratis' ? (
                                  <span className="font-mono font-bold text-emerald-600">Grátis (Cupom)</span>
                                ) : (
                                  <span className="font-mono text-foreground">{formatCurrency(computedFrete ?? 0)}</span>
                                )}
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border/40">
                              <span className="text-foreground">TOTAL</span>
                              <span className="font-mono" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                {formatCurrency(totalComFrete)}
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  </div>
                )}
              </div>
              {/* ═══ FIXED BOTTOM BAR ═══ */}
              {showForm && (
                <div className="shrink-0 px-6 py-4 pb-6 bg-card flex gap-3 border-t border-border/50 relative z-40">
                  <Button
                    className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                    onClick={() => {
                      if (paymentStepDone && deliveryMode && selectedPayment) {
                        setPaymentStepDone(false);
                        if (selectedPayment !== "Dinheiro" && selectedPayment !== "PIX") setSelectedPayment(null);
                      } else if (selectedPayment && !paymentStepDone) {
                        setSelectedPayment(null);
                        setPaymentStepDone(false);
                      } else if (!selectedPayment && deliveryAddressConfirmed) {
                        setDeliveryAddressConfirmed(false);
                        setSelectedPayment(null);
                      } else if (editingDeliveryAddress) {
                        setEditingDeliveryAddress(false);
                        setDeliveryAddressConfirmed(false);
                      } else if (deliveryMode && !deliveryAddressConfirmed) {
                        setDeliveryMode(null);
                      } else {
                        setShowForm(false);
                        setDeliveryMode(null);
                      }
                    }}
                  >
                    <ChevronLeft className="h-5 w-5 mr-2 animate-bounce-horizontal" /> Voltar
                  </Button>
                  {/* Confirmar endereço ao lado de Voltar - modo edição */}
                  {deliveryMode === "delivery" && editingDeliveryAddress && (
                    <Button
                      className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}
                      onClick={async () => {
                        if (!customDeliveryAddress.endereco_rua.trim() || !customDeliveryAddress.endereco_numero.trim() || !customDeliveryAddress.endereco_bairro.trim()) {
                          toast.error("Preencha rua, número e bairro.");
                          return;
                        }
                        // Persist the new address to the client's profile so it
                        // is used for this order and remembered for next ones.
                        try {
                          if (clientData?.id) {
                            const patch = {
                              endereco_rua: customDeliveryAddress.endereco_rua || null,
                              endereco_numero: customDeliveryAddress.endereco_numero || null,
                              endereco_complemento: customDeliveryAddress.endereco_complemento || null,
                              endereco_bairro: customDeliveryAddress.endereco_bairro || null,
                              endereco_cidade: customDeliveryAddress.endereco_cidade || null,
                              endereco_estado: (customDeliveryAddress as any).endereco_estado || null,
                              endereco_cep: customDeliveryAddress.endereco_cep || null,
                            };
                            const { error } = await supabase.from('clientes').update(patch).eq('id', clientData.id);
                            if (error) throw error;
                             const updated = { ...clientData, ...patch };
                             setClientData(updated);
                             localStorage.setItem('noov_client', JSON.stringify(updated));
                             setClientAddress([updated.endereco_rua, updated.endereco_numero, updated.endereco_complemento, updated.endereco_bairro, updated.endereco_cidade].filter(Boolean).join(", "));
                             toast.success("Endereço atualizado! ✅");
                          }
                        } catch (err) {
                          console.error("Erro ao salvar endereço:", err);
                          toast.error("Não foi possível salvar o endereço, mas você pode continuar o pedido.");
                        }
                        setEditingDeliveryAddress(false);
                        setDeliveryAddressConfirmed(true);
                      }}
                    >
                      <Check className="h-5 w-5 mr-2" /> Confirmar endereço
                    </Button>
                  )}
                  {/* Confirmar endereço ao lado de Voltar - modo visualização */}
                  {deliveryMode === "delivery" && !editingDeliveryAddress && !deliveryAddressConfirmed && (
                    <Button
                      className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}
                      onClick={() => {
                        setCustomDeliveryAddress({ endereco_rua: "", endereco_numero: "", endereco_bairro: "", endereco_cidade: "", endereco_complemento: "", endereco_cep: "" });
                        if (clientData?.endereco_rua) {
                          setClientAddress([clientData.endereco_rua, clientData.endereco_numero, clientData.endereco_complemento, clientData.endereco_bairro, clientData.endereco_cidade].filter(Boolean).join(", "));
                        }
                        setDeliveryAddressConfirmed(true);
                      }}
                    >
                      <Check className="h-5 w-5 mr-2" /> Confirmar endereço
                    </Button>
                  )}
                  {/* Continuar troco ao lado de Voltar */}
                  {selectedPayment === "Dinheiro" && needsChange === true && !paymentStepDone && (
                    <Button
                      className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}
                      onClick={() => { 
                        const totalComEntrega = cartTotal + (deliveryMode === "delivery" ? computedFrete : 0);
                        if (!changeAmount.trim()) {
                          toast.error("Informe o valor do troco.");
                        } else if (Number(changeAmount) <= totalComEntrega) {
                          toast.error("O valor para troco deve ser maior que o total do pedido.");
                        } else {
                          setPaymentStepDone(true); 
                        }
                      }}
                    >
                      <Check className="h-5 w-5 mr-2" /> Continuar
                    </Button>
                  )}
                  {/* Já paguei PIX ao lado de Voltar */}
                  {selectedPayment === "PIX" && !paymentStepDone && deliveryAddressConfirmed && (
                    <Button
                      className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: 'hsl(var(--success, 142 71% 45%))' }}
                      onClick={() => setPaymentStepDone(true)}
                    >
                      <Check className="h-5 w-5 mr-2" /> Já paguei · Continuar
                    </Button>
                  )}
                  {paymentStepDone && deliveryMode && selectedPayment && (
                    <Button
                      className="w-full h-13 text-base font-bold rounded-xl text-white border-0 shadow-md active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: 'hsl(var(--success))' }}
                      onClick={handleSubmitOrder}
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" /> Enviar Pedido
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ RANKING MODAL ═══ */}
      <AnimatePresence>
        {showRanking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border sticky top-0 bg-background z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.125rem)' }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowRanking(false); setActiveBottomTab(null); }}
                  className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Flame className="w-5 h-5" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                  + Vendidos
                </h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-0 py-2">
              <div className="max-w-3xl mx-auto">
                {products
                  .filter(p => p.disponivel && (topSellerCounts[p.id] || 0) > 0)
                  .sort((a, b) => (topSellerCounts[b.id] || 0) - (topSellerCounts[a.id] || 0))
                  .slice(0, 20)
                  .map((product, idx) => {
                    const rank = idx + 1;
                    return (
                      <div 
                        key={product.id}
                        onClick={() => {
                          setSelectedProduct(product);
                           setShowRanking(false);
                           setActiveBottomTab(null);
                        }}
                        className="flex items-center gap-4 p-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                      >
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                          <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black z-10 shadow-lg border-2 border-background ${
                            rank === 1 ? 'bg-yellow-400 text-yellow-900' : 
                            rank === 2 ? 'bg-slate-300 text-slate-800' :
                            rank === 3 ? 'bg-orange-400 text-orange-900' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {rank}º
                          </div>
                          {product.imagem_url ? (
                            <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center rounded-xl text-2xl">
                              {segmentEmoji[store?.segmento || 'lanchonete'] || "📦"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm font-display leading-snug line-clamp-1 flex-1 group-hover:text-primary transition-colors">
                              {product.nome}
                            </h3>
                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 flex-shrink-0">
                              <ShoppingCart className="w-3 h-3" />
                              {topSellerCounts[product.id] || 0} vendidos
                            </span>
                          </div>
                          <div className="w-8 h-[1.5px] rounded-full mb-1" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }} />
                          {product.descricao && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                              {product.descricao}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {product.preco_promocional ? (
                                  <>
                                    <span className="text-sm font-black" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Number(product.preco_promocional))}</span>
                                    <span className="text-[10px] text-muted-foreground line-through">{formatCurrency(Number(product.preco))}</span>
                                  </>
                                ) : (
                                  <span className="text-sm font-black" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Number(product.preco))}</span>
                                )}
                            </div>
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all"
                              style={{ 
                                backgroundColor: storePrimary ? `${storePrimary}33` : 'rgba(var(--primary), 0.2)',
                                color: storePrimary || 'hsl(var(--primary))'
                              }}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CLIENT AUTH MODAL ═══ */}
      <AnimatePresence>
        {showClientAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center"
            onClick={() => { setShowClientAuth(false); setActiveBottomTab(null); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-5xl rounded-t-3xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 max-w-md mx-auto">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-3" />

                {/* Icon/Photo + Close on same row */}
                <div className="relative flex items-center justify-center mb-4">
                  <div className="relative">
                    {clientData?.foto_url ? (
                      <img src={clientData.foto_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${storePrimary || 'hsl(var(--primary))'}15` }}>
                        <User className="w-7 h-7" style={{ color: storePrimary || 'hsl(var(--primary))' }} />
                      </div>
                    )}
                    {clientData && (
                      <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-md">
                        <Camera className="w-3 h-3 text-primary-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !clientData) return;
                            
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error('Imagem muito grande. Máximo 2MB.');
                              return;
                            }

                            setUploadingPhoto(true);
                            try {
                              const ext = file.name.split('.').pop() || 'jpg';
                              const path = `${clientData.id}-${Date.now()}.${ext}`;
                              const { error: uploadError } = await supabase.storage.from('client-photos').upload(path, file, { 
                                upsert: true,
                                cacheControl: '3600'
                              });
                              
                              if (uploadError) {
                                console.error('Error uploading photo:', uploadError);
                                throw uploadError;
                              }
                              
                              const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(path);
                              const foto_url = `${urlData.publicUrl}?t=${Date.now()}`;
                              const { error: updateError } = await supabase.from('clientes').update({ foto_url }).eq('id', clientData.id);
                              
                              if (updateError) {
                                console.error('Error updating client photo url:', updateError);
                                throw updateError;
                              }

                              const updated = { ...clientData, foto_url };
                              setClientData(updated);
                              localStorage.setItem('noov_client', JSON.stringify(updated));
                              toast.success('Foto atualizada! 📸');
                            } catch (err: any) { 
                              console.error('Photo upload exception:', err);
                              toast.error(`Erro ao enviar foto: ${err.message || 'Tente novamente'}`); 
                            }
                            finally { setUploadingPhoto(false); }
                          }}
                        />
                      </label>
                    )}
                    {uploadingPhoto && <div className="absolute inset-0 rounded-2xl bg-foreground/30 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>}
                  </div>
                  <button onClick={() => { setShowClientAuth(false); setEditingProfile(false); setActiveBottomTab(null); }} className="absolute right-0 p-2 rounded-full hover:bg-muted transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Title */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold font-display text-foreground">
                    {clientData ? "Meu Perfil" : clientAuthMode === "login" ? "Entrar na sua conta" : "Criar sua conta"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {clientData ? "Seus dados cadastrados" : clientAuthMode === "login" ? "Digite seu telefone para acessar" : "Preencha seus dados para começar"}
                  </p>
                </div>

                {clientData ? (
                  editingProfile ? (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">Nome completo</label>
                          <Input value={editForm?.nome_completo || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, nome_completo: e.target.value }))} className="rounded-xl h-11 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm font-semibold text-foreground mb-1 block">Nascimento</label>
                            <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} value={editForm?.data_nascimento || ""} onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                              let formatted = digits;
                              if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                              if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                              setEditForm((f: any) => ({ ...f, data_nascimento: formatted }));
                            }} className="rounded-xl h-11 text-sm" />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-foreground mb-1 block">WhatsApp</label>
                            <Input value={editForm?.whatsapp || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, whatsapp: e.target.value }))} className="rounded-xl h-11 text-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Endereço</h4>
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">CEP</label>
                          <Input 
                            placeholder="00000-000" 
                            value={editForm?.endereco_cep || ""} 
                            onChange={async (e) => {
                              const cep = e.target.value.replace(/\D/g, "");
                              const formatted = cep.length > 5 ? cep.slice(0, 5) + "-" + cep.slice(5, 8) : cep;
                              setEditForm((f: any) => ({ ...f, endereco_cep: formatted }));
                              if (cep.length === 8) {
                                try {
                                  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                                  const data = await res.json();
                                  if (!data.erro) {
                                    setEditForm((f: any) => ({
                                      ...f,
                                      endereco_rua: data.logradouro || f.endereco_rua,
                                      endereco_bairro: data.bairro || f.endereco_bairro,
                                      endereco_cidade: data.localidade || f.endereco_cidade,
                                      endereco_estado: data.uf || f.endereco_estado,
                                    }));
                                  }
                                } catch {}
                              }
                            }} 
                            maxLength={9}
                            className="rounded-xl h-11 text-sm" 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-foreground mb-1 block">Rua</label>
                          <Input placeholder="Rua" value={editForm?.endereco_rua || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_rua: e.target.value }))} className="rounded-xl h-11 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Número</label>
                            <Input placeholder="Número" value={editForm?.endereco_numero || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_numero: e.target.value }))} className="rounded-xl h-11 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Complemento</label>
                            <Input placeholder="Complemento" value={editForm?.endereco_complemento || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_complemento: e.target.value }))} className="rounded-xl h-11 text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-foreground mb-1 block">Bairro</label>
                          {allBairros.length > 0 ? (
                            <Select 
                              value={editForm?.endereco_bairro || ""} 
                              onValueChange={(val) => setEditForm((f: any) => ({ ...f, endereco_bairro: val }))}
                            >
                              <SelectTrigger className="rounded-xl h-11 bg-background border-border relative z-[100]">
                                <SelectValue placeholder="Escolha o bairro" />
                              </SelectTrigger>
                              <SelectContent className="z-[150]">
                                {allBairros.map(b => (
                                  <SelectItem key={b} value={b}>{b}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="relative group">
                              <Input 
                                list="edit-bairros-list"
                                placeholder="Bairro" 
                                value={editForm?.endereco_bairro || ""} 
                                onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_bairro: e.target.value }))} 
                                className="rounded-xl pr-10 h-11 text-sm" 
                              />
                              {(editForm?.endereco_bairro) && (
                                <button
                                  onClick={() => setEditForm((f: any) => ({ ...f, endereco_bairro: "" }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                                  type="button"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <datalist id="edit-bairros-list">
                                {allBairros.map(b => (
                                  <option key={b} value={b} />
                                ))}
                              </datalist>
                            </div>
                          )}
                          {storeFreteTipo === "bairro" && (
                            <p className="text-[10px] text-muted-foreground mt-1">Só entregamos nos bairros relacionado da lista.</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Cidade</label>
                            <Input placeholder="Cidade" value={editForm?.endereco_cidade || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_cidade: e.target.value }))} className="rounded-xl h-11 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">Estado</label>
                            <Input placeholder="Estado" value={editForm?.endereco_estado || ""} onChange={(e) => setEditForm((f: any) => ({ ...f, endereco_estado: e.target.value }))} className="rounded-xl h-11 text-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setEditingProfile(false)}>Cancelar</Button>
                        <Button
                          className="flex-1 h-12 rounded-xl text-white font-bold border-0"
                          style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                          disabled={clientLoading}
                          onClick={async () => {
                            setClientLoading(true);
                            try {
                              const nascIso = editForm.data_nascimento?.length === 10
                                ? `${editForm.data_nascimento.slice(6, 10)}-${editForm.data_nascimento.slice(3, 5)}-${editForm.data_nascimento.slice(0, 2)}`
                                : clientData.data_nascimento;
                              const { error } = await supabase.from('clientes').update({
                                nome_completo: editForm.nome_completo,
                                whatsapp: editForm.whatsapp,
                                telefone: editForm.whatsapp,
                                instagram: editForm.instagram || null,
                                data_nascimento: nascIso || null,
                                endereco_rua: editForm.endereco_rua || null,
                                endereco_numero: editForm.endereco_numero || null,
                                endereco_complemento: editForm.endereco_complemento || null,
                                endereco_bairro: editForm.endereco_bairro || null,
                                endereco_cidade: editForm.endereco_cidade || null,
                                endereco_estado: editForm.endereco_estado || null,
                                endereco_cep: editForm.endereco_cep || null,
                              }).eq('id', clientData.id);
                              if (error) throw error;
                              const updated = { ...clientData, ...editForm, telefone: editForm.whatsapp, data_nascimento: nascIso || null };
                              setClientData(updated);
                              localStorage.setItem('noov_client', JSON.stringify(updated));
                              setClientAddress([updated.endereco_rua, updated.endereco_numero, updated.endereco_complemento, updated.endereco_bairro, updated.endereco_cidade].filter(Boolean).join(", "));
                              setEditingProfile(false);
                              toast.success('Dados atualizados! ✅');
                            } catch { toast.error('Erro ao atualizar.'); }
                            finally { setClientLoading(false); }
                          }}
                        >
                          {clientLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nome</span><span className="font-medium text-foreground">{clientData.nome_completo}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">WhatsApp</span><span className="font-medium text-foreground">{formatPhone(clientData.whatsapp || clientData.telefone)}</span></div>
                        {clientData.data_nascimento && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nascimento</span><span className="font-medium text-foreground">{new Date(clientData.data_nascimento).toLocaleDateString("pt-BR")}</span></div>}
                        {clientData.instagram && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Instagram</span><span className="font-medium text-foreground">@{clientData.instagram.replace("@", "")}</span></div>}
                        {clientData.endereco_rua && (
                          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Endereço</span><span className="font-medium text-foreground text-right max-w-[60%]">{[clientData.endereco_rua, clientData.endereco_numero, clientData.endereco_complemento, clientData.endereco_bairro, clientData.endereco_cidade].filter(Boolean).join(", ")}</span></div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full h-12 rounded-xl font-semibold"
                        onClick={() => {
                          const nasc = clientData.data_nascimento
                            ? new Date(clientData.data_nascimento).toLocaleDateString("pt-BR")
                            : "";
                          setEditForm({
                            nome_completo: clientData.nome_completo || "",
                            whatsapp: clientData.whatsapp || clientData.telefone || "",
                            instagram: clientData.instagram || "",
                            data_nascimento: nasc,
                            endereco_rua: clientData.endereco_rua || "",
                            endereco_numero: clientData.endereco_numero || "",
                            endereco_complemento: clientData.endereco_complemento || "",
                            endereco_bairro: clientData.endereco_bairro || "",
                            endereco_cidade: clientData.endereco_cidade || "",
                            endereco_estado: clientData.endereco_estado || "",
                          });
                          setEditingProfile(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar dados
                      </Button>
                      <Button variant="outline" className="w-full h-12 rounded-xl text-destructive border-destructive/30 font-semibold" onClick={handleClientLogout}>
                        Sair da conta
                      </Button>
                    </div>
                  )
                ) : clientAuthMode === "login" ? (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Telefone / WhatsApp</label>
                      <Input placeholder="(00) 00000-0000" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(maskPhoneInput(e.target.value))} className="rounded-xl h-12 text-base" />
                    </div>
                    <Button
                      className="w-full h-12 rounded-xl text-white font-bold border-0 shadow-elevated text-base"
                      style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                      onClick={handleClientLogin}
                      disabled={clientLoading}
                    >
                      {clientLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Não tem conta?{" "}
                      <button onClick={() => { if (clientesLimitReached) { setShowClientAuth(false); setShowClientLimitPopup(true); } else { setClientAuthMode("register"); } }} className="font-semibold underline" style={{ color: storePrimary || 'hsl(var(--primary))' }}>Cadastre-se</button>
                    </p>
                    <a href="https://noov.app.br" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-4 pt-4 border-t border-border/30 hover:opacity-80 transition-opacity">
                      <span className="text-[10px] text-muted-foreground">Feito por</span>
                      <span className="text-[10px] font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Card Dados Pessoais */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold font-display text-muted-foreground uppercase tracking-wide">Dados Pessoais</h3>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">Como quer ser chamado? *</label>
                        <Input placeholder="Seu nome" value={registerForm.nome_completo} onChange={(e) => setRegisterForm(f => ({ ...f, nome_completo: e.target.value }))} className="rounded-xl h-11 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">Nascimento</label>
                          <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} value={registerForm.data_nascimento} onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                            let formatted = digits;
                            if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                            if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                            setRegisterForm({ ...registerForm, data_nascimento: formatted });
                          }} className="rounded-xl h-11 text-sm" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">WhatsApp *</label>
                          <Input placeholder="(00) 0 0000-0000" inputMode="tel" value={registerForm.whatsapp} onChange={(e) => setRegisterForm(f => ({ ...f, whatsapp: maskPhoneInput(e.target.value) }))} className="rounded-xl h-11 text-sm" />
                        </div>
                      </div>
                    </div>

                    {/* Endereço */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold font-display text-muted-foreground uppercase tracking-wide">Endereço</h3>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">CEP</label>
                        <Input
                          placeholder="00000-000"
                          value={registerForm.endereco_cep}
                          onChange={async (e) => {
                            const cep = e.target.value.replace(/\D/g, "");
                            const formatted = cep.length > 5 ? cep.slice(0, 5) + "-" + cep.slice(5, 8) : cep;
                            setRegisterForm(f => ({ ...f, endereco_cep: formatted }));
                            if (cep.length === 8) {
                              try {
                                const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                                const data = await res.json();
                                if (!data.erro) {
                                  const bairroFound = data.bairro || "";
                                  
                                  setRegisterForm(f => ({
                                    ...f,
                                    endereco_rua: data.logradouro || f.endereco_rua,
                                    endereco_bairro: bairroFound || f.endereco_bairro,
                                    endereco_cidade: data.localidade || f.endereco_cidade,
                                    endereco_estado: data.uf || f.endereco_estado,
                                  }));
                                }
                              } catch {}
                            }
                          }}
                          className="rounded-xl h-11 text-sm"
                          maxLength={9}
                        />
                      </div>
                      <div className="grid grid-cols-[1fr_80px] gap-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">Rua *</label>
                          <Input placeholder="Rua" value={registerForm.endereco_rua} onChange={(e) => setRegisterForm(f => ({ ...f, endereco_rua: e.target.value }))} className="rounded-xl h-11 text-sm" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground mb-1 block">Nº *</label>
                          <Input placeholder="Nº" value={registerForm.endereco_numero} onChange={(e) => setRegisterForm(f => ({ ...f, endereco_numero: e.target.value }))} className="rounded-xl h-11 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">Complemento</label>
                        <Input placeholder="Apto, bloco..." value={registerForm.endereco_complemento} onChange={(e) => setRegisterForm(f => ({ ...f, endereco_complemento: e.target.value }))} className="rounded-xl h-11 text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">Bairro *</label>
                        {storeFreteTipo === "bairro" && allBairros.length > 0 ? (
                          <Select 
                            value={registerForm.endereco_bairro} 
                            onValueChange={(val) => setRegisterForm(f => ({ ...f, endereco_bairro: val }))}
                          >
                            <SelectTrigger className="rounded-xl bg-background border-border h-11 text-sm relative z-[100]">
                              <SelectValue placeholder="Escolha o bairro" />
                            </SelectTrigger>
                            <SelectContent className="z-[150]">
                              {allBairros.map(b => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <>
                            <Input 
                              list="register-bairros-list"
                              placeholder="Bairro" 
                              value={registerForm.endereco_bairro} 
                              onChange={(e) => setRegisterForm(f => ({ ...f, endereco_bairro: e.target.value }))} 
                              className="rounded-xl h-11 text-sm" 
                            />
                            <datalist id="register-bairros-list">
                              {allBairros.map(b => (
                                <option key={b} value={b} />
                              ))}
                            </datalist>
                          </>
                        )}
                        {storeFreteTipo === "bairro" && (
                          <p className="text-[10px] text-muted-foreground mt-1">Só entregamos nos bairros relacionado da lista.</p>
                        )}
                      </div>
                    <div className="grid grid-cols-[1fr_80px] gap-3">
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">Cidade *</label>
                        <Input placeholder="Cidade" value={registerForm.endereco_cidade} onChange={(e) => setRegisterForm(f => ({ ...f, endereco_cidade: e.target.value }))} className="rounded-xl h-11 text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1 block">Estado *</label>
                        <Input placeholder="UF" value={registerForm.endereco_estado} onChange={(e) => setRegisterForm(f => ({ ...f, endereco_estado: e.target.value }))} className="rounded-xl h-11 text-sm" />
                      </div>
                    </div>
                    </div>
                    

                    <Button
                      className="w-full h-12 rounded-xl text-white font-bold border-0 shadow-elevated text-base"
                      style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                      onClick={handleClientRegister}
                      disabled={clientLoading}
                    >
                      {clientLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar conta"}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      Já tem conta?{" "}
                      <button onClick={() => setClientAuthMode("login")} className="font-semibold underline" style={{ color: storePrimary || 'hsl(var(--primary))' }}>Faça login</button>
                    </p>
                    <a href="https://noov.app.br" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 mt-4 pt-4 border-t border-border/30 hover:opacity-80 transition-opacity">
                      <span className="text-[10px] text-muted-foreground">Feito por</span>
                      <span className="text-[10px] font-bold text-primary">N<span className="text-secondary">O</span>OV</span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MY ORDERS MODAL ═══ */}
      <AnimatePresence>
        {showMyOrders && clientData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center"
            onClick={() => { setShowMyOrders(false); setMyOrdersTab("pedidos"); setActiveBottomTab(null); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold font-display text-foreground">📋 Meus pedidos</h2>
                  <button onClick={() => { setShowMyOrders(false); setMyOrdersTab("pedidos"); setActiveBottomTab(null); }} className="p-2 rounded-full hover:bg-muted">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex gap-6 mb-6 border-b border-border/50">
                  <button
                    onClick={() => setMyOrdersTab("pedidos")}
                    className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
                      myOrdersTab === "pedidos"
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    Pedidos
                    {myOrdersTab === "pedidos" && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                      />
                    )}
                  </button>
                  {!clientData?.is_mesa_guest && (
                    <button
                      onClick={() => setMyOrdersTab("historico")}
                      className={`pb-3 text-sm font-bold transition-all relative flex items-center gap-2 ${
                        myOrdersTab === "historico"
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground/80"
                      }`}
                    >
                      <History className="w-4 h-4" />
                      Histórico
                      {myOrdersTab === "historico" && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                          style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                        />
                      )}
                    </button>
                  )}
                </div>

                {(() => {
                  const filteredOrders = clientOrders.filter((order: any) => {
                    const isCompleted = order.status === "finalizado" || order.status === "entregue" || order.status === "cancelado";
                    return myOrdersTab === "historico" ? isCompleted : !isCompleted;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          {myOrdersTab === "historico" 
                            ? "Nenhum histórico encontrado" 
                            : "Nenhum pedido em aberto"}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {filteredOrders.map((order: any) => {
                      const isMesaOrder = !!order.mesa_id;
                      const isRetirada = order.tipo === "retirada";
                      
                      const orderSteps = isMesaOrder
                        ? [
                            { key: "pendente", label: "Aguardando", icon: Clock, color: "text-blue-500" },
                            { key: "em_preparo", label: "Preparando", icon: ChefHat, color: "text-orange-500" },
                            { key: "pronto", label: "Pronto", icon: UtensilsCrossed, color: "text-green-600" },
                          ]
                        : isRetirada
                          ? [
                              { key: "pendente", label: "Pedido enviado", icon: Package, color: "text-yellow-500" },
                              { key: "aceito", label: "Aceito", icon: Check, color: "text-blue-500" },
                              { key: "preparando", label: "Em preparo", icon: ChefHat, color: "text-orange-500" },
                              { key: "aceita", label: "Pronto p/ Buscar", icon: MapPin, color: "text-purple-500" },
                              { key: "finalizado", label: "Retirado", icon: CircleCheck, color: "text-green-500" },
                            ]
                          : [
                              { key: "pendente", label: "Pedido enviado", icon: Package, color: "text-yellow-500" },
                              { key: "aceito", label: "Aceito", icon: Check, color: "text-blue-500" },
                              { key: "preparando", label: "Em preparo", icon: ChefHat, color: "text-orange-500" },
                              { key: "saiu_entrega", label: "Saiu para entrega", icon: Bike, color: "text-purple-500" },
                              { key: "finalizado", label: "Entregue", icon: CircleCheck, color: "text-green-500" },
                            ];
                      
                      // Map intermediate statuses to the correct step
                      const normalizedStatus = isMesaOrder 
                        ? (order.status_cozinha || "pendente")
                        : isRetirada && order.status === "aceita" 
                          ? "aceita" 
                          : (order.status === "aceita" ? "preparando" : (order.status === "em_transito" ? "saiu_entrega" : (order.status === "entregue" ? "finalizado" : order.status)));
                      const currentIdx = orderSteps.findIndex((s) => s.key === normalizedStatus);
                      const items = Array.isArray(order.items) ? order.items : [];
                      const createdAt = new Date(order.created_at);
                      const timeStr = createdAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
                      const isDelivered = order.status === "finalizado" || order.status === "entregue";
                      const isCancelled = order.status === "cancelado";

                      // Build timestamp map from status_historico
                      const statusHist: Array<{status: string; timestamp: string}> = Array.isArray(order.status_historico) ? order.status_historico : [];
                      const tsMap: Record<string, string> = { pendente: order.created_at };
                      statusHist.forEach((h: any) => { if (h.status && h.timestamp) tsMap[h.status] = h.timestamp; });

                      const renderTimeline = () => (
                        <div className="relative flex items-start mt-2">
                          {/* Connecting line behind icons */}
                          <div className="absolute flex items-center" style={{ top: "14px", left: `${100 / orderSteps.length / 2}%`, right: `${100 / orderSteps.length / 2}%`, height: "2px" }}>
                            {orderSteps.slice(0, -1).map((_, idx) => (
                              <div key={idx} className={`h-0.5 flex-1 ${
                                idx < currentIdx ? "bg-green-400" : idx === currentIdx ? "bg-green-400 animate-stepper-pulse" : "bg-border"
                              }`} />
                            ))}
                          </div>
                          {orderSteps.map((step, idx) => {
                            const StepIcon = step.icon;
                            const isCompleted = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            const ts = tsMap[step.key];
                            return (
                              <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: `${100 / orderSteps.length}%` }}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center border border-border transition-all ${
                                  isCurrent ? `${step.color} ring-2 ring-current bg-card` :
                                  isCompleted ? `${step.color} bg-card` : "text-muted-foreground/30 bg-card"
                                }`}
                                >
                                  <StepIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className={`text-[8px] mt-1 text-center leading-tight ${
                                  isCompleted ? "text-foreground font-medium" : "text-muted-foreground/50"
                                }`}>
                                  {step.label}
                                </span>
                                {ts && isCompleted && (
                                  <span className="text-[7px] text-muted-foreground mt-0.5">
                                    {new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );

                      if (isCancelled) {
                        return (
                          <div key={order.id} id={`order-${order.id}`} className="p-4 rounded-2xl border border-destructive/30 bg-card shadow-card">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <Ban className="w-4 h-4 text-destructive" />
                               <span className="text-xs font-semibold text-foreground">Pedido <span className="text-xs">Nº {order.numero_diario ? String(order.numero_diario).padStart(3, "0") : order.id.slice(0, 8).toUpperCase()}</span></span>
                              </div>
                              <span className="text-sm font-bold text-destructive">Cancelado</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
                          </div>
                        );
                      }

                      if (isDelivered) {
                        return (
                          <div key={order.id} id={`order-${order.id}`} className="p-4 rounded-2xl border border-border bg-card shadow-card">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <CircleCheck className="w-4 h-4 text-green-500" />
                                <span className="text-xs font-semibold text-foreground">Pedido <span className="text-xs">Nº {order.numero_diario ? String(order.numero_diario).padStart(3, "0") : order.id.slice(0, 8).toUpperCase()}</span></span>
                              </div>
                              <span className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                {formatCurrency(Number(order.total))}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-xs text-muted-foreground">{timeStr}</span>
                              <button
                                className="hover:opacity-80 transition-opacity text-secondary"
                                onClick={() => {
                                  const orderItems = Array.isArray(order.items) ? order.items : [];
                                  const subtotal = orderItems.reduce((sum: number, item: any) => sum + (Number(item.preco) || Number(item.price) || 0) * (Number(item.quantidade) || Number(item.qty) || 1), 0);
                                  
                                  // Parse payment info from observations
                                  const obs = order.observacoes || "";
                                  const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
                                  const changeMatch = obs.match(/Troco para: R\$ ([^|]+)/);
                                  const selectedPayment = paymentMatch ? paymentMatch[1].trim() : "—";
                                  const changeAmount = changeMatch ? changeMatch[1].trim().replace(",", ".") : "";

                                  setComprovante({
                                    orderId: order.id,
                                    numeroDiario: order.numero_diario,
                                    storeName: store?.nome || "",
                                    storeLogo: store?.logo_url || "",
                                    clientName: order.cliente_nome || "",
                                    clientPhone: order.cliente_telefone || "",
                                    endereco: order.endereco_entrega || "",
                                    deliveryMode: order.tipo || "delivery",
                                    selectedPayment,
                                    needsChange: !!changeAmount,
                                    changeAmount,
                                    items: orderItems,
                                    subtotal,
                                    frete: Number(order.taxa_entrega || 0),
                                    appliedCoupon: order.cupom_codigo ? {
                                      codigo: order.cupom_codigo,
                                      tipo: (Number(order.taxa_entrega || 0) > 0 && Number(order.cupom_desconto || 0) === Number(order.taxa_entrega || 0)) ? 'frete_gratis' : 'fixo',
                                      valor: Number(order.cupom_desconto || 0)
                                    } : null,
                                    total: Number(order.total),
                                    createdAt: new Date(order.created_at).toLocaleString("pt-BR"),
                                  });
                                  setShowMyOrders(false);
                                  setMyOrdersTab("pedidos");
                                  setActiveBottomTab(null);
                                }}
                              >
                                <FileText className="w-5 h-5 text-primary" />
                              </button>
                            </div>
                            <button
                              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
                              onClick={(e) => {
                                const details = e.currentTarget.nextElementSibling as HTMLElement;
                                if (details) details.classList.toggle("hidden");
                                e.currentTarget.querySelector("svg")?.classList.toggle("rotate-180");
                              }}
                            >
                              <span>ver status</span>
                              <ChevronDown className="w-3.5 h-3.5 transition-transform" />
                            </button>
                            <div className="hidden">
                              {renderTimeline()}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={order.id} id={`order-${order.id}`} className="p-4 rounded-2xl border border-border bg-card shadow-card">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground font-mono">Pedido Nº {order.numero_diario ? String(order.numero_diario).padStart(3, "0") : order.id.slice(0, 8).toUpperCase()}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{timeStr}</p>
                              <p className="text-sm font-bold text-foreground mt-0.5">
                                {isMesaOrder 

                                  ? "📋 Status do Pedido" 
                                  : order.tipo === "delivery" ? "🛵 Delivery" : "📍 Retirada"}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>
                                {formatCurrency(Number(order.total))}
                              </span>
                              <button
                                className="hover:opacity-80 transition-opacity text-secondary"
                                onClick={() => {
                                  const orderItems = Array.isArray(order.items) ? order.items : [];
                                  const subtotal = orderItems.reduce((sum: number, item: any) => sum + (Number(item.preco) || Number(item.price) || 0) * (Number(item.quantidade) || Number(item.qty) || 1), 0);
                                  
                                  // Parse payment info from observations
                                  const obs = order.observacoes || "";
                                  const paymentMatch = obs.match(/Pagamento: ([^|]+)/);
                                  const changeMatch = obs.match(/Troco para: R\$ ([^|]+)/);
                                  const selectedPayment = paymentMatch ? paymentMatch[1].trim() : "—";
                                  const changeAmount = changeMatch ? changeMatch[1].trim().replace(",", ".") : "";

                                  setComprovante({
                                    orderId: order.id,
                                    numeroDiario: order.numero_diario,
                                    storeName: store?.nome || "",
                                    storeLogo: store?.logo_url || "",
                                    clientName: order.cliente_nome || "",
                                    clientPhone: order.cliente_telefone || "",
                                    endereco: order.endereco_entrega || "",
                                    deliveryMode: order.tipo || "delivery",
                                    selectedPayment,
                                    needsChange: !!changeAmount,
                                    changeAmount,
                                    items: orderItems,
                                    subtotal,
                                    frete: Number(order.taxa_entrega || 0),
                                    appliedCoupon: order.cupom_codigo ? {
                                      codigo: order.cupom_codigo,
                                      tipo: (Number(order.taxa_entrega || 0) > 0 && Number(order.cupom_desconto || 0) === Number(order.taxa_entrega || 0)) ? 'frete_gratis' : 'fixo',
                                      valor: Number(order.cupom_desconto || 0)
                                    } : null,
                                    total: Number(order.total),
                                    createdAt: new Date(order.created_at).toLocaleString("pt-BR"),
                                  });
                                  setShowMyOrders(false);
                                  setMyOrdersTab("pedidos");
                                  setActiveBottomTab(null);
                                }}
                              >
                                <FileText className="w-5 h-5 text-primary" />
                              </button>
                            </div>
                          </div>

                          {/* Timeline with timestamps */}
                          {renderTimeline()}


                          {/* Rating section for delivered orders */}
                          {store?.avaliacoes_ativas !== false && isDelivered && !order.avaliacao && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              {ratingOrderId === order.id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-3"
                                >
                                  <p className="text-sm font-semibold text-foreground text-center">Como foi sua experiência?</p>
                                  <div className="flex justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        onMouseEnter={() => setRatingHover(star)}
                                        onMouseLeave={() => setRatingHover(0)}
                                        onClick={() => setRatingStars(star)}
                                        className="transition-transform hover:scale-110"
                                      >
                                        <Star
                                          className={`w-8 h-8 transition-colors ${
                                            star <= (ratingHover || ratingStars)
                                              ? "fill-yellow-400 text-yellow-400"
                                              : "text-muted-foreground/30"
                                          }`}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                  <Textarea
                                    placeholder="Deixe um comentário (opcional)"
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    rows={2}
                                    className="text-sm rounded-xl"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => { setRatingOrderId(null); setRatingStars(0); setRatingComment(""); }}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="flex-1 font-bold"
                                      style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
                                      disabled={ratingStars === 0 || ratingSubmitting}
                                      onClick={async () => {
                                        setRatingSubmitting(true);
                                        try {
                                          const { error } = await supabase
                                            .from("pedidos")
                                            .update({ avaliacao: ratingStars, avaliacao_comentario: ratingComment || null } as any)
                                            .eq("id", order.id);
                                          if (error) throw error;
                                          toast.success("Obrigado pela sua avaliação! ⭐");
                                          handledRatingOrderIdsRef.current.add(order.id);
                                          pendingAutoRatingOrderIdRef.current = null;
                                          setRatingOrderId(null);
                                          setRatingStars(0);
                                          setRatingComment("");
                                          refetchOrders();
                                        } catch (err: any) {
                                          toast.error("Erro ao enviar avaliação");
                                        } finally {
                                          setRatingSubmitting(false);
                                        }
                                      }}
                                    >
                                      {ratingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
                                    </Button>
                                  </div>
                                </motion.div>
                              ) : (
                                <Button
                                  variant="outline"
                                  className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border-yellow-300 text-yellow-600 hover:bg-yellow-50"
                                  onClick={() => { setRatingOrderId(order.id); setRatingStars(0); setRatingComment(""); }}
                                >
                                  <Star className="w-4 h-4" />
                                  ⭐ Avaliar pedido
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Show existing rating */}
                          {store?.avaliacoes_ativas !== false && order.avaliacao && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= order.avaliacao ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">Avaliado</span>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ COMPROVANTE MODAL ═══ */}
      <AnimatePresence>
        {comprovante && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/50 z-[2147483647] flex items-end justify-center"
            onClick={() => { if (!comprovante.is_pre_receipt) setComprovante(null); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-lg rounded-t-[32px] max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 overflow-y-auto flex-1">
                <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold font-display text-foreground">
                    {comprovante.is_pre_receipt ? "Conferir seu Pedido" : "Comprovante do Pedido"}
                  </h2>
                  <button
                    onClick={() => setComprovante(null)}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center transition-colors"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              <div className="space-y-4 font-mono text-[10px]">
                <div className="border-b border-dashed pb-2 text-center flex flex-col items-center gap-2">
                  {comprovante.storeLogo && (
                    <img src={comprovante.storeLogo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-gray-100" />
                  )}
                  <div>
                    <p className="font-bold uppercase text-[11px] mb-0.5 tracking-tight">{comprovante.storeName}</p>
                    <p className="font-bold uppercase mb-1 text-[10px]">
                      Nº {comprovante.numeroDiario ? String(comprovante.numeroDiario).padStart(3, "0") : (comprovante.orderId ? comprovante.orderId.slice(0, 8).toUpperCase() : "—")}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{comprovante.createdAt}</p>
                  </div>
                </div>

                <div className="space-y-1 border-b border-dashed pb-2">
                  <p><span className="font-bold">STATUS:</span> {comprovante.is_pre_receipt ? "CONFERÊNCIA DE PEDIDO" : "PEDIDO CONFIRMADO"}</p>
                  <p><span className="font-bold">TIPO:</span> {comprovante.is_pre_receipt ? "CONSUMO LOCAL (MESA)" : (comprovante.deliveryMode === "delivery" ? "ENTREGA" : "RETIRADA")}</p>
                  {comprovante.deliveryMode === "delivery" && comprovante.endereco && (
                    <p><span className="font-bold">ENDEREÇO:</span> {comprovante.endereco}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-bold border-b border-dashed pb-1 mb-1">ITENS:</p>
                  {comprovante.items.map((item: any, i: number) => {
                    const basePrice = Number(item.unit_price || item.preco || item.price) || 0;
                    const addonsList = item.addons || item.adicionais || [];
                    const addonsTotal = addonsList.reduce((acc: number, a: any) => {
                      const aPrice = typeof a === "object" ? Number(a.preco || 0) : 0;
                      const aQty = typeof a === "object" ? Math.max(1, Number(a.quantidade) || 1) : 1;
                      return acc + (aPrice * aQty);
                    }, 0);
                    
                    let flavorExtra = 0;
                    if (item.caldo_sabor?.valorExtra) {
                      flavorExtra = Number(item.caldo_sabor.valorExtra);
                    }

                    const subtotalUnit = basePrice + addonsTotal + flavorExtra;
                    const itemQty = item.quantidade || item.qty || 1;

                    return (
                      <div key={i} className="flex flex-col mb-1 border-b border-dashed border-muted-foreground/20 pb-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="flex-1 font-bold">{itemQty}x {item.weight ? `(${item.weight}${item.unidade_medida === "kg" ? "g" : "ml"}) ` : ""}{item.nome || item.name}</span>
                          <div className="text-right shrink-0">
                            <p className="font-bold">{formatCurrency(subtotalUnit * itemQty)}</p>
                            <p className="text-[7px] text-muted-foreground">Unit: {formatCurrency(subtotalUnit)}</p>
                          </div>
                        </div>
                        
                        {/* Preço base se houver adicionais para clareza */}
                        {(addonsTotal > 0 || flavorExtra > 0) && (
                          <p className="text-[7px] ml-2 text-muted-foreground">Base: {formatCurrency(basePrice)}</p>
                        )}

                        {item.sabores?.length > 0 && <p className="text-[8px] ml-2">• Sabores: {item.sabores.join(", ")}</p>}
                        {item.caldo_sabor && (
                          <p className="text-[8px] ml-2">• Sabor: {item.caldo_sabor.nome} {flavorExtra > 0 && `(+${formatCurrency(flavorExtra)})`}</p>
                        )}
                        {item.tamanho && <p className="text-[8px] ml-2">• Tamanho: {item.tamanho}</p>}
                        {item.bordas?.length > 0 && <p className="text-[8px] ml-2">• Bordas: {item.bordas.join(", ")}</p>}
                        
                        {addonsList.length > 0 && (
                          <div className="ml-2">
                            <p className="text-[8px] font-bold">• Adicionais:</p>
                            {addonsList.map((a: any, idx: number) => {
                              if (typeof a === "string") return <p key={idx} className="text-[8px] ml-1">- {a}</p>;
                              const aPrice = Number(a.preco || 0);
                              const aQty = Math.max(1, Number(a.quantidade) || 1);
                              const label = aQty > 1 ? `${a.nome} x${aQty}` : a.nome;
                              return (
                                <p key={idx} className="text-[8px] ml-1 flex justify-between">
                                  <span>- {label}</span>
                                  {aPrice > 0 && <span className="text-[7px]">{formatCurrency(aPrice * aQty)}</span>}
                                </p>
                              );
                            })}
                          </div>
                        )}
                        {item.observation && <p className="text-[8px] ml-2 italic">• Obs: {item.observation}</p>}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-dashed pt-2 space-y-1">
                  <div className="flex justify-between"><span>SUBTOTAL</span><span>{formatCurrency(comprovante.subtotal)}</span></div>
                  
                  {comprovante.frete !== undefined && (comprovante.frete > 0 || comprovante.appliedCoupon?.tipo === 'frete_gratis') && (
                    <div className="flex justify-between">
                      <span>TAXA DE ENTREGA</span>
                      {comprovante.appliedCoupon?.tipo === 'frete_gratis' ? (
                        <span className="flex items-center gap-1">
                          <span className="line-through text-muted-foreground">{formatCurrency(comprovante.frete)}</span>
                          <span className="text-emerald-600 font-bold">GRÁTIS</span>
                        </span>
                      ) : (
                        <span>{formatCurrency(comprovante.frete)}</span>
                      )}
                    </div>
                  )}

                  {comprovante.appliedCoupon && comprovante.appliedCoupon.tipo !== 'frete_gratis' && (
                    <div className="flex justify-between text-destructive font-bold">
                      <span>CUPOM DE DESCONTO</span>
                      <span>-{formatCurrency(comprovante.appliedCoupon.valor)}</span>
                    </div>
                  )}

                  {comprovante.appliedCoupon?.tipo === 'frete_gratis' && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>CUPOM ({comprovante.appliedCoupon.codigo})</span>
                      <span>FRETE GRÁTIS</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed">
                    <span>TOTAL</span><span>{formatCurrency(comprovante.total)}</span>
                  </div>
                </div>

                <div className="border-t border-dashed pt-2 space-y-1">
                  <p><span className="font-bold">PAGAMENTO:</span> {comprovante.selectedPayment}</p>
                  {comprovante.selectedPayment === "Dinheiro" && comprovante.needsChange && comprovante.changeAmount && (
                    <p><span className="font-bold">TROCO:</span> {formatCurrency(Number(comprovante.changeAmount) - comprovante.total)}</p>
                  )}
                </div>

                <div className="pt-2 text-center text-[8px] text-muted-foreground uppercase">
                  {comprovante.is_pre_receipt ? "Confira seus itens antes de enviar" : "Obrigado pela preferência!"}
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  {mesaId && comprovante?.is_pre_receipt ? (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 font-black rounded-xl h-9"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setComprovante(null);
                          setShowCart(true);
                        }}
                      >
                        VOLTAR AO CARRINHO
                      </Button>
                      <Button
                        className="flex-1 font-black rounded-xl h-9"
                        style={{ backgroundColor: storePrimary || 'hsl(var(--primary))', color: 'white' }}
                        size="sm"
                        onClick={async () => {
                          setComprovante(null);
                          handleSubmitOrder();
                        }}
                      >
                        ENVIAR PEDIDO
                      </Button>
                    </div>
                  ) : mesaId && mesaConfirmOrder ? (
                    <Button
                      className="w-full font-black rounded-xl h-9"
                      style={{ backgroundColor: storePrimary || 'hsl(var(--primary))', color: 'white' }}
                      size="sm"
                      onClick={() => {
                        setMesaConfirmOrder(false);
                        setComprovante(null);
                        setShowMyOrders(true);
                        setActiveBottomTab("pedidos");
                        if (comprovante?.orderId) {
                          setTimeout(() => {
                            const el = document.getElementById(`order-${comprovante.orderId}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 300);
                        }
                      }}
                    >
                      ENVIAR PEDIDO
                    </Button>
                  ) : (mesaId || clientData?.is_mesa_guest) ? null : (
                    <Button
                      className="w-full font-black rounded-xl h-9"
                      style={{ backgroundColor: storePrimary || 'hsl(var(--primary))', color: 'white' }}
                      size="sm"
                      onClick={() => {
                        setComprovante(null);
                        setShowMyOrders(true);
                        setActiveBottomTab("pedidos");
                        if (comprovante?.orderId) {
                          setTimeout(() => {
                            const el = document.getElementById(`order-${comprovante.orderId}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 300);
                        }
                      }}
                    >
                      ACOMPANHE SEU PEDIDO
                    </Button>
                  )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

  {/* Product Rating Dialog */}
  <Dialog open={showProductRatingModal} onOpenChange={setShowProductRatingModal}>
    <DialogContent className="max-w-[350px] rounded-2xl p-0 overflow-hidden border-none mx-auto">
      <div className="p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            Avaliar Produto
          </DialogTitle>
          <DialogDescription className="text-sm">
            O que achou de <strong>{selectedProduct?.nome}</strong>?
          </DialogDescription>
        </DialogHeader>

        {selectedProduct && store && (
          <ProductRatingSection
            productId={selectedProduct.id}
            storeId={store.id}
            clientName={clientData?.nome_completo}
            clientPhone={clientData?.whatsapp || clientData?.telefone}
            storePrimary={storePrimary}
            onClose={() => setShowProductRatingModal(false)}
          />
        )}
      </div>
    </DialogContent>
  </Dialog>
      {/* Rating Dialog */}
      <Dialog open={!!ratingOrderId} onOpenChange={(open) => !open && setRatingOrderId(null)}>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center font-display">Avalie sua experiência</DialogTitle>
            <DialogDescription className="text-center">
              Como foi seu pedido e a entrega?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setRatingHover(star)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => setRatingStars(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (ratingHover || ratingStars)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/20"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Conte-nos o que achou..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="rounded-xl resize-none text-sm"
              rows={3}
            />
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full rounded-xl font-bold h-11"
              style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
              disabled={ratingStars === 0 || ratingSubmitting}
              onClick={async () => {
                const submittedRatingOrderId = ratingOrderId;
                if (!submittedRatingOrderId) return;
                setRatingSubmitting(true);
                try {
                  const { error } = await supabase
                    .from("pedidos")
                    .update({
                      avaliacao: ratingStars,
                      avaliacao_comentario: ratingComment
                    })
                    .eq("id", submittedRatingOrderId);
                  
                  if (error) throw error;
                  
                  toast.success("Obrigado pela sua avaliação! ⭐");
                  handledRatingOrderIdsRef.current.add(submittedRatingOrderId);
                  pendingAutoRatingOrderIdRef.current = null;
                  setRatingOrderId(null);
                  setRatingStars(0);
                  setRatingComment("");
                  refetchOrders();
                } catch (error: any) {
                  toast.error("Erro ao enviar avaliação: " + error.message);
                } finally {
                  setRatingSubmitting(false);
                }
              }}
            >
              {ratingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Avaliação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppDownloadPopup />

      <Dialog 
        open={unavailableProductsModal.isOpen} 
        onOpenChange={(open) => !open && setUnavailableProductsModal(prev => ({ ...prev, isOpen: false }))}
      >
        <DialogContent className="max-w-[90vw] w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-5 h-5" />
              Produto Indisponível
            </DialogTitle>
            <DialogDescription className="pt-2 text-foreground">
              {unavailableProductsModal.type === "cart" ? (
                <div className="space-y-4">
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                    {unavailableProductsModal.products.map((pName, idx) => {
                      const p = products.find(prod => prod.nome === pName);
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50">
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 grayscale">
                            {p?.imagem_url ? (
                              <img src={p.imagem_url} alt={pName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">
                                {segmentEmoji[store?.segmento || ""] || "📦"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground line-clamp-1">{pName}</p>
                            <Badge variant="secondary" className="mt-1 bg-red-100 text-red-600 border-red-200 text-[10px] font-bold uppercase">
                               Esgotado
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Remova os itens indisponíveis para prosseguir com seu pedido.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border/50">
                    {(() => {
                      const pName = unavailableProductsModal.products[0];
                      const p = products.find(prod => prod.nome === pName);
                      return (
                        <>
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 grayscale">
                            {p?.imagem_url ? (
                              <img src={p.imagem_url} alt={pName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">
                                {segmentEmoji[store?.segmento || ""] || "📦"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground line-clamp-1">{pName}</p>
                            <Badge variant="secondary" className="mt-1 bg-red-100 text-red-600 border-red-200 text-[10px] font-bold uppercase">
                               Esgotado
                            </Badge>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Este produto não está mais disponível para pedido no momento.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              className="w-full bg-store-primary hover:bg-store-primary/90 text-white rounded-xl"
              onClick={() => {
                setUnavailableProductsModal({ isOpen: false, products: [], type: "cart" });
                setShowCart(true); // Always ensure cart is visible after closing the popup
                setShowForm(false); // Ensure we are on the first screen (cart list)
              }}
            >
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CLIENT LIMIT REACHED POPUP ═══ */}
      <Dialog open={showClientLimitPopup} onOpenChange={setShowClientLimitPopup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Cadastro temporariamente indisponível</DialogTitle>
            <DialogDescription className="pt-2">
              Devido a vários clientes cadastrados, nossos servidores estão passando por atualizações.
              Tente novamente em alguns minutos ou fale diretamente com a loja para fazer seu pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {lojistaWhatsapp && (
              <a
                href={`https://wa.me/${lojistaWhatsapp}?text=${encodeURIComponent(
                  `Olá! Tentei me cadastrar no app da ${(store as any)?.nome || "loja"} para fazer pedidos, mas o sistema apresentou um problema no servidor. Pode me ajudar?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:opacity-90 transition"
              >
                <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
              </a>
            )}
            <Button variant="outline" onClick={() => setShowClientLimitPopup(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ INFORMATIVE POPUP ═══ */}
      <Dialog open={showInfoPopup} onOpenChange={setShowInfoPopup}>
        <DialogContent className="max-w-[340px] p-0 overflow-visible border-0 bg-transparent shadow-none [&>button]:hidden">

          <DialogHeader className="sr-only">
            <DialogTitle>Aviso</DialogTitle>
            <DialogDescription>Informativo da loja</DialogDescription>
          </DialogHeader>
          {(store as any)?.popup_informativo_imagem_url && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowInfoPopup(false)}
                aria-label="Fechar"
                className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-background text-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={(store as any).popup_informativo_imagem_url}
                alt="Informativo"
                className="w-full h-auto object-contain rounded-2xl shadow-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* ═══ COUPON POPUP ═══ */}
      <Dialog open={showCouponPopup} onOpenChange={setShowCouponPopup}>
        <DialogContent className="max-w-xs sm:max-w-xs p-0 overflow-hidden border-0 bg-transparent shadow-none">
          {publicDiscountCoupon && (() => {
            const bg = (store as any)?.cupom_popup_cor_fundo || '#10b981';
            const fg = (store as any)?.cupom_popup_cor_texto || '#ffffff';
            const titulo = (store as any)?.cupom_popup_titulo || 'Cupom de Desconto';
            const subtitulo = (store as any)?.cupom_popup_subtitulo || 'Aproveite uma oferta especial no seu pedido!';
            const cta = (store as any)?.cupom_popup_cta || 'COMEÇAR A PEDIR';
            const imagem = (store as any)?.cupom_popup_imagem_url;
            return (
            <div
              className="relative rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${bg}, ${bg}dd)`, color: fg }}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-background rounded-full -ml-2" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-background rounded-full -mr-2" />

              <div className="p-5 pb-3 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden"
                  style={{ background: `${fg}20` }}
                >
                  {imagem ? (
                    <img src={imagem} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Ticket className="w-7 h-7" style={{ color: fg }} />
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">{titulo}</p>
                <h3 className="text-2xl font-extrabold font-display mt-1.5 leading-none">
                  {publicDiscountCoupon.tipo === 'frete_gratis'
                    ? 'FRETE GRÁTIS'
                    : publicDiscountCoupon.tipo === 'percentual'
                      ? `${Number(publicDiscountCoupon.valor)}% OFF`
                      : `${formatCurrency(Number(publicDiscountCoupon.valor))} OFF`}
                </h3>
                <p className="text-xs opacity-90 mt-1.5 font-medium px-2">
                  {subtitulo}
                </p>
              </div>

              <div className="border-t border-dashed mx-5" style={{ borderColor: `${fg}40` }} />

              <div className="px-5 py-3">
                <p className="text-[10px] uppercase tracking-wider opacity-70 text-center font-bold mb-1.5">Use o código</p>
                <div
                  className="backdrop-blur border-2 border-dashed rounded-xl p-2.5 flex items-center justify-between gap-2"
                  style={{ background: `${fg}15`, borderColor: `${fg}55` }}
                >
                  <span className="font-mono font-extrabold text-lg tracking-widest flex-1 text-center">
                    {publicDiscountCoupon.codigo}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(publicDiscountCoupon.codigo);
                      toast.success("Código copiado!");
                    }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                    style={{ background: fg, color: bg }}
                  >
                    COPIAR
                  </button>
                </div>

                <ul className="mt-3 space-y-1 text-[11px] font-medium opacity-95">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Adicione produtos ao carrinho</span>
                  </li>
                  {Number(publicDiscountCoupon.valor_minimo) > 0 && (
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Pedido mínimo de <strong>{formatCurrency(Number(publicDiscountCoupon.valor_minimo))}</strong></span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Cole o código no campo "Cupom de desconto"</span>
                  </li>
                  {publicDiscountCoupon.validade_fim && (
                    <li className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>Válido até {new Date(publicDiscountCoupon.validade_fim).toLocaleDateString('pt-BR')}</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="px-5 pb-5">
                <Button
                  onClick={() => setShowCouponPopup(false)}
                  className="w-full font-bold rounded-xl h-10 hover:opacity-90"
                  style={{ background: fg, color: bg }}
                >
                  {cta}
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Product Card Component ──
const ProductRatingSection = ({
  productId,
  storeId,
  clientName,
  clientPhone,
  storePrimary,
  onClose,
}: {
  productId: string;
  storeId: string;
  clientName?: string;
  clientPhone?: string;
  storePrimary?: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    setSubmitting(true);
    try {
      // Double check if already rated to prevent duplicates and provide feedback
      if (clientPhone) {
        const { data: existingRating } = await supabase
          .from("product_ratings")
          .select("id")
          .eq("product_id", productId)
          .eq("customer_phone", clientPhone)
          .limit(1)
          .maybeSingle();

        if (existingRating) {
          toast.error("Você já avaliou este produto.");
          setHasRated(true);
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from("product_ratings").insert({
        product_id: productId,
        rating,
        comment: comment.trim() || null,
        customer_name: clientName || "Cliente",
        customer_phone: clientPhone || null,
      });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error("Você já avaliou este produto.");
          setHasRated(true);
          return;
        }
        throw error;
      }

      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ["user-product-rating", productId, clientPhone] });
      queryClient.invalidateQueries({ queryKey: ["store-products"] });

      setHasRated(true);
      toast.success("Obrigado pela sua avaliação! ⭐");
    } catch (err) {
      console.error("Error submitting rating:", err);
      toast.error("Erro ao enviar avaliação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (hasRated) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center mt-6">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-sm font-semibold text-green-700">Avaliação enviada com sucesso!</p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 focus:outline-none transition-transform active:scale-90"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            <Star
              className={`w-10 h-10 transition-colors ${
                star <= (hover || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <Button 
          variant="outline" 
          className="flex-1 rounded-xl font-bold h-11"
          onClick={onClose}
        >
          Fechar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 rounded-xl font-bold h-11 text-white"
          style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar
        </Button>
      </div>
    </div>
  );
};

const HorizontalProductCard = ({
  product,
  index,
  cart,
  onAdd,
  storePrimary,
  segmento,
  avaliacoesProdutosAtivas,
  fullWidth = false,
}: {
  product: Product;
  index: number;
  cart: CartItem[];
  onAdd: (preSelectedSize?: string) => void;
  storePrimary?: string;
  segmento?: string;
  avaliacoesProdutosAtivas?: boolean;
  fullWidth?: boolean;
}) => {
  const inCart = cart.filter((c) => c.id === product.id);
  const qtyInCart = inCart.reduce((sum, c) => sum + c.quantidade, 0);
  const isInactive = !product.disponivel;
  const isPizza = segmento === "pizzaria";
  const defaultPizzaImage = categoryImages["Pizzas Tradicionais"];
  const fallbackImage = isPizza ? defaultPizzaImage : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => !isInactive && onAdd()}
      className={`${fullWidth ? "w-full" : "flex-shrink-0"} snap-start cursor-pointer rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-elevated transition-all overflow-hidden`}
      style={fullWidth ? undefined : { width: "calc((100% - 1.5rem) / 2.3)" }}
    >
      <div className={`relative w-full aspect-square bg-muted flex-shrink-0 ${isInactive ? "grayscale" : ""}`}>
        {product.imagem_url ? (
          <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover" />
        ) : fallbackImage ? (
          <img src={fallbackImage} alt={product.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-4xl">{segmentEmoji[segmento || ""] || "📦"}</div>
        )}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          {product.preco_promocional && isPromoActive(product) && (
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-sm border border-orange-600/50">
              <Flame className="w-3.5 h-3.5 text-white fill-white" />
            </div>
          )}
          {product.tag_destaque && (
            <div className="bg-secondary p-1 rounded-full shadow-sm">
              <Flame className="w-2.5 h-2.5 text-accent-foreground" />
            </div>
          )}
          {product.tag_novo && (
            <div className="bg-green-500 p-1 rounded-full shadow-sm">
              <Package className="w-2.5 h-2.5 text-white" />
            </div>
          )}
          {product.tag_sugestao && (
            <div className="bg-blue-500 p-1 rounded-full shadow-sm">
              <Star className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
        
        {!isInactive && (
          <Button
            size="icon"
            className="absolute top-0 right-0 h-8 w-8 rounded-full shadow-md z-10"
            style={{ 
              backgroundColor: `color-mix(in srgb, ${storePrimary || 'hsl(var(--primary))'}, white 85%)`,
              border: 'none',
              color: storePrimary || 'hsl(var(--primary))'
            }}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}

        {avaliacoesProdutosAtivas && product.rating_count ? (
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-white shadow-sm">
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
            <span className="text-[10px] font-bold">
              {product.rating_average ? Number(product.rating_average).toFixed(1) : "0.0"}
            </span>
          </div>
        ) : null}

        {qtyInCart > 0 && !isInactive && (
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 text-white px-2 py-1 rounded-full shadow-md" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}>
            <ShoppingCart className="w-3 h-3" />
            <span className="text-[10px] font-bold">{qtyInCart}x</span>
          </div>
        )}

        {isInactive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-600 text-white shadow-lg uppercase">Esgotado</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex-1 flex flex-col">
          <h3 className={`font-semibold font-display text-sm leading-tight line-clamp-2 ${isInactive ? "text-muted-foreground" : "text-foreground"}`}>
            {product.nome}
          </h3>
          <div className="w-8 h-[2.5px] rounded-full mt-0 mb-0.5" style={{ backgroundColor: storePrimary || 'hsl(var(--secondary))' }} />
          <div>
            {product.descricao && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                {product.descricao}
              </p>
            )}
          </div>
        </div>
        <div className="pt-0.5 flex items-center justify-between">
          <p className={`text-sm font-bold ${isInactive ? "text-muted-foreground" : ""}`} style={!isInactive ? { color: storePrimary || 'hsl(var(--primary))' } : undefined}>
            {product.preco_promocional && !isInactive ? formatCurrency(Number(product.preco_promocional)) : formatCurrency(Number(product.preco))}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const ProductCard = ({
  product,
  index,
  cart,
  onAdd,
  storePrimary,
  segmento,
  avaliacoesProdutosAtivas,
}: {
  product: Product;
  index: number;
  cart: CartItem[];
  onAdd: (preSelectedSize?: string) => void;
  storePrimary?: string;
  segmento?: string;
  avaliacoesProdutosAtivas?: boolean;
}) => {
  const inCart = cart.filter((c) => c.id === product.id);
  const qtyInCart = inCart.reduce((sum, c) => sum + c.quantidade, 0);

  const isInactive = !product.disponivel || (product as any).oculto;

  const hasSizes = !!(product.tamanhos && Array.isArray(product.tamanhos) && (product.tamanhos as PizzaSize[]).length > 0);
  const sizes = hasSizes ? (product.tamanhos as PizzaSize[]) : [];
  const isPizza = segmento === "pizzaria";
  const defaultPizzaImage = categoryImages["Pizzas Tradicionais"];
  const fallbackImage = isPizza ? defaultPizzaImage : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => onAdd()}
      className={`bg-transparent border-b border-border transition-all group overflow-hidden ${
        isInactive
          ? "opacity-60 cursor-not-allowed"
          : "hover:bg-muted/50 cursor-pointer active:scale-[0.98]"
      }`}
    >
      {/* Mobile: horizontal / Desktop: vertical */}
      <div className="relative">

        {/* Mobile layout: row */}
        <div className="flex gap-3 p-2 md:hidden items-start">
          <div className={`w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative ${isInactive ? "grayscale" : ""}`}>
            {product.imagem_url ? (
              <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover" />
            ) : fallbackImage ? (
              <img src={fallbackImage} alt={product.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-3xl">{segmentEmoji[segmento] || "📦"}</div>
            )}
            {!isInactive && (product.tag_novo || product.tag_sugestao || product.tag_destaque) && (
              <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                {product.tag_novo && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-500 text-white shadow-sm uppercase">Novo</span>}
                {product.tag_sugestao && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-500 text-white shadow-sm uppercase">Sugestão</span>}
                {product.tag_destaque && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-secondary text-accent-foreground shadow-sm uppercase">Destaque</span>}
              </div>
            )}
            {!isInactive && product.preco_promocional && (
              <div className="absolute top-1 right-1">
                <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-sm border border-orange-600/50">
                  <Flame className="w-3 h-3 text-white fill-white" />
                </div>
              </div>
            )}
            {qtyInCart > 0 && !isInactive && (
              <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-white px-1.5 py-0.5 rounded-full shadow-md z-10" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}>
                <ShoppingCart className="w-2.5 h-2.5" />
                <span className="text-[9px] font-bold">{qtyInCart}x</span>
              </div>
            )}
            {isInactive && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-600 text-white shadow-lg">Esgotado</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold text-sm font-display leading-snug line-clamp-1 flex-1 ${isInactive ? "text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"}`}>
                {product.nome}
              </h3>
              {avaliacoesProdutosAtivas && product.rating_count ? (
                <div className="flex items-center gap-1 shrink-0 bg-muted/50 px-1.5 py-0.5 rounded-md">
                  <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-[10px] font-bold text-foreground">
                    {product.rating_average ? Number(product.rating_average).toFixed(1) : "0.0"}
                  </span>
                  <span className="text-[8px] text-muted-foreground">({product.rating_count})</span>
                </div>
              ) : null}
            </div>
            <div className="w-8 h-[2px] rounded-full mt-0.5" style={{ backgroundColor: storePrimary || 'hsl(var(--secondary))' }} />
            {product.descricao && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{product.descricao}</p>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                {isPizza ? null : hasSizes && !isInactive ? (
                  <p className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Math.min(...sizes.map((s) => s.preco)))}</p>
                ) : product.preco_promocional && !isInactive ? (
                  <>
                    <p className="text-xs text-muted-foreground line-through">{formatCurrency(Number(product.preco))}</p>
                    <p className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Number(product.preco_promocional))}</p>
                  </>
                ) : (
                  <p className={`text-sm font-bold ${isInactive ? "text-muted-foreground" : ""}`} style={!isInactive ? { color: storePrimary || 'hsl(var(--primary))' } : undefined}>
                    {formatCurrency(Number(product.preco))}
                    {product.unidade_medida && product.unidade_medida !== 'un' && <span className="text-[10px] font-normal text-muted-foreground ml-1">/{product.unidade_medida}</span>}
                  </p>
                )}
              </div>
              {!isInactive && segmento !== "pizzaria" && (
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all border"
                  style={{ 
                    backgroundColor: `${storePrimary || 'hsl(var(--primary))'}1a`,
                    borderColor: 'transparent',
                    color: storePrimary || 'hsl(var(--primary))'
                  }}
                >
                  <Plus className="w-3 h-3" />
                </div>
              )}
            </div>
            {hasSizes && !isInactive && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sizes.map((size) => (
                  <button
                    key={size.nome}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAdd(size.nome); }}
                    className="px-2 py-0.5 rounded-full border border-border bg-background hover:bg-muted text-[10px] font-medium text-foreground transition-colors flex items-center gap-1"
                  >
                    <span>{isPizza ? size.nome.charAt(0) : size.nome}</span>
                    <span className="font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(size.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop layout: compact horizontal card */}
        <div className="hidden md:flex gap-3 p-2 items-start">
          <div className={`w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 relative ${isInactive ? "grayscale" : ""}`}>
            {product.imagem_url ? (
              <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover" />
            ) : fallbackImage ? (
              <img src={fallbackImage} alt={product.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-4xl">{segmentEmoji[segmento] || "📦"}</div>
            )}
            {!isInactive && (product.tag_novo || product.tag_sugestao || product.tag_destaque) && (
              <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                {product.tag_novo && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-500 text-white shadow-sm uppercase">Novo</span>}
                {product.tag_sugestao && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-500 text-white shadow-sm uppercase">Sugestão</span>}
                {product.tag_destaque && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-secondary text-accent-foreground shadow-sm uppercase">Destaque</span>}
              </div>
            )}
            {!isInactive && product.preco_promocional && (
              <div className="absolute top-1 right-1">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-sm border border-orange-600/50">
                  <Flame className="w-4 h-4 text-white fill-white" />
                </div>
              </div>
            )}
            {qtyInCart > 0 && !isInactive && (
              <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 text-white px-1.5 py-0.5 rounded-full shadow-md z-10" style={{ backgroundColor: storePrimary || 'hsl(var(--primary))' }}>
                <ShoppingCart className="w-2.5 h-2.5" />
                <span className="text-[9px] font-bold">{qtyInCart}x</span>
              </div>
            )}
            {isInactive && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-600 text-white shadow-lg">Esgotado</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold text-sm font-display leading-snug line-clamp-1 flex-1 ${isInactive ? "text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors"}`}>
                {product.nome}
              </h3>
              {avaliacoesProdutosAtivas && product.rating_count ? (
                <div className="flex items-center gap-1 shrink-0 bg-muted/50 px-1.5 py-0.5 rounded-md">
                  <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-[10px] font-bold text-foreground">
                    {product.rating_average ? Number(product.rating_average).toFixed(1) : "0.0"}
                  </span>
                  <span className="text-[8px] text-muted-foreground">({product.rating_count})</span>
                </div>
              ) : null}
            </div>
            <div className="w-8 h-[2px] rounded-full mt-0.5" style={{ backgroundColor: storePrimary || 'hsl(var(--secondary))' }} />
            {product.descricao && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{product.descricao}</p>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                {isPizza ? null : hasSizes && !isInactive ? (
                  <p className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Math.min(...sizes.map((s) => s.preco)))}</p>
                ) : product.preco_promocional && !isInactive ? (
                  <>
                    <p className="text-xs text-muted-foreground line-through">{formatCurrency(Number(product.preco))}</p>
                    <p className="text-sm font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(Number(product.preco_promocional))}</p>
                  </>
                ) : (
                  <p className={`text-sm font-bold ${isInactive ? "text-muted-foreground" : ""}`} style={!isInactive ? { color: storePrimary || 'hsl(var(--primary))' } : undefined}>
                    {formatCurrency(Number(product.preco))}
                    {product.unidade_medida && product.unidade_medida !== 'un' && <span className="text-[10px] font-normal text-muted-foreground ml-1">/{product.unidade_medida}</span>}
                  </p>
                )}
              </div>
              {!isInactive && segmento !== "pizzaria" && (
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all"
                  style={{ 
                    backgroundColor: storePrimary ? `${storePrimary}33` : 'rgba(var(--primary), 0.2)',
                    color: storePrimary || 'hsl(var(--primary))'
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {hasSizes && !isInactive && (
              <div className="flex flex-wrap gap-1 mt-2">
                {sizes.map((size) => (
                  <button
                    key={size.nome}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAdd(size.nome); }}
                    className="px-2 py-0.5 rounded-full border border-border bg-background hover:bg-muted text-[10px] font-medium text-foreground transition-colors flex items-center gap-1"
                  >
                    <span>{isPizza ? size.nome.charAt(0) : size.nome}</span>
                    <span className="font-bold" style={{ color: storePrimary || 'hsl(var(--primary))' }}>{formatCurrency(size.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StoreMenu;
