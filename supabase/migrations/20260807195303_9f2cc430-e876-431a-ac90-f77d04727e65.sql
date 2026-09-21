ALTER TABLE public.lojas ALTER COLUMN margem_esquerda SET DEFAULT 3.0;
ALTER TABLE public.lojas ALTER COLUMN margem_direita SET DEFAULT 3.0;

UPDATE public.lojas 
SET margem_esquerda = 3.0, 
    margem_direita = 3.0
WHERE (margem_esquerda IN (0, 0.5) OR margem_esquerda IS NULL)
  OR (margem_direita IN (0, 0.5) OR margem_direita IS NULL);