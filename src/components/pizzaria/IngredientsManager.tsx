import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Loader2, Package } from "lucide-react";
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

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  stock_quantity: number;
}

export default function IngredientsManager({ storeId }: { storeId: string }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("0");

  const fetchIngredients = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("ingredients")
      .select("*")
      .eq("store_id", storeId)
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar insumos");
    } else {
      setIngredients(data || []);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const resetForm = () => {
    setName("");
    setUnit("g");
    setCost("");
    setStock("0");
    setEditingIngredient(null);
  };

  const handleEdit = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setName(ing.name);
    setUnit(ing.unit);
    setCost(String(ing.cost_per_unit));
    setStock(String(ing.stock_quantity));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome do insumo");
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        unit,
        cost_per_unit: Number(cost) || 0,
        stock_quantity: Number(stock) || 0,
        store_id: storeId,
      };

      if (editingIngredient) {
        const { error } = await supabase
          .from("ingredients")
          .update(data)
          .eq("id", editingIngredient.id);
        if (error) throw error;
        toast.success("Insumo atualizado");
      } else {
        const { error } = await supabase
          .from("ingredients")
          .insert(data);
        if (error) throw error;
        toast.success("Insumo cadastrado");
      }

      setDialogOpen(false);
      resetForm();
      fetchIngredients();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este insumo?")) return;
    
    const { error } = await supabase
      .from("ingredients")
      .delete()
      .eq("id", id);
    
    if (error) {
      toast.error("Erro ao excluir. O insumo pode estar sendo usado em uma ficha técnica.");
    } else {
      toast.success("Insumo removido");
      fetchIngredients();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Insumos (Estoque e Custo)
        </h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Insumo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ingredients.map((ing) => (
            <Card key={ing.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{ing.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Custo: R$ {ing.cost_per_unit.toFixed(2)} / {ing.unit}
                  </p>
                  <p className="text-sm font-medium">
                    Estoque: {ing.stock_quantity} {ing.unit}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(ing)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(ing.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {ingredients.length === 0 && (
            <div className="col-span-full text-center p-12 bg-muted/30 rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground">Nenhum insumo cadastrado ainda.</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIngredient ? "Editar Insumo" : "Novo Insumo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Insumo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Queijo Mussarela" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unidade de Medida</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">Gramas (g)</SelectItem>
                    <SelectItem value="kg">Quilos (kg)</SelectItem>
                    <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    <SelectItem value="l">Litros (l)</SelectItem>
                    <SelectItem value="unidade">Unidade (un)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custo por {unit}</Label>
                <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estoque Atual ({unit})</Label>
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingIngredient ? "Atualizar Insumo" : "Salvar Insumo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
