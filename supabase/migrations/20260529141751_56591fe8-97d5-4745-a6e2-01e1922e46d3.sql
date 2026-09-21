-- 1. Refine Pedidos policies for Authenticated users
DROP POLICY IF EXISTS "Authenticated can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Authenticated can insert orders from active stores" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- 2. Refine Order Rating update policy
DROP POLICY IF EXISTS "Anon can update order rating" ON public.pedidos;
CREATE POLICY "Anyone can update order rating if active store"
ON public.pedidos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- 3. Refine Coupon usage policy
DROP POLICY IF EXISTS "Inserção pública de uso de cupom" ON public.uso_cupons;
CREATE POLICY "Public coupon usage for active stores"
ON public.uso_cupons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.lojas l ON l.user_id = p.lojista_id
    WHERE p.id = pedido_id AND l.ativo = true
  )
);
