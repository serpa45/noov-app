ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS garcom_nome TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO service_role;