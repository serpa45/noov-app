CREATE POLICY "Anyone can view store owner pix info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  user_id IN (SELECT user_id FROM public.lojas WHERE ativo = true)
);