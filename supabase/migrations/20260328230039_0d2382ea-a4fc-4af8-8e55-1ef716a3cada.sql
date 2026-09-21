
-- Allow public (anon) read access to lojas by slug for the public menu
CREATE POLICY "Anyone can view stores by slug"
ON public.lojas FOR SELECT TO anon
USING (true);

-- Allow public (anon) read access to available products for the public menu
CREATE POLICY "Anyone can view available products"
ON public.produtos FOR SELECT TO anon
USING (disponivel = true);
