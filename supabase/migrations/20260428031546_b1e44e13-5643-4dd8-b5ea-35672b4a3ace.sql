-- Add ranking_ativo column to lojas table
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS ranking_ativo BOOLEAN DEFAULT true;

-- Update the comment to describe the column
COMMENT ON COLUMN public.lojas.ranking_ativo IS 'Define se o menu de ranking de produtos mais pedidos deve ser exibido no cardápio do cliente.';