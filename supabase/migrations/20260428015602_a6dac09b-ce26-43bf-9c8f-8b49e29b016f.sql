-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Anyone can view product ratings" ON public.product_ratings;
DROP POLICY IF EXISTS "Anyone can create product ratings" ON public.product_ratings;

-- Criar política para visualização: Permitir apenas se o produto pertencer a uma loja ativa que permite avaliações
CREATE POLICY "Clientes podem ver avaliações de produtos da loja atual" 
ON public.product_ratings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    JOIN public.lojas l ON p.loja_id = l.id
    WHERE p.id = product_ratings.product_id
    AND l.avaliacoes_produtos_ativas = true
  )
);

-- Criar política para inserção: Garantir que o produto existe
CREATE POLICY "Clientes podem criar avaliações para produtos existentes" 
ON public.product_ratings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = product_ratings.product_id
  )
);