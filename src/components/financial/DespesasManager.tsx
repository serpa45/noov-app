import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Receipt, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIAS = [
  "Ingredientes", "Embalagens", "Entregadores", "Taxas/Impostos",
  "Aluguel", "Funcionários", "Equipamentos", "Marketing", "Outros"
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyForm = { descricao: "", valor: "", categoria: "Outros", data: format(new Date(), "yyyy-MM-dd"), observacoes: "" };

interface Props {
  despesas: any[];
  lojaId: string;
  onRefresh: () => void;
}

export default function DespesasManager({ despesas, lojaId, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      descricao: d.descricao ?? "",
      valor: String(d.valor ?? ""),
      categoria: d.categoria ?? "Outros",
      data: d.data ? format(new Date(d.data), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      observacoes: d.observacoes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha descrição e valor"); return; }
    setSaving(true);
    const payload = {
      loja_id: lojaId,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      categoria: form.categoria,
      data: form.data,
      observacoes: form.observacoes || null,
    };
    const { error } = editingId
      ? await supabase.from("despesas").update(payload).eq("id", editingId)
      : await supabase.from("despesas").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar despesa"); return; }
    toast.success(editingId ? "Despesa atualizada!" : "Despesa cadastrada!");
    setForm(emptyForm);
    setEditingId(null);
    setOpen(false);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Despesa excluída");
    onRefresh();
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Receipt className="w-4 h-4 text-red-500" /> Despesas
          </CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={openNew}><Plus className="w-3 h-3" /> Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} /></div>
                  <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></div>
                </div>
                <div><Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="z-[100001]">{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
                <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Salvando..." : (editingId ? "Salvar Alterações" : "Salvar Despesa")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {despesas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa registrada.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {despesas.slice(0, 20).map(d => (
              <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.descricao}</p>
                  <p className="text-[10px] text-muted-foreground">{d.categoria} · {format(new Date(d.data), "dd/MM/yyyy")}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm font-semibold text-red-500">{fmt(Number(d.valor))}</span>
                  <button onClick={() => openEdit(d)} className="p-1 hover:bg-blue-100 rounded text-blue-400 hover:text-blue-600 transition-colors" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600 transition-colors" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
