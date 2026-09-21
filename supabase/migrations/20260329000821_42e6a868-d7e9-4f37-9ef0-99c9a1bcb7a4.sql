
-- Allow anyone to look up profiles by affiliate code (for ref linking)
CREATE POLICY "Anyone can lookup by affiliate code"
  ON public.profiles FOR SELECT TO anon
  USING (codigo_afiliado IS NOT NULL);

CREATE POLICY "Authenticated can lookup by affiliate code"
  ON public.profiles FOR SELECT TO authenticated
  USING (codigo_afiliado IS NOT NULL);
