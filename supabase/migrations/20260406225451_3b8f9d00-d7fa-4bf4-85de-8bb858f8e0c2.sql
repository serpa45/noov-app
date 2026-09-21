CREATE POLICY "Entregadores can update orders linked to their deliveries"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
)
WITH CHECK (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
);