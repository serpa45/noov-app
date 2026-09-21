ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS popup_informativo_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_informativo_imagem_url text,
  ADD COLUMN IF NOT EXISTS popup_informativo_data_limite timestamptz;