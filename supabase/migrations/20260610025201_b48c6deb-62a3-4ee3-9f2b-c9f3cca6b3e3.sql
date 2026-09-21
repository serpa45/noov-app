ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;