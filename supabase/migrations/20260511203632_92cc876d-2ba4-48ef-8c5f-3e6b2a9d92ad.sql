
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_titulo text NOT NULL DEFAULT 'Cupom de Desconto',
  ADD COLUMN IF NOT EXISTS cupom_popup_subtitulo text NOT NULL DEFAULT 'Aproveite uma oferta especial no seu pedido!',
  ADD COLUMN IF NOT EXISTS cupom_popup_cta text NOT NULL DEFAULT 'COMEÇAR A PEDIR',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_fundo text NOT NULL DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_texto text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS cupom_popup_imagem_url text;
