ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS avaliacoes_produtos_ativas BOOLEAN DEFAULT false;
