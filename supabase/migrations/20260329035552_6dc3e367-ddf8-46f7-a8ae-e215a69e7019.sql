
CREATE TABLE public.saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  pago_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own withdrawals
CREATE POLICY "Afiliados can view their withdrawals"
ON public.saques FOR SELECT TO authenticated
USING (afiliado_id = auth.uid());

-- Affiliates can insert their own withdrawals
CREATE POLICY "Afiliados can insert their withdrawals"
ON public.saques FOR INSERT TO authenticated
WITH CHECK (afiliado_id = auth.uid());

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals"
ON public.saques FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any withdrawal
CREATE POLICY "Admins can update any withdrawal"
ON public.saques FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
