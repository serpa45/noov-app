
-- Backfill codigo_acesso for existing lojistas without one
UPDATE public.profiles p
SET codigo_acesso = upper(substr(md5(p.user_id::text || random()::text || now()::text), 1, 10))
WHERE p.codigo_acesso IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'lojista'
  );

-- Update handle_new_user to also generate codigo_acesso for lojistas
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
  ELSIF _role = 'lojista' THEN
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
