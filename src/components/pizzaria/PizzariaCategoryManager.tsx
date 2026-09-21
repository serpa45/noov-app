import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Loader2, Layers, Settings2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  type: "size" | "flavor" | "crust" | "complement";
}

interface Option {
  id: string;
  category_id: string;
  name: string;
  additional_price: number;
}

export default function PizzariaCategoryManager({ storeId }: { storeId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Category form state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<Category["type"]>("size");

  // Option form state
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("0");

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    
    // Fetch categories
    const { data: catData, error: catError } = await supabase
      .from("pizzaria_categories")
      .select("*")
      .eq("store_id", storeId)
      .order("name", { ascending: true });

    if (catError) {
      toast.error("Erro ao carregar grupos");
      return;
    }
    
    setCategories((catData || []) as Category[]);

    if (catData && catData.length > 0) {
      const catIds = catData.map(c => c.id);
      const { data: optData, error: optError } = await supabase
        .from("pizzaria_options")
        .select("*")
        .in("category_id", catIds)
        .order("name", { ascending: true });

      if (optError) {
        toast.error("Erro ao carregar opções");
      } else {
        const grouped: Record<string, Option[]> = {};
        optData?.forEach(opt => {
          if (!grouped[opt.category_id]) grouped[opt.category_id] = [];
          grouped[opt.category_id].push(opt);
        });
        setOptions(grouped);
      }
    }
    
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveCategory = async () => {
    if (!catName.trim()) return;
    setSaving(true);
    try {
      const data = { name: catName.trim(), type: catType, store_id: storeId };
      if (editingCategory) {
        const { error } = await supabase.from("pizzaria_categories").update(data).eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pizzaria_categories").insert(data);
        if (error) throw error;
      }
      setCategoryDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveOption = async () => {
    if (!optName.trim() || !activeCategoryId) return;
    setSaving(true);
    try {
      const data = { 
        name: optName.trim(), 
        additional_price: Number(optPrice) || 0, 
        category_id: activeCategoryId 
      };
      if (editingOption) {
        const { error } = await supabase.from("pizzaria_options").update(data).eq("id", editingOption.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pizzaria_options").insert(data);
        if (error) throw error;
      }
      setOptionDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Isso excluirá todas as opções deste grupo. Continuar?")) return;
    try {
      // Get all option ids for this category
      const { data: opts, error: optsErr } = await supabase
        .from("pizzaria_options")
        .select("id")
        .eq("category_id", id);
      if (optsErr) throw optsErr;

      const optionIds = (opts || []).map((o) => o.id);

      if (optionIds.length > 0) {
        // Remove dependencies referencing these options
        const { error: priceErr } = await supabase
          .from("product_prices")
          .delete()
          .in("size_option_id", optionIds);
        if (priceErr) throw priceErr;

        const { error: ingErr } = await supabase
          .from("product_ingredients")
          .delete()
          .in("size_option_id", optionIds);
        if (ingErr) throw ingErr;
      }

      // Remove product_complements that reference this category
      const { error: compErr } = await supabase
        .from("product_complements")
        .delete()
        .eq("category_id", id);
      if (compErr) throw compErr;

      // Unlink products that use this category as their flavor category
      const { error: prodErr } = await supabase
        .from("produtos")
        .update({ category_flavor_id: null })
        .eq("category_flavor_id", id);
      if (prodErr) throw prodErr;

      // Remove options of this category
      const { error: delOptsErr } = await supabase
        .from("pizzaria_options")
        .delete()
        .eq("category_id", id);
      if (delOptsErr) throw delOptsErr;

      // Finally delete the category
      const { error } = await supabase
        .from("pizzaria_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;

      toast.success("Grupo excluído");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "tente novamente"));
    }
  };

  const deleteOption = async (id: string) => {
    try {
      // Remove dependencies first
      const { error: priceErr } = await supabase
        .from("product_prices")
        .delete()
        .eq("size_option_id", id);
      if (priceErr) throw priceErr;

      const { error: ingErr } = await supabase
        .from("product_ingredients")
        .delete()
        .eq("size_option_id", id);
      if (ingErr) throw ingErr;

      const { error } = await supabase
        .from("pizzaria_options")
        .delete()
        .eq("id", id);
      if (error) throw error;

      toast.success("Opção excluída");
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "tente novamente"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Grupos e Opções (Tamanhos, Sabores, Bordas)
        </h2>
        <Button onClick={() => { 
          setEditingCategory(null); 
          setCatName(""); 
          setCatType("size"); 
          setCategoryDialogOpen(true); 
        }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Grupo
        </Button>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex gap-4 items-start">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Como funcionam os Grupos de Sabores?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os <span className="font-semibold text-foreground">Grupos de Sabores</span> organizam os recheios das suas pizzas. 
              Ao criar um grupo do tipo <span className="font-medium">"Sabores / Recheios"</span>, você poderá vincular 
              suas pizzas a ele, permitindo que o cliente escolha entre os sabores disponíveis (incluindo 1/2 a 1/2).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-background/50 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] font-bold uppercase text-primary mb-1">1. Criar Grupo</p>
                <p className="text-xs">Crie um grupo com o tipo "Sabores / Recheios" (ex: Sabores Tradicionais).</p>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] font-bold uppercase text-primary mb-1">2. Adicionar Opções</p>
                <p className="text-xs">Cadastre os sabores dentro do grupo (ex: Calabresa, Mussarela, Frango).</p>
              </div>
              <div className="bg-background/50 p-3 rounded-lg border border-border/40">
                <p className="text-[10px] font-bold uppercase text-primary mb-1">3. Vincular Pizza</p>
                <p className="text-xs">No cadastro da Pizza, selecione o grupo de sabores para ativá-lo.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <Card key={cat.id} className="relative overflow-hidden">
              <CardHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">{cat.name}</CardTitle>
                  <span className="text-[10px] text-muted-foreground uppercase">{cat.type === 'size' ? 'Tamanhos' : cat.type === 'flavor' ? 'Sabores' : cat.type === 'crust' ? 'Bordas' : 'Complementos'}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setEditingCategory(cat);
                    setCatName(cat.name);
                    setCatType(cat.type);
                    setCategoryDialogOpen(true);
                  }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  {options[cat.id]?.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 text-sm border border-border/40 group">
                      <span>{opt.name} {opt.additional_price > 0 && <span className="text-xs text-primary font-medium">(+R$ {opt.additional_price.toFixed(2)})</span>}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                           setEditingOption(opt);
                           setActiveCategoryId(cat.id);
                           setOptName(opt.name);
                           setOptPrice(String(opt.additional_price));
                           setOptionDialogOpen(true);
                         }}>
                           <Edit2 className="w-3 h-3" />
                         </Button>
                         <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteOption(opt.id)}>
                           <Trash2 className="w-3 h-3" />
                         </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full h-8 border-dashed text-xs gap-2" onClick={() => {
                    setEditingOption(null);
                    setActiveCategoryId(cat.id);
                    setOptName("");
                    setOptPrice("0");
                    setOptionDialogOpen(true);
                  }}>
                    <Plus className="w-3 h-3" /> Adicionar Opção
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCategory ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex: Tamanhos, Bordas Recheadas" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Grupo</Label>
              <Select value={catType} onValueChange={(val: any) => setCatType(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-[100001]">
                  <SelectItem value="size">Tamanhos</SelectItem>
                  <SelectItem value="flavor">Sabores / Recheios</SelectItem>
                  <SelectItem value="crust">Bordas</SelectItem>
                  <SelectItem value="complement">Complementos / Bebidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveCategory} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Grupo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Option Dialog */}
      <Dialog open={optionDialogOpen} onOpenChange={setOptionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingOption ? "Editar Opção" : "Nova Opção"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Opção</Label>
              <Input value={optName} onChange={(e) => setOptName(e.target.value)} placeholder="Ex: Média, Grande, Cheddar" />
            </div>
            <div className="space-y-2">
              <Label>Acréscimo de Preço (Opcional)</Label>
              <Input type="number" value={optPrice} onChange={(e) => setOptPrice(e.target.value)} placeholder="0.00" />
            </div>
            <Button className="w-full" onClick={saveOption} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar Opção</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
