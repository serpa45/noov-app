CREATE TABLE IF NOT EXISTS public.loja_adicionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'adicional', -- 'adicional' or 'borda'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, nome, tipo)
);

-- Enable RLS
ALTER TABLE public.loja_adicionais ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view addons from their own stores"
ON public.loja_adicionais FOR SELECT
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert addons for their own stores"
ON public.loja_adicionais FOR INSERT
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update addons from their own stores"
ON public.loja_adicionais FOR UPDATE
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete addons from their own stores"
ON public.loja_adicionais FOR DELETE
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loja_adicionais_updated_at
BEFORE UPDATE ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
