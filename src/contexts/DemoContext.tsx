import React, { createContext, useContext, useState, useCallback } from "react";

// ── Mock Data ──

const DEMO_STORE = {
  id: "demo-store-001",
  user_id: "demo-user-001",
  nome: "Burger House Demo",
  slug: "demo-burger-house",
  segmento: "hamburgueria",
  logo_url: "",
  banner_url: "",
  ativo: true,
  codigo_convite: "DEMO01",
  cor_primaria: "#2563EB",
  cor_secundaria: "#F97316",
  tempo_entrega_min: 30,
  tempo_entrega_max: 45,
  frete_valor_fixo: 5.99,
  frete_tipo: "fixo",
  dias_teste_extra: 0,
  formas_pagamento: ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"],
  horario_funcionamento: {
    segunda: { aberto: true, inicio: "18:00", fim: "23:00" },
    terca: { aberto: true, inicio: "18:00", fim: "23:00" },
    quarta: { aberto: true, inicio: "18:00", fim: "23:00" },
    quinta: { aberto: true, inicio: "18:00", fim: "23:00" },
    sexta: { aberto: true, inicio: "18:00", fim: "00:00" },
    sabado: { aberto: true, inicio: "17:00", fim: "00:00" },
    domingo: { aberto: true, inicio: "17:00", fim: "22:00" },
  },
  endereco_rua: "Rua Exemplo",
  endereco_numero: "123",
  endereco_bairro: "Centro",
  endereco_cidade: "São Paulo",
  endereco_estado: "SP",
  endereco_cep: "01000-000",
  categorias_ordem: ["Hambúrgueres", "Bebidas", "Sobremesas"],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_PRODUCTS = [
  {
    id: "demo-prod-1",
    loja_id: "demo-store-001",
    nome: "Smash Burger Clássico",
    descricao: "Pão brioche, 2 smash burgers 90g, queijo cheddar, cebola caramelizada e molho especial",
    preco: 28.90,
    categoria: "Hambúrgueres",
    imagem_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: false,
    tag_sugestao: true,
    tag_destaque: true,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [
      { nome: "Bacon extra", preco: 4.00 },
      { nome: "Queijo extra", preco: 3.00 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-2",
    loja_id: "demo-store-001",
    nome: "Burger Bacon Supreme",
    descricao: "Pão australiano, burger 180g, bacon crocante, queijo prato, alface, tomate e maionese da casa",
    preco: 34.90,
    categoria: "Hambúrgueres",
    imagem_url: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: true,
    tag_sugestao: false,
    tag_destaque: false,
    preco_promocional: 29.90,
    promocao_validade: null,
    adicionais: [
      { nome: "Ovo", preco: 3.00 },
      { nome: "Cebola crispy", preco: 2.50 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-3",
    loja_id: "demo-store-001",
    nome: "Chicken Burger",
    descricao: "Pão com gergelim, frango empanado crocante, salada coleslaw e molho ranch",
    preco: 26.90,
    categoria: "Hambúrgueres",
    imagem_url: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: false,
    tag_sugestao: false,
    tag_destaque: false,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-4",
    loja_id: "demo-store-001",
    nome: "Coca-Cola 350ml",
    descricao: "Lata gelada",
    preco: 6.00,
    categoria: "Bebidas",
    imagem_url: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: false,
    tag_sugestao: false,
    tag_destaque: false,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-5",
    loja_id: "demo-store-001",
    nome: "Suco Natural Laranja",
    descricao: "500ml - feito na hora",
    preco: 10.00,
    categoria: "Bebidas",
    imagem_url: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: false,
    tag_sugestao: true,
    tag_destaque: false,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-6",
    loja_id: "demo-store-001",
    nome: "Brownie com Sorvete",
    descricao: "Brownie quentinho com bola de sorvete de creme e calda de chocolate",
    preco: 18.90,
    categoria: "Sobremesas",
    imagem_url: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: false,
    tag_sugestao: false,
    tag_destaque: true,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [
      { nome: "Bola extra de sorvete", preco: 5.00 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-prod-7",
    loja_id: "demo-store-001",
    nome: "Milkshake Ovomaltine",
    descricao: "400ml de milkshake cremoso com Ovomaltine",
    preco: 16.90,
    categoria: "Sobremesas",
    imagem_url: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    disponivel: true,
    tag_novo: true,
    tag_sugestao: false,
    tag_destaque: false,
    preco_promocional: null,
    promocao_validade: null,
    adicionais: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEMO_ORDERS = [
  {
    id: "demo-order-1",
    lojista_id: "demo-user-001",
    cliente_nome: "Maria Silva",
    cliente_telefone: "(11) 99999-1234",
    status: "pendente",
    tipo: "delivery",
    total: 63.80,
    items: [
      { nome: "Smash Burger Clássico", quantidade: 2, preco: 28.90 },
      { nome: "Coca-Cola 350ml", quantidade: 1, preco: 6.00 },
    ],
    endereco_entrega: "Rua das Flores, 456 - Centro",
    observacoes: "Sem cebola no burger",
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: "demo-order-2",
    lojista_id: "demo-user-001",
    cliente_nome: "João Pereira",
    cliente_telefone: "(11) 98888-5678",
    status: "preparando",
    tipo: "delivery",
    total: 34.90,
    items: [
      { nome: "Burger Bacon Supreme", quantidade: 1, preco: 34.90 },
    ],
    endereco_entrega: "Av. Brasil, 789 - Jardim América",
    observacoes: null,
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "demo-order-3",
    lojista_id: "demo-user-001",
    cliente_nome: "Ana Costa",
    cliente_telefone: "(11) 97777-9012",
    status: "entregue",
    tipo: "balcao",
    total: 45.80,
    items: [
      { nome: "Chicken Burger", quantidade: 1, preco: 26.90 },
      { nome: "Brownie com Sorvete", quantidade: 1, preco: 18.90 },
    ],
    endereco_entrega: null,
    observacoes: null,
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 90 * 60000).toISOString(),
  },
];

const DEMO_PROFILE = {
  id: "demo-profile-001",
  user_id: "demo-user-001",
  full_name: "Lojista Demo",
  email: "demo@noov.com.br",
  phone: "(11) 99999-0000",
  avatar_url: null,
  codigo_afiliado: null,
  codigo_acesso: null,
  codigo_admin: null,
  pix_tipo: "cpf",
  pix_chave: "123.456.789-00",
  pix_nome_favorecido: "Lojista Demo",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Context ──

interface DemoContextType {
  isDemoMode: boolean;
  demoType: "lojista" | "cliente" | null;
  store: typeof DEMO_STORE;
  products: typeof DEMO_PRODUCTS;
  orders: typeof DEMO_ORDERS;
  deliveries: any[];
  profile: typeof DEMO_PROFILE;
  setProducts: React.Dispatch<React.SetStateAction<typeof DEMO_PRODUCTS>>;
  setOrders: React.Dispatch<React.SetStateAction<typeof DEMO_ORDERS>>;
  setDeliveries: React.Dispatch<React.SetStateAction<any[]>>;
  addProduct: (product: any) => void;
  updateProduct: (id: string, updates: any) => void;
  deleteProduct: (id: string) => void;
  updateOrderStatus: (id: string, status: string) => void;
  assignDelivery: (deliveryId: string, driverId: string) => void;
}

const DemoContext = createContext<DemoContextType | null>(null);

export const useDemo = () => {
  const ctx = useContext(DemoContext);
  return ctx;
};

export const useDemoRequired = () => {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemoRequired must be used within DemoProvider");
  return ctx;
};

interface DemoProviderProps {
  children: React.ReactNode;
  demoType: "lojista" | "cliente";
}

export const DemoProvider = ({ children, demoType }: DemoProviderProps) => {
  const [products, setProducts] = useState([...DEMO_PRODUCTS]);
  const [orders, setOrders] = useState([...DEMO_ORDERS]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const addProduct = useCallback((product: any) => {
    const newProd = {
      ...product,
      id: `demo-prod-${Date.now()}`,
      loja_id: DEMO_STORE.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setProducts((prev) => [...prev, newProd]);
  }, []);

  const updateProduct = useCallback((id: string, updates: any) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p))
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateOrderStatus = useCallback((id: string, status: string) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          // If advancing to "em_entrega", create a mock delivery record
          if (status === "em_entrega") {
            const existing = deliveries.find(d => d.pedido_id === id);
            if (!existing) {
              const newDelivery = {
                id: `demo-del-${Date.now()}`,
                pedido_id: id,
                lojista_id: o.lojista_id,
                status: "pendente",
                endereco_entrega: o.endereco_entrega,
                valor_entrega: 5.0,
                created_at: new Date().toISOString(),
                pedido: o,
              };
              setDeliveries(prevD => [...prevD, newDelivery]);
            }
          }
          return { ...o, status, updated_at: new Date().toISOString() };
        }
        return o;
      })
    );
  }, [deliveries]);

  const assignDelivery = useCallback((deliveryId: string, driverId: string) => {
    setDeliveries(prev => 
      prev.map(d => d.id === deliveryId ? { ...d, status: "aceita", entregador_id: driverId } : d)
    );
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemoMode: true,
        demoType,
        store: DEMO_STORE,
        products,
        orders,
        deliveries,
        profile: DEMO_PROFILE,
        setProducts,
        setOrders,
        setDeliveries,
        addProduct,
        updateProduct,
        deleteProduct,
        updateOrderStatus,
        assignDelivery,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export { DEMO_STORE, DEMO_PRODUCTS, DEMO_ORDERS, DEMO_PROFILE };
