import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Loader2, Save, Info, ShoppingBag, Calculator, Settings, Upload, ImageIcon, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Props {
  storeId: string;
  productId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function PizzaProductForm({ storeId, productId, onSave, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Data for selects
  const [flavorCategories, setFlavorCategories] = useState<{id: string, name: string}[]>([]);
  const [sizes, setSizes] = useState<{id: string, name: string}[]>([]);
  const [ingredients, setIngredients] = useState<{id: string, name: string, cost_per_unit: number, unit: string}[]>([]);
  const [complementCategories, setComplementCategories] = useState<{id: string, name: string}[]>([]);

  // Main Product State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [flavorCategoryId, setFlavorCategoryId] = useState<string | null>(null);
  const [allowHalf, setAllowHalf] = useState(false);
  const [maxFlavors, setMaxFlavors] = useState("1");
  const [pricingRule, setPricingRule] = useState("maior_preco");
  const [oculto, setOculto] = useState(false);

  // Prices per size
  const [sizePrices, setSizePrices] = useState<Record<string, string>>({});
  
  // Complements
  const [selectedComplements, setSelectedComplements] = useState<Record<string, {required: boolean, max: number}>>({});

  // Technical Sheet (Ingredients per size)
  const [techSheet, setTechSheet] = useState<Record<string, {ingredient_id: string, quantity: string}[]>>({});

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    
    // Fetch categories for pizzerias
    const { data: cats } = await supabase.from("pizzaria_categories").select("*").eq("store_id", storeId);
    if (cats) {
      setFlavorCategories(cats.filter(c => c.type === 'flavor').map(c => ({ id: c.id, name: c.name })));
      setComplementCategories(cats.filter(c => c.type === 'crust' || c.type === 'complement').map(c => ({ id: c.id, name: c.name })));
      
      const sizeCats = cats.filter(c => c.type === 'size').map(c => c.id);
      if (sizeCats.length > 0) {
        const { data: opts } = await supabase.from("pizzaria_options").select("*").in("category_id", sizeCats);
        if (opts) setSizes(opts.map(o => ({ id: o.id, name: o.name })));
      }
    }

    // Fetch ingredients
    const { data: ingData } = await supabase.from("ingredients").select("*").eq("store_id", storeId);
    if (ingData) setIngredients(ingData);

    // If editing, fetch product data
    if (productId) {
      const { data: prod } = await supabase.from("produtos").select("*").eq("id", productId).single();
      if (prod) {
        setName(prod.nome);
        setDescription(prod.descricao || "");
        setImageUrl(prod.imagem_url || "");
        setFlavorCategoryId(prod.category_flavor_id);
        setAllowHalf(prod.allow_half);
        setMaxFlavors(String(prod.max_flavors));
        setPricingRule(prod.pricing_rule);
        setOculto(!!prod.oculto);

        // Fetch prices
        const { data: prices } = await supabase.from("product_prices").select("*").eq("product_id", productId);
        if (prices) {
          const pMap: Record<string, string> = {};
          prices.forEach(p => pMap[p.size_option_id] = String(p.price));
          setSizePrices(pMap);
        }

        // Fetch complements
        const { data: comps } = await supabase.from("product_complements").select("*").eq("product_id", productId);
        if (comps) {
          const cMap: Record<string, {required: boolean, max: number}> = {};
          comps.forEach(c => cMap[c.category_id] = { required: c.required, max: c.max_selection });
          setSelectedComplements(cMap);
        }

        // Fetch recipe
        const { data: recipe } = await supabase.from("product_ingredients").select("*").eq("product_id", productId);
        if (recipe) {
          const rMap: Record<string, {ingredient_id: string, quantity: string}[]> = {};
          recipe.forEach(r => {
            const key = r.size_option_id || "all";
            if (!rMap[key]) rMap[key] = [];
            rMap[key].push({ ingredient_id: r.ingredient_id, quantity: String(r.quantity_used) });
          });
          setTechSheet(rMap);
        }
      }
    }
    
    setLoading(false);
  }, [storeId, productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Informe o nome da pizza"); return; }
    setSaving(true);
    try {
      const prodData = {
        nome: name.trim(),
        descricao: description,
        imagem_url: imageUrl,
        category_flavor_id: flavorCategoryId,
        allow_half: allowHalf,
        max_flavors: Number(maxFlavors) || 1,
        pricing_rule: pricingRule,
        loja_id: storeId,
        preco: Object.values(sizePrices)[0] ? Number(Object.values(sizePrices)[0]) : 0, // Fallback for basic listing
        categoria: flavorCategories.find(c => c.id === flavorCategoryId)?.name || 'Pizzas',
        oculto: oculto
      };

      let currentId = productId;
      if (productId) {
        await supabase.from("produtos").update(prodData).eq("id", productId);
      } else {
        const { data, error } = await supabase.from("produtos").insert(prodData).select().single();
        if (error) throw error;
        currentId = data.id;
      }

      if (currentId) {
        // 1. Update Prices
        await supabase.from("product_prices").delete().eq("product_id", currentId);
        const priceInserts = Object.entries(sizePrices)
          .filter(([_, price]) => Number(price) > 0)
          .map(([sizeId, price]) => ({
            product_id: currentId!,
            size_option_id: sizeId,
            price: Number(price)
          }));
        if (priceInserts.length > 0) await supabase.from("product_prices").insert(priceInserts);

        // 2. Update Complements
        await supabase.from("product_complements").delete().eq("product_id", currentId);
        const compInserts = Object.entries(selectedComplements).map(([catId, data]) => ({
          product_id: currentId!,
          category_id: catId,
          required: data.required,
          max_selection: data.max
        }));
        if (compInserts.length > 0) await supabase.from("product_complements").insert(compInserts);

        // 3. Update Recipe
        await supabase.from("product_ingredients").delete().eq("product_id", currentId);
        const recipeInserts: any[] = [];
        Object.entries(techSheet).forEach(([sizeId, items]) => {
          items.forEach(item => {
            if (item.ingredient_id && Number(item.quantity) > 0) {
              recipeInserts.push({
                product_id: currentId!,
                ingredient_id: item.ingredient_id,
                size_option_id: sizeId === "all" ? null : sizeId,
                quantity_used: Number(item.quantity)
              });
            }
          });
        });
        if (recipeInserts.length > 0) await supabase.from("product_ingredients").insert(recipeInserts);
      }

      toast.success("Pizza salva com sucesso!");
      onSave?.();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 5MB)");
      return;
    }
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${storeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const addRecipeItem = (sizeId: string) => {
    setTechSheet(prev => ({
      ...prev,
      [sizeId]: [...(prev[sizeId] || []), { ingredient_id: "", quantity: "0" }]
    }));
  };

  const removeRecipeItem = (sizeId: string, index: number) => {
    setTechSheet(prev => {
      const items = [...(prev[sizeId] || [])];
      items.splice(index, 1);
      return { ...prev, [sizeId]: items };
    });
  };

  const updateRecipeItem = (sizeId: string, index: number, field: string, value: string) => {
    setTechSheet(prev => {
      const items = [...(prev[sizeId] || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, [sizeId]: items };
    });
  };

  const calculateCost = (sizeId: string) => {
    const items = techSheet[sizeId] || [];
    return items.reduce((acc, item) => {
      const ing = ingredients.find(i => i.id === item.ingredient_id);
      if (ing) return acc + (ing.cost_per_unit * Number(item.quantity));
      return acc;
    }, 0);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">{productId ? "Editar Pizza" : "Nova Pizza"}</CardTitle>
              <CardDescription>Cadastre as especificações da pizza, preços por tamanho e ficha técnica.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Pizza
              </Button>
            </div>
          </div>
        </CardHeader>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="info" className="gap-2"><Info className="w-4 h-4" /> Geral</TabsTrigger>
            <TabsTrigger value="prices" className="gap-2"><ShoppingBag className="w-4 h-4" /> Preços / Tamanhos</TabsTrigger>
            <TabsTrigger value="complements" className="gap-2"><Settings className="w-4 h-4" /> Adicionais</TabsTrigger>
            <TabsTrigger value="tech" className="gap-2"><Calculator className="w-4 h-4" /> Ficha Técnica</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Imagem do Produto</Label>
                  <div className="flex items-start gap-4">
                    <div className="relative w-32 h-32 rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                      {imageUrl ? (
                        <>
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImageUrl("")}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                            aria-label="Remover imagem"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label htmlFor="product-image-upload" className="cursor-pointer">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
                          {uploadingImage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          {uploadingImage ? "Enviando..." : imageUrl ? "Trocar Imagem" : "Enviar Imagem"}
                        </div>
                        <input
                          id="product-image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploadingImage}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG ou WEBP. Máximo 5MB. Recomendado: 800x800px.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Nome da Pizza</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Calabresa Especial" />
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo de Sabores</Label>
                    <Select value={flavorCategoryId || "none"} onValueChange={(val) => setFlavorCategoryId(val === "none" ? null : val)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {flavorCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Vincula esta pizza a um grupo de sabores (recheios) cadastrado.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição / Ingredientes</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mussarela, calabresa fatiada, cebola e orégano..." />
                </div>
                <div className="pt-4 border-t">
                   <div className="flex items-center justify-between space-x-2 max-w-md">
                      <Label className="flex flex-col gap-1">
                        <span>Permitir Meio-a-Meio?</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          O cliente pode dividir o sabor. O limite de sabores e a forma de cobrança são definidos em <strong>Regras</strong>.
                        </span>
                      </Label>
                      <Switch checked={allowHalf} onCheckedChange={setAllowHalf} />
                   </div>
                   <div className="flex items-center justify-between space-x-2 max-w-md pt-4 border-t mt-4">
                      <Label className="flex flex-col gap-1">
                        <span>Ocultar do Cardápio?</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          O produto não aparecerá para o cliente no cardápio.
                        </span>
                      </Label>
                      <Switch checked={oculto} onCheckedChange={setOculto} />
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prices">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sizes.map(size => (
                    <div key={size.id} className="p-4 border rounded-xl space-y-3 bg-muted/20">
                      <Label className="font-bold">{size.name}</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <Input 
                          type="number" 
                          value={sizePrices[size.id] || ""} 
                          onChange={(e) => setSizePrices(prev => ({ ...prev, [size.id]: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ))}
                  {sizes.length === 0 && (
                     <div className="col-span-full p-6 text-center text-muted-foreground bg-muted/10 rounded-xl border-2 border-dashed">
                        Configure os "Tamanhos" no menu de Grupos primeiro.
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="complements">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {complementCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/10 transition-colors">
                      <div className="space-y-1">
                        <Label className="font-bold text-base">{cat.name}</Label>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                              <Checkbox 
                                id={`req-${cat.id}`}
                                checked={selectedComplements[cat.id]?.required || false}
                                onCheckedChange={(val) => setSelectedComplements(prev => ({ 
                                  ...prev, 
                                  [cat.id]: { ...(prev[cat.id] || { max: 1 }), required: !!val } 
                                }))}
                              />
                              <label htmlFor={`req-${cat.id}`} className="text-xs">Obrigatório</label>
                           </div>
                           <div className="flex items-center gap-2">
                              <span className="text-xs">Máximo:</span>
                              <Input 
                                className="w-16 h-8 text-xs" 
                                type="number" 
                                value={selectedComplements[cat.id]?.max || 1} 
                                onChange={(e) => setSelectedComplements(prev => ({ 
                                  ...prev, 
                                  [cat.id]: { ...(prev[cat.id] || { required: false }), max: Number(e.target.value) } 
                                }))}
                              />
                           </div>
                        </div>
                      </div>
                      <Switch 
                        checked={!!selectedComplements[cat.id]}
                        onCheckedChange={(val) => {
                          if (val) {
                            setSelectedComplements(prev => ({ ...prev, [cat.id]: { required: false, max: 1 } }));
                          } else {
                            const next = { ...selectedComplements };
                            delete next[cat.id];
                            setSelectedComplements(next);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tech">
             <div className="space-y-6">
               {sizes.filter(s => !!sizePrices[s.id]).map(size => (
                 <Card key={size.id}>
                   <CardHeader className="pb-3 border-b">
                     <div className="flex items-center justify-between">
                       <CardTitle className="text-sm font-bold uppercase">{size.name}</CardTitle>
                       <div className="flex items-center gap-4 text-xs">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded">Preço Venda: R$ {Number(sizePrices[size.id]).toFixed(2)}</span>
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Custo Insumos: R$ {calculateCost(size.id).toFixed(2)}</span>
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">
                            Lucro Estimado: R$ {(Number(sizePrices[size.id]) - calculateCost(size.id)).toFixed(2)}
                          </span>
                       </div>
                     </div>
                   </CardHeader>
                   <CardContent className="pt-4 space-y-4">
                      {techSheet[size.id]?.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-end">
                           <div className="flex-1 space-y-1.5">
                             <Label className="text-xs">Insumo</Label>
                             <Select value={item.ingredient_id} onValueChange={(val) => updateRecipeItem(size.id, idx, "ingredient_id", val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                   {ingredients.map(ing => <SelectItem key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</SelectItem>)}
                                </SelectContent>
                             </Select>
                           </div>
                           <div className="w-32 space-y-1.5">
                             <Label className="text-xs">Qtd Gasta</Label>
                             <Input type="number" value={item.quantity} onChange={(e) => updateRecipeItem(size.id, idx, "quantity", e.target.value)} />
                           </div>
                           <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeRecipeItem(size.id, idx)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full border-dashed gap-2" onClick={() => addRecipeItem(size.id)}>
                        <Plus className="w-4 h-4" /> Adicionar Insumo para {size.name}
                      </Button>
                   </CardContent>
                 </Card>
               ))}
               {sizes.filter(s => !!sizePrices[s.id]).length === 0 && (
                  <Card><CardContent className="p-12 text-center text-muted-foreground">Defina o preço de pelo menos um tamanho para abrir a ficha técnica.</CardContent></Card>
               )}
             </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
