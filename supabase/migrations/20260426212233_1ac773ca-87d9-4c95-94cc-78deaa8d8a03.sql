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
CREATE POLICY "Anyone can view product ratings" 
ON public.product_ratings FOR SELECT 
USING (true);

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
