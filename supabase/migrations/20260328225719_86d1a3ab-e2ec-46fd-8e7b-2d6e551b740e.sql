
CREATE TABLE public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  categoria text,
  imagem_url text,
  disponivel boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Lojista vê produtos da sua loja
CREATE POLICY "Lojistas can view their products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode criar produtos na sua loja
CREATE POLICY "Lojistas can insert their products"
ON public.produtos FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode atualizar produtos da sua loja
CREATE POLICY "Lojistas can update their products"
ON public.produtos FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode deletar produtos da sua loja
CREATE POLICY "Lojistas can delete their products"
ON public.produtos FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Admin vê todos os produtos
CREATE POLICY "Admins can view all products"
ON public.produtos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
