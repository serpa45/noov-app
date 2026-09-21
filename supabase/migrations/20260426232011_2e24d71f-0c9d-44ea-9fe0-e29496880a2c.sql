-- Allow authenticated users to view stores by slug (currently only anon can)
DROP POLICY IF EXISTS "Anyone can view stores by slug" ON public.lojas;
CREATE POLICY "Anyone can view stores by slug" 
ON public.lojas 
FOR SELECT 
USING (true); -- This replaces the previous anon-only policy and makes it public

-- Allow authenticated users to view clients (matching anon policy)
DROP POLICY IF EXISTS "Anon can select clients" ON public.clientes;
CREATE POLICY "Anyone can select clients" 
ON public.clientes 
FOR SELECT 
USING (true); -- This allows both anon and authenticated users to see clients

-- Ensure insert policy is clear
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);
