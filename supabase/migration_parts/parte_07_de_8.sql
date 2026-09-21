-- ================================================================
-- PARTE 7 DE 8 | Migrações 181–210 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260615211841_7d152217-b8f4-4931-bba3-569b71cb2e96.sql
-- ----------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_rating_settings;

-- ----------------------------------------
-- 20260615213926_32c6a994-fbf1-47c5-977a-b2cacb0673d8.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ocultar_evento boolean NOT NULL DEFAULT false;

-- ----------------------------------------
-- 20260620214510_3545d83f-a126-4ac2-8cad-425bcb8180f7.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260620214701_73208ebe-11fc-4a94-9452-6cead65376d2.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_painel TEXT;

-- ----------------------------------------
-- 20260621014705_637b3dcf-97f4-4031-9781-31b5b00cf3a6.sql
-- ----------------------------------------
GRANT SELECT ON public.pdv_mesas TO anon;
DROP POLICY IF EXISTS "Public read mesas for comanda link" ON public.pdv_mesas;
CREATE POLICY "Public read mesas for comanda link"
ON public.pdv_mesas FOR SELECT
TO anon, authenticated
USING (true);

-- ----------------------------------------
-- 20260622012842_dd49e0d6-e7f9-4939-a946-0109f4f1869c.sql
-- ----------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens TO authenticated;
GRANT ALL ON public.admin_mensagens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_excluidas TO authenticated;
GRANT ALL ON public.admin_mensagens_excluidas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_lidas TO authenticated;
GRANT ALL ON public.admin_mensagens_lidas TO service_role;

-- ----------------------------------------
-- 20260624142906_5e099528-9a72-4169-86db-79542237e205.sql
-- ----------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS popup_informativo_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_informativo_imagem_url text,
  ADD COLUMN IF NOT EXISTS popup_informativo_data_limite timestamptz;

-- ----------------------------------------
-- 20260624175211_9b849a92-144c-4037-847e-a713d67f004b.sql
-- ----------------------------------------
GRANT SELECT ON public.loja_categoria_imagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_categoria_imagens TO authenticated;
GRANT ALL ON public.loja_categoria_imagens TO service_role;

DROP POLICY IF EXISTS "Anyone can view category images" ON public.loja_categoria_imagens;
DROP POLICY IF EXISTS "Anyone can view category images" ON public.loja_categoria_imagens;
CREATE POLICY "Anyone can view category images"
ON public.loja_categoria_imagens
FOR SELECT
TO anon, authenticated
USING (true);

-- ----------------------------------------
-- 20260626013200_e42ff4ca-8dcd-49f0-814e-a9fecdbe24ac.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- ----------------------------------------
-- 20260626013919_65392b11-3e26-4d19-aa18-fb147184c1f8.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

-- ----------------------------------------
-- 20260626015316_1365587e-4ee8-4c7c-92bd-d997defc1211.sql
-- ----------------------------------------
ALTER TABLE public.support_tickets ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app';

GRANT INSERT ON public.support_tickets TO anon;

DROP POLICY IF EXISTS "Anon can create guest tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Anon can create guest tickets" ON public.support_tickets;
CREATE POLICY "Anon can create guest tickets" ON public.support_tickets
  FOR INSERT TO anon
  WITH CHECK (store_id IS NULL AND guest_email IS NOT NULL AND length(guest_email) <= 255 AND length(coalesce(description,'')) <= 2000);

-- ----------------------------------------
-- 20260626020701_1075be34-4f9c-4444-b906-f2e5a19b7122.sql
-- ----------------------------------------
UPDATE public.planos
SET limites = limites || '{"pdv_balcao": true, "pdv_mesas": true}'::jsonb
WHERE (limites->>'pdv')::boolean = true;

-- ----------------------------------------
-- 20260626221537_7c5ab29a-fcd4-4369-a994-192fde35cb41.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS pdv_venda_fora_horario boolean NOT NULL DEFAULT false;

-- ----------------------------------------
-- 20260704011022_073b5d90-7720-4e7c-a077-d6686e1a8cb9.sql
-- ----------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS max_adicionais integer DEFAULT NULL;
COMMENT ON COLUMN public.produtos.max_adicionais IS 'Maximum number of adicionais (add-ons) the customer can select. NULL or 0 = unlimited.';

-- ----------------------------------------
-- 20260705021749_adbedbe7-5e77-40bb-b879-6e3e8c0f04c1.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS comissao_percent numeric;

-- ----------------------------------------
-- 20260705023640_1c0cded2-d76a-4e45-8898-f5e6e4eed608.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260705024126_dc714c5a-e261-47b6-8599-efb8b5433af3.sql
-- ----------------------------------------
UPDATE public.comissoes SET percentual = 35, valor_comissao = ROUND(valor_pedido * 0.35, 2) WHERE id = '022e9fa1-c27d-4d00-9a57-c8260329d769';

-- ----------------------------------------
-- 20260707220247_a364017d-58f0-4b87-a88a-09d26973cee6.sql
-- ----------------------------------------
create table if not exists public.app_version (
  id int primary key default 1,
  major int not null default 1,
  minor int not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_version_singleton check (id = 1)
);

insert into public.app_version (id, major, minor)
values (1, 1, 1)
on conflict (id) do nothing;

grant select on public.app_version to anon, authenticated;
grant all on public.app_version to service_role;

alter table public.app_version enable row level security;

drop policy if exists "read app version" on public.app_version;
DROP POLICY IF EXISTS "read app version" ON public.app_version;
create policy "read app version"
  on public.app_version
  for select
  using (true);

create or replace function public.bump_app_version()
returns table(major int, minor int)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_major int;
  cur_minor int;
  next_major int;
  next_minor int;
begin
  select av.major, av.minor into cur_major, cur_minor
  from public.app_version av where av.id = 1 for update;

  if cur_minor + 1 >= 5 then
    next_major := cur_major + 1;
    next_minor := 0;
  else
    next_major := cur_major;
    next_minor := cur_minor + 1;
  end if;

  update public.app_version
    set major = next_major,
        minor = next_minor,
        updated_at = now()
   where id = 1;

  return query select next_major, next_minor;
end;
$$;

grant execute on function public.bump_app_version() to anon, authenticated, service_role;

-- ----------------------------------------
-- 20260707220541_03bb5702-002a-4638-856c-0072a485288d.sql
-- ----------------------------------------
create or replace function public.bump_app_version()
returns table(major int, minor int)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_minor int;
begin
  update public.app_version
     set minor = minor + 1,
         updated_at = now()
   where id = 1
  returning app_version.minor into next_minor;

  return query select 0 as major, next_minor;
end;
$$;

-- ----------------------------------------
-- 20260707220804_79a872ca-1a1d-47ad-b1df-0cad3ef87297.sql
-- ----------------------------------------
create or replace function public.bump_app_version()
returns table(major int, minor int)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_major int;
  cur_minor int;
  next_major int;
  next_minor int;
begin
  select av.major, av.minor into cur_major, cur_minor
  from public.app_version av where av.id = 1 for update;

  if cur_minor + 1 > 5 then
    next_major := cur_major + 1;
    next_minor := 0;
  else
    next_major := cur_major;
    next_minor := cur_minor + 1;
  end if;

  update public.app_version
    set major = next_major,
        minor = next_minor,
        updated_at = now()
   where id = 1;

  return query select next_major, next_minor;
end;
$$;

-- ----------------------------------------
-- 20260708030144_bcb0a617-5796-44cc-af65-bd9498210945.sql
-- ----------------------------------------
UPDATE public.app_version SET major = 1, minor = 3, updated_at = now() WHERE id = 1;

-- ----------------------------------------
-- 20260712202010_0f181e97-8106-4f65-942e-7b1c27b80851.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS mais_vendidos_ativo BOOLEAN NOT NULL DEFAULT true;

-- ----------------------------------------
-- 20260712203856_a3203d31-2b09-4c5e-b9d1-e3f628465ff2.sql
-- ----------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- ----------------------------------------
-- 20260716152946_76ca1d49-2e60-4981-87ab-5490f3806d95.sql
-- ----------------------------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ;

-- ----------------------------------------
-- 20260716154018_20ad88b1-96f2-451b-9177-4d63bfa05008.sql
-- ----------------------------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS store_read_at TIMESTAMPTZ;

-- ----------------------------------------
-- 20260716154615_137a81eb-7193-41b2-b4d6-2a15dddc3a10.sql
-- ----------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- ----------------------------------------
-- 20260716154938_b633c294-10e9-47ac-ad3a-4d087ebff67b.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Stores can update their own tickets" ON public.support_tickets;
CREATE POLICY "Stores can update their own tickets"
ON public.support_tickets
FOR UPDATE
USING (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id))
WITH CHECK (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id));

-- ----------------------------------------
-- 20260717231137_6a9230dc-b46c-4b5f-8896-b10d92986ecb.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid NULL,
  user_name text,
  user_role text,
  page text,
  path text,
  event_type text NOT NULL DEFAULT 'page',
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_session ON public.access_logs (session_id, created_at);

GRANT INSERT ON public.access_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert access logs" ON public.access_logs;
CREATE POLICY "Anyone can insert access logs"
  ON public.access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view access logs" ON public.access_logs;
CREATE POLICY "Admins can view access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete access logs" ON public.access_logs;
CREATE POLICY "Admins can delete access logs"
  ON public.access_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260717232946_52c179f8-8742-4862-9fca-82a7b4094a56.sql
-- ----------------------------------------
ALTER TABLE public.online_users REPLICA IDENTITY FULL;
ALTER TABLE public.access_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='access_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs';
  END IF;
END $$;

-- ----------------------------------------
-- 20260719132915_786fe33d-d1e0-4d66-acb0-536b4df35661.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

DROP POLICY IF EXISTS "Admin upload installers" ON storage.objects;
CREATE POLICY "Admin upload installers" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin update installers" ON storage.objects;
CREATE POLICY "Admin update installers" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin delete installers" ON storage.objects;
CREATE POLICY "Admin delete installers" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public read installers" ON storage.objects;
CREATE POLICY "Public read installers" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'installers');

