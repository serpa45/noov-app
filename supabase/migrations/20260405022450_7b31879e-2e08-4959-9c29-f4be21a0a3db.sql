-- Cleanup and standardize entregas policies
DROP POLICY IF EXISTS "Lojistas can view their store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries to linked entregadores" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;

-- 1. Lojistas can see and create deliveries for their store
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id))
WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- 2. Entregadores can see available deliveries or deliveries assigned to them or from their linked stores
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
TO authenticated
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid())
);

-- 3. Entregadores can update their own deliveries or accept available ones from linked stores
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
TO authenticated
USING (
  entregador_id = auth.uid() OR 
  (entregador_id IS NULL AND lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid()))
);

-- 4. Admins can manage all
-- (Already exists in some migrations, but let's ensure it's there and correct)
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.entregas;
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Public access for tracking (already exists, but ensuring)
DROP POLICY IF EXISTS "Anyone can view a delivery by pedido_id" ON public.entregas;
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);
