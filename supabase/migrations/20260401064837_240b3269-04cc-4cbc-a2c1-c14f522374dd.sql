CREATE TABLE public.pix_split_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pdv_pedidos(id) ON DELETE SET NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  valor_plataforma NUMERIC NOT NULL DEFAULT 0,
  valor_lojista NUMERIC NOT NULL DEFAULT 0,
  payment_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo TEXT NOT NULL DEFAULT 'pix',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_split_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all pix split payments"
  ON public.pix_split_pagamentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lojistas can view their pix split payments"
  ON public.pix_split_pagamentos FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "System can insert pix split payments"
  ON public.pix_split_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pix_split_pagamentos_updated_at
  BEFORE UPDATE ON public.pix_split_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();