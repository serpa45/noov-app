-- Criar o trigger faltante para sincronizar rating_average e rating_count
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

CREATE TRIGGER trg_update_product_rating_stats
AFTER INSERT OR DELETE ON public.product_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating_stats();

-- Backfill: recalcular média e contagem para produtos que já possuem avaliações
UPDATE public.produtos p
SET 
  rating_average = COALESCE(stats.avg_rating, 0),
  rating_count = COALESCE(stats.count_ratings, 0)
FROM (
  SELECT 
    product_id,
    AVG(rating)::numeric(3,2) AS avg_rating,
    COUNT(*) AS count_ratings
  FROM public.product_ratings
  GROUP BY product_id
) stats
WHERE p.id = stats.product_id;