-- Add daily order number column
ALTER TABLE public.pedidos ADD COLUMN numero_diario integer;

-- Create function to auto-assign daily sequential number per lojista
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(numero_diario), 0) + 1
  INTO next_num
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_set_numero_diario
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario();