
-- Add pizza-specific fields to produtos table
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tamanhos jsonb DEFAULT NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS max_sabores integer DEFAULT NULL;

-- tamanhos example: [{"nome": "Média (6 fatias)", "preco": 38}, {"nome": "Grande (8 fatias)", "preco": 48}]
-- max_sabores: maximum number of flavors allowed (e.g. 2 for Grande, 1 for Broto)
