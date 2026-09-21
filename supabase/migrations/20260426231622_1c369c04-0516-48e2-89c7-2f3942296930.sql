-- Function to normalize strings for comparison (lowercase and trim)
-- We'll use this to match client neighborhoods with the corrected ones in loja_frete_bairros

UPDATE public.clientes c
SET endereco_bairro = fb.bairro
FROM public.loja_frete_bairros fb
WHERE c.loja_id = fb.loja_id
AND lower(trim(c.endereco_bairro)) = lower(trim(fb.bairro))
AND c.endereco_bairro != fb.bairro;

-- Also update any orders that might have the old names if we want to be thorough
-- But the user specifically mentioned "clientes"
