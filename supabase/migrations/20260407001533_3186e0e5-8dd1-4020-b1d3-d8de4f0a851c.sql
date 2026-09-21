
-- Table to link garcons to stores (similar to loja_entregadores)
CREATE TABLE IF NOT EXISTS public.loja_garcons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  garcom_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(loja_id, garcom_id)
);

ALTER TABLE public.loja_garcons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view their store garcons"
ON public.loja_garcons FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can delete their store garcons"
ON public.loja_garcons FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Garcons can insert their links"
ON public.loja_garcons FOR INSERT TO authenticated
WITH CHECK (garcom_id = auth.uid());

CREATE POLICY "Garcons can view their links"
ON public.loja_garcons FOR SELECT TO authenticated
USING (garcom_id = auth.uid());

-- Update pdv_pedidos RLS to allow garcons linked via loja_garcons
CREATE POLICY "Garcons can manage PDV orders for their stores"
ON public.pdv_pedidos FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view mesas of their stores
CREATE POLICY "Garcons can view their store mesas"
ON public.pdv_mesas FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view products of their stores
CREATE POLICY "Garcons can view their store products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));
