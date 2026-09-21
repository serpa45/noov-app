
-- Add affiliate code to profiles (auto-generated for affiliates)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_afiliado text UNIQUE;

-- Add affiliate reference to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS afiliado_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create commissions table
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  valor_pedido numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 10,
  valor_comissao numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  pago_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- RLS: affiliates can view their own commissions
CREATE POLICY "Afiliados can view their commissions"
  ON public.comissoes FOR SELECT TO authenticated
  USING (afiliado_id = auth.uid());

-- RLS: admins can view all commissions
CREATE POLICY "Admins can view all commissions"
  ON public.comissoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: system inserts via lojista context
CREATE POLICY "Lojistas can insert commissions for their stores"
  ON public.comissoes FOR INSERT TO authenticated
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

-- Update handle_new_user to generate affiliate code
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _code text;
BEGIN
  _role := NEW.raw_user_meta_data->>'role';

  -- Generate affiliate code if role is afiliado
  IF _role = 'afiliado' THEN
    _code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, codigo_afiliado)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _code);

  IF _role IS NOT NULL AND _role IN ('admin', 'lojista', 'afiliado', 'entregador') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
