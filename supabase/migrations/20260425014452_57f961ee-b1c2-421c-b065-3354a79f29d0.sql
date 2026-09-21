-- First, let's clean up the overly permissive policies for 'produtos' table
DROP POLICY IF EXISTS "Authenticated can view all store products" ON public.produtos;
DROP POLICY IF EXISTS "Admins can view all products" ON public.produtos;

-- Ensure the existing policies are correct and secure
-- Public can view products (needed for the menu)
-- Note: It's better to filter by loja_id in the query, but the policy allows viewing
DROP POLICY IF EXISTS "Anyone can view store products" ON public.produtos;
CREATE POLICY "Anyone can view store products" 
ON public.produtos 
FOR SELECT 
USING (true);

-- Lojistas can see their own products
DROP POLICY IF EXISTS "Lojistas can view their products" ON public.produtos;
CREATE POLICY "Lojistas can view their products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

-- Garcons can see their store products
DROP POLICY IF EXISTS "Garcons can view their store products" ON public.produtos;
CREATE POLICY "Garcons can view their store products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Ensure RLS is enabled
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
