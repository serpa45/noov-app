
-- Add codigo_acesso column for affiliate panel login (separate from sharing link code)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_acesso text;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_codigo_acesso_unique ON public.profiles (codigo_acesso) WHERE codigo_acesso IS NOT NULL;

-- Generate codigo_acesso for existing affiliates that don't have one
UPDATE public.profiles
SET codigo_acesso = upper(substr(md5(random()::text || user_id::text || now()::text), 1, 10))
WHERE codigo_afiliado IS NOT NULL AND codigo_acesso IS NULL;

-- Update the handle_new_user function to also generate codigo_acesso
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _affiliate_code text;
  _access_code text;
BEGIN
  _role := NEW.raw_user_meta_data->>'role';

  IF _role = 'afiliado' THEN
    _affiliate_code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
    _access_code := upper(substr(md5(NEW.id::text || random()::text || now()::text), 1, 10));
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, codigo_afiliado, codigo_acesso)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _affiliate_code, _access_code);

  IF _role IS NOT NULL AND _role IN ('admin', 'lojista', 'afiliado', 'entregador') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
