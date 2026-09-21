-- ================================================================
-- PARTE 4 DE 8 | Migrações 91–120 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260416164115_eabb647d-cdc3-46fc-a2fb-311cd76a25b8.sql
-- ----------------------------------------
-- Categories (Groups: Sizes, Flavors, Crusts)
CREATE TABLE IF NOT EXISTS public.pizzaria_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'size', 'flavor', 'crust', 'complement'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Options within categories
CREATE TABLE IF NOT EXISTS public.pizzaria_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.pizzaria_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    additional_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update products table
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS category_flavor_id UUID REFERENCES public.pizzaria_categories(id),
ADD COLUMN IF NOT EXISTS allow_half BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_flavors INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pricing_rule TEXT DEFAULT 'maior_preco'; -- 'maior_preco' or 'media'

-- Product Prices (Price per size)
CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    size_option_id UUID NOT NULL REFERENCES public.pizzaria_options(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, size_option_id)
);

-- Product Complements (Bordas, extras)
CREATE TABLE IF NOT EXISTS public.product_complements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.pizzaria_categories(id) ON DELETE CASCADE,
    required BOOLEAN DEFAULT FALSE,
    max_selection INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ingredients
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- 'g', 'ml', 'unidade'
    cost_per_unit NUMERIC NOT NULL DEFAULT 0,
    stock_quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Technical Data Sheet (Recipe)
CREATE TABLE IF NOT EXISTS public.product_ingredients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    size_option_id UUID REFERENCES public.pizzaria_options(id) ON DELETE CASCADE,
    quantity_used NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pizzaria_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzaria_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_complements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pizzaria_categories' AND policyname = 'Users can manage their own categories') THEN
        DROP POLICY IF EXISTS "Users can manage their own categories" ON public.pizzaria_categories;
CREATE POLICY "Users can manage their own categories" ON public.pizzaria_categories
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pizzaria_options' AND policyname = 'Users can manage their own options') THEN
        DROP POLICY IF EXISTS "Users can manage their own options" ON public.pizzaria_options;
CREATE POLICY "Users can manage their own options" ON public.pizzaria_options
            FOR ALL USING (category_id IN (SELECT id FROM public.pizzaria_categories WHERE store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_prices' AND policyname = 'Users can manage their own product prices') THEN
        DROP POLICY IF EXISTS "Users can manage their own product prices" ON public.product_prices;
CREATE POLICY "Users can manage their own product prices" ON public.product_prices
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_complements' AND policyname = 'Users can manage their own product complements') THEN
        DROP POLICY IF EXISTS "Users can manage their own product complements" ON public.product_complements;
CREATE POLICY "Users can manage their own product complements" ON public.product_complements
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredients' AND policyname = 'Users can manage their own ingredients') THEN
        DROP POLICY IF EXISTS "Users can manage their own ingredients" ON public.ingredients;
CREATE POLICY "Users can manage their own ingredients" ON public.ingredients
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ingredients' AND policyname = 'Users can manage their own technical sheets') THEN
        DROP POLICY IF EXISTS "Users can manage their own technical sheets" ON public.product_ingredients;
CREATE POLICY "Users can manage their own technical sheets" ON public.product_ingredients
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;
END $$;

-- ----------------------------------------
-- 20260416224752_c5d3970c-43ee-4d4b-858c-49fc056a7526.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.pizzaria_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL UNIQUE,
  forma_cobranca TEXT NOT NULL DEFAULT 'fracionado',
  limite_sabores JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pizzaria_configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas manage their pizzaria config" ON public.pizzaria_configuracoes;
CREATE POLICY "Lojistas manage their pizzaria config"
ON public.pizzaria_configuracoes
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view pizzaria config" ON public.pizzaria_configuracoes;
CREATE POLICY "Anyone can view pizzaria config"
ON public.pizzaria_configuracoes
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER update_pizzaria_configuracoes_updated_at
BEFORE UPDATE ON public.pizzaria_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 20260425005006_b94e9ea7-9421-4e48-996c-a43fd86ecd5b.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Users can view addons from their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can view addons from their own stores"
ON public.loja_adicionais FOR SELECT
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert addons for their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can insert addons for their own stores"
ON public.loja_adicionais FOR INSERT
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update addons from their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can update addons from their own stores"
ON public.loja_adicionais FOR UPDATE
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete addons from their own stores" ON public.loja_adicionais;
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

-- ----------------------------------------
-- 20260425005408_c461de05-e22d-4c90-9810-220020ef4c12.sql
-- ----------------------------------------
-- Function to validate ownership of loja_adicionais
CREATE OR REPLACE FUNCTION public.check_loja_adicionais_ownership()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    target_loja_id UUID;
BEGIN
    -- Determine which loja_id to check based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_loja_id := OLD.loja_id;
    ELSE
        target_loja_id := NEW.loja_id;
    END IF;

    -- Get the owner of the store
    SELECT user_id INTO owner_id
    FROM public.lojas
    WHERE id = target_loja_id;

    -- Verify if the authenticated user is the owner
    -- Note: auth.uid() returns NULL for service_role/background tasks, 
    -- we might want to allow those or handle them specifically.
    -- If we want to be strict and ONLY allow the owner even in "RLS bypass" scenarios 
    -- where auth.uid() is set, this check holds.
    
    IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: Você não é o proprietário desta loja.';
    END IF;

    -- For UPDATE, also ensure they don't try to change the loja_id to one they don't own
    IF (TG_OP = 'UPDATE' AND OLD.loja_id != NEW.loja_id) THEN
        SELECT user_id INTO owner_id
        FROM public.lojas
        WHERE id = NEW.loja_id;
        
        IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
            RAISE EXCEPTION 'Acesso negado: Não é possível mover adicionais para uma loja que você não possui.';
        END IF;
    END IF;

    RETURN IF (TG_OP = 'DELETE', OLD, NEW);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce ownership on DML operations
DROP TRIGGER IF EXISTS enforce_loja_adicionais_ownership ON public.loja_adicionais;
CREATE TRIGGER enforce_loja_adicionais_ownership
BEFORE INSERT OR UPDATE OR DELETE
ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.check_loja_adicionais_ownership();

-- ----------------------------------------
-- 20260425005424_9932f974-bac3-401c-9f00-7a0cb022a042.sql
-- ----------------------------------------
-- Function to validate ownership of loja_adicionais with fixed syntax and search_path
CREATE OR REPLACE FUNCTION public.check_loja_adicionais_ownership()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    target_loja_id UUID;
BEGIN
    -- Determine which loja_id to check based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_loja_id := OLD.loja_id;
    ELSE
        target_loja_id := NEW.loja_id;
    END IF;

    -- Get the owner of the store
    SELECT user_id INTO owner_id
    FROM public.lojas
    WHERE id = target_loja_id;

    -- Verify if the authenticated user is the owner
    -- Note: auth.uid() returns NULL for service_role/background tasks, 
    -- we might want to allow those or handle them specifically.
    
    IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: Você não é o proprietário desta loja.';
    END IF;

    -- For UPDATE, also ensure they don't try to change the loja_id to one they don't own
    IF (TG_OP = 'UPDATE' AND OLD.loja_id != NEW.loja_id) THEN
        SELECT user_id INTO owner_id
        FROM public.lojas
        WHERE id = NEW.loja_id;
        
        IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
            RAISE EXCEPTION 'Acesso negado: Não é possível mover adicionais para uma loja que você não possui.';
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS enforce_loja_adicionais_ownership ON public.loja_adicionais;
CREATE TRIGGER enforce_loja_adicionais_ownership
BEFORE INSERT OR UPDATE OR DELETE
ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.check_loja_adicionais_ownership();

-- ----------------------------------------
-- 20260425014452_57f961ee-b1c2-421c-b065-3354a79f29d0.sql
-- ----------------------------------------
-- First, let's clean up the overly permissive policies for 'produtos' table
DROP POLICY IF EXISTS "Authenticated can view all store products" ON public.produtos;
DROP POLICY IF EXISTS "Admins can view all products" ON public.produtos;

-- Ensure the existing policies are correct and secure
-- Public can view products (needed for the menu)
-- Note: It's better to filter by loja_id in the query, but the policy allows viewing
DROP POLICY IF EXISTS "Anyone can view store products" ON public.produtos;
DROP POLICY IF EXISTS "Anyone can view store products" ON public.produtos;
CREATE POLICY "Anyone can view store products" 
ON public.produtos 
FOR SELECT 
USING (true);

-- Lojistas can see their own products
DROP POLICY IF EXISTS "Lojistas can view their products" ON public.produtos;
DROP POLICY IF EXISTS "Lojistas can view their products" ON public.produtos;
CREATE POLICY "Lojistas can view their products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

-- Garcons can see their store products
DROP POLICY IF EXISTS "Garcons can view their store products" ON public.produtos;
DROP POLICY IF EXISTS "Garcons can view their store products" ON public.produtos;
CREATE POLICY "Garcons can view their store products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Ensure RLS is enabled
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- 20260425173621_655f4f04-196d-412d-af36-dacbc594bf06.sql
-- ----------------------------------------
ALTER TABLE public.produtos 
ADD COLUMN unidade_medida TEXT NOT NULL DEFAULT 'un';

-- Add a comment for clarity
COMMENT ON COLUMN public.produtos.unidade_medida IS 'Unidade de medida do produto: un, kg, ml';

-- ----------------------------------------
-- 20260425181551_a5f927ad-6d4a-43d7-8917-9678b3bcdf17.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS categorias_ocultas JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.categorias_ocultas IS 'Lista de nomes de categorias padrão que o lojista deseja ocultar em sua loja.';

-- ----------------------------------------
-- 20260425185609_edff7f89-80b8-4802-9c4f-d50dd9fb3fb0.sql
-- ----------------------------------------
-- Enable Realtime for the produtos table
ALTER TABLE public.produtos REPLICA IDENTITY FULL;

-- Check if the table is already in the publication to avoid error
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'produtos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
    END IF;
END $$;

-- ----------------------------------------
-- 20260425191244_f4c3164f-a9c0-4e35-ae0a-ae09993388a9.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN valor_plano_exclusivo NUMERIC;
COMMENT ON COLUMN public.lojas.valor_plano_exclusivo IS 'Valor exclusivo do plano para esta loja, que sobrescreve o valor padrão do plano.';

-- ----------------------------------------
-- 20260425192931_9a28c2c0-6415-485b-b8fc-b24ed32a2731.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS plano_id_exclusivo UUID REFERENCES public.planos(id);

-- ----------------------------------------
-- 20260425221700_8a308614-e74a-43f7-97a0-d5e04d0f75d7.sql
-- ----------------------------------------
-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public to view avatars
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy to allow authenticated users to upload their own avatar
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to update their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to delete their own avatar
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- ----------------------------------------
-- 20260425224724_bf4df445-fa1e-4166-a6d9-88d2a4e19d8f.sql
-- ----------------------------------------
-- Clean up existing policies for the relevant buckets to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can update client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
    
    -- Also drop common names that might exist from default setups
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
END $$;

-- 1. client-photos bucket (for customers)
DROP POLICY IF EXISTS "Public Access Client Photos" ON storage.objects;
CREATE POLICY "Public Access Client Photos" ON storage.objects FOR SELECT USING (bucket_id = 'client-photos');
DROP POLICY IF EXISTS "Anyone can upload client photos" ON storage.objects;
CREATE POLICY "Anyone can upload client photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client-photos');
DROP POLICY IF EXISTS "Anyone can update client photos" ON storage.objects;
CREATE POLICY "Anyone can update client photos" ON storage.objects FOR UPDATE USING (bucket_id = 'client-photos');

-- 2. avatars bucket (for lojistas, delivery, affiliates)
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 3. logos bucket (for lojistas)
DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
CREATE POLICY "Public Access Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 4. banners bucket (for lojistas)
DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE USING (bucket_id = 'banners' AND auth.role() = 'authenticated');

-- ----------------------------------------
-- 20260426005427_8eafe772-0857-4bfc-a12c-d9708423c6c1.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Lojistas can manage their driver payments" ON public.entregador_pagamentos;
CREATE POLICY "Lojistas can manage their driver payments"
    ON public.entregador_pagamentos
    FOR ALL
    USING (lojista_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Drivers can view their own payments" ON public.entregador_pagamentos;
CREATE POLICY "Drivers can view their own payments"
    ON public.entregador_pagamentos
    FOR SELECT
    USING (entregador_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_entregador_id ON public.entregador_pagamentos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_lojista_id ON public.entregador_pagamentos(lojista_id);

-- ----------------------------------------
-- 20260426212233_1ac773ca-87d9-4c95-94cc-78deaa8d8a03.sql
-- ----------------------------------------
-- Add rating fields to produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS rating_average NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create product_ratings table
CREATE TABLE IF NOT EXISTS public.product_ratings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_ratings ENABLE ROW LEVEL SECURITY;

-- Policies for product_ratings
DROP POLICY IF EXISTS "Anyone can view product ratings" ON public.product_ratings;
CREATE POLICY "Anyone can view product ratings" 
ON public.product_ratings FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Anyone can create product ratings" ON public.product_ratings;
CREATE POLICY "Anyone can create product ratings" 
ON public.product_ratings FOR INSERT 
WITH CHECK (true);

-- Function to update product rating stats
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos
        SET 
            rating_average = (rating_average * rating_count + NEW.rating) / (rating_count + 1),
            rating_count = rating_count + 1
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos
        SET 
            rating_average = CASE 
                WHEN rating_count > 1 THEN (rating_average * rating_count - OLD.rating) / (rating_count - 1)
                ELSE 0 
            END,
            rating_count = rating_count - 1
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for product ratings
DROP TRIGGER IF EXISTS tr_update_product_rating_stats ON public.product_ratings;
CREATE TRIGGER tr_update_product_rating_stats
AFTER INSERT OR DELETE ON public.product_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating_stats();

-- ----------------------------------------
-- 20260426212253_f62d88e2-6efa-429c-ac44-872254885634.sql
-- ----------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS avaliacoes_produtos_ativas BOOLEAN DEFAULT false;

-- ----------------------------------------
-- 20260426221044_e014dd1f-4ba6-429d-8cfc-5b7ee5c1ea38.sql
-- ----------------------------------------
-- Delete duplicates keeping only the most recent rating for each product/customer pair
DELETE FROM public.product_ratings a
USING public.product_ratings b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.customer_phone = b.customer_phone;

-- Add unique constraint
ALTER TABLE public.product_ratings
ADD CONSTRAINT unique_product_customer_rating UNIQUE (product_id, customer_phone);

-- ----------------------------------------
-- 20260426231622_1c369c04-0516-48e2-89c7-2f3942296930.sql
-- ----------------------------------------
-- Function to normalize strings for comparison (lowercase and trim)
-- We'll use this to match client neighborhoods with the corrected ones in loja_frete_bairros

UPDATE public.clientes c
SET endereco_bairro = fb.bairro
FROM public.loja_frete_bairros fb
WHERE c.loja_id = fb.loja_id
AND lower(trim(c.endereco_bairro)) = lower(trim(fb.bairro))
AND c.endereco_bairro != fb.bairro;

-- Also update any orders that might have the old names if we want to be thorough
-- But the user specifically mentioned "clientes"

-- ----------------------------------------
-- 20260426231639_ff312d10-1654-415b-b2ba-1bbd034e4f53.sql
-- ----------------------------------------
-- Update the frete_bairros JSON column in the lojas table
-- to match the current state of the loja_frete_bairros table
WITH updated_bairros AS (
    SELECT 
        loja_id, 
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'bairro', bairro,
                'valor', valor
            )
        ) as bairros_json
    FROM public.loja_frete_bairros
    GROUP BY loja_id
)
UPDATE public.lojas l
SET frete_bairros = ub.bairros_json
FROM updated_bairros ub
WHERE l.id = ub.loja_id;

-- ----------------------------------------
-- 20260426232011_2e24d71f-0c9d-44ea-9fe0-e29496880a2c.sql
-- ----------------------------------------
-- Allow authenticated users to view stores by slug (currently only anon can)
DROP POLICY IF EXISTS "Anyone can view stores by slug" ON public.lojas;
DROP POLICY IF EXISTS "Anyone can view stores by slug" ON public.lojas;
CREATE POLICY "Anyone can view stores by slug" 
ON public.lojas 
FOR SELECT 
USING (true); -- This replaces the previous anon-only policy and makes it public

-- Allow authenticated users to view clients (matching anon policy)
DROP POLICY IF EXISTS "Anon can select clients" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can select clients" ON public.clientes;
CREATE POLICY "Anyone can select clients" 
ON public.clientes 
FOR SELECT 
USING (true); -- This allows both anon and authenticated users to see clients

-- Ensure insert policy is clear
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);

-- ----------------------------------------
-- 20260428015602_a6dac09b-ce26-43bf-9c8f-8b49e29b016f.sql
-- ----------------------------------------
-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Anyone can view product ratings" ON public.product_ratings;
DROP POLICY IF EXISTS "Anyone can create product ratings" ON public.product_ratings;

-- Criar política para visualização: Permitir apenas se o produto pertencer a uma loja ativa que permite avaliações
DROP POLICY IF EXISTS "Clientes podem ver avaliações de produtos da loja atual" ON public.product_ratings;
CREATE POLICY "Clientes podem ver avaliações de produtos da loja atual" 
ON public.product_ratings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    JOIN public.lojas l ON p.loja_id = l.id
    WHERE p.id = product_ratings.product_id
    AND l.avaliacoes_produtos_ativas = true
  )
);

-- Criar política para inserção: Garantir que o produto existe
DROP POLICY IF EXISTS "Clientes podem criar avaliações para produtos existentes" ON public.product_ratings;
CREATE POLICY "Clientes podem criar avaliações para produtos existentes" 
ON public.product_ratings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = product_ratings.product_id
  )
);

-- ----------------------------------------
-- 20260428023851_08652a1f-aee6-4716-82da-35b5802a45dd.sql
-- ----------------------------------------
-- Criar o trigger faltante para sincronizar rating_average e rating_count
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

CREATE TRIGGER trg_update_product_rating_stats
AFTER INSERT OR DELETE ON public.product_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating_stats();

-- Backfill: recalcular média e contagem para produtos que já possuem avaliações
UPDATE public.produtos p
SET 
  rating_average = COALESCE(stats.avg_rating, 0),
  rating_count = COALESCE(stats.count_ratings, 0)
FROM (
  SELECT 
    product_id,
    AVG(rating)::numeric(3,2) AS avg_rating,
    COUNT(*) AS count_ratings
  FROM public.product_ratings
  GROUP BY product_id
) stats
WHERE p.id = stats.product_id;

-- ----------------------------------------
-- 20260428031546_b1e44e13-5643-4dd8-b5ea-35672b4a3ace.sql
-- ----------------------------------------
-- Add ranking_ativo column to lojas table
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS ranking_ativo BOOLEAN DEFAULT true;

-- Update the comment to describe the column
COMMENT ON COLUMN public.lojas.ranking_ativo IS 'Define se o menu de ranking de produtos mais pedidos deve ser exibido no cardápio do cliente.';

-- ----------------------------------------
-- 20260428040038_fb6067b9-658b-4503-94e0-4c4258b5b128.sql
-- ----------------------------------------
-- Drop duplicate triggers
DROP TRIGGER IF EXISTS tr_update_product_rating_stats ON public.product_ratings;
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

-- Recriar função para ser mais robusta e evitar erros de arredondamento/incremento manual falho
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular média e contagem baseado na tabela real para evitar desvios
    UPDATE public.produtos
    SET 
        rating_count = (SELECT count(*) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
        rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)), 0)
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar apenas um trigger
CREATE TRIGGER tr_update_product_rating_stats
AFTER INSERT OR DELETE OR UPDATE ON public.product_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

-- Sincronizar todos os produtos agora para corrigir dados errados
UPDATE public.produtos p
SET 
    rating_count = (SELECT count(*) FROM public.product_ratings pr WHERE pr.product_id = p.id),
    rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings pr WHERE pr.product_id = p.id), 0);

-- ----------------------------------------
-- 20260428040558_039bf2d3-0688-42ca-886e-edc76c69ff1b.sql
-- ----------------------------------------
-- 1. Criar a coluna pedidos_count se ela não existir
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS pedidos_count INTEGER DEFAULT 0;

-- 2. Sincronizar todos os produtos com a contagem real de vendas (pedidos concluídos/finalizados/entregues)
UPDATE public.produtos p
SET pedidos_count = (
    SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
    FROM public.pedidos ped,
    jsonb_array_elements(ped.items) elem
    WHERE (elem->>'id')::uuid = p.id
    AND ped.status IN ('concluido', 'finalizado', 'entregue')
);

-- 3. Atualizar a função do trigger para usar a coluna pedidos_count
CREATE OR REPLACE FUNCTION public.update_product_order_stats()
RETURNS TRIGGER AS $$
DECLARE
  item_record jsonb;
  product_id_var uuid;
BEGIN
  -- Se o status mudou para algo que consideramos "concluído" ou saiu desse status
  IF (TG_OP = 'INSERT' AND (NEW.status IN ('concluido', 'finalizado', 'entregue'))) OR
     (TG_OP = 'UPDATE' AND 
       ((NEW.status IN ('concluido', 'finalizado', 'entregue')) != (OLD.status IN ('concluido', 'finalizado', 'entregue')))
     )
  THEN
    -- Recalcula para os produtos no pedido atual (NEW)
    FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      BEGIN
        product_id_var := (item_record->>'id')::uuid;
        
        UPDATE public.produtos
        SET pedidos_count = (
          SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
          FROM public.pedidos p,
          jsonb_array_elements(p.items) elem
          WHERE (elem->>'id')::uuid = product_id_var
          AND p.status IN ('concluido', 'finalizado', 'entregue')
        )
        WHERE id = product_id_var;
      EXCEPTION WHEN OTHERS THEN
        -- Ignora se o ID não for um UUID válido ou produto não existir
        CONTINUE;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-aplicar o trigger
DROP TRIGGER IF EXISTS trg_update_product_order_stats ON public.pedidos;
CREATE TRIGGER trg_update_product_order_stats
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.update_product_order_stats();

-- ----------------------------------------
-- 20260428043458_35b04678-afe9-437e-92c6-2091ecc18798.sql
-- ----------------------------------------
-- Create linked_products table
CREATE TABLE IF NOT EXISTS public.linked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  linked_product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, linked_product_id)
);

-- Enable RLS
ALTER TABLE public.linked_products ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Lojistas can manage linked products for their own store" ON public.linked_products;
CREATE POLICY "Lojistas can manage linked products for their own store"
ON public.linked_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = public.linked_products.loja_id
    AND l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone can view linked products" ON public.linked_products;
CREATE POLICY "Anyone can view linked products"
ON public.linked_products
FOR SELECT
USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_linked_products_product_id ON public.linked_products(product_id);
CREATE INDEX IF NOT EXISTS idx_linked_products_loja_id ON public.linked_products(loja_id);

-- ----------------------------------------
-- 20260429161053_d317b91f-9bfc-4867-93f4-99b03fa4ef7a.sql
-- ----------------------------------------
-- Add contact info to lojas table
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Add instagram to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS instagram TEXT;

-- ----------------------------------------
-- 20260429201825_899f05cf-f72a-4b1e-a6d0-a2066054dd8e.sql
-- ----------------------------------------
-- Add column to track which year the birthday was last dismissed
ALTER TABLE public.clientes
ADD COLUMN aniversario_visto_ano INTEGER;

-- Comment for documentation
COMMENT ON COLUMN public.clientes.aniversario_visto_ano IS 'Ano em que o aniversariante foi marcado como visto pelo lojista';

-- ----------------------------------------
-- 20260502233946_8e82cb67-c30a-47e3-8b62-6e183965eb4f.sql
-- ----------------------------------------
-- Create bucket for installers
INSERT INTO storage.buckets (id, name, public) 
VALUES ('installers', 'installers', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'installers');

-- Policy for authenticated users to upload/update/delete (simple for now)
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'installers' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'installers' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'installers' AND auth.role() = 'authenticated');

-- ----------------------------------------
-- 20260503001952_3448c051-dea1-4ea9-afd6-917bf53e5f12.sql
-- ----------------------------------------
-- No direct SQL changes needed for this edge function implementation as it relies on environment variables for the private key.
-- However, we ensure the function can be called by authenticated users if needed.

