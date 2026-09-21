
-- Create a table to track individual payments
CREATE TABLE public.pagamentos_loja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id),
  plano_nome TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  metodo TEXT NOT NULL DEFAULT 'mercadopago',
  status TEXT NOT NULL DEFAULT 'aprovado',
  payment_external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_loja ENABLE ROW LEVEL SECURITY;

-- Lojistas can view their own payments
CREATE POLICY "Lojistas can view their payments"
  ON public.pagamentos_loja
  FOR SELECT
  TO authenticated
  USING (
    loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  );

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
  ON public.pagamentos_loja
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert the first payment for each store that has an active plan (these are realized payments)
INSERT INTO public.pagamentos_loja (loja_id, plano_id, plano_nome, valor, metodo, status, created_at)
SELECT 
  lp.loja_id, 
  lp.plano_id, 
  p.nome, 
  lp.preco_assinado, 
  'mercadopago', 
  'aprovado', 
  lp.assinado_em
FROM loja_planos lp
LEFT JOIN planos p ON p.id = lp.plano_id
WHERE lp.ativo = true;
