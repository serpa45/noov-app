
-- Allow lojistas to INSERT their own plan
CREATE POLICY "Lojistas can insert their plan"
ON public.loja_planos
FOR INSERT TO authenticated
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);

-- Allow lojistas to UPDATE their own plan
CREATE POLICY "Lojistas can update their plan"
ON public.loja_planos
FOR UPDATE TO authenticated
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);
