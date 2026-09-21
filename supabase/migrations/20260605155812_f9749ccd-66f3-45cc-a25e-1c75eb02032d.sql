ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pdv_pedido_id UUID REFERENCES public.pdv_pedidos(id) ON DELETE SET NULL;

-- Criar ou substituir a função de trigger para sincronizar o numero_diario
CREATE OR REPLACE FUNCTION public.sync_pedido_numero_diario()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pdv_pedido_id IS NOT NULL THEN
    -- Busca o numero_diario do pdv_pedido
    SELECT numero_diario INTO NEW.numero_diario
    FROM public.pdv_pedidos
    WHERE id = NEW.pdv_pedido_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar trigger à tabela pedidos
DROP TRIGGER IF EXISTS tr_sync_pedido_numero_diario ON public.pedidos;
CREATE TRIGGER tr_sync_pedido_numero_diario
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.sync_pedido_numero_diario();