import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, LayoutDashboard, ShoppingCart, Package, Truck, DollarSign, Settings,
  AlertCircle, ChefHat, CheckCircle2, Clock, Flame, TrendingUp, Users,
  Bell, ChevronDown, Store, BarChart3, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ── Mock data ──

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const MOCK_ORDERS = [
  { id: "a1b2", cliente: "Maria Silva", items: "2x Smash Burger, 1x Coca-Cola", total: 63.80, status: "pendente", tipo: "delivery", time: "3 min" },
  { id: "c3d4", cliente: "João Pereira", items: "1x Bacon Supreme", total: 29.90, status: "preparando", tipo: "delivery", time: "12 min" },
  { id: "e5f6", cliente: "Ana Costa", items: "1x Chicken Burger, 1x Brownie", total: 45.80, status: "em_entrega", tipo: "delivery", time: "28 min" },
  { id: "g7h8", cliente: "Carlos Lima", items: "1x Combo Duplo", total: 59.90, status: "entregue", tipo: "balcao", time: "45 min" },
  { id: "i9j0", cliente: "Fernanda Souza", items: "3x X-Bacon, 2x Milkshake", total: 132.50, status: "entregue", tipo: "delivery", time: "1h" },
];

const MOCK_PRODUCTS = [
  { nome: "Smash Burger Clássico", preco: 28.90, categoria: "Hambúrgueres", disponivel: true },
  { nome: "Bacon Supreme", preco: 34.90, categoria: "Hambúrgueres", disponivel: true },
  { nome: "Chicken Burger", preco: 26.90, categoria: "Hambúrgueres", disponivel: true },
  { nome: "Combo Duplo", preco: 59.90, categoria: "Combos", disponivel: true },
  { nome: "Coca-Cola 350ml", preco: 6.00, categoria: "Bebidas", disponivel: true },
  { nome: "Brownie com Sorvete", preco: 18.90, categoria: "Sobremesas", disponivel: false },
  { nome: "Milkshake Ovomaltine", preco: 16.90, categoria: "Sobremesas", disponivel: true },
];

const MOCK_DELIVERIES = [
  { id: "d1", pedido: "Nº a1b2", entregador: "Lucas Moto", status: "aguardando", endereco: "Rua das Flores, 456" },
  { id: "d2", pedido: "Nº e5f6", entregador: "Pedro Bike", status: "em_rota", endereco: "Av. Brasil, 789" },
];

const statusConfig: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", bg: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  preparando: { label: "Em preparo", bg: "bg-blue-100 text-blue-800", icon: ChefHat },
  em_entrega: { label: "Em entrega", bg: "bg-orange-100 text-orange-800", icon: Truck },
  entregue: { label: "Finalizado", bg: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

type Tab = "dashboard" | "pedidos" | "produtos" | "entregas" | "financeiro" | "configuracoes";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pedidos", label: "Pedidos", icon: ShoppingCart },
  { id: "produtos", label: "Produtos", icon: Package },
  { id: "entregas", label: "Entregas", icon: Truck },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

// ── Sub-views ──

const DashboardView = () => {
  const pending = MOCK_ORDERS.filter(o => o.status === "pendente").length;
  const preparing = MOCK_ORDERS.filter(o => o.status === "preparando").length;
  const delivering = MOCK_ORDERS.filter(o => o.status === "em_entrega").length;
  const done = MOCK_ORDERS.filter(o => o.status === "entregue").length;
  const totalRevenue = MOCK_ORDERS.reduce((s, o) => s + o.total, 0);

  const stats = [
    { label: "Faturamento Hoje", value: formatCurrency(totalRevenue * 0.6), icon: DollarSign, accent: true },
    { label: "Pedidos Ativos", value: String(pending + preparing + delivering), icon: ShoppingCart, accent: false },
    { label: "Ticket Médio", value: formatCurrency(totalRevenue / MOCK_ORDERS.length), icon: TrendingUp, accent: true },
    { label: "Clientes", value: "47", icon: Users, accent: false },
  ];

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">LD</span>
        </div>
        <div>
          <p className="text-sm font-semibold">Boa tarde, Lojista 👋</p>
          <p className="text-[10px] text-muted-foreground">Burger House — Resumo do seu delivery</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-card border border-border/50 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-0.5 ${s.accent ? "bg-primary" : "bg-secondary"}`} />
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${s.accent ? "bg-primary/10" : "bg-secondary/10"}`}>
              <s.icon className={`w-3.5 h-3.5 ${s.accent ? "text-primary" : "text-secondary"}`} />
            </div>
            <p className="text-base font-bold font-display">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <p className="text-[10px] font-semibold font-display mb-2">Pipeline de Pedidos</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { key: "pendente", count: pending },
            { key: "preparando", count: preparing },
            { key: "em_entrega", count: delivering },
            { key: "entregue", count: done },
          ].map((s) => {
            const cfg = statusConfig[s.key];
            const Icon = cfg.icon;
            return (
              <div key={s.key} className={`p-2 rounded-lg ${cfg.bg} text-center`}>
                <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />
                <p className="text-lg font-bold font-display">{s.count}</p>
                <p className="text-[8px] font-medium">{cfg.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold font-display flex items-center gap-1"><BarChart3 className="w-3 h-3 text-primary" /> Vendas da Semana</p>
        </div>
        <div className="h-24 flex items-end gap-1.5 px-1">
          {[35, 52, 41, 68, 85, 73, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t bg-primary/80 transition-all" style={{ height: `${h}%` }} />
              <span className="text-[7px] text-muted-foreground">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold font-display flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /> Pedidos Recentes</p>
        </div>
        <div className="space-y-1.5">
          {MOCK_ORDERS.slice(0, 3).map((o) => {
            const cfg = statusConfig[o.status];
            return (
              <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold font-display">Nº {o.id}</span>
                    <Badge className={`text-[7px] px-1 py-0 h-3.5 ${cfg.bg}`}>{cfg.label}</Badge>
                    <span className="text-[8px] text-muted-foreground">{o.time}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate">{o.cliente} · {o.tipo}</p>
                </div>
                <span className="text-[10px] font-semibold ml-2">{formatCurrency(o.total)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PedidosView = () => (
  <div className="space-y-3">
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {["Todos", "Pendentes", "Em preparo", "Em entrega", "Finalizados"].map((f, i) => (
        <button key={f} className={`px-2.5 py-1 rounded-full text-[9px] font-semibold whitespace-nowrap ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{f}</button>
      ))}
    </div>
    {MOCK_ORDERS.map((o) => {
      const cfg = statusConfig[o.status];
      return (
        <div key={o.id} className="p-3 rounded-xl bg-card border border-border/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-display">Nº {o.id}</span>
              <Badge className={`text-[7px] px-1.5 py-0 h-4 ${cfg.bg}`}>{cfg.label}</Badge>
            </div>
            <span className="text-xs font-bold">{formatCurrency(o.total)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{o.cliente} · {o.tipo}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{o.items}</p>
          <div className="flex gap-1.5 mt-2">
            {o.status === "pendente" && <button className="px-2 py-1 rounded bg-primary text-primary-foreground text-[9px] font-semibold">Aceitar</button>}
            {o.status === "preparando" && <button className="px-2 py-1 rounded bg-orange-500 text-white text-[9px] font-semibold">Enviar para entrega</button>}
            {o.status === "em_entrega" && <button className="px-2 py-1 rounded bg-green-600 text-white text-[9px] font-semibold">Finalizar</button>}
          </div>
        </div>
      );
    })}
  </div>
);

const ProdutosView = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold">{MOCK_PRODUCTS.length} produtos</p>
      <button className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[9px] font-semibold">+ Novo Produto</button>
    </div>
    {MOCK_PRODUCTS.map((p, i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">🍔</div>
          <div>
            <p className="text-xs font-semibold">{p.nome}</p>
            <p className="text-[9px] text-muted-foreground">{p.categoria}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-primary">{formatCurrency(p.preco)}</p>
          <span className={`text-[8px] font-semibold ${p.disponivel ? "text-green-600" : "text-red-500"}`}>{p.disponivel ? "Ativo" : "Inativo"}</span>
        </div>
      </div>
    ))}
  </div>
);

const EntregasView = () => (
  <div className="space-y-3">
    <p className="text-xs font-semibold">{MOCK_DELIVERIES.length} entregas ativas</p>
    {MOCK_DELIVERIES.map((d) => (
      <div key={d.id} className="p-3 rounded-xl bg-card border border-border/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold font-display">Pedido {d.pedido}</span>
          <Badge className={`text-[7px] px-1.5 py-0 h-4 ${d.status === "em_rota" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
            {d.status === "em_rota" ? "Em rota" : "Aguardando"}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">🛵 {d.entregador}</p>
        <p className="text-[9px] text-muted-foreground">📍 {d.endereco}</p>
      </div>
    ))}
  </div>
);

const FinanceiroView = () => {
  const total = MOCK_ORDERS.reduce((s, o) => s + o.total, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-card border border-border/50">
          <p className="text-[9px] text-muted-foreground">Receita Total</p>
          <p className="text-base font-bold text-primary">{formatCurrency(total)}</p>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/50">
          <p className="text-[9px] text-muted-foreground">Lucro Estimado</p>
          <p className="text-base font-bold text-green-600">{formatCurrency(total * 0.7)}</p>
        </div>
      </div>
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <p className="text-[10px] font-semibold mb-2">Últimas transações</p>
        {MOCK_ORDERS.map((o) => (
          <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
            <div>
              <p className="text-[10px] font-medium">Pedido Nº {o.id}</p>
              <p className="text-[8px] text-muted-foreground">{o.cliente}</p>
            </div>
            <span className="text-[10px] font-bold text-green-600">+{formatCurrency(o.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfigView = () => (
  <div className="space-y-3">
    {[
      { label: "Nome da Loja", value: "Burger House" },
      { label: "Segmento", value: "Hamburgueria" },
      { label: "Horário", value: "18:00 - 23:00" },
      { label: "Frete fixo", value: "R$ 5,99" },
      { label: "Impressão automática", value: "Ativado" },
      { label: "Formas de pagamento", value: "PIX, Cartão, Dinheiro" },
    ].map((item) => (
      <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
        <span className="text-[10px] text-muted-foreground">{item.label}</span>
        <span className="text-[10px] font-semibold">{item.value}</span>
      </div>
    ))}
  </div>
);

// ── Main Modal ──

interface DemoPanelModalProps {
  open: boolean;
  onClose: () => void;
}

const DemoPanelModal = ({ open, onClose }: DemoPanelModalProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  if (!open) return null;

  const currentTab = tabs.find(t => t.id === activeTab)!;
  const pendingCount = MOCK_ORDERS.filter(o => o.status === "pendente").length;

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardView />;
      case "pedidos": return <PedidosView />;
      case "produtos": return <ProdutosView />;
      case "entregas": return <EntregasView />;
      case "financeiro": return <FinanceiroView />;
      case "configuracoes": return <ConfigView />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-7xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Mac Window Frame ── */}
          <div className="bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden border border-[#333]">
            {/* Title bar */}
            <div className="flex items-center h-10 px-4 bg-[#2d2d2d] border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[11px] text-[#999] font-medium">NOOV — Painel do Lojista (Demo)</span>
              </div>
              <div className="w-14" /> {/* Balance */}
            </div>

            {/* Content */}
            <div className="flex h-[90vh]">
              {/* Sidebar */}
              <div className="w-48 bg-[#1a1a2e] border-r border-[#2a2a3a] flex flex-col shrink-0">
                {/* Logo */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a3a]">
                  <Store className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-extrabold font-display text-white tracking-tight">
                    N<span className="text-secondary">O</span>OV
                  </span>
                  <span className="text-[7px] font-bold text-white/40 uppercase tracking-widest ml-0.5">Demo</span>
                </div>

                <div className="flex-1 py-2 px-2 space-y-0.5">
                  <p className="text-[8px] font-semibold text-white/40 uppercase tracking-wider px-2 mb-1">Principal</p>
                  {tabs.slice(0, 5).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-white/15 text-white"
                          : "text-white/60 hover:bg-white/10 hover:text-white/80"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.id === "pedidos" && pendingCount > 0 && (
                        <span className="ml-auto w-4 h-4 rounded-full bg-destructive text-[8px] font-bold text-white flex items-center justify-center">{pendingCount}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-[#2a2a3a] p-2">
                  <button
                    onClick={() => setActiveTab("configuracoes")}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === "configuracoes"
                        ? "bg-white/15 text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white/80"
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configurações
                  </button>
                </div>
              </div>

              {/* Main area */}
              <div className="flex-1 flex flex-col bg-background min-w-0">
                {/* Top bar */}
                <div className="h-11 flex items-center px-4 border-b border-border bg-card shrink-0">
                  <h2 className="text-sm font-bold font-display">{currentTab.label}</h2>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-[7px] font-bold text-white flex items-center justify-center">{pendingCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-primary">LD</span>
                      </div>
                      <span className="text-[10px] font-semibold">Lojista</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="h-[2px] bg-secondary shrink-0" />

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>

          {/* Demo badge */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
            <span className="text-[10px] text-white/50 font-medium">Modo demonstração — dados fictícios</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoPanelModal;