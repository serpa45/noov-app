-- Ajustar políticas para a tabela produtos
DROP POLICY IF EXISTS "Lojistas can insert their products" ON public.produtos;
CREATE POLICY "Lojistas can insert their products" ON public.produtos 
FOR INSERT TO authenticated 
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Ajustar políticas para a tabela loja_adicionais
DROP POLICY IF EXISTS "Users can insert addons for their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can insert addons for their own stores" ON public.loja_adicionais 
FOR INSERT TO authenticated 
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update addons from their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can update addons from their own stores" ON public.loja_adicionais 
FOR UPDATE TO authenticated 
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Ajustar políticas para a tabela loja_categoria_imagens
DROP POLICY IF EXISTS "Lojista can manage own category images" ON public.loja_categoria_imagens;
CREATE POLICY "Lojista can manage own category images" ON public.loja_categoria_imagens 
FOR ALL TO authenticated 
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Garantir acesso ao bucket de imagens
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
CREATE POLICY "Users can update own product images" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);