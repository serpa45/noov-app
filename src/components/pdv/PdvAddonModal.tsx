import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Scale, Banknote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Addon {
  nome: string;
  preco: string | number;
  tipo?: string;
}

interface SizeOption {
  nome: string;
  preco: number;
  preco_promocional?: number;
  max_sabores?: number;
}

interface FlavorProduct {
  id: string;
  nome: string;
  preco: number;
  imagem_url: string | null;
}

interface PdvAddonModalProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    nome: string;
    preco: number;
    preco_promocional?: number | null;
    promocao_validade?: string | null;
    imagem_url?: string | null;
    adicionais?: Addon[] | null;
    max_sabores?: number | null;
    tamanhos?: SizeOption[] | null;
    categoria?: string | null;
    unidade_medida?: string | null;
  } | null;
  segmento?: string;
  flavorProducts?: FlavorProduct[];
  onConfirm: (data: {
    productId: string;
    name: string;
    basePrice: number;
    totalPrice: number;
    qty: number;
    addons: { nome: string; preco: number }[];
    observation: string;
    image?: string;
    sabores?: string[];
    weight?: string;
    unidade_medida?: string;
    weightMode?: "weight" | "value";
  }) => void;
}

export default function PdvAddonModal({ open, onClose, product, segmento, flavorProducts = [], onConfirm }: PdvAddonModalProps) {
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [qty, setQty] = useState(1);
  const [observation, setObservation] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [weightMode, setWeightMode] = useState<"weight" | "value">("weight");
  const [weightInput, setWeightInput] = useState<string>("");

  const isCaldo = (product?.categoria || "").toLowerCase() === "caldos";
  const isPizzaria = segmento === "pizzaria" || isCaldo;
  const sizes: SizeOption[] = (isPizzaria && product?.tamanhos) ? product.tamanhos : [];

  const selectedSizeObj = selectedSize ? sizes.find(s => s.nome === selectedSize) : null;
  const maxFlavorsTotal = selectedSizeObj?.max_sabores ?? product?.max_sabores ?? 1;
  const maxExtraFlavors = isCaldo ? 1 : Math.max(0, maxFlavorsTotal - 1);

  useEffect(() => {
    if (open) {
      if (sizes.length > 0) {
        setSelectedSize(sizes[0].nome);
      } else {
        setSelectedSize(null);
      }
      if (product?.categoria === "Caldos" && flavorProducts.length > 0) {
        setSelectedFlavors([flavorProducts[0].id]);
      } else {
        setSelectedFlavors([]);
      }
      setSelectedAddons({});
      setQty(1);
      setObservation("");
      setWeightMode("weight");
      setWeightInput("");
    }
  }, [open, product?.id]);

  // Trim flavors when size changes
  useEffect(() => {
    setSelectedFlavors(prev => prev.slice(0, maxExtraFlavors));
  }, [maxExtraFlavors]);

  if (!product) return null;

  const hasPromo = product.preco_promocional && Number(product.preco_promocional) > 0 && (!product.promocao_validade || new Date(product.promocao_validade) >= new Date());

  const sizePrice = selectedSizeObj ? (selectedSizeObj.preco_promocional && selectedSizeObj.preco_promocional > 0 ? selectedSizeObj.preco_promocional : selectedSizeObj.preco) : null;
  const basePrice = sizePrice != null ? sizePrice : (hasPromo ? Number(product.preco_promocional) : Number(product.preco));

  const allAddons: Addon[] = product.adicionais || [];
  const isSpecialCategory = isPizzaria;
  const productBordas = isSpecialCategory ? allAddons.filter(a => a.tipo === 'borda') : [];
  const productAddons = isSpecialCategory ? allAddons.filter(a => a.tipo !== 'borda') : allAddons;

  const isAcai = segmento === "acaiteria";
  const freeCount = isAcai ? (product.max_sabores ?? 0) : 0;

  const updateAddonQty = (nome: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[nome] || 0;
      const next = Math.max(0, current + delta);
      const newAddons = { ...prev };
      if (next === 0) {
        delete newAddons[nome];
      } else {
        newAddons[nome] = next;
      }
      return newAddons;
    });
  };

  const toggleAddon = (nome: string) => {
    setSelectedAddons((prev) => {
      const newAddons = { ...prev };
      if (newAddons[nome]) {
        delete newAddons[nome];
      } else {
        newAddons[nome] = 1;
      }
      return newAddons;
    });
  };

  const toggleFlavor = (flavorId: string) => {
    setSelectedFlavors((prev) => {
      if (prev.includes(flavorId)) {
        // Se for caldo, não permite desmarcar se for o único
        if (isCaldo && prev.length === 1) return prev;
        return prev.filter(f => f !== flavorId);
      }
      
      // Se for caldo e já tem um sabor, substitui em vez de adicionar (já que max extra é 0 normalmente, 
      // mas aqui queremos garantir o comportamento de "obrigatório um")
      if (isCaldo) return [flavorId];
      
      if (prev.length >= maxExtraFlavors) return prev;
      return [...prev, flavorId];
    });
  };

  const isWeightBased = product?.unidade_medida === "kg";

  const calcTotal = () => {
    let price = 0;

    if (isWeightBased) {
      const val = Number(weightInput) || 0;
      if (weightMode === "value") {
        price = val;
      } else {
        price = (val / 1000) * basePrice;
      }
      
      // Add addons to the weight-based price
      for (const [nome, quantity] of Object.entries(selectedAddons)) {
        const addon = [...productAddons, ...productBordas].find(a => a.nome === nome);
        if (addon) price += Number(addon.preco) * quantity;
      }
      return price * qty;
    }

    if (isPizzaria && (sizes.length > 0 || isCaldo)) {
      price = basePrice;
      // Flavor pricing
      if (selectedFlavors.length > 0) {
        const flavorPrices = selectedFlavors.map(fid => {
          const fp = flavorProducts.find(p => p.id === fid);
          return fp ? Number(fp.preco) : 0;
        });

        if (isCaldo) {
          // Caldos: add the extra value of the selected flavor
          const extraValue = flavorPrices.reduce((a, b) => a + b, 0);
          price += extraValue;
        } else {
          // Pizza: use highest price among pizza + extra flavors
          const maxFlavorPrice = Math.max(...flavorPrices);
          if (maxFlavorPrice > price) price = maxFlavorPrice;
        }
      }
      // Add addons
      for (const [nome, quantity] of Object.entries(selectedAddons)) {
        const addon = [...productAddons, ...productBordas].find(a => a.nome === nome);
        if (addon) price += Number(addon.preco) * quantity;
      }
      return price * qty;
    }

    price = basePrice;
    const sortedEntries = Object.entries(selectedAddons);
    let chargedAddonsCount = 0;
    
    for (const [nome, quantity] of sortedEntries) {
      const addon = allAddons.find((a) => a.nome === nome);
      if (addon) {
        // Handle free addons logic: if we have free items, subtract from total quantity
        // This is a simplification, might need adjustment based on specific business rules
        const totalQty = quantity;
        const freeForThisAddon = Math.max(0, freeCount - chargedAddonsCount);
        const billableQty = Math.max(0, totalQty - freeForThisAddon);
        
        price += Number(addon.preco) * billableQty;
        chargedAddonsCount += totalQty;
      }
    }
    return price * qty;
  };

  const handleConfirm = () => {
    const addonObjects = Object.entries(selectedAddons).flatMap(([nome, quantity]) => {
      const a = [...productAddons, ...productBordas].find((x) => x.nome === nome);
      // We repeat the addon object N times or include quantity? 
      // MobileComanda seems to expect an array of addons where quantity is handled by repeating or the item itself has quantity.
      // Looking at MobileComanda.tsx line 808, it maps over item.addons.
      return Array(quantity).fill({ nome, preco: Number(a?.preco || 0) });
    });
    const flavorNames = selectedFlavors.map(fid => {
      const fp = flavorProducts.find(p => p.id === fid);
      return fp?.nome || "";
    }).filter(Boolean);

    const sizeSuffix = selectedSize ? ` (${selectedSize})` : "";
    const flavorSuffix = flavorNames.length > 0 ? ` - ${flavorNames.join(" / ")}` : "";
    const displayName = `${product.nome}${sizeSuffix}`;
    const saboresToSent = isCaldo ? flavorNames : [product.nome, ...flavorNames];

    let finalWeight = "";
    if (isWeightBased) {
      if (weightMode === "weight") {
        finalWeight = weightInput;
      } else {
        const val = Number(weightInput) || 0;
        finalWeight = ((val / basePrice) * 1000).toFixed(0);
      }
    }

    onConfirm({
      productId: product.id,
      name: displayName,
      basePrice,
      totalPrice: calcTotal() / qty,
      qty,
      addons: addonObjects,
      observation,
      image: product.imagem_url || undefined,
      sabores: saboresToSent,
      weight: finalWeight || undefined,
      unidade_medida: product.unidade_medida || undefined,
      weightMode: isWeightBased ? weightMode : undefined,
    });
    setSelectedAddons({});
    setQty(1);
    setObservation("");
    setSelectedSize(null);
    setSelectedFlavors([]);
    setWeightInput("");
    onClose();
  };

  const handleClose = () => {
    setSelectedAddons({});
    setQty(1);
    setObservation("");
    setSelectedSize(null);
    setSelectedFlavors([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product.imagem_url && (
              <img src={product.imagem_url} alt={product.nome} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <span>{product.nome}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Pizza sizes */}
        {sizes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <button
                  key={size.nome}
                  onClick={() => setSelectedSize(size.nome)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-full border transition-colors ${
                    selectedSize === size.nome
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">{size.nome}</span>
                  {size.preco_promocional && size.preco_promocional > 0 ? (
                    <>
                      <span className="text-xs text-muted-foreground line-through">R$ {Number(size.preco).toFixed(2).replace(".", ",")}</span>
                      <span className="text-xs font-semibold text-green-600">R$ {Number(size.preco_promocional).toFixed(2).replace(".", ",")}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">R$ {Number(size.preco).toFixed(2).replace(".", ",")}</span>
                  )}
                  {size.max_sabores && size.max_sabores > 1 && (
                    <span className="text-[10px] text-muted-foreground">• {size.max_sabores} sabores</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sabores - chips horizontais */}
        {(isPizzaria || isCaldo) && flavorProducts.length > 0 && (isCaldo || maxExtraFlavors >= 1) && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {isCaldo ? "🍲 Escolha o Sabor" : `🍕 ${maxExtraFlavors} ${maxExtraFlavors === 1 ? "sabor extra" : "sabores extras"}`}
              <Badge variant={isCaldo ? "default" : "outline"} className={isCaldo ? "bg-red-500 text-[10px]" : "text-[10px]"}>
                {isCaldo ? "Obrigatório" : "Opcional"}
              </Badge>
              {!isCaldo && <span className="text-xs text-muted-foreground ml-auto">+{selectedFlavors.length}/{maxExtraFlavors}</span>}
            </p>
            {isCaldo ? <p className="text-[11px] text-muted-foreground">Escolha 1 sabor</p> : isPizzaria && <p className="text-[11px] text-muted-foreground">⚡ Valor cobrado é do sabor mais caro.</p>}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {flavorProducts.map((flavor) => {
                const isSelected = selectedFlavors.includes(flavor.id);
                const isDisabled = !isCaldo && !isSelected && selectedFlavors.length >= maxExtraFlavors;
                return (
                  <div
                    key={flavor.id}
                    className={`flex items-center justify-between py-3 border-b border-border last:border-0 ${isDisabled ? "opacity-40" : ""}`}
                  >
                    <div className="flex-1" onClick={() => !isDisabled && toggleFlavor(flavor.id)}>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} disabled={isDisabled} onCheckedChange={() => !isDisabled && toggleFlavor(flavor.id)} />
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground font-bold">{flavor.nome}</span>
                          {Number(flavor.preco) > 0 && (
                            <span className="text-xs font-semibold text-primary">
                              + R$ {Number(flavor.preco).toFixed(2).replace(".", ",")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bordas - chips horizontais */}
        {productBordas.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Borda</p>
            <div className="flex flex-wrap gap-2">
              {productBordas.map((borda) => {
                const quantity = selectedAddons[borda.nome] || 0;
                return (
                  <div
                    key={borda.nome}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                      quantity > 0 ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex flex-row items-center gap-2" onClick={() => toggleAddon(borda.nome)}>
                      <span className="text-sm font-medium text-foreground">{borda.nome}</span>
                      <span className="text-xs text-muted-foreground font-semibold">+R$ {Number(borda.preco).toFixed(2).replace(".", ",")}</span>
                    </div>
                    {quantity > 0 && (
                      <div className="flex items-center gap-2 ml-2 border-l pl-2 border-primary/20">
                        <button onClick={() => updateAddonQty(borda.nome, -1)} className="hover:text-primary transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold min-w-[12px] text-center">{quantity}</span>
                        <button onClick={() => updateAddonQty(borda.nome, 1)} className="hover:text-primary transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Adicionais - lista vertical */}
        {productAddons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Adicionais {freeCount > 0 && <span className="text-xs text-muted-foreground font-normal">({freeCount} grátis)</span>}
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {productAddons.map((addon) => {
                const quantity = selectedAddons[addon.nome] || 0;
                // This free logic is complex with quantities, keeping it simple as before for UI indication
                const isFree = false; // simplified
                return (
                  <div
                    key={addon.nome}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1" onClick={() => quantity === 0 && updateAddonQty(addon.nome, 1)}>
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground font-bold">{addon.nome}</span>
                        <span className={`text-xs font-semibold ${isFree ? "text-green-600 line-through" : "text-primary"}`}>
                          {Number(addon.preco) > 0 ? `+ R$ ${Number(addon.preco).toFixed(2).replace(".", ",")}` : "Grátis"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateAddonQty(addon.nome, -1); }} 
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all ${quantity > 0 ? "border-primary text-primary hover:bg-primary/10" : "border-slate-200 text-slate-200 cursor-not-allowed"}`}
                        disabled={quantity === 0}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-sm font-bold min-w-[18px] text-center ${quantity === 0 ? "text-slate-300" : "text-foreground"}`}>{quantity}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateAddonQty(addon.nome, 1); }} 
                        className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weight based selection */}
        {isWeightBased && (
          <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Venda por Peso</p>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Preço/kg: R$ {basePrice.toFixed(2).replace(".", ",")}
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
              <p className="text-xs text-muted-foreground text-center">
                {weightMode === "value" 
                  ? `Equivale a aprox. ${((Number(weightInput) / basePrice) * 1000).toFixed(0)}g` 
                  : `Custo do produto: R$ ${((Number(weightInput) / 1000) * basePrice).toFixed(2).replace(".", ",")}`}
              </p>
            )}
          </div>
        )}

        {/* Observation */}
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Observação</p>
          <Textarea
            placeholder="Ex: sem cebola, bem passado..."
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            className="h-16 text-sm"
          />
        </div>

        {/* Quantity */}
        {!isWeightBased && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Quantidade</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-lg font-bold w-6 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button className="w-full bg-gradient-cta text-accent-foreground font-bold border-0" onClick={handleConfirm}>
            Adicionar — R$ {calcTotal().toFixed(2).replace(".", ",")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
