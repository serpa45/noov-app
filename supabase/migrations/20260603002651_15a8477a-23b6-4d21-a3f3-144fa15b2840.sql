-- Remover política insegura de UPDATE (era aplicada à role 'public', incluindo anônimos)
DROP POLICY IF EXISTS "Users can update their own client data" ON public.clientes;
DROP POLICY IF EXISTS "Qualquer pessoa pode atualizar os dados dos clientes" ON public.clientes;

-- Nova política: apenas lojistas donos da loja do cliente, ou admins, podem atualizar
CREATE POLICY "Lojistas can update their store clients"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
