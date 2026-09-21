GRANT SELECT ON public.loja_categoria_imagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_categoria_imagens TO authenticated;
GRANT ALL ON public.loja_categoria_imagens TO service_role;

DROP POLICY IF EXISTS "Anyone can view category images" ON public.loja_categoria_imagens;
CREATE POLICY "Anyone can view category images"
ON public.loja_categoria_imagens
FOR SELECT
TO anon, authenticated
USING (true);