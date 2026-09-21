
-- Mesas do PDV
CREATE TABLE public.pdv_mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  lugares integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'livre',
  pedido_atual_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage their tables" ON public.pdv_mesas
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pedidos do PDV
CREATE TABLE public.pdv_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id uuid REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  pagamento_status text NOT NULL DEFAULT 'aberto',
  metodo_pagamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage their PDV orders" ON public.pdv_pedidos
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pagamentos parciais do PDV
CREATE TABLE public.pdv_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pdv_pedidos(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  metodo text NOT NULL DEFAULT 'dinheiro',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage PDV payments" ON public.pdv_pagamentos
  FOR ALL TO authenticated
  USING (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_pedidos;

-- Triggers for updated_at
CREATE TRIGGER update_pdv_mesas_updated_at BEFORE UPDATE ON public.pdv_mesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pdv_pedidos_updated_at BEFORE UPDATE ON public.pdv_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
