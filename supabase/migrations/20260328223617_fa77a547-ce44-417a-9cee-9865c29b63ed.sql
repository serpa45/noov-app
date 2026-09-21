
-- Tabela de pedidos
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid NOT NULL,
  cliente_nome text,
  cliente_telefone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  total numeric(10,2) NOT NULL DEFAULT 0,
  endereco_entrega text,
  tipo text NOT NULL DEFAULT 'delivery',
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view their own orders"
ON public.pedidos FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Lojistas can insert their own orders"
ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

CREATE POLICY "Lojistas can update their own orders"
ON public.pedidos FOR UPDATE TO authenticated
USING (lojista_id = auth.uid())
WITH CHECK (lojista_id = auth.uid());

CREATE POLICY "Lojistas can delete their own orders"
ON public.pedidos FOR DELETE TO authenticated
USING (lojista_id = auth.uid());

-- Admins podem ver todos os pedidos
CREATE POLICY "Admins can view all orders"
ON public.pedidos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
