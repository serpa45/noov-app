CREATE POLICY "Authenticated can view all store products"
ON public.produtos
FOR SELECT
TO authenticated
USING (true);