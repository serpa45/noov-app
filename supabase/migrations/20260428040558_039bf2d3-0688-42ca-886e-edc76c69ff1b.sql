-- 1. Criar a coluna pedidos_count se ela não existir
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS pedidos_count INTEGER DEFAULT 0;

-- 2. Sincronizar todos os produtos com a contagem real de vendas (pedidos concluídos/finalizados/entregues)
UPDATE public.produtos p
SET pedidos_count = (
    SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
    FROM public.pedidos ped,
    jsonb_array_elements(ped.items) elem
    WHERE (elem->>'id')::uuid = p.id
    AND ped.status IN ('concluido', 'finalizado', 'entregue')
);

-- 3. Atualizar a função do trigger para usar a coluna pedidos_count
CREATE OR REPLACE FUNCTION public.update_product_order_stats()
RETURNS TRIGGER AS $$
DECLARE
  item_record jsonb;
  product_id_var uuid;
BEGIN
  -- Se o status mudou para algo que consideramos "concluído" ou saiu desse status
  IF (TG_OP = 'INSERT' AND (NEW.status IN ('concluido', 'finalizado', 'entregue'))) OR
     (TG_OP = 'UPDATE' AND 
       ((NEW.status IN ('concluido', 'finalizado', 'entregue')) != (OLD.status IN ('concluido', 'finalizado', 'entregue')))
     )
  THEN
    -- Recalcula para os produtos no pedido atual (NEW)
    FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      BEGIN
        product_id_var := (item_record->>'id')::uuid;
        
        UPDATE public.produtos
        SET pedidos_count = (
          SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
          FROM public.pedidos p,
          jsonb_array_elements(p.items) elem
          WHERE (elem->>'id')::uuid = product_id_var
          AND p.status IN ('concluido', 'finalizado', 'entregue')
        )
        WHERE id = product_id_var;
      EXCEPTION WHEN OTHERS THEN
        -- Ignora se o ID não for um UUID válido ou produto não existir
        CONTINUE;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-aplicar o trigger
DROP TRIGGER IF EXISTS trg_update_product_order_stats ON public.pedidos;
CREATE TRIGGER trg_update_product_order_stats
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.update_product_order_stats();
