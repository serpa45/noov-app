import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Save, Upload, ImageIcon, X, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  storeId: string;
  productId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

interface Variation {
  name: string;
  price: string;
}

interface Complement {
  name: string;
  price: string;
}

interface Sabor {
  nome: string;
  valorExtra: string;
}

const CALDOS_CATEGORY = "Caldos";


export default function DiverseProductForm({ storeId, productId, onSave, onCancel }: Props) {
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [oculto, setOculto] = useState(false);

  // Category management
  const [categoryList, setCategoryList] = useState<string[]>([CALDOS_CATEGORY]);
  const [newCatDialogOpen, setNewCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [generatingCategoryImg, setGeneratingCategoryImg] = useState(false);

  // Dialogs for Adding Items
  const [saborDialogOpen, setSaborDialogOpen] = useState(false);
  const [newSaborName, setNewSaborName] = useState("");
  const [newSaborPrice, setNewSaborPrice] = useState("");

  const [complementDialogOpen, setComplementDialogOpen] = useState(false);
  const [newComplementName, setNewComplementName] = useState("");
  const [newComplementPrice, setNewComplementPrice] = useState("");

  const generateCategoryImage = async (cat: string) => {
    if (!storeId) return;
    setGeneratingCategoryImg(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-category-image", {
        body: { categoryName: cat },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || "Erro ao gerar imagem da categoria.");
        return;
      }
      if (data?.imageUrl) {
        await supabase.from("loja_categoria_imagens").upsert({
          loja_id: storeId,
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
    } catch (err: any) {
      console.error("Error generating category image:", err);
      toast.error("Erro ao gerar imagem: " + err.message);
    } finally {
      setGeneratingCategoryImg(false);
    }
  };

  // Variations (stored in produtos.tamanhos JSON)
  const [hasVariations, setHasVariations] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([{ name: "", price: "" }]);

  // Complements (stored in produtos.adicionais JSON)
  const [hasComplements, setHasComplements] = useState(false);
  const [complements, setComplements] = useState<Complement[]>([{ name: "", price: "" }]);

  // Sabores (categoria Caldos) — stored in produtos.sabores JSON
  const [sabores, setSabores] = useState<Sabor[]>([{ nome: "", valorExtra: "" }]);
  const isCaldos = category.trim().toLowerCase() === CALDOS_CATEGORY.toLowerCase();


  const [registryComplements, setRegistryComplements] = useState<Complement[]>([]);
  const [registrySabores, setRegistrySabores] = useState<Sabor[]>([]);

  // Load registry items (complements and flavors)
  useEffect(() => {
    if (!storeId) {
      setRegistryComplements([]);
      setRegistrySabores([]);
      return;
    }
    const fetchRegistry = async () => {
      const { data } = await supabase
        .from("loja_adicionais")
        .select("nome, preco, tipo")
        .eq("loja_id", storeId);
      
      if (data) {
        setRegistryComplements(
          data.filter(d => d.tipo === "adicional").map(d => ({ name: d.nome, price: String(d.preco) }))
        );
        setRegistrySabores(
          data.filter(d => d.tipo === "sabor").map(d => ({ nome: d.nome, valorExtra: String(d.preco) }))
        );
      }
    };
    fetchRegistry();
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    const loadCategories = async () => {
      const { data } = await supabase
        .from("produtos")
        .select("categoria")
        .eq("loja_id", storeId)
        .not("categoria", "is", null);
      if (data) {
        const unique = [...new Set(data.map(d => d.categoria).filter(Boolean))] as string[];
        const others = unique.filter(c => c.toLowerCase() !== CALDOS_CATEGORY.toLowerCase()).sort();
        setCategoryList([CALDOS_CATEGORY, ...others]);

      } else {
        setCategoryList([CALDOS_CATEGORY]);
      }

    };
    loadCategories();
  }, [storeId]);

  useEffect(() => {
    if (!productId) { setLoading(false); return; }
    const load = async () => {
      const { data: prod } = await supabase.from("produtos").select("*").eq("id", productId).single();
      if (prod) {
        setName(prod.nome);
        setCategory(prod.categoria || "");
        setDescription(prod.descricao || "");
        setImageUrl(prod.imagem_url || "");
        setPrice(String(prod.preco));
        setPromoPrice(prod.preco_promocional ? String(prod.preco_promocional) : "");
        setAvailable(prod.disponivel);
        setOculto(!!prod.oculto);

        // Variations
        const tam = prod.tamanhos as unknown as Variation[] | null;
        if (tam && Array.isArray(tam) && tam.length > 0) {
          setHasVariations(true);
          setVariations(tam.map((t: any) => ({ name: t.name || t.nome || "", price: String(t.price || t.preco || "") })));
        }

        // Complements
        const ads = prod.adicionais as unknown as Complement[] | null;
        if (ads && Array.isArray(ads) && ads.length > 0) {
          setHasComplements(true);
          setComplements(ads.map((a: any) => ({ name: a.name || a.nome || "", price: String(a.price || a.preco || "") })));
        }

        // Sabores (Caldos)
        const sb = (prod as any).sabores as Sabor[] | null;
        if (sb && Array.isArray(sb) && sb.length > 0) {
          setSabores(sb.map((s: any) => ({ nome: s.nome || s.name || "", valorExtra: String(s.valorExtra ?? s.valor_extra ?? 0) })));
        }
      }

      setLoading(false);
    };
    load();
  }, [productId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem válida"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Informe o nome do produto"); return; }
    if (!hasVariations && !price) { toast.error("Informe o preço"); return; }
    setSaving(true);
    try {
      const cleanVariations = hasVariations
        ? variations.filter(v => v.name.trim() && Number(v.price) > 0).map(v => ({ name: v.name.trim(), price: Number(v.price) }))
        : null;

      const cleanComplements = hasComplements
        ? complements.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), price: Number(c.price) || 0 }))
        : [];

      const cleanSabores = isCaldos
        ? sabores
            .filter(s => s.nome.trim())
            .map(s => ({ nome: s.nome.trim(), valorExtra: Number(s.valorExtra) || 0 }))
        : [];

      if (isCaldos && cleanSabores.length === 0) {
        toast.error("Adicione pelo menos um sabor para o caldo");
        setSaving(false);
        return;
      }

      const prodData = {
        nome: name.trim(),
        categoria: category.trim() || "Diversos",
        descricao: description,
        imagem_url: imageUrl,
        preco: hasVariations && cleanVariations && cleanVariations.length > 0
          ? Math.min(...cleanVariations.map(v => v.price))
          : Number(price) || 0,
        preco_promocional: promoPrice ? Number(promoPrice) : null,
        disponivel: available,
        oculto: oculto,
        loja_id: storeId,
        tamanhos: cleanVariations as any,
        adicionais: cleanComplements as any,
        sabores: cleanSabores as any,
        // Pizza-specific fields set to defaults
        allow_half: false,
        max_flavors: 1,
        pricing_rule: "maior_preco",
        category_flavor_id: null,
      };


      // Register complements in the store registry
      if (cleanComplements.length > 0) {
        for (const ad of cleanComplements) {
          await supabase.from("loja_adicionais").upsert({
            loja_id: storeId,
            nome: ad.name,
            preco: Number(ad.price),
            tipo: 'adicional'
          }, { onConflict: 'loja_id,nome,tipo' });
        }
      }
      // Register flavors in the store registry
      if (isCaldos && cleanSabores.length > 0) {
        for (const sb of cleanSabores) {
          await supabase.from("loja_adicionais").upsert({
            loja_id: storeId,
            nome: sb.nome,
            preco: Number(sb.valorExtra),
            tipo: 'sabor'
          }, { onConflict: 'loja_id,nome,tipo' });
        }
      }

      if (productId) {
        const { error } = await supabase.from("produtos").update(prodData).eq("id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert(prodData);
        if (error) throw error;
      }

      toast.success("Produto salvo com sucesso!");
      onSave?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="w-full max-w-3xl mx-auto pb-10 px-2 sm:px-4">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold">{productId ? "Editar Produto" : "Novo Produto Diverso"}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Cadastro simplificado para bebidas, lanches, sobremesas e outros.</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1 sm:flex-none">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">Salvar Produto</span>
                <span className="sm:hidden">Salvar</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Image */}
            <div className="space-y-2">
              <Label>Imagem do Produto</Label>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="relative w-28 h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setImageUrl("")} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors" aria-label="Remover">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <label htmlFor="diverse-image-upload" className="cursor-pointer">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                      {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingImage ? "Enviando..." : imageUrl ? "Trocar" : "Enviar Imagem"}
                    </div>
                    <input id="diverse-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP. Máx 5MB.</p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Nome do Produto *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Coca-Cola, Hambúrguer, Açaí" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex items-center gap-2">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryList.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          <div className="flex items-center justify-between w-full min-w-[140px]">
                            <span>{cat}</span>
                            {cat !== CALDOS_CATEGORY && (
                              <button
                                type="button"
                                className="p-1 text-destructive hover:bg-destructive/10 rounded ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCategoryList(prev => prev.filter(c => c !== cat));
                                  if (category === cat) setCategory("");
                                }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </SelectItem>
                      ))}

                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-10 w-10"
                    onClick={() => { setNewCatName(""); setNewCatDialogOpen(true); }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o produto..." rows={2} />
            </div>

            {/* Price */}
            {!hasVariations && (
              <div className="pt-2 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Preço *</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-green-500" />
                      Preço Promocional
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <Input type="number" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} placeholder="0.00" />
                    </div>
                    {promoPrice && Number(promoPrice) > 0 && Number(price) > 0 && (
                      <p className="text-xs text-green-600 font-medium">
                        {Math.round((1 - Number(promoPrice) / Number(price)) * 100)}% de desconto
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Availability */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Label className="flex flex-col gap-1">
                <span>Disponível no cardápio?</span>
                <span className="text-xs font-normal text-muted-foreground">Desative para marcar como "Esgotado"</span>
              </Label>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Label className="flex flex-col gap-1">
                <span>Ocultar do Cardápio?</span>
                <span className="text-xs font-normal text-muted-foreground">O produto não aparecerá para o cliente</span>
              </Label>
              <Switch checked={oculto} onCheckedChange={setOculto} />
            </div>

            {/* Variations */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1">
                  <span className="font-bold">Variações (Tamanhos / Volumes)</span>
                  <span className="text-xs font-normal text-muted-foreground">Ex: Lata, 600ml, 1L — com preços diferentes</span>
                </Label>
                <Switch checked={hasVariations} onCheckedChange={setHasVariations} />
              </div>

              {hasVariations && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                  {variations.map((v, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input
                        value={v.name}
                        onChange={(e) => {
                          const next = [...variations];
                          next[i] = { ...next[i], name: e.target.value };
                          setVariations(next);
                        }}
                        placeholder="Ex: 600ml"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 w-36">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          value={v.price}
                          onChange={(e) => {
                            const next = [...variations];
                            next[i] = { ...next[i], price: e.target.value };
                            setVariations(next);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      {variations.length > 1 && (
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setVariations(variations.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-dashed gap-2" onClick={() => setVariations([...variations, { name: "", price: "" }])}>
                    <Plus className="w-4 h-4" /> Adicionar Variação
                  </Button>
                </div>
              )}
            </div>

            {/* Sabores — somente para Caldos */}
            {isCaldos && (
              <div className="pt-4 border-t space-y-4">
                <div>
                  <Label className="flex flex-col gap-1">
                    <span className="font-bold">🍲 Sabores do Caldo</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Cliente escolherá 1 sabor obrigatoriamente. Valor adicional é somado ao preço base.
                    </span>
                  </Label>
                </div>
                <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                  {registrySabores.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <Select
                        value=""
                        onValueChange={(val) => {
                          const found = registrySabores.find(s => s.nome === val);
                          if (found && !sabores.find(s => s.nome === found.nome)) {
                            const next = [...sabores];
                            const emptyIdx = next.findIndex(n => !n.nome.trim());
                            if (emptyIdx > -1) {
                              next[emptyIdx] = { ...found };
                              setSabores(next);
                            } else {
                              setSabores([...next, { ...found }]);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1 text-xs h-8">
                          <SelectValue placeholder="Importar da lista..." />
                        </SelectTrigger>
                        <SelectContent>
                          {registrySabores.map((rs, idx) => (
                            <SelectItem key={idx} value={rs.nome}>
                              {rs.nome} - +R$ {Number(rs.valorExtra).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {sabores.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input
                        value={s.nome}
                        onChange={(e) => {
                          const next = [...sabores];
                          next[i] = { ...next[i], nome: e.target.value };
                          setSabores(next);
                        }}
                        placeholder="Ex: Calabresa"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 w-36">
                        <span className="text-xs text-muted-foreground">+R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={s.valorExtra}
                          onChange={(e) => {
                            const next = [...sabores];
                            next[i] = { ...next[i], valorExtra: e.target.value };
                            setSabores(next);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      {sabores.length > 1 && (
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setSabores(sabores.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-dashed gap-2" 
                    onClick={() => {
                      setNewSaborName("");
                      setNewSaborPrice("");
                      setSaborDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" /> Adicionar Sabor
                  </Button>
                </div>
              </div>
            )}



            {/* Complements */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex flex-col gap-1">
                  <span className="font-bold">Complementos / Adicionais</span>
                  <span className="text-xs font-normal text-muted-foreground">Ex: Queijo extra, Bacon, Granola</span>
                </Label>
                <Switch checked={hasComplements} onCheckedChange={setHasComplements} />
              </div>

              {hasComplements && (
                <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                  {registryComplements.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <Select
                        value=""
                        onValueChange={(val) => {
                          const found = registryComplements.find(c => c.name === val);
                          if (found && !complements.find(c => c.name === found.name)) {
                            // Replace the first empty or add new
                            const next = [...complements];
                            const emptyIdx = next.findIndex(n => !n.name.trim());
                            if (emptyIdx > -1) {
                              next[emptyIdx] = { ...found };
                              setComplements(next);
                            } else {
                              setComplements([...next, { ...found }]);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1 text-xs h-8">
                          <SelectValue placeholder="Importar da lista..." />
                        </SelectTrigger>
                        <SelectContent>
                          {registryComplements.map((rc, idx) => (
                            <SelectItem key={idx} value={rc.name}>
                              {rc.name} - R$ {Number(rc.price).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {complements.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...complements];
                          next[i] = { ...next[i], name: e.target.value };
                          setComplements(next);
                        }}
                        placeholder="Ex: Queijo extra"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 w-36">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          value={c.price}
                          onChange={(e) => {
                            const next = [...complements];
                            next[i] = { ...next[i], price: e.target.value };
                            setComplements(next);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      {complements.length > 1 && (
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setComplements(complements.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-dashed gap-2" 
                    onClick={() => {
                      setNewComplementName("");
                      setNewComplementPrice("");
                      setComplementDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" /> Adicionar Complemento
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Card>

      {/* New Category Dialog */}
      <Dialog open={newCatDialogOpen} onOpenChange={setNewCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Categoria</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Bebidas, Lanches, Sobremesas"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCatName.trim()) {
                    const name = newCatName.trim();
                    if (!categoryList.includes(name)) {
                      setCategoryList(prev => [...prev, name].sort());
                      generateCategoryImage(name);
                    }
                    setCategory(name);
                    setNewCatDialogOpen(false);
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newCatName.trim()}
              onClick={() => {
                const name = newCatName.trim();
                if (!categoryList.includes(name)) {
                  setCategoryList(prev => [...prev, name].sort());
                  generateCategoryImage(name);
                }
                setCategory(name);
                setNewCatDialogOpen(false);
              }}
            >
              {generatingCategoryImg ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* New Sabor Dialog */}
      <Dialog open={saborDialogOpen} onOpenChange={setSaborDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Sabor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Sabor</Label>
              <Input
                value={newSaborName}
                onChange={(e) => setNewSaborName(e.target.value)}
                placeholder="Ex: Calabresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Extra (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                value={newSaborPrice}
                onChange={(e) => setNewSaborPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              className="w-full"
              disabled={!newSaborName.trim()}
              onClick={() => {
                const name = newSaborName.trim();
                const priceValue = newSaborPrice || "0";
                
                // Add to the list
                const next = [...sabores];
                const emptyIdx = next.findIndex(n => !n.nome.trim());
                if (emptyIdx > -1) {
                  next[emptyIdx] = { nome: name, valorExtra: priceValue };
                  setSabores(next);
                } else {
                  setSabores([...next, { nome: name, valorExtra: priceValue }]);
                }
                
                // Also save to registry for future use
                supabase.from("loja_adicionais").upsert({
                  loja_id: storeId,
                  nome: name,
                  preco: Number(priceValue),
                  tipo: 'sabor'
                }, { onConflict: 'loja_id,nome,tipo' }).then(({ error }) => {
                   if (!error) {
                     setRegistrySabores(prev => {
                        if (prev.find(p => p.nome === name)) return prev;
                        return [...prev, { nome: name, valorExtra: priceValue }];
                     });
                   }
                });

                setSaborDialogOpen(false);
                setNewSaborName("");
                setNewSaborPrice("");
              }}
            >
              Adicionar Sabor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Complement Dialog */}
      <Dialog open={complementDialogOpen} onOpenChange={setComplementDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Complemento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Complemento</Label>
              <Input
                value={newComplementName}
                onChange={(e) => setNewComplementName(e.target.value)}
                placeholder="Ex: Queijo Extra"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço</Label>
              <Input
                type="number"
                step="0.01"
                value={newComplementPrice}
                onChange={(e) => setNewComplementPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              className="w-full"
              disabled={!newComplementName.trim()}
              onClick={() => {
                const name = newComplementName.trim();
                const priceValue = newComplementPrice || "0";
                
                // Add to the list
                const next = [...complements];
                const emptyIdx = next.findIndex(n => !n.name.trim());
                if (emptyIdx > -1) {
                  next[emptyIdx] = { name: name, price: priceValue };
                  setComplements(next);
                } else {
                  setComplements([...next, { name: name, price: priceValue }]);
                }
                
                // Also save to registry for future use
                supabase.from("loja_adicionais").upsert({
                  loja_id: storeId,
                  nome: name,
                  preco: Number(priceValue),
                  tipo: 'adicional'
                }, { onConflict: 'loja_id,nome,tipo' }).then(({ error }) => {
                   if (!error) {
                      setRegistryComplements(prev => {
                         if (prev.find(p => p.name === name)) return prev;
                         return [...prev, { name: name, price: priceValue }];
                      });
                   }
                });

                setComplementDialogOpen(false);
                setNewComplementName("");
                setNewComplementPrice("");
              }}
            >
              Adicionar Complemento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
