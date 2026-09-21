-- Make entregador_id nullable in entregas table
ALTER TABLE public.entregas ALTER COLUMN entregador_id DROP NOT NULL;

-- Create policy for admins to manage all deliveries
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update lojista insert policy to be more robust (it might already exist but let's make sure it's correct)
-- DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
-- CREATE POLICY "Lojistas can insert deliveries"
-- ON public.entregas FOR INSERT TO authenticated
-- WITH CHECK (lojista_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
