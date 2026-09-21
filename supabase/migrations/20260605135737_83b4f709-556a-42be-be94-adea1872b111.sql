ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pedidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT SELECT ON public.pedidos TO anon;
