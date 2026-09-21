-- Add location to deliveries
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS latitude_atual NUMERIC;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS longitude_atual NUMERIC;

-- Add location to orders for the delivery target
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS latitude_entrega NUMERIC;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS longitude_entrega NUMERIC;

-- Enable RLS for entregas
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to be safe)
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;

-- Policies for 'entregas'
-- Lojistas can see and create deliveries for their store
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- Entregadores can see available deliveries or deliveries assigned to them
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)
);

-- Entregadores can update their own deliveries
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
USING (entregador_id = auth.uid() OR (entregador_id IS NULL AND auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)));
