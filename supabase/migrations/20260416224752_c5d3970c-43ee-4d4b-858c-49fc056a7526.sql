CREATE TABLE public.pizzaria_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL UNIQUE,
  forma_cobranca TEXT NOT NULL DEFAULT 'fracionado',
  limite_sabores JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pizzaria_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas manage their pizzaria config"
ON public.pizzaria_configuracoes
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view pizzaria config"
ON public.pizzaria_configuracoes
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER update_pizzaria_configuracoes_updated_at
BEFORE UPDATE ON public.pizzaria_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();