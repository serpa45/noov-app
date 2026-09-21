
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE POLICY "Admins can update any store"
ON public.lojas
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any store"
ON public.lojas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
