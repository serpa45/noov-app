
CREATE TABLE public.configuracoes_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global config" ON public.configuracoes_globais
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage global config" ON public.configuracoes_globais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.configuracoes_globais (chave, valor) VALUES ('dias_teste_gratis', '7');
