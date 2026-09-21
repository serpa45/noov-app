import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IngredientsManager from "@/components/pizzaria/IngredientsManager";
import PizzariaCategoryManager from "@/components/pizzaria/PizzariaCategoryManager";
import PizzaProductForm from "@/components/pizzaria/PizzaProductForm";
import DiverseProductForm from "@/components/pizzaria/DiverseProductForm";
import PizzariaRulesManager from "@/components/pizzaria/PizzariaRulesManager";
import { Pizza, Package, Layers, Plus, List, Edit2, Coffee, Trash2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type ProductType = "pizza" | "diverse";
type View = "list" | "form-pizza" | "form-diverse" | "choose-type";

export default function PizzariaManager() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStore = async () => {
      const { data } = await supabase.from("lojas").select("id").eq("user_id", user.id).maybeSingle();
      if (data) setStoreId(data.id);
    };
    fetchStore();
  }, [user]);

  const fetchProducts = async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("produtos")
      .select(`*, product_prices (price, pizzaria_options (name))`)
      .eq("loja_id", storeId)
      .order("nome", { ascending: true });
    if (data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => {
    if (storeId) fetchProducts();
  }, [storeId, view]);

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    try {
      await supabase.from("product_prices").delete().eq("product_id", id);
      await supabase.from("product_complements").delete().eq("product_id", id);
      await supabase.from("product_ingredients").delete().eq("product_id", id);
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Produto excluído");
      fetchProducts();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  // Determine if product is pizza (has product_prices or category_flavor_id)
  const isPizza = (prod: any) => !!prod.category_flavor_id || (prod.product_prices && prod.product_prices.length > 0);

  const pizzaProducts = products.filter(isPizza);
  const diverseProducts = products.filter(p => !isPizza(p));

  if (!storeId) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto py-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">Gestão de Cardápio Profissional</h1>
          <p className="text-muted-foreground">Pizzas, bebidas, lanches e muito mais.</p>
        </div>
        {view === "list" && (
          <Button onClick={() => setView("choose-type")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        )}
        {view !== "list" && view !== "choose-type" && (
          <Button variant="outline" onClick={() => setView("list")} className="gap-2">
            <List className="w-4 h-4" /> Voltar para Lista
          </Button>
        )}
      </header>

      {/* Product Type Selection */}
      {view === "choose-type" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto py-8">
          <Card
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
            onClick={() => { setEditingId(undefined); setView("form-pizza"); }}
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
            className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group"
            onClick={() => { setEditingId(undefined); setView("form-diverse"); }}
          >
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                <Coffee className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Produto Diverso</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Bebidas, lanches, sobremesas — cadastro rápido com variações e complementos
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="col-span-full text-center">
            <Button variant="ghost" onClick={() => setView("list")}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Pizza Form */}
      {view === "form-pizza" && (
        <PizzaProductForm
          storeId={storeId}
          productId={editingId}
          onSave={() => setView("list")}
          onCancel={() => setView("list")}
        />
      )}

      {/* Diverse Product Form */}
      {view === "form-diverse" && (
        <DiverseProductForm
          storeId={storeId}
          productId={editingId}
          onSave={() => setView("list")}
          onCancel={() => setView("list")}
        />
      )}

      {/* Product List */}
      {view === "list" && (
        <Tabs defaultValue="rules" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="rules" className="gap-2"><ScrollText className="w-4 h-4" /> Regras</TabsTrigger>
            <TabsTrigger value="products" className="gap-2"><Pizza className="w-4 h-4" /> Pizzas</TabsTrigger>
            <TabsTrigger value="diverse" className="gap-2"><Coffee className="w-4 h-4" /> Produtos Diversos</TabsTrigger>
            <TabsTrigger value="categories" className="gap-2"><Layers className="w-4 h-4" /> Grupos e Opções</TabsTrigger>
            <TabsTrigger value="ingredients" className="gap-2"><Package className="w-4 h-4" /> Insumos / Estoque</TabsTrigger>
          </TabsList>

          {/* Pizzas Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pizzaProducts.map(prod => (
                <Card key={prod.id} className="overflow-hidden hover:shadow-lg transition-all border-border/40 group bg-card">
                  <div className="aspect-video w-full bg-muted relative overflow-hidden">
                    {prod.imagem_url ? (
                      <img src={prod.imagem_url} alt={prod.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Pizza className="w-16 h-16" />
                      </div>
                    )}
                    {prod.allow_half && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-primary/90 backdrop-blur-sm">1/2 a 1/2</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg leading-tight text-foreground">{prod.nome}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{prod.descricao || "Sem descrição"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => { setEditingId(prod.id); setView("form-pizza"); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(prod.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-border/50">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Preços por Tamanho</p>
                      <div className="flex flex-wrap gap-2">
                        {prod.product_prices?.map((p: any) => (
                          <Badge key={p.pizzaria_options?.name} variant="outline" className="text-[10px] bg-muted/30 border-border/60">
                            {p.pizzaria_options?.name}: R$ {p.price.toFixed(2)}
                          </Badge>
                        ))}
                        {(!prod.product_prices || prod.product_prices.length === 0) && (
                          <span className="text-[10px] text-destructive uppercase font-bold">Sem preços definidos</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pizzaProducts.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center space-y-4 bg-muted/10 rounded-2xl border-2 border-dashed border-border/50">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Pizza className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">Nenhuma pizza cadastrada</p>
                  <Button onClick={() => { setEditingId(undefined); setView("form-pizza"); }} className="gap-2">
                    <Plus className="w-4 h-4" /> Cadastrar Pizza
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Diverse Products Tab */}
          <TabsContent value="diverse" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {diverseProducts.map(prod => {
                const variations = (prod.tamanhos as unknown as { name: string; price: number }[] | null);
                const complements = (prod.adicionais as unknown as { name: string; price: number }[] | null);
                return (
                  <Card key={prod.id} className="overflow-hidden hover:shadow-lg transition-all border-border/40 group bg-card">
                    <div className="aspect-video w-full bg-muted relative overflow-hidden">
                      {prod.imagem_url ? (
                        <img src={prod.imagem_url} alt={prod.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <Coffee className="w-16 h-16" />
                        </div>
                      )}
                      {prod.categoria && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="backdrop-blur-sm text-[10px]">{prod.categoria}</Badge>
                        </div>
                      )}
                      {!prod.disponivel && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="destructive" className="backdrop-blur-sm text-[10px]">Indisponível</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg leading-tight text-foreground">{prod.nome}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{prod.descricao || "Sem descrição"}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => { setEditingId(prod.id); setView("form-diverse"); }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(prod.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Price or Variations */}
                      <div className="pt-2 border-t border-border/50">
                        {variations && variations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {variations.map((v, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] bg-muted/30 border-border/60">
                                {v.name}: R$ {Number(v.price).toFixed(2)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-primary">R$ {Number(prod.preco).toFixed(2)}</span>
                        )}
                      </div>

                      {/* Complements */}
                      {complements && complements.length > 0 && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Adicionais</p>
                          <div className="flex flex-wrap gap-1">
                            {complements.map((c, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] bg-muted/20">
                                {c.name} {c.price > 0 ? `+R$${Number(c.price).toFixed(2)}` : ""}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {diverseProducts.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center space-y-4 bg-muted/10 rounded-2xl border-2 border-dashed border-border/50">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Coffee className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">Nenhum produto diverso cadastrado</p>
                  <p className="text-sm text-muted-foreground">Bebidas, lanches, sobremesas e outros</p>
                  <Button onClick={() => { setEditingId(undefined); setView("form-diverse"); }} className="gap-2">
                    <Plus className="w-4 h-4" /> Cadastrar Produto
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <PizzariaCategoryManager storeId={storeId} />
          </TabsContent>

          <TabsContent value="ingredients">
            <IngredientsManager storeId={storeId} />
          </TabsContent>

          <TabsContent value="rules">
            <PizzariaRulesManager storeId={storeId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
