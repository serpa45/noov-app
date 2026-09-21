-- Alterar o padrão das colunas para 0.5
ALTER TABLE public.lojas ALTER COLUMN margem_esquerda SET DEFAULT 0.5;
ALTER TABLE public.lojas ALTER COLUMN margem_direita SET DEFAULT 0.5;

-- Atualizar registros existentes onde as margens estão como 0 (assumindo que 0 era o padrão anterior)
UPDATE public.lojas 
SET margem_esquerda = 0.5 
WHERE margem_esquerda = 0 OR margem_esquerda IS NULL;

UPDATE public.lojas 
SET margem_direita = 0.5 
WHERE margem_direita = 0 OR margem_direita IS NULL;