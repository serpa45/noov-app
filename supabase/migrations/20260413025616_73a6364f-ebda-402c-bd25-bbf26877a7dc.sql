
-- Add numero_diario column to pdv_pedidos
ALTER TABLE public.pdv_pedidos ADD COLUMN numero_diario integer;

-- Create function to set numero_diario for PDV orders, shared sequence with pedidos
CREATE OR REPLACE FUNCTION public.set_numero_diario_pdv()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_user_id uuid;
BEGIN
  -- Get the store owner's user_id from loja_id
  SELECT user_id INTO store_user_id FROM public.lojas WHERE id = NEW.loja_id;

  -- Get max numero_diario from pedidos for this store owner today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = store_user_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get max numero_diario from pdv_pedidos for this store today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = NEW.loja_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_pdv_numero_diario
BEFORE INSERT ON public.pdv_pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario_pdv();

-- Also update the original pedidos trigger to consider PDV orders
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_id uuid;
BEGIN
  -- Get max from pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get the store id for this owner
  SELECT id INTO store_id FROM public.lojas WHERE user_id = NEW.lojista_id LIMIT 1;

  -- Get max from pdv_pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = store_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
