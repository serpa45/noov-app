import { useState } from "react";
import { Plus, Search, Edit2, Trash2, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDemoRequired } from "@/contexts/DemoContext";
import { toast } from "sonner";

const CATEGORIES = ["Hambúrgueres", "Bebidas", "Sobremesas"];

const DemoProducts = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useDemoRequired();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", descricao: "", preco: "", categoria: "Hambúrgueres",
    disponivel: true, imagem_url: "",
  });

  const filtered = products.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "todas" || p.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ nome: "", descricao: "", preco: "", categoria: "Hambúrgueres", disponivel: true, imagem_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      nome: p.nome, descricao: p.descricao || "", preco: String(p.preco),
      categoria: p.categoria || "Hambúrgueres", disponivel: p.disponivel,
      imagem_url: p.imagem_url || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nome || !form.preco) {
      toast.error("Preencha nome e preço");
      return;
    }
    if (editingId) {
      updateProduct(editingId, {
        nome: form.nome, descricao: form.descricao, preco: parseFloat(form.preco),
        categoria: form.categoria, disponivel: form.disponivel, imagem_url: form.imagem_url || null,
      });
      toast.success("Produto atualizado (demo)");
    } else {
      addProduct({
        nome: form.nome, descricao: form.descricao, preco: parseFloat(form.preco),
        categoria: form.categoria, disponivel: form.disponivel, imagem_url: form.imagem_url || null,
        tag_novo: false, tag_sugestao: false, tag_destaque: false,
        preco_promocional: null, promocao_validade: null, adicionais: [],
      });
      toast.success("Produto adicionado (demo)");
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    toast.success("Produto removido (demo)");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold font-display">Produtos</h1>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Pizza
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produtos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            {p.imagem_url && (
              <img src={p.imagem_url} alt={p.nome} className="w-full h-40 object-cover" />
            )}
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold font-display">{p.nome}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.descricao}</p>
                </div>
                <Badge variant="outline" className="text-xs">{p.categoria}</Badge>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-lg font-bold text-primary">R$ {p.preco.toFixed(2)}</p>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tamanho da Pizza</Label>
              <Input placeholder="Ex: Grande 45cm" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço</Label>
                <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL da imagem</Label>
              <Input value={form.imagem_url} onChange={(e) => setForm((f) => ({ ...f, imagem_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.disponivel} onCheckedChange={(c) => setForm((f) => ({ ...f, disponivel: c }))} />
              <Label>Disponível</Label>
            </div>
            <Button onClick={handleSave} className="w-full">{editingId ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoProducts;
