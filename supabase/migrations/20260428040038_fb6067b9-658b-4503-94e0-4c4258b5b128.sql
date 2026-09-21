-- Drop duplicate triggers
DROP TRIGGER IF EXISTS tr_update_product_rating_stats ON public.product_ratings;
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

-- Recriar função para ser mais robusta e evitar erros de arredondamento/incremento manual falho
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular média e contagem baseado na tabela real para evitar desvios
    UPDATE public.produtos
    SET 
        rating_count = (SELECT count(*) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
        rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)), 0)
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar apenas um trigger
CREATE TRIGGER tr_update_product_rating_stats
AFTER INSERT OR DELETE OR UPDATE ON public.product_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

-- Sincronizar todos os produtos agora para corrigir dados errados
UPDATE public.produtos p
SET 
    rating_count = (SELECT count(*) FROM public.product_ratings pr WHERE pr.product_id = p.id),
    rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings pr WHERE pr.product_id = p.id), 0);
