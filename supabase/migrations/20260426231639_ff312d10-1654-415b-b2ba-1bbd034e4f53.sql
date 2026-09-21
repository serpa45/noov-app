-- Update the frete_bairros JSON column in the lojas table
-- to match the current state of the loja_frete_bairros table
WITH updated_bairros AS (
    SELECT 
        loja_id, 
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'bairro', bairro,
                'valor', valor
            )
        ) as bairros_json
    FROM public.loja_frete_bairros
    GROUP BY loja_id
)
UPDATE public.lojas l
SET frete_bairros = ub.bairros_json
FROM updated_bairros ub
WHERE l.id = ub.loja_id;
