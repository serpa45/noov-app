
-- Add loja_id column to clientes
ALTER TABLE public.clientes ADD COLUMN loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can select by phone" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clientes;

-- Anon can insert clients (from public menu)
CREATE POLICY "Anyone can insert clients"
ON public.clientes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon can select clients by phone (for login flow on public menu)
CREATE POLICY "Anon can select clients"
ON public.clientes FOR SELECT
TO anon
USING (true);

-- Lojistas can only view clients linked to their store
CREATE POLICY "Lojistas can view their store clients"
ON public.clientes FOR SELECT
TO authenticated
USING (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Anyone can update clients
CREATE POLICY "Anyone can update clients"
ON public.clientes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
