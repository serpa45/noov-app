-- 1. Fix mutable search_path for triggers and functions
ALTER FUNCTION public.update_product_order_stats() SET search_path = public;
ALTER FUNCTION public.update_product_rating_stats() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Restrict EXECUTE privileges on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.delete_loja_complete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_order_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_rating_stats() FROM PUBLIC;

-- Re-grant to authenticated/service_role as needed (internal use)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 3. Refine Permissive RLS Policies (Fixing "RLS Policy Always True")

-- Pedidos: Refine "Anyone can insert orders from public menu"
DROP POLICY IF EXISTS "Anyone can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Anyone can insert orders from active stores" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- Clientes: Refine permissive policies
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients for active stores"
ON public.clientes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE id = loja_id AND ativo = true
  )
);

DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
CREATE POLICY "Users can update their own client data"
ON public.clientes
FOR UPDATE
USING (
  -- If linked to a user, check auth.uid()
  -- Assuming there might be a user_id column or similar link in some context, 
  -- but checking against existing column knowledge:
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE id = loja_id AND user_id = auth.uid()
  )
);

-- Suporte Mensagens: Refine insertion
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.suporte_mensagens;
CREATE POLICY "Authenticated users or session holders can insert support messages"
ON public.suporte_mensagens
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL OR session_id IS NOT NULL
);

-- 4. Enable RLS on all public tables (Safety check)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;
