
CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  segmento text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own store"
ON public.lojas FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own store"
ON public.lojas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own store"
ON public.lojas FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all stores"
ON public.lojas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
