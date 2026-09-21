-- Primeiro, vamos garantir que o trigger tr_sync_pedido_numero_diario seja executado ANTES do trg_set_numero_diario
-- para que ele possa atribuir o numero_diario do PDV e o trg_set_numero_diario veja que já existe um valor.

-- No PostgreSQL, os triggers são executados em ordem alfabética.
-- Atualmente: 
-- tr_sync_pedido_numero_diario (S)
-- trg_set_numero_diario (T)
-- A ordem já está correta (S vem antes de T).

-- O problema é que o trg_set_numero_diario provavelmente não verifica se o NEW.numero_diario já está preenchido.
-- Vamos ajustar a função set_numero_diario para respeitar um número já atribuído.

CREATE OR REPLACE FUNCTION public.set_numero_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_id uuid;
BEGIN
  -- Se já houver um número (atribuído por outro trigger como o de sync do PDV), mantém ele.
  IF NEW.numero_diario IS NOT NULL AND NEW.numero_diario > 0 THEN
    RETURN NEW;
  END IF;

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
$function$;

-- Vamos ajustar também a função do PDV para ser mais robusta e evitar conflitos.
CREATE OR REPLACE FUNCTION public.set_numero_diario_pdv()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_user_id uuid;
BEGIN
  -- Se for um UPDATE e o número já existir, não altera
  IF (TG_OP = 'UPDATE' AND OLD.numero_diario IS NOT NULL) THEN
    RETURN NEW;
  END IF;

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
$function$;
