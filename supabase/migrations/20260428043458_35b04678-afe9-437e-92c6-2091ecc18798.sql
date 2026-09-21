-- Create linked_products table
CREATE TABLE IF NOT EXISTS public.linked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  linked_product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, linked_product_id)
);

-- Enable RLS
ALTER TABLE public.linked_products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Lojistas can manage linked products for their own store"
ON public.linked_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = public.linked_products.loja_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view linked products"
ON public.linked_products
FOR SELECT
USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_linked_products_product_id ON public.linked_products(product_id);
CREATE INDEX IF NOT EXISTS idx_linked_products_loja_id ON public.linked_products(loja_id);
