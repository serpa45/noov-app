-- Delete duplicates keeping only the most recent rating for each product/customer pair
DELETE FROM public.product_ratings a
USING public.product_ratings b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.customer_phone = b.customer_phone;

-- Add unique constraint
ALTER TABLE public.product_ratings
ADD CONSTRAINT unique_product_customer_rating UNIQUE (product_id, customer_phone);
