import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { categoryImages } from "@/constants/categoryImages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Search, Edit2, Trash2, Pizza, Beef, IceCream, Sandwich, X, Loader2, Flame, Check, ArrowUp, ArrowDown, GripVertical, ListOrdered, ChevronDown, ScrollText, AlertTriangle, Crown, Calculator, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStorePlanLimits } from "@/hooks/useStorePlanLimits";
import { usePdvUser } from "@/contexts/PdvUserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import PizzariaRulesManager from "@/components/pizzaria/PizzariaRulesManager";
import TopSellersTab from "@/components/admin/TopSellersTab";


type Segment = "pizzaria" | "hamburgueria" | "acaiteria" | "lanchonete" | "japonesa" | "churrasquinho";

const segmentLabels: Record<Segment, string> = {
  pizzaria: "Pizzaria",
  hamburgueria: "Hamburgueria",
  acaiteria: "Açaiteria/Sorveteria",
  lanchonete: "Lanchonete",
  japonesa: "Japonesa",
  churrasquinho: "Churrasquinho",
};

const defaultCategories: Record<Segment, string[]> = {
  pizzaria: ["Caldos", "Pizzas Tradicionais", "Pizzas Especiais", "Pizzas Doces", "Bebidas", "Sobremesas"],
  hamburgueria: ["Caldos", "Hambúrgueres", "Combos", "Acompanhamentos", "Bebidas", "Sobremesas"],
  acaiteria: ["Caldos", "Açaí", "Sorvetes", "Cremes", "Sucos", "Vitaminas", "Complementos"],
  lanchonete: ["Caldos", "Lanches", "Salgados", "Porções", "Bebidas", "Sobremesas"],
  japonesa: ["Entradas", "Sushi", "Sashimi", "Temaki", "Hot Roll", "Combinados", "Pratos Quentes", "Bebidas", "Sobremesas"],
  churrasquinho: ["Espetinhos", "Carnes", "Acompanhamentos", "Porções", "Bebidas", "Sobremesas"],
};

const SUGGESTED_CATEGORY_IMAGES = [
  { label: "Hambúrguer", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Sanduíche", url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Passaporte", url: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Salgados", url: "https://images.unsplash.com/photo-1619096252214-ef06c45683e3?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Copo de suco", url: "https://images.unsplash.com/photo-1547514701-42782101795e?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Açaí", url: "https://images.unsplash.com/photo-1590301157890-4810ed352733?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Sobremesa", url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Batata frita", url: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Churrasco", url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Bebida", url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Taco", url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Pastel", url: "https://images.unsplash.com/photo-1644400782358-ccf875323910?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Sorvete", url: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Picolé", url: "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Refrigerante", url: "https://images.unsplash.com/photo-1543253687-c931c8e01820?q=80&w=200&h=200&auto=format&fit=crop" },
  { label: "Chopp", url: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?q=80&w=200&h=200&auto=format&fit=crop" },
];


interface Product {
  id: string;
  nome: string;
  preco: number;
  categoria: string | null;
  disponivel: boolean;
  oculto?: boolean;
  descricao: string | null;
  imagem_url: string | null;
  banner_url?: string | null;
  loja_id: string;
  tag_novo: boolean;
  tag_sugestao: boolean;
  tag_destaque: boolean;
  preco_promocional: number | null;
  promocao_validade: string | null;
  adicionais: any[] | null;
  tamanhos: { nome: string; preco: number; max_sabores: number }[] | null;
  max_sabores: number | null;
  unidade_medida: string;
}

const Products = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { limits } = useStorePlanLimits();
  const { pdvUser, hasActionPermission } = usePdvUser();
  const canCreate = hasActionPermission("produtos", "create");
  const canEdit = hasActionPermission("produtos", "edit");
  const canDelete = hasActionPermission("produtos", "delete");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [showPricingFrame, setShowPricingFrame] = useState(false);
  const produtosLimitReached = limits.max_produtos !== -1 && products.length >= limits.max_produtos;

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [productType, setProductType] = useState<"pizza" | "diverso">("pizza");
  const [saving, setSaving] = useState(false);
  const [segment, setSegment] = useState<Segment>("hamburgueria");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState("un");
  const [descricao, setDescricao] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [tagNovo, setTagNovo] = useState(false);
  const [tagSugestao, setTagSugestao] = useState(false);
  const [tagDestaque, setTagDestaque] = useState(false);
  const [adicionais, setAdicionais] = useState<{ nome: string; preco: string }[]>([]);
  const [linkedProducts, setLinkedProducts] = useState<string[]>([]);
  const [adicionaisGratis, setAdicionaisGratis] = useState("0");
  const [maxAdicionais, setMaxAdicionais] = useState("0");
  const [addAddonOpen, setAddAddonOpen] = useState(false);
  const [novoAdicionalNome, setNovoAdicionalNome] = useState("");
  const [novoAdicionalPreco, setNovoAdicionalPreco] = useState("");
  const [editingAddon, setEditingAddon] = useState<{ originalNome: string; nome: string; preco: string } | null>(null);
  
  const [addSaborOpen, setAddSaborOpen] = useState(false);
  const [novoSaborNome, setNovoSaborNome] = useState("");
  const [novoSaborPreco, setNovoSaborPreco] = useState("");
  const [novoSaborDisponivel, setNovoSaborDisponivel] = useState(true);
  const [editingSabor, setEditingSabor] = useState<{ originalNome: string; nome: string; valorExtra: string; disponivel: boolean } | null>(null);

  
  const [bordas, setBordas] = useState<{ nome: string; preco: string }[]>([]);
  const [maxSaboresBorda, setMaxSaboresBorda] = useState("1");
  const [addBordaOpen, setAddBordaOpen] = useState(false);
  const [novaBordaNome, setNovaBordaNome] = useState("");
  const [novaBordaPreco, setNovaBordaPreco] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [promoAtiva, setPromoAtiva] = useState(false);
  const [precoPromocional, setPrecoPromocional] = useState("");
  const [promocaoValidade, setPromocaoValidade] = useState("");
  const [availablePizzaSizes, setAvailablePizzaSizes] = useState<{ key: string; label: string; defaultSabores: string }[]>([]);
  const [selectedPizzaSizes, setSelectedPizzaSizes] = useState<string[]>([]);
  const [pizzaSizePrices, setPizzaSizePrices] = useState<Record<string, string>>({});
  const [pizzaSizeSabores, setPizzaSizeSabores] = useState<Record<string, string>>({});
  const [pizzaSizePromos, setPizzaSizePromos] = useState<Record<string, string>>({});
  const [pizzaSizeBordas, setPizzaSizeBordas] = useState<Record<string, string>>({});
  const [diverseProductsType, setDiverseProductsType] = useState<"diverso" | "pizza">("diverso");
  const [pizzaBillingForm, setPizzaBillingForm] = useState<"fracionado" | "maior_preco">("maior_preco");

  // Category state
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [customCategoryImages, setCustomCategoryImages] = useState<Record<string, string>>({});
  const [generatingImage, setGeneratingImage] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [categoryStyles, setCategoryStyles] = useState<Record<string, "lista" | "horizontal" | "grid2">>({});
  const [savingStyles, setSavingStyles] = useState(false);

  const [savingOrder, setSavingOrder] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedCategoryImage, setSelectedCategoryImage] = useState<string | null>(null);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ originalName: string; name: string } | null>(null);
  const [editingCategoryForImage, setEditingCategoryForImage] = useState<string | null>(null);
  const [sabores, setSabores] = useState<{ nome: string; valorExtra: string; disponivel: boolean }[]>([{ nome: "", valorExtra: "", disponivel: true }]);
  const [applyIndisponibilidadeAll, setApplyIndisponibilidadeAll] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingScopeSabor, setPendingScopeSabor] = useState<{ index: number, checked: boolean } | null>(null);
  const isCaldos = selectedCategory.trim().toLowerCase() === "caldos";



  // Derive custom categories from saved products
  const savedCategories = Array.from(
    new Set(products.map(p => p.categoria).filter(Boolean) as string[])
  ).filter(cat => !defaultCategories[segment].includes(cat) && !hiddenCategories.includes(cat));

  const [sessionCategories, setSessionCategories] = useState<string[]>([]);
  const allCategories = [...defaultCategories[segment].filter(c => !hiddenCategories.includes(c)), ...new Set([...savedCategories, ...sessionCategories])];

  // Fetch and manage store-wide addons (registry)
  const [dbAddons, setDbAddons] = useState<{ id?: string; nome: string; preco: string; tipo: string }[]>([]);

  const fetchDbAddons = useCallback(async () => {
    if (!lojaId) return;
    const { data, error } = await supabase
      .from("loja_adicionais")
      .select("*")
      .eq("loja_id", lojaId);
    if (!error && data) {
      setDbAddons(data.map(d => ({ id: d.id, nome: d.nome, preco: String(d.preco), tipo: d.tipo })));
    }
  }, [lojaId]);

  useEffect(() => {
    fetchDbAddons();
  }, [fetchDbAddons]);

  // Derive master addon list from registry (no longer merging from current products to avoid duplicates/confusion)
  const masterAddons = [...dbAddons.filter(a => a.tipo === 'adicional')].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' }));
  
  const masterSabores = [...dbAddons.filter(a => a.tipo === 'sabor')].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' }));

  // Same for bordas
  const masterBordas = [...dbAddons.filter(a => a.tipo === 'borda')].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' }));

  useEffect(() => {
    if (!user) {
      setLojaId(null);
      setProducts([]);
      setDbAddons([]);
      return;
    }
    const fetchLoja = async () => {
      const { data } = await supabase
        .from("lojas")
        .select("id, segmento, categorias_ordem, categorias_ocultas, categorias_estilo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setLojaId(data.id);
        if (data.segmento && data.segmento in segmentLabels) {
          setSegment(data.segmento as Segment);
        }
        if (Array.isArray(data.categorias_ordem)) {
          setCategoryOrder(data.categorias_ordem as string[]);
        }
        if (Array.isArray(data.categorias_ocultas)) {
          setHiddenCategories(data.categorias_ocultas as string[]);
        }
        if (data.categorias_estilo && typeof data.categorias_estilo === "object" && !Array.isArray(data.categorias_estilo)) {
          setCategoryStyles(data.categorias_estilo as Record<string, "lista" | "horizontal" | "grid2">);
        }
        // Load custom category images from DB
        const { data: imgData } = await supabase
          .from("loja_categoria_imagens")
          .select("categoria, imagem_url")
          .eq("loja_id", data.id);
        if (imgData) {
          const imgs: Record<string, string> = {};
          for (const row of imgData) {
            imgs[row.categoria] = row.imagem_url;
          }
          setCustomCategoryImages(imgs);
        }
      } else {
        setLojaId(null);
        setProducts([]);
        setDbAddons([]);
      }
    };
    fetchLoja();
  }, [user]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!lojaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("loja_id", lojaId)
      .order("nome", { ascending: true });
    if (error) {
      console.error("Error fetching products:", error);
    } else {
      setProducts((data || []) as unknown as Product[]);
    }
    setLoading(false);
  }, [lojaId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  const fetchPizzaSizes = useCallback(async () => {
    if (!lojaId || segment !== "pizzaria") return;
    try {
      const { data: config } = await supabase
        .from("pizzaria_configuracoes" as any)
        .select("limite_sabores, tamanhos_disponiveis, forma_cobranca")
        .eq("loja_id", lojaId)
        .maybeSingle();

      if (config) {
        setPizzaBillingForm((config as any).forma_cobranca || "maior_preco");
      }

      const { data: cats } = await supabase
        .from("pizzaria_categories")
        .select("id")
        .eq("store_id", lojaId)
        .eq("type", "size");

      if (cats && cats.length > 0) {
        const { data: opts } = await supabase
          .from("pizzaria_options")
          .select("id, name")
          .in("category_id", cats.map(c => c.id));
        
        if (opts) {
          const limits = (config as any)?.limite_sabores || {};
          const availableIds = (config as any)?.tamanhos_disponiveis || [];
          
          const mapped = opts
            .filter(o => availableIds.length === 0 || availableIds.includes(o.id))
            .map(o => ({
              key: o.name,
              label: o.name,
              defaultSabores: String(limits[o.id] || "2")
            }));
          setAvailablePizzaSizes(mapped);
        }
      }
    } catch (error) {
      console.error("Error fetching pizza sizes:", error);
    }
  }, [lojaId, segment]);

  useEffect(() => {
    fetchPizzaSizes();
  }, [fetchPizzaSizes]);

  useEffect(() => {
    if (availablePizzaSizes.length > 0 && !editingProduct) {
      const keys = availablePizzaSizes.map(s => s.key);
      setSelectedPizzaSizes(keys);
      
      const newSabores: Record<string, string> = {};
      keys.forEach(key => {
        const opt = availablePizzaSizes.find(s => s.key === key);
        if (opt) {
          newSabores[key] = opt.defaultSabores;
        }
      });
      setPizzaSizeSabores(newSabores);
    }
  }, [availablePizzaSizes, editingProduct]);

  useEffect(() => {
    if (segment === "pizzaria" && productType === "pizza" && selectedPizzaSizes.length > 0) {
      const prices = selectedPizzaSizes
        .map(size => pizzaSizePrices[size])
        .filter(p => p && !isNaN(Number(p)))
        .map(p => Number(p));
      
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        setPreco(String(minPrice));

        const promoPrices = selectedPizzaSizes
          .map(size => pizzaSizePromos[size])
          .filter(p => p && !isNaN(Number(p)))
          .map(p => Number(p));
        
        if (promoPrices.length > 0) {
          setPrecoPromocional(String(Math.min(...promoPrices)));
          setPromoAtiva(true);
        } else {
          setPrecoPromocional("");
          setPromoAtiva(false);
        }
      }
    }
  }, [segment, productType, selectedPizzaSizes, pizzaSizePrices, pizzaSizePromos]);



  const resetForm = () => {
    setNome("");
    setPreco("");
    setUnidadeMedida("un");
    setDescricao("");
    setSelectedCategory("");
    setTagNovo(false);
    setTagSugestao(false);
    setTagDestaque(false);
    setAdicionais([]);
    setLinkedProducts([]);
    setAdicionaisGratis("0");
    setMaxAdicionais("0");
    setSabores([{ nome: "", valorExtra: "", disponivel: true }]);
    setApplyIndisponibilidadeAll(false);


    setNovoAdicionalNome("");
    setNovoAdicionalPreco("");
    setBordas([]);
    setMaxSaboresBorda("1");
    setNovaBordaNome("");
    setNovaBordaPreco("");
    setImageFile(null);
    setImagePreview(null);
    setBannerFile(null);
    setBannerPreview(null);
    setEditingProduct(null);
    setPromoAtiva(false);
    setPrecoPromocional("");
    setPromocaoValidade("");
    setSelectedPizzaSizes([]);
    setPizzaSizePrices({});
    setPizzaSizeSabores({});
    setPizzaSizePromos({});
    setPizzaSizeBordas({});
    setProductType("pizza");
    setShowTypeSelection(false);
  };

  const openEditDialog = async (product: Product) => {
    setEditingProduct(product);
    setNome(product.nome);
    setPreco(String(product.preco));
    setUnidadeMedida(product.unidade_medida || "un");
    setDescricao(product.descricao || "");
    setSelectedCategory(product.categoria || "");
    setImageFile(null);
    setImagePreview(product.imagem_url || null);
    setBannerFile(null);
    setBannerPreview((product as any).banner_url || null);
    setTagNovo(product.tag_novo);
    setTagSugestao(product.tag_sugestao);
    setTagDestaque(product.tag_destaque);
    setPromoAtiva(!!product.preco_promocional);
    setPrecoPromocional(product.preco_promocional ? String(product.preco_promocional) : "");
    setPromocaoValidade(product.promocao_validade || "");
    setAdicionais(Array.isArray(product.adicionais) ? product.adicionais : []);
    setAdicionaisGratis(String(product.max_sabores ?? 0));
    setMaxAdicionais(String((product as any).max_adicionais ?? 0));
    
    // Load sabores for Caldos
    const sb = (product as any).sabores;
    if (sb && Array.isArray(sb) && sb.length > 0) {
      setSabores(sb.map((s: any) => ({ 
        nome: s.nome || s.name || "", 
        valorExtra: String(s.valorExtra ?? s.valor_extra ?? 0),
        disponivel: s.disponivel !== false
      })));
    } else {
      setSabores([{ nome: "", valorExtra: "", disponivel: true }]);
    }


    
    // Fetch linked products
    const { data: linkedData } = await supabase
      .from("linked_products")
      .select("linked_product_id")
      .eq("product_id", product.id);
    if (linkedData) {
      setLinkedProducts(linkedData.map(lp => lp.linked_product_id));
    } else {
      setLinkedProducts([]);
    }

    // For pizzaria, adicionais stores bordas with type: 'borda'
    if (segment === "pizzaria" && Array.isArray(product.adicionais)) {
      const bordasData = product.adicionais.filter((a: any) => a.tipo === 'borda');
      setBordas(bordasData.map((a: any) => ({ nome: a.nome, preco: String(a.preco || "0") })));
      setMaxSaboresBorda(String(bordasData[0]?.max_sabores_borda || "1"));
      setAdicionais([]);
    } else {
      setBordas([]);
    }
    if (Array.isArray(product.tamanhos) && product.tamanhos.length > 0) {
      const sizes = product.tamanhos.map((t: any) => t.nome || "");
      setSelectedPizzaSizes(sizes);
      const prices: Record<string, string> = {};
      const sabores: Record<string, string> = {};
      const promos: Record<string, string> = {};
      const maxBordas: Record<string, string> = {};
      for (const t of product.tamanhos as any[]) {
        prices[t.nome] = String(t.preco || "");
        sabores[t.nome] = String(t.max_sabores || "2");
        maxBordas[t.nome] = String(t.max_bordas || "1");
        if (t.preco_promocional) promos[t.nome] = String(t.preco_promocional);
      }
      setPizzaSizePrices(prices);
      setPizzaSizeSabores(sabores);
      setPizzaSizePromos(promos);
      setPizzaSizeBordas(maxBordas);
    } else {
      setSelectedPizzaSizes([]);
      setPizzaSizePrices({});
      setPizzaSizeSabores({});
      setPizzaSizePromos({});
      setPizzaSizeBordas({});
    }
    if (segment === "pizzaria") {
      setProductType(Array.isArray(product.tamanhos) && product.tamanhos.length > 0 ? "pizza" : "diverso");
    }
    setDialogOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !lojaId) return null;
    const ext = imageFile.name.split(".").pop() || "jpg";
    const filePath = `${lojaId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(filePath, imageFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Banner muito grande. Máximo 2MB.");
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const uploadBanner = async (): Promise<string | null> => {
    if (!bannerFile || !lojaId) return null;
    const ext = bannerFile.name.split(".").pop() || "jpg";
    const filePath = `${lojaId}/banners/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(filePath, bannerFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
    return urlData.publicUrl;
  };


  const handleSave = async () => {
    if (!lojaId) {
      toast.error("Loja não encontrada. Cadastre sua loja primeiro.");
      return;
    }
    if (!nome.trim()) {
      toast.error(`Informe o ${segment === "pizzaria" ? "nome da pizza" : "nome do produto"}.`);
      return;
    }
    if (!preco || Number(preco) <= 0) {
      toast.error("Informe um preço válido.");
      return;
    }

    if (!imageFile && !editingProduct?.imagem_url) {
      toast.error("A imagem do produto é obrigatória.");
      return;
    }

    if (segment === "pizzaria" && productType === "pizza" && !selectedCategory) {
      toast.error("Informe a categoria da pizza.");
      setSaving(false);
      return;
    }


    try {
      let imagemUrl: string | null = editingProduct?.imagem_url || null;
      if (imageFile) {
        imagemUrl = await uploadImage();
      }
      let bannerUrl: string | null = (editingProduct as any)?.banner_url || null;
      if (bannerFile) {
        bannerUrl = await uploadBanner();
      }

      const validTamanhos = segment === "pizzaria"
        ? selectedPizzaSizes.filter(s => pizzaSizePrices[s]).map(s => ({
            nome: s,
            preco: Number(pizzaSizePrices[s]),
            max_sabores: Number(pizzaSizeSabores[s] || availablePizzaSizes.find(o => o.key === s)?.defaultSabores || "2"),
            max_bordas: Number(pizzaSizeBordas[s] || "1"),
            ...(pizzaSizePromos[s] ? { preco_promocional: Number(pizzaSizePromos[s]) } : {}),
          }))
        : null;

      const saboresEnabled = isCaldos || segment === "acaiteria";
      const cleanSabores = saboresEnabled
        ? sabores
            .filter(s => s.nome.trim())
            .map(s => ({ nome: s.nome.trim(), valorExtra: Number(s.valorExtra) || 0, disponivel: s.disponivel !== false }))

        : [];

      if (isCaldos && cleanSabores.length === 0) {
        toast.error("Adicione pelo menos um sabor para o caldo");
        setSaving(false);
        return;
      }

      const productData = {
        nome: nome.trim(),
        preco: (segment === "pizzaria" && productType === "pizza") ? 0 : Number(preco),
        unidade_medida: unidadeMedida,
        categoria: selectedCategory || null,
        descricao: descricao.trim() || null,
        imagem_url: imagemUrl,
        banner_url: bannerUrl,
        tag_novo: tagNovo,
        tag_sugestao: tagSugestao,
        tag_destaque: tagDestaque,
        preco_promocional: promoAtiva && precoPromocional ? Number(precoPromocional) : null,
        promocao_validade: promoAtiva && promocaoValidade ? promocaoValidade : null,
        adicionais: (segment === "pizzaria" && productType !== "diverso")
          ? bordas.filter(b => b.nome.trim()).map(b => ({ nome: b.nome.trim(), preco: Number(b.preco || 0), tipo: 'borda', max_sabores_borda: Number(maxSaboresBorda || 1) }))
          : (adicionais.length > 0 ? adicionais.map(a => ({ ...a, tipo: (a as any).tipo || 'adicional' })) : []),
        tamanhos: validTamanhos,
        sabores: cleanSabores,
        max_sabores: segment === "acaiteria" ? (Number(adicionaisGratis) || 0) : (validTamanhos && validTamanhos.length > 0 ? Math.max(...validTamanhos.map(t => t.max_sabores)) : null),
        max_adicionais: segment === "acaiteria" ? (Number(maxAdicionais) || 0) : null,
      };


      // Register addons/bordas in the store registry
      if (Array.isArray(productData.adicionais) && productData.adicionais.length > 0) {
        for (const ad of productData.adicionais) {
          await supabase.from("loja_adicionais").upsert({
            loja_id: lojaId,
            nome: ad.nome,
            preco: Number(ad.preco),
            tipo: (ad as any).tipo || 'adicional',
            disponivel: (ad as any).disponivel !== false
          }, { onConflict: 'loja_id,nome,tipo' });

        }
      }

      // Register sabores in the store registry
      if (Array.isArray(productData.sabores) && productData.sabores.length > 0) {
        for (const sb of productData.sabores) {
          await supabase.from("loja_adicionais").upsert({
            loja_id: lojaId,
            nome: sb.nome,
            preco: Number(sb.valorExtra),
            tipo: 'sabor',
            disponivel: sb.disponivel !== false
          }, { onConflict: 'loja_id,nome,tipo' });

        }
      }
      
      fetchDbAddons();

      let finalProductId = "";
      if (editingProduct) {
        finalProductId = editingProduct.id;
        const { error } = await supabase.from("produtos").update(productData).eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        const { data, error } = await supabase.from("produtos").insert({
          ...productData,
          loja_id: lojaId,
          disponivel: true,
        }).select("id").single();
        if (error) throw error;
        finalProductId = data.id;
        toast.success("Produto cadastrado com sucesso!");
      }

      // Persist selected segment on the store so it stays after logout
      if (lojaId && segment) {
        const { error: segError } = await supabase
          .from("lojas")
          .update({ segmento: segment })
          .eq("id", lojaId);
        if (segError) console.error("Error saving segmento:", segError);
      }

      // Handle linked products
      // First delete existing links
      await supabase.from("linked_products").delete().eq("product_id", finalProductId);
      // Insert new links
      if (linkedProducts.length > 0) {
        const links = linkedProducts.map(lpId => ({
          product_id: finalProductId,
          linked_product_id: lpId,
          loja_id: lojaId
        }));
        const { error: linkError } = await supabase.from("linked_products").insert(links);
        if (linkError) console.error("Error saving linked products:", linkError);
      }

      resetForm();
      setDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error("Error saving product:", err);
      toast.error("Erro ao salvar produto: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir produto");
    } else {
      toast.success("Produto excluído");
      fetchProducts();
    }
  };

  const toggleDisponivel = async (id: string, current: boolean) => {
    const { error } = await supabase.from("produtos").update({ disponivel: !current }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar produto");
    } else {
      fetchProducts();
    }
  };

  const toggleOculto = async (id: string, current: boolean) => {
    const { error } = await supabase.from("produtos").update({ oculto: !current } as any).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar visibilidade");
    } else {
      toast.success(!current ? "Produto oculto do cardápio" : "Produto visível no cardápio");
      fetchProducts();
    }
  };

  const generateImageForCategory = async (cat: string) => {
    if (!lojaId) return;
    setGeneratingImage(true);
    try {
      // First check if we already have it in local constants
      const { data, error } = await supabase.functions.invoke("generate-category-image", {
        body: { categoryName: cat },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || "Erro ao gerar imagem da categoria.");
        return;
      }
      if (data?.imageUrl) {
        setCustomCategoryImages(prev => ({ ...prev, [cat]: data.imageUrl }));
        await supabase.from("loja_categoria_imagens").upsert({
          loja_id: lojaId,
          categoria: cat,
          imagem_url: data.imageUrl,
        }, { onConflict: "loja_id,categoria" });
        
        toast.success(`Imagem gerada para "${cat}"`, {
          description: `Link: ${data.imageUrl}`,
          action: {
            label: "Copiar Link",
            onClick: () => {
              navigator.clipboard.writeText(data.imageUrl);
              toast.success("Link copiado!");
            }
          }
        });
      }
    } catch (err) {
      console.error("Error generating category image:", err);
      toast.error("Erro ao gerar imagem da categoria. Tente novamente.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const addCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    
    if (allCategories.includes(trimmed)) {
      toast.error("Esta categoria já existe.");
      return;
    }

    if (!selectedCategoryImage && !categoryImageFile) {
      toast.error("A imagem da categoria é obrigatória.");
      return;
    }

    setSessionCategories(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setSelectedCategory(trimmed);
    
    let finalImageUrl = selectedCategoryImage;

    if (categoryImageFile) {
      try {
        const ext = categoryImageFile.name.split(".").pop() || "jpg";
        const filePath = `${lojaId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("category-images").upload(filePath, categoryImageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: categoryImageFile.type || undefined,
        });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("category-images").getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      } catch (err) {
        console.error("Error uploading category image:", err);
        toast.error("Erro ao fazer upload da imagem da categoria.");
      }
    }

    setNewCategory("");
    setSelectedCategoryImage(null);
    setCategoryImageFile(null);
    setCategoryImagePreview(null);
    setAddCategoryOpen(false);
    
    if (finalImageUrl) {
      setCustomCategoryImages(prev => ({ ...prev, [trimmed]: finalImageUrl! }));
      if (lojaId) {
        await supabase.from("loja_categoria_imagens").upsert({
          loja_id: lojaId,
          categoria: trimmed,
          imagem_url: finalImageUrl,
        }, { onConflict: "loja_id,categoria" });
      }
    }
  };

  const handleUpdateCategoryImage = async () => {
    if (!editingCategoryForImage || !lojaId) return;
    
    let finalImageUrl = selectedCategoryImage;

    if (categoryImageFile) {
      try {
        const ext = categoryImageFile.name.split(".").pop() || "jpg";
        const filePath = `${lojaId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("category-images").upload(filePath, categoryImageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: categoryImageFile.type || undefined,
        });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("category-images").getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      } catch (err) {
        console.error("Error uploading category image:", err);
        toast.error("Erro ao fazer upload da imagem da categoria.");
        return;
      }
    }

    if (finalImageUrl) {
      setCustomCategoryImages(prev => ({ ...prev, [editingCategoryForImage]: finalImageUrl! }));
      const { error } = await supabase.from("loja_categoria_imagens").upsert({
        loja_id: lojaId,
        categoria: editingCategoryForImage,
        imagem_url: finalImageUrl,
      }, { onConflict: "loja_id,categoria" });
      
      if (!error) {
        toast.success(`Imagem da categoria "${editingCategoryForImage}" atualizada!`);
      }
    } else {
      // If no image is selected/uploaded, maybe remove the custom image to revert to default?
      const { error } = await supabase.from("loja_categoria_imagens").delete().eq("loja_id", lojaId).eq("categoria", editingCategoryForImage);
      if (!error) {
        setCustomCategoryImages(prev => {
          const updated = { ...prev };
          delete updated[editingCategoryForImage];
          return updated;
        });
        toast.success(`Imagem da categoria "${editingCategoryForImage}" resetada para o padrão.`);
      }
    }

    setEditingCategoryForImage(null);
    setSelectedCategoryImage(null);
    setCategoryImageFile(null);
    setCategoryImagePreview(null);
  };



  const renameCategory = async (oldName: string, newName: string) => {
    if (!lojaId || !newName.trim() || oldName === newName) return;
    const trimmedNew = newName.trim();

    try {
      // 1. Update all products in this category
      const { error: prodError } = await supabase
        .from("produtos")
        .update({ categoria: trimmedNew })
        .eq("loja_id", lojaId)
        .eq("categoria", oldName);
      if (prodError) throw prodError;

      // 2. Update category images
      await supabase
        .from("loja_categoria_imagens")
        .update({ categoria: trimmedNew })
        .eq("loja_id", lojaId)
        .eq("categoria", oldName);
      
      // 3. Update category order
      const newOrder = categoryOrder.map(c => c === oldName ? trimmedNew : c);
      setCategoryOrder(newOrder);
      await supabase.from("lojas").update({ categorias_ordem: newOrder }).eq("id", lojaId);

      // 4. Update hidden categories if needed
      const newHidden = hiddenCategories.map(c => c === oldName ? trimmedNew : c);
      setHiddenCategories(newHidden);
      await supabase.from("lojas").update({ categorias_ocultas: newHidden }).eq("id", lojaId);

      // 5. If it was a default category, we should hide the old default category name for this store
      if (defaultCategories[segment].includes(oldName)) {
        const updatedHidden = Array.from(new Set([...newHidden, oldName]));
        setHiddenCategories(updatedHidden);
        await supabase.from("lojas").update({ categorias_ocultas: updatedHidden }).eq("id", lojaId);
      }

      // Update local state
      setProducts(prev => prev.map(p => p.categoria === oldName ? { ...p, categoria: trimmedNew } : p));
      setSessionCategories(prev => prev.map(c => c === oldName ? trimmedNew : c));
      
      // Update custom images state
      if (customCategoryImages[oldName]) {
        setCustomCategoryImages(prev => {
          const next = { ...prev };
          next[trimmedNew] = next[oldName];
          delete next[oldName];
          return next;
        });
      }
      if (selectedCategory === oldName) setSelectedCategory(trimmedNew);
      setEditingCategory(null);
      setEditingCategoryForImage(null);

      toast.success("Categoria renomeada com sucesso!");
    } catch (err) {
      console.error("Error renaming category:", err);
      toast.error("Erro ao renomear categoria.");
    }
  };

  const removeCategory = async (cat: string) => {
    if (!lojaId) return;
    if (!confirm(`Deseja realmente excluir a categoria "${cat}"? Os produtos desta categoria ficarão sem categoria.`)) return;

    try {
      // 1. Update products to have no category
      await supabase.from("produtos").update({ categoria: null }).eq("loja_id", lojaId).eq("categoria", cat);
      
      // 2. Add to hidden categories in DB
      const updatedHidden = Array.from(new Set([...hiddenCategories, cat]));
      setHiddenCategories(updatedHidden);
      await supabase.from("lojas").update({ categorias_ocultas: updatedHidden }).eq("id", lojaId);

      // 3. Remove from session
      setSessionCategories(prev => prev.filter(c => c !== cat));
      
      if (selectedCategory === cat) setSelectedCategory("");
      fetchProducts();
      toast.success("Categoria removida.");
    } catch (err) {
      console.error("Error removing category:", err);
      toast.error("Erro ao remover categoria.");
    }
  };

  // Category ordering helpers
  const usedCategories = Array.from(new Set(products.map(p => p.categoria).filter(Boolean) as string[]));

  const getOrderedCategories = () => {
    const ordered: string[] = [];

    // Respect saved order
    for (const cat of categoryOrder) {
      if (usedCategories.includes(cat) && !ordered.includes(cat)) {
        ordered.push(cat);
      }
    }

    // Add remaining categories not in order
    for (const cat of usedCategories) {
      if (!ordered.includes(cat)) {
        ordered.push(cat);
      }
    }
    return ordered;
  };

  const moveCategoryUp = (index: number) => {
    if (index === 0) return;
    const list = getOrderedCategories();
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    setCategoryOrder(list);
  };

  const moveCategoryDown = (index: number) => {
    const list = getOrderedCategories();
    if (index >= list.length - 1) return;
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    setCategoryOrder(list);
  };

  const saveCategoryOrder = async () => {
    if (!lojaId) return;
    setSavingOrder(true);
    const ordered = getOrderedCategories();
    const { error } = await supabase.from("lojas").update({ categorias_ordem: ordered } as any).eq("id", lojaId);
    if (error) {
      toast.error("Erro ao salvar ordenação");
    } else {
      setCategoryOrder(ordered);
      toast.success("Ordem das categorias salva!");
    }
    setSavingOrder(false);
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || (p.categoria || "Sem categoria") === filterCategory;
    return matchSearch && matchCategory;
  });

  if (showPricingFrame) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-card">
          <Button 
            variant="outline" 
            onClick={() => setShowPricingFrame(false)}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Voltar para o Cardápio
          </Button>
          <h2 className="font-bold">Sistema de Precificação</h2>
          <div className="w-[120px]" /> {/* Spacer */}
        </div>
        <iframe 
          src="https://pricenew.lovable.app/?hideLayout=true&hideDeliveryCard=true" 
          className="flex-1 w-full border-0"
          title="Precificação"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {produtosLimitReached && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              Limite de produtos do seu plano atingido ({products.length}/{limits.max_produtos})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Para cadastrar novos produtos faça upgrade do seu plano.
            </p>
          </div>
          <Button size="sm" className="bg-gradient-cta text-accent-foreground font-bold border-0" onClick={() => navigate("/lojista/plano")}>
            <Crown className="w-4 h-4 mr-1" /> Fazer upgrade
          </Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <span className="w-1.5 h-7 rounded-full bg-primary" />
            Cardápio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {products.length} {segment === "pizzaria" ? "pizzas" : "produtos"} cadastrados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline"
            className="border-primary/50 text-primary hover:bg-primary/5 font-bold gap-2 h-10 px-4"
            onClick={() => setShowPricingFrame(true)}
          >
            <Calculator className="w-4 h-4" />
            Precificar produto
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { resetForm(); setShowTypeSelection(false); } }}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-cta text-accent-foreground font-bold border-0"
                onClick={(e) => {
                  if (!canCreate) {
                    e.preventDefault();
                    toast.error("Você não tem permissão para adicionar produtos.");
                    return;
                  }
                  if (produtosLimitReached) {
                    e.preventDefault();
                    setUpgradeOpen(true);
                    return;
                  }
                  if (segment === "pizzaria") {
                    setShowTypeSelection(true);
                  } else {
                    setProductType("diverso");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); setShowTypeSelection(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:rounded-2xl p-0">
            <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-4 flex items-center justify-between">
              <DialogHeader className="p-0">
                <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
                  <span className="w-1.5 h-6 rounded-full bg-[hsl(var(--accent))]" />
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </DialogTitle>
              </DialogHeader>
              <Button variant="ghost" size="icon" onClick={() => { setDialogOpen(false); resetForm(); }} className="rounded-full hover:bg-muted/80">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {segment === "pizzaria" && !editingProduct && showTypeSelection ? (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto py-8">
                  <Card
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group border-2"
                    onClick={() => { setProductType("pizza"); setShowTypeSelection(false); }}
                  >
                    <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Pizza className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Pizza</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cadastro completo com tamanhos, sabores, meio-a-meio e ficha técnica
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group border-2"
                    onClick={() => { setProductType("diverso"); setShowTypeSelection(false); }}
                  >
                    <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                        <IceCream className="w-8 h-8 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Outros Produtos</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Bebidas, lanches, sobremesas — cadastro rápido com variações e complementos
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="p-6 pt-2">
                {/* As abas foram removidas pois o tipo já é escolhido na tela anterior */}


            {segment === "pizzaria" && productType === "pizza" && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Pizza className="w-4 h-4 text-primary" /> Tamanhos da Pizza
                </p>
                <p className="text-xs text-muted-foreground">Os tamanhos exibidos são os que estão ativos nas configurações da pizzaria.</p>
                <div className="flex flex-row flex-wrap md:flex-nowrap gap-3 overflow-x-auto pb-2 md:overflow-x-visible">
                  {availablePizzaSizes.length === 0 && (
                    <div className="w-full py-4 text-center border-2 border-dashed rounded-xl">
                      <p className="text-sm text-muted-foreground">Nenhum tamanho configurado.</p>
                      <p className="text-[10px] text-muted-foreground">Configure os tamanhos na aba de Regras.</p>
                    </div>
                  )}
                  {availablePizzaSizes.map((opt) => {
                    const isChecked = selectedPizzaSizes.includes(opt.key);
                    
                    return (

                      <div key={opt.key} className="flex-1 min-w-[200px] md:min-w-0 rounded-xl border-2 p-3 transition-all border-primary bg-primary/5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{opt.label}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div>
                            <Label className="text-xs">Preço (R$)</Label>
                            <Input
                              type="number"
                              placeholder="0,00"
                              value={pizzaSizePrices[opt.key] || ""}
                              onChange={e => setPizzaSizePrices(prev => ({ ...prev, [opt.key]: e.target.value }))}
                              className="mt-1 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Promoção (R$)</Label>
                            <Input
                              type="number"
                              placeholder="Opcional"
                              value={pizzaSizePromos[opt.key] || ""}
                              onChange={e => setPizzaSizePromos(prev => ({ ...prev, [opt.key]: e.target.value }))}
                              className="mt-1 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Máx. sabores</Label>
                            <Select
                              value={pizzaSizeSabores[opt.key] || opt.defaultSabores}
                              onValueChange={val => setPizzaSizeSabores(prev => ({ ...prev, [opt.key]: val }))}
                            >
                              <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[100001]">
                                <SelectItem value="1">1 sabor</SelectItem>
                                <SelectItem value="2">2 sabores</SelectItem>
                                <SelectItem value="3">3 sabores</SelectItem>
                                <SelectItem value="4">4 sabores</SelectItem>
                                <SelectItem value="5">5 sabores</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Qtd. bordas</Label>
                            <Select
                              value={pizzaSizeBordas[opt.key] || "1"}
                              onValueChange={val => setPizzaSizeBordas(prev => ({ ...prev, [opt.key]: val }))}
                            >
                              <SelectTrigger className="mt-1 bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[100001]">
                                <SelectItem value="1">1 borda</SelectItem>
                                <SelectItem value="2">2 bordas</SelectItem>
                                <SelectItem value="3">3 bordas</SelectItem>
                                <SelectItem value="4">4 bordas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pizzaBillingForm === "fracionado" 
                    ? "⚡ Cada tamanho define quantos sabores o cliente pode escolher. Cobra a média dos valores dos sabores (Valor Fracionado)." 
                    : "⚡ Cada tamanho define quantos sabores o cliente pode escolher. Cobra o valor do sabor mais caro."}
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-6 mt-4">
              {/* Image upload section (Now appearing first on mobile) */}
              <div className="w-full md:w-52 shrink-0 md:order-2">
                <Label>{segment === "pizzaria" ? "Imagem da Pizza" : "Imagem do Produto"}</Label>
                <div className="relative mt-1 w-full max-w-[240px] mx-auto md:max-w-none md:w-52 aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 text-muted-foreground text-sm text-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2 p-3">
                      <Plus className="w-6 h-6" />
                      <span>Adicionar foto</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    </label>
                  )}
                  {(tagNovo || tagSugestao || tagDestaque) && (
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {tagNovo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500 text-white shadow-sm">🆕 NOVO</span>}
                      {tagSugestao && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white shadow-sm">⭐ SUGESTÃO</span>}
                      {tagDestaque && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500 text-white shadow-sm">🔥 DESTAQUE</span>}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG ou WebP. Máx 2MB.</p>
              </div>

              {/* Main fields */}
              <div className="flex-1 md:order-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do Produto</Label>
                    <Input placeholder={segment === "pizzaria" ? "Ex: Calabresa Especial" : "Ex: X-Bacon Especial"} className="mt-1" value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div>
                    <Label>Segmento da Categoria</Label>
                    <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[100001]">
                        {Object.entries(segmentLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(segment !== "pizzaria" || productType === "diverso") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Preço (R$)</Label>
                      <Input type="number" placeholder="0,00" className="mt-1" value={preco} onChange={e => setPreco(e.target.value)} />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="z-[100001]">
                          <SelectItem value="un">un</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  )}
                  <div>
                    <Label>Categoria {segment === "pizzaria" && productType === "pizza" && <span className="text-destructive font-bold">*</span>}</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="flex-1 relative">
                        <button
                          type="button"
                          onClick={() => setCategoryDropdownOpen(prev => !prev)}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <span className={selectedCategory ? "text-foreground" : "text-muted-foreground"}>
                            {selectedCategory || "Selecione..."}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </button>
                        {categoryDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                            {[ "Caldos", ...defaultCategories[segment].filter(cat => cat !== "Caldos" && !hiddenCategories.includes(cat)) ].map(cat => (
                              <div key={cat} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground group ${selectedCategory === cat ? "bg-accent/50" : ""}`}>
                                <button
                                  type="button"
                                  className="flex flex-1 items-center gap-2 text-left min-w-0"
                                  onClick={() => { setSelectedCategory(cat); setCategoryDropdownOpen(false); }}
                                >
                                  {(customCategoryImages[cat] || categoryImages[cat]) && (
                                    <img src={customCategoryImages[cat] || categoryImages[cat]} alt={cat} className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
                                  )}
                                  <span className="truncate">{cat}</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCategory({ originalName: cat, name: cat });
                                    setEditingCategoryForImage(cat);
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {[...savedCategories, ...sessionCategories.filter(c => !savedCategories.includes(c) && !defaultCategories[segment].includes(c))].filter(cat => !hiddenCategories.includes(cat)).map(cat => (
                              <div key={cat} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground group ${selectedCategory === cat ? "bg-accent/50" : ""}`}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                                    onClick={() => { setSelectedCategory(cat); setCategoryDropdownOpen(false); }}
                                  >
                                    {customCategoryImages[cat] ? (
                                      <img src={customCategoryImages[cat]} alt={cat} className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" />
                                    ) : (
                                      <div className="relative shrink-0">
                                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                          {generatingImage ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <X className="w-3 h-3 text-muted-foreground/50" />}
                                        </span>
                                      </div>
                                    )}
                                    <span className="truncate">{cat}</span>
                                  </button>
                                  
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!customCategoryImages[cat] && !generatingImage && (
                                      <button
                                        type="button"
                                        title="Gerar imagem com IA"
                                        className="p-1 rounded hover:bg-primary/10 text-primary shrink-0 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); generateImageForCategory(cat); }}
                                      >
                                        <Flame className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCategory({ originalName: cat, name: cat });
                                        setEditingCategoryForImage(cat);
                                      }}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                                      onClick={(e) => { e.stopPropagation(); removeCategory(cat); }}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {limits.relatorios && (
                        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setAddCategoryOpen(true)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>


                    <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
                      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="font-display">Nova Categoria</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                          <div>
                            <Label>Nome da Categoria</Label>
                            <Input
                              placeholder="Ex: Combos Especiais"
                              value={newCategory}
                              onChange={e => setNewCategory(e.target.value)}
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label className="flex items-center gap-1">
                              Escolha uma imagem <span className="text-destructive font-bold">*</span>
                            </Label>
                            <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto p-1 border rounded-md">
                              {SUGGESTED_CATEGORY_IMAGES.map((img) => (
                                <button
                                  key={img.label}
                                  type="button"
                                  className={`relative group rounded-md overflow-hidden aspect-square border-2 transition-all ${
                                    selectedCategoryImage === img.url ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                                  }`}
                                  onClick={() => {
                                    setSelectedCategoryImage(img.url);
                                    setCategoryImageFile(null);
                                    setCategoryImagePreview(null);
                                  }}
                                  title={img.label}
                                >
                                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-[10px] text-white font-medium px-1 text-center leading-tight">{img.label}</span>
                                  </div>
                                  {selectedCategoryImage === img.url && (
                                    <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5">
                                      <Check className="w-2.5 h-2.5" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Label>Ou envie sua própria imagem</Label>
                            <div className="flex items-center gap-3">
                              {categoryImagePreview ? (
                                <div className="relative w-16 h-16 rounded-md overflow-hidden border">
                                  <img src={categoryImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => {
                                      setCategoryImageFile(null);
                                      setCategoryImagePreview(null);
                                    }}
                                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl-md"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <Label
                                  htmlFor="category-image-upload"
                                  className="w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                  <Plus className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                                </Label>
                              )}
                              <Input
                                id="category-image-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setCategoryImageFile(file);
                                    setCategoryImagePreview(URL.createObjectURL(file));
                                    setSelectedCategoryImage(null);
                                  }
                                }}
                              />
                              <div className="flex-1 text-[11px] text-muted-foreground">
                                Recomendado: 200x200px. Máximo 2MB.
                              </div>
                            </div>
                          </div>

                          <Button
                            className="w-full bg-primary text-primary-foreground font-bold h-11"
                            onClick={addCategory}
                          >
                            {generatingImage ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Processando...
                              </>
                            ) : "Adicionar Categoria"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                  </div>
                </div>

                {(segment !== "pizzaria" || productType === "diverso") && (
                  <div className="p-3 rounded-lg bg-red-50/50 border border-red-100/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-500" />
                        <Label className="text-sm font-semibold text-red-700">Ativar Promoção?</Label>
                      </div>
                      <Switch checked={promoAtiva} onCheckedChange={setPromoAtiva} />
                    </div>
                    
                    {promoAtiva && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 animate-in fade-in slide-in-from-top-1">
                        <div>
                          <Label className="text-xs text-red-600">Preço Promocional (R$)</Label>
                          <Input
                            type="number"
                            placeholder="0,00"
                            value={precoPromocional}
                            onChange={e => setPrecoPromocional(e.target.value)}
                            className="mt-1 h-9 border-red-200 focus-visible:ring-red-500"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-red-600">Válido até (Opcional)</Label>
                          <Input
                            type="date"
                            value={promocaoValidade}
                            onChange={e => setPromocaoValidade(e.target.value)}
                            className="mt-1 h-9 border-red-200 focus-visible:ring-red-500 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label>Descrição do Produto</Label>
                  <Textarea placeholder="Descreva o produto, ingredientes, etc." className="mt-1 min-h-[70px]" value={descricao} onChange={e => setDescricao(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Full width sections */}
            <div className="space-y-4 mt-4">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
                    <div>
                      <Label>Marcadores</Label>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <button type="button" onClick={() => setTagNovo(!tagNovo)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tagNovo ? "bg-green-500 text-white border-green-500" : "bg-background text-muted-foreground border-border hover:border-green-500/50"}`}>
                          🆕 Novo
                        </button>
                        <button type="button" onClick={() => setTagSugestao(!tagSugestao)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tagSugestao ? "bg-blue-500 text-white border-blue-500" : "bg-background text-muted-foreground border-border hover:border-blue-500/50"}`}>
                          ⭐ Sugestão da Loja
                        </button>
                        <button type="button" onClick={() => setTagDestaque(!tagDestaque)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tagDestaque ? "bg-orange-500 text-white border-orange-500" : "bg-background text-muted-foreground border-border hover:border-orange-500/50"}`}>
                          🔥 Destaque
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Esses marcadores serão fixados na imagem do produto e ficaram em destaque na tela principal do cardápio do cliente.
                      </p>
                    </div>

                    {/* Banner para Principais Escolhas */}
                    <div className="pt-4 border-t border-border/50">
                      <Label className="flex items-center gap-2">
                        🖼️ Banner do Produto <span className="text-[10px] font-normal text-muted-foreground">(opcional)</span>
                      </Label>
                      <div className="mt-2 flex items-start gap-3">
                        <label className="relative shrink-0 cursor-pointer group">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBannerSelect}
                          />
                          <div className="w-[176px] h-[57px] rounded-lg border-2 border-dashed border-primary hover:border-primary/80 bg-background overflow-hidden flex items-center justify-center transition-colors">
                            {bannerPreview ? (
                              <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-[10px] text-muted-foreground text-center px-2 leading-tight">
                                456 × 150px
                                <br />
                                <span className="text-[9px]">clique p/ enviar</span>
                              </div>
                            )}
                          </div>
                          {bannerPreview && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBannerFile(null); setBannerPreview(null); }}
                              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center shadow"
                            >
                              ×
                            </button>
                          )}
                        </label>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Este banner aparecerá na seção <b>Principais Escolhas</b> do cardápio público.
                          Dimensões recomendadas: <b>456 × 150px</b>. Caso não envie um banner, a imagem do produto será usada no lugar.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isCaldos && (
                    <div className="space-y-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="flex items-center justify-between">
                        <Label className="flex flex-col gap-1">
                          <span className="font-bold">🍲 Sabores do Caldo</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            Cliente escolherá 1 sabor obrigatoriamente. Valor adicional é somado ao preço base.
                          </span>
                        </Label>
                        <Button 
                          type="button" 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs gap-1"
                          onClick={() => {
                            setEditingSabor(null);
                            setNovoSaborNome("");
                            setNovoSaborPreco("");
                            setNovoSaborDisponivel(true);
                            setAddSaborOpen(true);

                          }}
                        >
                          <Plus className="w-3 h-3" /> Novo Sabor
                        </Button>
                      </div>

                      <div className="flex gap-2 items-center">
                        <Select
                          value=""
                          onValueChange={(val) => {
                            const found = masterSabores.find(s => s.nome === val);
                            if (found && !sabores.find(s => s.nome === found.nome)) {
                              setSabores(prev => [...prev.filter(s => s.nome.trim()), { nome: found.nome, valorExtra: String(found.preco), disponivel: true }]);
                            }
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background h-10">
                            <SelectValue placeholder="Procure o sabor" />
                          </SelectTrigger>
                          <SelectContent className="z-[100001]">
                            {masterSabores.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum sabor cadastrado.</div>}
                            {masterSabores.map(sb => (
                              <div key={sb.nome} className="relative flex items-center group px-1">
                                <SelectItem value={sb.nome} className="flex-1 pr-12 [&>span:first-child]:hidden">
                                  <span className="flex items-center justify-between w-full">
                                    <span className="flex items-center gap-2">
                                      {sb.nome}
                                      <span className="text-xs text-muted-foreground">R$ {Number(sb.preco || 0).toFixed(2).replace(".", ",")}</span>
                                    </span>
                                  </span>
                                </SelectItem>
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {sabores.filter(s => s.nome.trim()).length > 0 && (
                        <div className="space-y-3 mt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Selecionados para este produto:</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sabores.filter(s => s.nome.trim()).map((s, i) => (
                              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/60 shadow-sm gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{s.nome}</span>
                                  <span className="text-xs text-muted-foreground font-semibold">+R$ {Number(s.valorExtra || 0).toFixed(2).replace(".", ",")}</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold uppercase ${s.disponivel !== false ? "text-green-600" : "text-red-600"}`}>
                                      {s.disponivel !== false ? "Disponível" : "Indisponível"}
                                    </span>
                                    <Switch 
                                      checked={s.disponivel !== false} 
                                      onCheckedChange={(checked) => {
                                        setPendingScopeSabor({ index: i, checked });
                                        setScopeDialogOpen(true);
                                      }}
                                      className="scale-75 h-4 w-7 border border-border/60 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500 [&>span]:data-[state=unchecked]:-translate-x-1 [&>span]:border [&>span]:border-border/60"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <button type="button" className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => {
                                           setEditingSabor({ originalNome: s.nome, nome: s.nome, valorExtra: String(s.valorExtra), disponivel: s.disponivel !== false });
                                           setNovoSaborNome(s.nome);
                                           setNovoSaborPreco(String(s.valorExtra));
                                           setNovoSaborDisponivel(s.disponivel !== false);
                                           setAddSaborOpen(true);
                                        }}>
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                                        onClick={() => setSabores(sabores.filter((_, idx) => idx !== i))}>
                                        <X className="w-4 h-4" />
                                      </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Dialog open={scopeDialogOpen} onOpenChange={setScopeDialogOpen}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Alterar Disponibilidade</DialogTitle>
                            <div className="text-sm text-muted-foreground mt-2">
                              Onde deseja aplicar esta alteração para o sabor <strong>{pendingScopeSabor !== null ? sabores[pendingScopeSabor.index]?.nome : ""}</strong>?
                            </div>
                          </DialogHeader>
                          <div className="flex flex-col gap-3 mt-4">
                            <Button 
                              onClick={async () => {
                                if (pendingScopeSabor === null) return;
                                const { index, checked } = pendingScopeSabor;
                                const s = sabores[index];
                                const updatedSabores = [...sabores];
                                updatedSabores[index] = { ...updatedSabores[index], disponivel: checked };
                                setSabores(updatedSabores);
                                
                                if (lojaId) {
                                  await supabase.from("loja_adicionais").upsert({
                                    loja_id: lojaId,
                                    nome: s.nome,
                                    preco: Number(s.valorExtra),
                                    tipo: 'sabor',
                                    disponivel: checked
                                  }, { onConflict: 'loja_id,nome,tipo' });
                                }
                                setScopeDialogOpen(false);
                                setPendingScopeSabor(null);
                              }}
                            >
                              Só este produto
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={async () => {
                                if (pendingScopeSabor === null) return;
                                const { index, checked } = pendingScopeSabor;
                                const s = sabores[index];
                                const updatedSabores = [...sabores];
                                updatedSabores[index] = { ...updatedSabores[index], disponivel: checked };
                                setSabores(updatedSabores);
                                
                                if (lojaId) {
                                  const updateAll = async () => {
                                    const { error } = await supabase.from("loja_adicionais").update({ disponivel: checked }).eq("loja_id", lojaId).eq("nome", s.nome).eq("tipo", 'sabor');
                                    if (error) throw error;
                                    return true;
                                  };
                                  toast.promise(
                                    updateAll(),
                                    {
                                      loading: 'Atualizando em todos os produtos...',
                                      success: 'Sabor atualizado em todos os produtos!',
                                      error: 'Erro ao atualizar.'
                                    }
                                  );
                                }
                                setScopeDialogOpen(false);
                                setPendingScopeSabor(null);
                              }}
                            >
                              Todos os produtos
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {(segment !== "pizzaria" || productType === "diverso") && (
              <div className="space-y-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Adicionais do Produto
                  </p>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1"
                    onClick={() => { setEditingAddon(null); setAddAddonOpen(true); setNovoAdicionalNome(""); setNovoAdicionalPreco(""); }}>
                    <Plus className="w-3 h-3" /> Novo Adicional
                  </Button>
                </div>


                <div className="flex gap-2 items-center">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const addon = masterAddons.find(a => a.nome === val);
                      if (addon && !adicionais.some(a => a.nome === val)) {
                        setAdicionais(prev => [...prev, { nome: addon.nome, preco: addon.preco }]);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-background h-10"><SelectValue placeholder="Procure o adicional" /></SelectTrigger>
                    <SelectContent className="z-[100001]">
                      {masterAddons.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum adicional cadastrado.</div>}
                      {masterAddons.map(ad => (
                        <div key={ad.nome} className="relative flex items-center group px-1">
                          <SelectItem value={ad.nome} className="flex-1 pr-12 [&>span:first-child]:hidden">
                            <span className="flex items-center justify-between w-full">
                              <span className="flex items-center gap-2">
                                {ad.nome}
                                <span className="text-xs text-muted-foreground">R$ {Number(ad.preco || 0).toFixed(2).replace(".", ",")}</span>
                              </span>
                            </span>
                          </SelectItem>
                          <div className="absolute right-2 flex items-center gap-1 z-50">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setEditingAddon({ originalNome: ad.nome, nome: ad.nome, preco: ad.preco });
                                setNovoAdicionalNome(ad.nome);
                                setNovoAdicionalPreco(ad.preco);
                                setAddAddonOpen(true);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onPointerDown={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Excluir "${ad.nome}" da lista definitiva?`)) {
                                  if (ad.id) {
                                    await supabase.from("loja_adicionais").delete().eq("id", ad.id);
                                    fetchDbAddons();
                                  } else {
                                    toast.info("Este adicional é derivado de outros produtos e não pode ser excluído diretamente.");
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {adicionais.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Selecionados para este produto:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...adicionais].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' })).map((ad) => (
                        <div key={ad.nome} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/60 text-sm shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{ad.nome}</span>
                            <span className="text-xs text-muted-foreground font-semibold">R$ {Number(ad.preco || 0).toFixed(2).replace(".", ",")}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => {
                                setEditingAddon({ originalNome: ad.nome, nome: ad.nome, preco: String(ad.preco) });
                                setNovoAdicionalNome(ad.nome);
                                setNovoAdicionalPreco(String(ad.preco));
                                setAddAddonOpen(true);
                              }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                              onClick={() => setAdicionais(prev => prev.filter(a => a.nome !== ad.nome))}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {segment === "acaiteria" && (
                  <div className="flex flex-col gap-3 p-3 rounded-lg bg-background border border-border/50 mt-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Label className="text-xs whitespace-nowrap">🎁 Adicionais grátis inclusos:</Label>
                      <Input type="number" min="0" max="20" value={adicionaisGratis} onChange={e => setAdicionaisGratis(e.target.value)} className="w-20 h-8 text-center text-sm" />
                      <span className="text-[10px] text-muted-foreground">Os demais serão cobrados</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap border-t border-border/50 pt-3">
                      <Label className="text-xs whitespace-nowrap">🔒 Limite total de adicionais:</Label>
                      <Input type="number" min="0" max="50" value={maxAdicionais} onChange={e => setMaxAdicionais(e.target.value)} className="w-20 h-8 text-center text-sm" />
                      <span className="text-[10px] text-muted-foreground">Máximo que o cliente pode escolher (0 = sem limite). Ao atingir, os demais ficam bloqueados.</span>
                    </div>
                  </div>
                )}
              </div>
              )}


              {segment === "pizzaria" && productType === "pizza" && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">🧀 Bordas (Opcional)</p>
                <p className="text-xs text-muted-foreground">O cliente poderá escolher uma borda ou ir sem borda. Não é obrigatório.</p>
                
                {/* Global Bordas List Removed as requested */}

                {/* Select from master list */}
                <div className="flex gap-2 items-center">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const found = masterBordas.find(b => b.nome === val);
                      if (found && !bordas.find(b => b.nome === found.nome)) {
                        setBordas(prev => [...prev, { ...found }]);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1 bg-background h-10"><SelectValue placeholder="Ou selecione borda existente..." /></SelectTrigger>
                    <SelectContent className="z-[100001]">
                      {masterBordas.map((b) => {
                        const alreadyAdded = bordas.some(current => current.nome === b.nome);
                        return (
                          <SelectItem key={b.nome} value={b.nome} disabled={alreadyAdded}>
                            <span className="flex items-center gap-2">
                              {b.nome}
                              <span className="text-xs text-muted-foreground">R$ {Number(b.preco || 0).toFixed(2).replace(".", ",")}</span>
                              {alreadyAdded && <span className="text-[10px] text-muted-foreground">• já adicionada</span>}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0"
                    onClick={() => { setAddBordaOpen(true); setNovaBordaNome(""); setNovaBordaPreco(""); }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* New borda inline form */}
                {addBordaOpen && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Nome da Borda</Label>
                      <Input placeholder="Ex: Cheddar" value={novaBordaNome} onChange={e => setNovaBordaNome(e.target.value)} className="mt-1" />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input type="number" placeholder="0,00" value={novaBordaPreco} onChange={e => setNovaBordaPreco(e.target.value)} className="mt-1" />
                    </div>
                    <Button type="button" size="sm" variant="default" className="h-10"
                      onClick={async () => {
                        if (!novaBordaNome.trim()) return;
                        const newBorda = { nome: novaBordaNome.trim(), preco: novaBordaPreco || "0" };
                        if (!bordas.find(b => b.nome === newBorda.nome)) {
                          setBordas(prev => [...prev, newBorda]);
                        }
                        if (lojaId) {
                          await supabase.from("loja_adicionais").upsert({
                            loja_id: lojaId,
                            nome: newBorda.nome,
                            preco: Number(newBorda.preco),
                            tipo: 'borda'
                          }, { onConflict: 'loja_id,nome,tipo' });
                          fetchDbAddons();
                        }
                        setNovaBordaNome("");
                        setNovaBordaPreco("");
                        setAddBordaOpen(false);
                      }}>
                      <Check className="w-3 h-3 mr-1" /> Salvar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-10" onClick={() => setAddBordaOpen(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {bordas.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Selecionadas para este produto:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[...bordas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' })).map((borda) => (
                        <div key={borda.nome} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/60 text-sm shadow-sm">
                          <span className="font-medium">{borda.nome}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-semibold">R$ {Number(borda.preco || 0).toFixed(2).replace(".", ",")}</span>
                            <div className="flex items-center gap-1">
                              <button type="button" className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => {
                                  setAddBordaOpen(true);
                                  setNovaBordaNome(borda.nome);
                                  setNovaBordaPreco(String(borda.preco));
                                }}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                                onClick={() => setBordas(prev => prev.filter(b => b.nome !== borda.nome))}>
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )}




              <div className="space-y-4 p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" /> Produtos Vinculados (Upsell)
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Estes produtos aparecerão como sugestão para o cliente no detalhe deste produto.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                  {products
                    .filter(p => p.id !== editingProduct?.id) // Don't link to itself
                    .map((p) => {
                      const isSelected = linkedProducts.includes(p.id);
                      return (
                        <div 
                          key={p.id}
                          onClick={() => {
                            if (isSelected) {
                              setLinkedProducts(prev => prev.filter(id => id !== p.id));
                            } else {
                              setLinkedProducts(prev => [...prev, p.id]);
                            }
                          }}
                          className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? "border-primary bg-primary/5 ring-1 ring-primary" 
                              : "border-border bg-background hover:bg-muted/50"
                          }`}
                        >
                          <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
                            {p.imagem_url ? (
                              <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{p.nome}</p>
                            <p className="text-[10px] text-muted-foreground">R$ {Number(p.preco || 0).toFixed(2).replace(".", ",")}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                      );
                    })}
                </div>
              </div>

          </div>
          
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/50 pt-4 pb-2 -mx-6 px-6 mt-4 flex justify-end">
            <Button
              className="bg-primary text-primary-foreground font-bold h-12 px-8"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : editingProduct ? "Atualizar Produto" : "Salvar Produto"}
            </Button>
          </div>
        </div>
          )}
        </DialogContent>
      </Dialog>












      {/* Addon creation dialog */}
      <Dialog open={addAddonOpen} onOpenChange={(open) => { setAddAddonOpen(open); if (!open) { setEditingAddon(null); setNovoAdicionalNome(""); setNovoAdicionalPreco(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingAddon ? "Editar Adicional" : "Novo Adicional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Nome do adicional</Label>
              <Input placeholder="Ex: Bacon extra" className="mt-1" value={novoAdicionalNome} onChange={e => setNovoAdicionalNome(e.target.value)} />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input type="number" placeholder="0,00" className="mt-1" value={novoAdicionalPreco} onChange={e => setNovoAdicionalPreco(e.target.value)} />
            </div>
            <Button className="w-full font-bold" onClick={async () => {
              const nome = novoAdicionalNome.trim();
              if (!nome) { toast.error("Informe o nome do adicional."); return; }
              
              const newAddon = { nome, preco: novoAdicionalPreco || "0" };
              
              if (lojaId) {
                if (editingAddon && editingAddon.originalNome !== nome) {
                  // If name changed, delete old one from master list
                  await supabase.from("loja_adicionais").delete().eq("loja_id", lojaId).eq("nome", editingAddon.originalNome).eq("tipo", 'adicional');
                }

                await supabase.from("loja_adicionais").upsert({
                  loja_id: lojaId,
                  nome: newAddon.nome,
                  preco: Number(newAddon.preco),
                  tipo: 'adicional'
                }, { onConflict: 'loja_id,nome,tipo' });
                
                fetchDbAddons();
              }

              if (editingAddon) {
                setAdicionais(prev => prev.map(a => a.nome === editingAddon.originalNome ? newAddon : a));
                toast.success("Adicional atualizado!");
              } else {
                if (!adicionais.some(a => a.nome === nome)) {
                  setAdicionais(prev => [...prev, newAddon]);
                  toast.success(`Adicional "${nome}" criado!`);
                } else {
                  toast.error("Este adicional já está na lista.");
                }
              }
              
              setAddAddonOpen(false);
              setEditingAddon(null);
              setNovoAdicionalNome("");
              setNovoAdicionalPreco("");
            }}>
              {editingAddon ? "Salvar Alterações" : "Adicionar à Lista"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={addSaborOpen} onOpenChange={setAddSaborOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSabor ? "Editar Sabor" : "Novo Sabor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Sabor</Label>
              <Input
                placeholder="Ex: Calabresa"
                value={novoSaborNome}
                onChange={(e) => setNovoSaborNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Adicional (R$)</Label>
              <p className="text-xs text-muted-foreground">Adicione o valor da diferença.</p>
              <Input
                type="number"
                placeholder="0,00"
                value={novoSaborPreco}
                onChange={(e) => setNovoSaborPreco(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Explicação: Se o produto custa R$ 10,00 e um sabor for um valor diferente de R$ 12,00, o valor extra é R$ 2,00.
              </p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="space-y-0.5">
                <Label>Disponível para venda?</Label>
                <p className="text-[10px] text-muted-foreground">Se desativado, aparecerá como "Indisponível".</p>
              </div>
              <Switch checked={novoSaborDisponivel} onCheckedChange={setNovoSaborDisponivel} />
            </div>

            <Button className="w-full" onClick={async () => {
              if (!novoSaborNome.trim()) return;
              
              const newSabor = { nome: novoSaborNome.trim(), valorExtra: novoSaborPreco || "0", disponivel: novoSaborDisponivel };

              if (lojaId) {
                if (editingSabor && editingSabor.originalNome !== newSabor.nome) {
                  await supabase.from("loja_adicionais").delete().eq("loja_id", lojaId).eq("nome", editingSabor.originalNome).eq("tipo", 'sabor');
                }

                await supabase.from("loja_adicionais").upsert({
                  loja_id: lojaId,
                  nome: newSabor.nome,
                  preco: Number(newSabor.valorExtra),
                  tipo: 'sabor',
                  disponivel: newSabor.disponivel
                }, { onConflict: 'loja_id,nome,tipo' });

                
                fetchDbAddons();
              }

              if (editingSabor) {
                setSabores(prev => prev.map(s => s.nome === editingSabor.originalNome ? newSabor : s));
                toast.success("Sabor atualizado!");
              } else {
                if (!sabores.some(s => s.nome === newSabor.nome)) {
                  setSabores(prev => [...prev.filter(s => s.nome.trim()), newSabor]);
                  toast.success(`Sabor "${newSabor.nome}" criado!`);
                } else {
                  toast.error("Este sabor já está na lista.");
                }
              }
              
              setAddSaborOpen(false);
              setEditingSabor(null);
              setNovoSaborNome("");
              setNovoSaborPreco("");
            }}>
              {editingSabor ? "Salvar Alterações" : "Adicionar à Lista"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="products" className="w-full">
        <div className="border-b border-border mb-6">
          <TabsList className="bg-transparent h-auto p-0 w-auto gap-0 overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger 
              value="products" 
              className="flex items-center gap-1.5 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 transition-all whitespace-nowrap"
            >
              <Sandwich className="w-4 h-4" /> Produtos
            </TabsTrigger>
            {limits.relatorios && (
              <>
                <TabsTrigger 
                  value="categories" 
                  className="flex items-center gap-1.5 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 transition-all whitespace-nowrap"
                >
                  <ListOrdered className="w-4 h-4" /> Categoria: Ordenar e Estilo
                </TabsTrigger>

                <TabsTrigger 
                  value="top-sellers" 
                  className="flex items-center gap-1.5 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 transition-all whitespace-nowrap"
                >
                  <Flame className="w-4 h-4" /> Mais Vendidos
                </TabsTrigger>
              </>
            )}
            {segment === "pizzaria" && limits.relatorios && (
              <TabsTrigger 
                value="rules" 
                className="flex items-center gap-1.5 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 transition-all whitespace-nowrap"
              >
                <ScrollText className="w-4 h-4" /> Regras da Pizzaria
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="products" className="m-0 space-y-6">
          {/* Category Filter Pills */}
          {usedCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFilterCategory("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                  filterCategory === "all"
                    ? "bg-secondary text-secondary-foreground border-secondary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                Todos ({products.length})
              </button>
              {usedCategories.map(cat => {
                const count = products.filter(p => (p.categoria || "Sem categoria") === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                      filterCategory === cat
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{search ? (segment === "pizzaria" ? "Nenhuma pizza encontrada." : "Nenhum produto encontrado.") : (segment === "pizzaria" ? "Nenhuma pizza cadastrada ainda." : "Nenhum produto cadastrado ainda.")}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card 
                    className="border-border/50 shadow-card hover:shadow-elevated transition-all cursor-pointer overflow-hidden border-l-4 border-l-secondary relative" 
                    onClick={() => {
                      if (!limits.relatorios) {
                        setUpgradeOpen(true);
                        return;
                      }
                      if (!canEdit) {
                        toast.error("Você não tem permissão para editar produtos.");
                        return;
                      }
                      openEditDialog(product);
                    }}
                  >
                    {/* Toggles - top right */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold ${(product.disponivel && !product.oculto) ? "text-green-600" : "text-red-600"}`}>{(product.disponivel && !product.oculto) ? "Em Estoque" : "Esgotado"}</span>
                        <Switch 
                          checked={product.disponivel} 
                          onCheckedChange={() => {
                            if (!canEdit) {
                              toast.error("Você não tem permissão para alterar a disponibilidade.");
                              return;
                            }
                            toggleDisponivel(product.id, product.disponivel);
                          }} 
                          className="scale-75" 
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-semibold ${product.oculto ? "text-orange-600" : "text-muted-foreground"}`}>{product.oculto ? "Oculto" : "Ocultar do Cardápio"}</span>
                        <Switch 
                          checked={!!product.oculto} 
                          onCheckedChange={() => {
                            if (!canEdit) {
                              toast.error("Você não tem permissão para ocultar produtos.");
                              return;
                            }
                            toggleOculto(product.id, !!product.oculto);
                          }} 
                          className="scale-75" 
                        />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canDelete) {
                              toast.error("Você não tem permissão para excluir produtos.");
                              return;
                            }
                            setDeleteConfirmId(product.id);
                          }}
                        >
                          {canDelete ? <Trash2 className="w-3 h-3 text-destructive" /> : <Lock className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      <div className="flex p-2.5 gap-3 items-start">
                        <div className="relative w-28 h-28 shrink-0 bg-muted flex items-center justify-center overflow-hidden rounded-xl">
                          {product.imagem_url ? (
                            <img src={product.imagem_url} alt={product.nome} className={`w-full h-full object-cover ${(!product.disponivel || product.oculto) ? "grayscale" : ""}`} />
                          ) : (
                            <span className={`text-3xl ${(!product.disponivel || product.oculto) ? "grayscale" : ""}`}>📦</span>
                          )}
                          {(!product.disponivel || product.oculto) && (
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-bold bg-red-600 text-white shadow-lg whitespace-nowrap z-20">ESGOTADO</span>
                          )}
                          {(product.tag_novo || product.tag_sugestao || product.tag_destaque || product.preco_promocional) && (
                            <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
                              {product.tag_novo && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-500 text-white shadow-sm">🆕 NOVO</span>}
                              {product.tag_sugestao && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-500 text-white shadow-sm">⭐ SUGESTÃO</span>}
                              {product.tag_destaque && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-secondary text-accent-foreground shadow-sm">🔥 DESTAQUE</span>}
                              {product.preco_promocional && <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-red-500 text-white shadow-sm flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" /> PROMO</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col min-w-0 pt-1">
                          <div>
                            <h3 className="font-semibold font-display text-foreground truncate pr-20">{product.nome}</h3>
                            <div className="w-10 h-0.5 bg-secondary rounded-full mt-1" />
                            {product.categoria && <p className="text-xs text-muted-foreground mt-1">{product.categoria}</p>}
                            {product.preco_promocional ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground line-through">R$ {product.preco.toFixed(2).replace(".", ",")}</span>
                                <span className="text-lg font-bold text-red-500">R$ {Number(product.preco_promocional).toFixed(2).replace(".", ",")}</span>
                              </div>
                            ) : (segment === "pizzaria" && Array.isArray(product.tamanhos) && product.tamanhos.length > 0) ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                {product.tamanhos.map((t: any) => (
                                  <div key={t.nome} className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none">{t.nome}</span>
                                    <span className="text-sm font-bold text-primary">R$ {Number(t.preco).toFixed(2).replace(".", ",")}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-lg font-bold text-primary mt-1 block">R$ {product.preco.toFixed(2).replace(".", ",")}</span>
                            )}
                            <div className="flex items-center justify-between mt-0.5" onClick={(e) => e.stopPropagation()}>
                              {Array.isArray(product.adicionais) && product.adicionais.length > 0 ? (
                                <p className="text-[10px] text-muted-foreground">+{product.adicionais.length} {product.adicionais.length === 1 ? "adicional" : "adicionais"}</p>
                              ) : <span />}
                              <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive" onClick={() => setDeleteConfirmId(product.id)} title="Excluir"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {limits.relatorios && (
          <TabsContent value="categories" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <ListOrdered className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold font-display">Ordenar Categorias no Cardápio</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Defina a ordem em que as categorias aparecem no cardápio do cliente. Use as setas para reordenar.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Em <strong>Estilo de Exibição</strong>, escolha como os produtos de cada categoria serão apresentados no cardápio: <strong>Lista</strong> exibe um produto abaixo do outro; <strong>Horizontal</strong> mostra dois lado a lado com rolagem lateral; <strong>Grade 2</strong> exibe dois produtos por linha no formato de card horizontal.
              </p>




              
              {usedCategories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  <p>Cadastre produtos com categorias para poder ordená-las.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:flex items-center gap-3 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-6 shrink-0 text-center">Pos.</span>
                      <span className="w-[72px] shrink-0">Ordem</span>
                      <span className="flex-1">Categoria</span>
                    </div>
                    <span className="w-[200px] shrink-0 text-center">Estilo de Exibição</span>
                  </div>

                  {getOrderedCategories().map((cat, index) => (
                    <div
                      key={cat}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 order-1 sm:order-none">
                          {index + 1}
                        </span>
                        <div className="flex gap-1 items-center shrink-0 order-2 sm:order-none sm:mr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategoryUp(index)}
                            disabled={index === 0}
                            className="h-8 w-8 rounded-full"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveCategoryDown(index)}
                            disabled={index === getOrderedCategories().length - 1}
                            className="h-8 w-8 rounded-full"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-0 order-3 sm:order-none">
                          {(customCategoryImages[cat] || categoryImages[cat]) && (
                            <img src={customCategoryImages[cat] || categoryImages[cat]} alt={cat} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{cat}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full shrink-0"
                            title="Editar nome e imagem"
                            onClick={() => {
                              setEditingCategory({ originalName: cat, name: cat });
                              setEditingCategoryForImage(cat);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex rounded-md overflow-hidden border border-border w-full sm:w-auto sm:shrink-0">
                        {(["lista","horizontal","grid2"] as const).map((style, i) => {
                          const current = categoryStyles[cat] || "lista";
                          const label = style === "lista" ? "Lista" : style === "horizontal" ? "Horizontal" : "Grade 2";
                          return (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setCategoryStyles(prev => ({ ...prev, [cat]: style }))}
                              className={`flex-1 sm:flex-none px-2 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                                current === style ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  ))}

                  
                  <div className="flex justify-end pt-2">
                    <Button
                      className="w-full sm:w-auto mt-6 bg-primary text-primary-foreground font-bold h-9 px-8 rounded-full shadow-lg"
                      onClick={async () => {
                        await saveCategoryOrder();
                        if (lojaId) {
                          setSavingStyles(true);
                          const { error } = await supabase
                            .from("lojas")
                            .update({ categorias_estilo: categoryStyles as any })
                            .eq("id", lojaId);
                          setSavingStyles(false);
                          if (error) toast.error("Erro ao salvar estilo de exibição.");
                        }
                      }}
                      disabled={savingOrder || savingStyles}
                    >
                      {(savingOrder || savingStyles) ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Salvar</>
                      )}
                    </Button>
                  </div>

                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {limits.relatorios && (
          <TabsContent value="top-sellers" className="m-0">
            {lojaId && user ? (
              <TopSellersTab lojaId={lojaId} userId={user.id} />
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </TabsContent>
        )}






        {segment === "pizzaria" && (
          <TabsContent value="rules" className="m-0">
            {lojaId ? (
              <PizzariaRulesManager storeId={lojaId} />
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Excluir Produto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={async () => {
              if (deleteConfirmId) {
                await handleDelete(deleteConfirmId);
                setDeleteConfirmId(null);
              }
            }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Crown className="w-5 h-5 text-[hsl(var(--accent))]" />
              Limite do plano atingido
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Você atingiu o limite de <strong>{limits.max_produtos}</strong> produtos do seu plano atual.
            Faça upgrade para cadastrar mais produtos e continuar crescendo sua loja.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setUpgradeOpen(false)}>Agora não</Button>
            <Button className="flex-1 bg-gradient-cta text-accent-foreground font-bold border-0" onClick={() => { setUpgradeOpen(false); navigate("/lojista/plano"); }}>
              <Crown className="w-4 h-4 mr-1" /> Ver planos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategoryForImage} onOpenChange={(open) => { if (!open) { setEditingCategoryForImage(null); setEditingCategory(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Categoria</DialogTitle>
            <p className="text-sm text-muted-foreground">{editingCategory?.originalName}</p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome da Categoria</Label>
              <Input
                value={editingCategory?.name || ""}
                onChange={e => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="mt-1"
              />
              {editingCategory && editingCategory.name !== editingCategory.originalName && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full text-xs"
                  onClick={() => renameCategory(editingCategory.originalName, editingCategory.name)}
                >
                  <Check className="w-3 h-3 mr-1" /> Salvar Novo Nome
                </Button>
              )}
            </div>
            <hr className="border-border/50" />
            <div>
              <Label className="flex items-center gap-1">Escolha uma imagem sugerida</Label>
              <div className="grid grid-cols-4 gap-2 mt-2 max-h-48 overflow-y-auto p-1 border rounded-md">
                {SUGGESTED_CATEGORY_IMAGES.map((img) => (
                  <button
                    key={img.label}
                    type="button"
                    className={`relative group rounded-md overflow-hidden aspect-square border-2 transition-all ${
                      selectedCategoryImage === img.url ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => {
                      setSelectedCategoryImage(img.url);
                      setCategoryImageFile(null);
                      setCategoryImagePreview(null);
                    }}
                    title={img.label}
                  >
                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    {selectedCategoryImage === img.url && (
                      <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ou envie sua própria imagem</Label>
              <div className="flex items-center gap-3">
                {categoryImagePreview ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img src={categoryImagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setCategoryImagePreview(null); setCategoryImageFile(null); setSelectedCategoryImage(null); }}
                      className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 shadow-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/30">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCategoryImageFile(file);
                          setCategoryImagePreview(URL.createObjectURL(file));
                          setSelectedCategoryImage(null);
                        }
                      }}
                    />
                  </Label>
                )}
                <div className="flex-1 text-xs text-muted-foreground">
                  Recomendado: 400x400px. JPG ou PNG até 1MB.
                </div>
              </div>
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <Button
                className="w-full bg-primary text-primary-foreground font-bold h-11"
                onClick={handleUpdateCategoryImage}
              >
                Salvar Alterações
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setSelectedCategoryImage(null);
                  setCategoryImageFile(null);
                  setCategoryImagePreview(null);
                  handleUpdateCategoryImage();
                }}
              >
                Resetar para imagem padrão
              </Button>
              <hr className="border-border/50" />
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => {
                  if (editingCategory) {
                    removeCategory(editingCategory.originalName);
                    setEditingCategory(null);
                    setEditingCategoryForImage(null);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" /> Excluir Categoria da Loja
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
