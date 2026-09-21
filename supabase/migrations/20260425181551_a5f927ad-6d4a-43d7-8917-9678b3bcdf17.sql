ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS categorias_ocultas JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.categorias_ocultas IS 'Lista de nomes de categorias padrão que o lojista deseja ocultar em sua loja.';