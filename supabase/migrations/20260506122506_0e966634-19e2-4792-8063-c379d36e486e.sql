-- Create app_cupom_tipo enum
DO $$ BEGIN
    CREATE TYPE public.app_cupom_tipo AS ENUM ('fixo', 'percentual', 'frete_gratis');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add cupons_ativos to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cupons_ativos BOOLEAN DEFAULT false;

-- Add coupon info to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_codigo TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_desconto NUMERIC DEFAULT 0;

-- Create cupons table
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    tipo public.app_cupom_tipo NOT NULL,
    valor NUMERIC NOT NULL DEFAULT 0,
    valor_minimo NUMERIC NOT NULL DEFAULT 0,
    validade_inicio TIMESTAMP WITH TIME ZONE,
    validade_fim TIMESTAMP WITH TIME ZONE,
    limite_total INTEGER,
    limite_por_cliente INTEGER DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT true,
    tipo_publico BOOLEAN NOT NULL DEFAULT true,
    usos_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(loja_id, codigo)
);

-- Create cupom_clientes table for private coupons
CREATE TABLE IF NOT EXISTS public.cupom_clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    cliente_identificador TEXT NOT NULL, -- Telefone do cliente
    cliente_nome TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uso_cupons table
CREATE TABLE IF NOT EXISTS public.uso_cupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    cliente_identificador TEXT NOT NULL, -- Telefone do cliente
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    valor_desconto NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupom_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_cupons ENABLE ROW LEVEL SECURITY;

-- Policies for cupons
DO $$ BEGIN
    CREATE POLICY "Lojistas podem gerenciar seus próprios cupons"
    ON public.cupons
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lojas 
        WHERE lojas.id = cupons.loja_id 
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Qualquer um pode ver cupons ativos da loja"
    ON public.cupons
    FOR SELECT
    USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for cupom_clientes
DO $$ BEGIN
    CREATE POLICY "Lojistas podem gerenciar clientes do cupom"
    ON public.cupom_clientes
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.cupons
        JOIN public.lojas ON lojas.id = cupons.loja_id
        WHERE cupons.id = cupom_clientes.cupom_id
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Clientes podem ver seus próprios cupons privados"
    ON public.cupom_clientes
    FOR SELECT
    USING (true); -- Permitir select público para validação no checkout via telefone
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for uso_cupons
DO $$ BEGIN
    CREATE POLICY "Lojistas podem ver usos dos seus cupons"
    ON public.uso_cupons
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.cupons
        JOIN public.lojas ON lojas.id = cupons.loja_id
        WHERE cupons.id = uso_cupons.cupom_id
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Inserção pública de uso de cupom"
    ON public.uso_cupons
    FOR INSERT
    WITH CHECK (true); -- Permitir inserção no checkout
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Function to update updated_at
CREATE OR REPLACE TRIGGER update_cupons_updated_at
BEFORE UPDATE ON public.cupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();