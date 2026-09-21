
DROP POLICY IF EXISTS "Anyone can view available products" ON public.produtos;
CREATE POLICY "Anyone can view store products" ON public.produtos FOR SELECT TO anon USING (true);
