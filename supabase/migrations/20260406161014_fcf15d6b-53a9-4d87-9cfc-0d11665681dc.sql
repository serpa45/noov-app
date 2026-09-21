CREATE TABLE public.materiais_afiliado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  texto_whatsapp TEXT,
  imagem_url TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.materiais_afiliado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all materials"
ON public.materiais_afiliado
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates can view available materials"
ON public.materiais_afiliado
FOR SELECT
TO authenticated
USING (disponivel = true);

CREATE TRIGGER update_materiais_afiliado_updated_at
BEFORE UPDATE ON public.materiais_afiliado
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();