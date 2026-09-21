
-- Remove lojista INSERT/UPDATE policies on loja_planos (only admin should manage)
DROP POLICY IF EXISTS "Lojistas can insert their plan" ON public.loja_planos;
DROP POLICY IF EXISTS "Lojistas can update their plan" ON public.loja_planos;
