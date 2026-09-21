
CREATE TABLE public.entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL,
  lojista_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  endereco_coleta text,
  endereco_entrega text,
  valor_entrega numeric(10,2) NOT NULL DEFAULT 0,
  observacoes text,
  aceita_em timestamp with time zone,
  finalizada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Entregador vê suas próprias entregas
CREATE POLICY "Entregadores can view their own deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (entregador_id = auth.uid());

-- Entregador pode atualizar suas entregas (aceitar, finalizar)
CREATE POLICY "Entregadores can update their own deliveries"
ON public.entregas FOR UPDATE TO authenticated
USING (entregador_id = auth.uid())
WITH CHECK (entregador_id = auth.uid());

-- Lojista vê entregas da sua loja
CREATE POLICY "Lojistas can view their store deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

-- Lojista pode criar entregas
CREATE POLICY "Lojistas can insert deliveries"
ON public.entregas FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

-- Admin vê todas
CREATE POLICY "Admins can view all deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
