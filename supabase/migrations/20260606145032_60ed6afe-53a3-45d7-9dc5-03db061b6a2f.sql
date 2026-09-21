ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC;
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS promo_duracao_meses INTEGER DEFAULT 0;

ALTER TABLE public.loja_planos ADD COLUMN IF NOT EXISTS promo_pagamentos_feitos INTEGER DEFAULT 0;
