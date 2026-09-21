ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.pdv_mesas(id);
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pdv_pedidos TO service_role;
GRANT ALL ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO anon;