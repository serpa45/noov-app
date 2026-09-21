
CREATE TABLE public.loja_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  nome text NOT NULL,
  pin text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('admin','gerente','funcionario')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loja_usuarios_loja_id ON public.loja_usuarios(loja_id);

ALTER TABLE public.loja_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam usuarios da sua loja"
ON public.loja_usuarios
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins gerenciam todos usuarios da loja"
ON public.loja_usuarios
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_loja_usuarios_updated_at
BEFORE UPDATE ON public.loja_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
