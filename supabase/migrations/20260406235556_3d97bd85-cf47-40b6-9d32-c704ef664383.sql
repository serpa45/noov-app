
-- Create pdv_comandas table
CREATE TABLE public.pdv_comandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  garcom_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  total NUMERIC NOT NULL DEFAULT 0,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdv_comandas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Lojistas and garcons can manage comandas"
ON public.pdv_comandas
FOR ALL
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add comanda_id and status_cozinha to pdv_pedidos
ALTER TABLE public.pdv_pedidos
ADD COLUMN comanda_id UUID REFERENCES public.pdv_comandas(id) ON DELETE SET NULL,
ADD COLUMN status_cozinha TEXT NOT NULL DEFAULT 'pendente';

-- Updated_at trigger for comandas
CREATE TRIGGER update_pdv_comandas_updated_at
BEFORE UPDATE ON public.pdv_comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_comandas;
