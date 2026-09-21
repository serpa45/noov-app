-- Drop the overly permissive policy for authenticated users viewing stores
DROP POLICY IF EXISTS "Authenticated can view stores by code" ON public.lojas;

-- Recreate with more specific conditions: user owns the store, is admin, or is the affiliate
CREATE POLICY "Authenticated can view relevant stores"
ON public.lojas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR afiliado_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'entregador'::app_role)
);