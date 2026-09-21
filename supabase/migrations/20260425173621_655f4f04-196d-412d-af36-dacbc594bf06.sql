ALTER TABLE public.produtos 
ADD COLUMN unidade_medida TEXT NOT NULL DEFAULT 'un';

-- Add a comment for clarity
COMMENT ON COLUMN public.produtos.unidade_medida IS 'Unidade de medida do produto: un, kg, ml';