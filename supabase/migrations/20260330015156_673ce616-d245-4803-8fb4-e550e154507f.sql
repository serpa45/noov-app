CREATE POLICY "Anon can view orders by phone"
ON public.pedidos
FOR SELECT
TO anon
USING (true);