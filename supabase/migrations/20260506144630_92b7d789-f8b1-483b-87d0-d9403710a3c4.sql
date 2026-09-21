ALTER TABLE public.cupons 
ADD COLUMN uso_unico BOOLEAN DEFAULT true;

-- Atualizar a descrição da política ou garantir que as políticas existentes cubram a nova coluna (geralmente cobrem se for SELECT *)
-- Se houver necessidade de atualizar caches ou triggers, pode ser feito aqui.
