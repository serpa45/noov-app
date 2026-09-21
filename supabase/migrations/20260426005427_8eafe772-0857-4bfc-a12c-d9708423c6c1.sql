-- Add pago column to entregas
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT false;

-- Create entregador_pagamentos table
CREATE TABLE IF NOT EXISTS public.entregador_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entregador_id UUID REFERENCES auth.users(id) NOT NULL,
    lojista_id UUID REFERENCES public.lojas(id) NOT NULL,
    valor NUMERIC NOT NULL,
    periodo_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    periodo_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    quantidade_entregas INTEGER NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entregador_pagamentos ENABLE ROW LEVEL SECURITY;

-- Policies for entregador_pagamentos
CREATE POLICY "Lojistas can manage their driver payments"
    ON public.entregador_pagamentos
    FOR ALL
    USING (lojista_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can view their own payments"
    ON public.entregador_pagamentos
    FOR SELECT
    USING (entregador_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_entregador_id ON public.entregador_pagamentos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_lojista_id ON public.entregador_pagamentos(lojista_id);
