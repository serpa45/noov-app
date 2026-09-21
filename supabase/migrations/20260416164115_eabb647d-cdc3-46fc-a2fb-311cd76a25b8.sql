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
        CREATE POLICY "Users can manage their own categories" ON public.pizzaria_categories
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pizzaria_options' AND policyname = 'Users can manage their own options') THEN
        CREATE POLICY "Users can manage their own options" ON public.pizzaria_options
            FOR ALL USING (category_id IN (SELECT id FROM public.pizzaria_categories WHERE store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_prices' AND policyname = 'Users can manage their own product prices') THEN
        CREATE POLICY "Users can manage their own product prices" ON public.product_prices
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_complements' AND policyname = 'Users can manage their own product complements') THEN
        CREATE POLICY "Users can manage their own product complements" ON public.product_complements
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredients' AND policyname = 'Users can manage their own ingredients') THEN
        CREATE POLICY "Users can manage their own ingredients" ON public.ingredients
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ingredients' AND policyname = 'Users can manage their own technical sheets') THEN
        CREATE POLICY "Users can manage their own technical sheets" ON public.product_ingredients
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;
END $$;
