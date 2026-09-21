
-- Allow anon/authenticated lookup by codigo_acesso for login
CREATE POLICY "Anyone can lookup by access code"
ON public.profiles
FOR SELECT
TO anon
USING (codigo_acesso IS NOT NULL);

CREATE POLICY "Authenticated can lookup by access code"
ON public.profiles
FOR SELECT
TO authenticated
USING (codigo_acesso IS NOT NULL);
