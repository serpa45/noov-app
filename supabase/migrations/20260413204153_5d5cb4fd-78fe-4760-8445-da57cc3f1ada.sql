CREATE POLICY "Lojistas can delete their store clients"
ON public.clientes
FOR DELETE
TO authenticated
USING (
  (loja_id IN (SELECT lojas.id FROM lojas WHERE lojas.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);