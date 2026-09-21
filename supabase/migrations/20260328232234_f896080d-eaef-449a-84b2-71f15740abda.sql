
-- Drop existing entregador SELECT policy
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;

-- New policy: entregadores see deliveries assigned to them AND from stores they're linked to
CREATE POLICY "Entregadores can view linked store deliveries"
  ON public.entregas FOR SELECT
  TO authenticated
  USING (
    entregador_id = auth.uid()
    AND lojista_id IN (
      SELECT l.user_id FROM public.lojas l
      INNER JOIN public.loja_entregadores le ON le.loja_id = l.id
      WHERE le.entregador_id = auth.uid()
    )
  );

-- Drop existing entregador UPDATE policy  
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;

-- New policy: entregadores can update only deliveries from linked stores
CREATE POLICY "Entregadores can update linked store deliveries"
  ON public.entregas FOR UPDATE
  TO authenticated
  USING (
    entregador_id = auth.uid()
    AND lojista_id IN (
      SELECT l.user_id FROM public.lojas l
      INNER JOIN public.loja_entregadores le ON le.loja_id = l.id
      WHERE le.entregador_id = auth.uid()
    )
  )
  WITH CHECK (
    entregador_id = auth.uid()
  );

-- Update lojista INSERT policy to ensure entregador is linked
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;

CREATE POLICY "Lojistas can insert deliveries to linked entregadores"
  ON public.entregas FOR INSERT
  TO authenticated
  WITH CHECK (
    lojista_id = auth.uid()
    AND entregador_id IN (
      SELECT le.entregador_id FROM public.loja_entregadores le
      INNER JOIN public.lojas l ON l.id = le.loja_id
      WHERE l.user_id = auth.uid()
    )
  );
