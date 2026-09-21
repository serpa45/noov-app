
CREATE TABLE public.loja_categoria_imagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, categoria)
);

ALTER TABLE public.loja_categoria_imagens ENABLE ROW LEVEL SECURITY;

-- Lojista can manage their own category images
CREATE POLICY "Lojista can manage own category images"
  ON public.loja_categoria_imagens
  FOR ALL
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Anyone can view category images (for client menu)
CREATE POLICY "Anyone can view category images"
  ON public.loja_categoria_imagens
  FOR SELECT
  TO anon
  USING (true);
