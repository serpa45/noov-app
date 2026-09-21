ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cupom_lembrete_ativo boolean NOT NULL DEFAULT false;