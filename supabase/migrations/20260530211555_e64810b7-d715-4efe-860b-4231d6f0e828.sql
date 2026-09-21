
-- Settings (singleton)
CREATE TABLE public.system_rating_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.system_rating_settings (id, enabled) VALUES (1, false);

GRANT SELECT ON public.system_rating_settings TO anon, authenticated;
GRANT ALL ON public.system_rating_settings TO service_role;

ALTER TABLE public.system_rating_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.system_rating_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update settings"
ON public.system_rating_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ratings
CREATE TABLE public.system_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL,
  cliente_nome TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('ruim', 'bom', 'otimo')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_telefone)
);

GRANT INSERT ON public.system_ratings TO anon, authenticated;
GRANT SELECT, DELETE ON public.system_ratings TO authenticated;
GRANT ALL ON public.system_ratings TO service_role;

ALTER TABLE public.system_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a rating"
ON public.system_ratings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read ratings"
ON public.system_ratings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ratings"
ON public.system_ratings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Opt-outs
CREATE TABLE public.system_rating_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL UNIQUE,
  cliente_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.system_rating_optouts TO anon, authenticated;
GRANT SELECT ON public.system_rating_optouts TO authenticated;
GRANT ALL ON public.system_rating_optouts TO service_role;

ALTER TABLE public.system_rating_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can opt out"
ON public.system_rating_optouts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read opt-outs"
ON public.system_rating_optouts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RPC: check if a phone already responded or opted out
CREATE OR REPLACE FUNCTION public.system_rating_status(_telefone TEXT)
RETURNS TABLE (has_voted BOOLEAN, has_opted_out BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.system_ratings WHERE cliente_telefone = _telefone),
    EXISTS (SELECT 1 FROM public.system_rating_optouts WHERE cliente_telefone = _telefone);
$$;

GRANT EXECUTE ON FUNCTION public.system_rating_status(TEXT) TO anon, authenticated;
