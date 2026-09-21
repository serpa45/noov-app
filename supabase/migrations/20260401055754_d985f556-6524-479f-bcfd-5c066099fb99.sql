
-- Tabela de despesas dos lojistas
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_despesas_loja_id ON public.despesas(loja_id);
CREATE INDEX idx_despesas_data ON public.despesas(data);

-- RLS
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view their expenses"
ON public.despesas FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can insert their expenses"
ON public.despesas FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can update their expenses"
ON public.despesas FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can delete their expenses"
ON public.despesas FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all expenses"
ON public.despesas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER update_despesas_updated_at
BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
