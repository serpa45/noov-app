CREATE POLICY "Anyone can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO anon
WITH CHECK (true);