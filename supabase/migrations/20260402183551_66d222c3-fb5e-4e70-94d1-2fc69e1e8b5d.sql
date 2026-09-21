CREATE POLICY "Authenticated can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (true);