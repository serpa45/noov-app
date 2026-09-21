ALTER TABLE public.loja_usuarios
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '[]'::jsonb;