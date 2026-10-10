-- One transaction: activation, invoice and commission either all commit or all retry.
CREATE OR REPLACE FUNCTION public.process_plan_payment(
  p_payment_id text, p_loja_id uuid, p_plano_id uuid, p_amount numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan public.planos%ROWTYPE;
  v_current public.loja_planos%ROWTYPE;
  v_affiliate uuid;
  v_percent numeric;
  v_expiration timestamptz;
  v_promo integer := 0;
BEGIN
  IF p_payment_id IS NULL OR btrim(p_payment_id) = '' OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payment';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('plan-payment:' || p_payment_id, 0));
  IF EXISTS (SELECT 1 FROM public.pagamentos_loja WHERE payment_external_id = p_payment_id) THEN
    RETURN;
  END IF;
  -- Serialize different payments for the same store so renewal dates are not lost.
  SELECT afiliado_id INTO v_affiliate FROM public.lojas WHERE id = p_loja_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;
  SELECT * INTO v_plan FROM public.planos WHERE id = p_plano_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  SELECT * INTO v_current FROM public.loja_planos WHERE loja_id = p_loja_id;
  v_expiration := now();
  IF v_current.ativo AND v_current.expira_em > now() THEN
    v_expiration := v_current.expira_em;
  END IF;
  IF v_current.plano_id = p_plano_id THEN
    v_promo := coalesce(v_current.promo_pagamentos_feitos, 0);
  END IF;
  IF v_plan.preco_promocional IS NOT NULL AND p_amount = v_plan.preco_promocional THEN
    v_promo := v_promo + 1;
  END IF;
  INSERT INTO public.loja_planos (loja_id, plano_id, preco_assinado, features_assinado,
    limites_assinado, ativo, assinado_em, expira_em, promo_pagamentos_feitos)
  VALUES (p_loja_id, p_plano_id, p_amount, v_plan.features, v_plan.limites,
    true, now(), v_expiration + interval '30 days', v_promo)
  ON CONFLICT (loja_id) DO UPDATE SET
    plano_id = EXCLUDED.plano_id, preco_assinado = EXCLUDED.preco_assinado,
    features_assinado = EXCLUDED.features_assinado, limites_assinado = EXCLUDED.limites_assinado,
    ativo = true, assinado_em = EXCLUDED.assinado_em, expira_em = EXCLUDED.expira_em,
    promo_pagamentos_feitos = EXCLUDED.promo_pagamentos_feitos;

  INSERT INTO public.pagamentos_loja (loja_id, plano_id, plano_nome, valor, metodo, status, payment_external_id)
  VALUES (p_loja_id, p_plano_id, v_plan.nome, p_amount, 'mercadopago', 'aprovado', p_payment_id);

  IF v_affiliate IS NOT NULL THEN
    SELECT comissao_percent INTO v_percent FROM public.profiles WHERE user_id = v_affiliate;
    IF v_percent IS NULL THEN
      SELECT nullif(valor, '')::numeric INTO v_percent FROM public.configuracoes_globais
      WHERE chave = 'comissao_afiliado_percent';
    END IF;
    v_percent := coalesce(v_percent, 10);
    IF v_percent > 0 THEN
      INSERT INTO public.comissoes (afiliado_id, loja_id, valor_pedido, percentual, valor_comissao, status)
      VALUES (v_affiliate, p_loja_id, p_amount, v_percent, round(p_amount * v_percent / 100, 2), 'pendente');
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.process_plan_payment(text, uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_plan_payment(text, uuid, uuid, numeric) TO service_role;

-- Validate every insert in the database, including simultaneous withdrawal requests.
CREATE OR REPLACE FUNCTION public.validate_affiliate_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_available numeric;
BEGIN
  IF NEW.valor IS NULL OR NEW.valor <= 0 OR NEW.valor <> round(NEW.valor, 2) THEN
    RAISE EXCEPTION 'Informe um valor válido com até duas casas decimais';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('affiliate-withdrawal:' || NEW.afiliado_id::text, 0));
  SELECT coalesce((SELECT sum(round(valor_comissao, 2)) FROM public.comissoes WHERE afiliado_id = NEW.afiliado_id), 0)
    - coalesce((SELECT sum(valor) FROM public.saques WHERE afiliado_id = NEW.afiliado_id AND status IN ('pago', 'pendente')), 0)
    INTO v_available;
  IF NEW.valor > v_available THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_affiliate_withdrawal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_affiliate_withdrawal_before_insert
BEFORE INSERT ON public.saques FOR EACH ROW EXECUTE FUNCTION public.validate_affiliate_withdrawal();
