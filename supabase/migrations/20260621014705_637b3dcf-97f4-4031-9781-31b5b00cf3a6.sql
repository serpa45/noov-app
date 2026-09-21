GRANT SELECT ON public.pdv_mesas TO anon;
CREATE POLICY "Public read mesas for comanda link"
ON public.pdv_mesas FOR SELECT
TO anon, authenticated
USING (true);