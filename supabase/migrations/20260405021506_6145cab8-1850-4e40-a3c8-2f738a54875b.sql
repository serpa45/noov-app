-- Allow public access to view orders by ID
CREATE POLICY "Anyone can view a specific order by ID"
ON public.pedidos
FOR SELECT
USING (true);

-- Allow public access to view deliveries by pedido_id
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);
