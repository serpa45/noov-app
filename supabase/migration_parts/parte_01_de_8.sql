-- ================================================================
-- PARTE 1 DE 8 | Migrações 1–30 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260328215956_8a614f56-e6c0-4803-9a7d-472dd86471f7.sql
-- ----------------------------------------
-- Create role enum
CREATE TYPE IF NOT EXISTS public.app_role AS ENUM ('admin', 'lojista', 'afiliado');

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 20260328220639_24ed7897-bda8-4dce-8069-a5be799c8d29.sql
-- ----------------------------------------
-- Add 'entregador' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'entregador';

-- Allow users to insert their own role on signup
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------
-- 20260328221046_d555c714-a21d-43f7-80ee-ae37af017e9e.sql
-- ----------------------------------------
-- Update the handle_new_user trigger to also assign the role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  -- Assign role from metadata if provided
  _role := NEW.raw_user_meta_data->>'role';
  IF _role IS NOT NULL AND _role IN ('admin', 'lojista', 'afiliado', 'entregador') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ----------------------------------------
-- 20260328223617_fa77a547-ce44-417a-9cee-9865c29b63ed.sql
-- ----------------------------------------
-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid NOT NULL,
  cliente_nome text,
  cliente_telefone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  total numeric(10,2) NOT NULL DEFAULT 0,
  endereco_entrega text,
  tipo text NOT NULL DEFAULT 'delivery',
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can view their own orders" ON public.pedidos;
CREATE POLICY "Lojistas can view their own orders"
ON public.pedidos FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

DROP POLICY IF EXISTS "Lojistas can insert their own orders" ON public.pedidos;
CREATE POLICY "Lojistas can insert their own orders"
ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

DROP POLICY IF EXISTS "Lojistas can update their own orders" ON public.pedidos;
CREATE POLICY "Lojistas can update their own orders"
ON public.pedidos FOR UPDATE TO authenticated
USING (lojista_id = auth.uid())
WITH CHECK (lojista_id = auth.uid());

DROP POLICY IF EXISTS "Lojistas can delete their own orders" ON public.pedidos;
CREATE POLICY "Lojistas can delete their own orders"
ON public.pedidos FOR DELETE TO authenticated
USING (lojista_id = auth.uid());

-- Admins podem ver todos os pedidos
DROP POLICY IF EXISTS "Admins can view all orders" ON public.pedidos;
CREATE POLICY "Admins can view all orders"
ON public.pedidos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260328223729_03c482e7-84bb-40fd-89e6-8f9007d960a9.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  segmento text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own store" ON public.lojas;
CREATE POLICY "Users can view their own store"
ON public.lojas FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own store" ON public.lojas;
CREATE POLICY "Users can insert their own store"
ON public.lojas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own store" ON public.lojas;
CREATE POLICY "Users can update their own store"
ON public.lojas FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all stores" ON public.lojas;
CREATE POLICY "Admins can view all stores"
ON public.lojas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260328223925_a59785f8-c2ff-435b-8211-774e967a328a.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL,
  lojista_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  endereco_coleta text,
  endereco_entrega text,
  valor_entrega numeric(10,2) NOT NULL DEFAULT 0,
  observacoes text,
  aceita_em timestamp with time zone,
  finalizada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Entregador vê suas próprias entregas
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;
CREATE POLICY "Entregadores can view their own deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (entregador_id = auth.uid());

-- Entregador pode atualizar suas entregas (aceitar, finalizar)
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;
CREATE POLICY "Entregadores can update their own deliveries"
ON public.entregas FOR UPDATE TO authenticated
USING (entregador_id = auth.uid())
WITH CHECK (entregador_id = auth.uid());

-- Lojista vê entregas da sua loja
DROP POLICY IF EXISTS "Lojistas can view their store deliveries" ON public.entregas;
CREATE POLICY "Lojistas can view their store deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

-- Lojista pode criar entregas
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
CREATE POLICY "Lojistas can insert deliveries"
ON public.entregas FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

-- Admin vê todas
DROP POLICY IF EXISTS "Admins can view all deliveries" ON public.entregas;
CREATE POLICY "Admins can view all deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260328225719_86d1a3ab-e2ec-46fd-8e7b-2d6e551b740e.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  categoria text,
  imagem_url text,
  disponivel boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Lojista vê produtos da sua loja
DROP POLICY IF EXISTS "Lojistas can view their products" ON public.produtos;
CREATE POLICY "Lojistas can view their products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode criar produtos na sua loja
DROP POLICY IF EXISTS "Lojistas can insert their products" ON public.produtos;
CREATE POLICY "Lojistas can insert their products"
ON public.produtos FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode atualizar produtos da sua loja
DROP POLICY IF EXISTS "Lojistas can update their products" ON public.produtos;
CREATE POLICY "Lojistas can update their products"
ON public.produtos FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode deletar produtos da sua loja
DROP POLICY IF EXISTS "Lojistas can delete their products" ON public.produtos;
CREATE POLICY "Lojistas can delete their products"
ON public.produtos FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Admin vê todos os produtos
DROP POLICY IF EXISTS "Admins can view all products" ON public.produtos;
CREATE POLICY "Admins can view all products"
ON public.produtos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260328230039_0d2382ea-a4fc-4af8-8e55-1ef716a3cada.sql
-- ----------------------------------------
-- Allow public (anon) read access to lojas by slug for the public menu
DROP POLICY IF EXISTS "Anyone can view stores by slug" ON public.lojas;
CREATE POLICY "Anyone can view stores by slug"
ON public.lojas FOR SELECT TO anon
USING (true);

-- Allow public (anon) read access to available products for the public menu
DROP POLICY IF EXISTS "Anyone can view available products" ON public.produtos;
CREATE POLICY "Anyone can view available products"
ON public.produtos FOR SELECT TO anon
USING (disponivel = true);

-- ----------------------------------------
-- 20260328230950_dc69e82a-57bf-4151-ba9d-56e8c892a9e5.sql
-- ----------------------------------------
-- Add invite code column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS codigo_convite text UNIQUE DEFAULT substr(md5(random()::text), 1, 6);

-- Update existing rows that have null codigo_convite
UPDATE public.lojas SET codigo_convite = substr(md5(random()::text), 1, 6) WHERE codigo_convite IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE public.lojas ALTER COLUMN codigo_convite SET NOT NULL;

-- Create junction table
CREATE TABLE IF NOT EXISTS public.loja_entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, entregador_id)
);

ALTER TABLE public.loja_entregadores ENABLE ROW LEVEL SECURITY;

-- Entregadores can view their own links
DROP POLICY IF EXISTS "Entregadores can view their links" ON public.loja_entregadores;
CREATE POLICY "Entregadores can view their links"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (entregador_id = auth.uid());

-- Entregadores can insert (link themselves via code)
DROP POLICY IF EXISTS "Entregadores can insert their links" ON public.loja_entregadores;
CREATE POLICY "Entregadores can insert their links"
  ON public.loja_entregadores FOR INSERT
  TO authenticated
  WITH CHECK (entregador_id = auth.uid());

-- Lojistas can view entregadores linked to their stores
DROP POLICY IF EXISTS "Lojistas can view their store entregadores" ON public.loja_entregadores;
CREATE POLICY "Lojistas can view their store entregadores"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojistas can remove entregadores from their stores
DROP POLICY IF EXISTS "Lojistas can delete their store entregadores" ON public.loja_entregadores;
CREATE POLICY "Lojistas can delete their store entregadores"
  ON public.loja_entregadores FOR DELETE
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Allow authenticated users to read lojas by codigo_convite (for linking)
DROP POLICY IF EXISTS "Authenticated can view stores by code" ON public.lojas;
CREATE POLICY "Authenticated can view stores by code"
  ON public.lojas FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- 20260328232234_f896080d-eaef-449a-84b2-71f15740abda.sql
-- ----------------------------------------
-- Drop existing entregador SELECT policy
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;

-- New policy: entregadores see deliveries assigned to them AND from stores they're linked to
DROP POLICY IF EXISTS "Entregadores can view linked store deliveries" ON public.entregas;
CREATE POLICY "Entregadores can view linked store deliveries"
  ON public.entregas FOR SELECT
  TO authenticated
  USING (
    entregador_id = auth.uid()
    AND lojista_id IN (
      SELECT l.user_id FROM public.lojas l
      INNER JOIN public.loja_entregadores le ON le.loja_id = l.id
      WHERE le.entregador_id = auth.uid()
    )
  );

-- Drop existing entregador UPDATE policy  
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;

-- New policy: entregadores can update only deliveries from linked stores
DROP POLICY IF EXISTS "Entregadores can update linked store deliveries" ON public.entregas;
CREATE POLICY "Entregadores can update linked store deliveries"
  ON public.entregas FOR UPDATE
  TO authenticated
  USING (
    entregador_id = auth.uid()
    AND lojista_id IN (
      SELECT l.user_id FROM public.lojas l
      INNER JOIN public.loja_entregadores le ON le.loja_id = l.id
      WHERE le.entregador_id = auth.uid()
    )
  )
  WITH CHECK (
    entregador_id = auth.uid()
  );

-- Update lojista INSERT policy to ensure entregador is linked
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;

DROP POLICY IF EXISTS "Lojistas can insert deliveries to linked entregadores" ON public.entregas;
CREATE POLICY "Lojistas can insert deliveries to linked entregadores"
  ON public.entregas FOR INSERT
  TO authenticated
  WITH CHECK (
    lojista_id = auth.uid()
    AND entregador_id IN (
      SELECT le.entregador_id FROM public.loja_entregadores le
      INNER JOIN public.lojas l ON l.id = le.loja_id
      WHERE l.user_id = auth.uid()
    )
  );

-- ----------------------------------------
-- 20260328235122_7e9eeedf-eb66-4939-8df2-fcf3fb361c1f.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Anyone can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Anyone can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO anon
WITH CHECK (true);

-- ----------------------------------------
-- 20260329000745_5a7278f4-d8d5-4dc0-9e6f-5ae784a050ea.sql
-- ----------------------------------------
-- Add affiliate code to profiles (auto-generated for affiliates)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_afiliado text UNIQUE;

-- Add affiliate reference to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS afiliado_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create commissions table
CREATE TABLE IF NOT EXISTS public.comissoes (
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
DROP POLICY IF EXISTS "Afiliados can view their commissions" ON public.comissoes;
CREATE POLICY "Afiliados can view their commissions"
  ON public.comissoes FOR SELECT TO authenticated
  USING (afiliado_id = auth.uid());

-- RLS: admins can view all commissions
DROP POLICY IF EXISTS "Admins can view all commissions" ON public.comissoes;
CREATE POLICY "Admins can view all commissions"
  ON public.comissoes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: system inserts via lojista context
DROP POLICY IF EXISTS "Lojistas can insert commissions for their stores" ON public.comissoes;
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

-- ----------------------------------------
-- 20260329000821_42e6a868-d7e9-4f37-9ef0-99c9a1bcb7a4.sql
-- ----------------------------------------
-- Allow anyone to look up profiles by affiliate code (for ref linking)
DROP POLICY IF EXISTS "Anyone can lookup by affiliate code" ON public.profiles;
CREATE POLICY "Anyone can lookup by affiliate code"
  ON public.profiles FOR SELECT TO anon
  USING (codigo_afiliado IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can lookup by affiliate code" ON public.profiles;
CREATE POLICY "Authenticated can lookup by affiliate code"
  ON public.profiles FOR SELECT TO authenticated
  USING (codigo_afiliado IS NOT NULL);

-- ----------------------------------------
-- 20260329010411_882fa75e-3484-42c4-afa2-1233b11fa020.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_tipo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_chave text;

-- ----------------------------------------
-- 20260329014608_7cb0f506-12db-4fe7-8ad7-00f91855dc20.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_admin text UNIQUE;

-- ----------------------------------------
-- 20260329021839_9b250788-ff2d-4a35-8062-da363beda37d.sql
-- ----------------------------------------
ALTER TABLE public.lojas 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS endereco_rua text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS endereco_cep text;

-- ----------------------------------------
-- 20260329023228_3f15a7da-ae7d-4fd2-8786-189c4dc25423.sql
-- ----------------------------------------
-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow authenticated users to upload logos
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to update their logos
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos');

-- Allow anyone to view logos
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

-- ----------------------------------------
-- 20260329032155_6c13a938-543e-4b3e-8d2c-8337692a9683.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Admins can update any store" ON public.lojas;
CREATE POLICY "Admins can update any store"
ON public.lojas
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete any store" ON public.lojas;
CREATE POLICY "Admins can delete any store"
ON public.lojas
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260329032609_ecc4c39c-255d-4122-bc53-5a5245265afb.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260329032834_842ff1bc-17be-4271-856b-27e7cc429840.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Admins can update any commission" ON public.comissoes;
CREATE POLICY "Admins can update any commission"
ON public.comissoes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260329035552_6dc3e367-ddf8-46f7-a8ae-e215a69e7019.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.saques (
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
DROP POLICY IF EXISTS "Afiliados can view their withdrawals" ON public.saques;
CREATE POLICY "Afiliados can view their withdrawals"
ON public.saques FOR SELECT TO authenticated
USING (afiliado_id = auth.uid());

-- Affiliates can insert their own withdrawals
DROP POLICY IF EXISTS "Afiliados can insert their withdrawals" ON public.saques;
CREATE POLICY "Afiliados can insert their withdrawals"
ON public.saques FOR INSERT TO authenticated
WITH CHECK (afiliado_id = auth.uid());

-- Admins can view all withdrawals
DROP POLICY IF EXISTS "Admins can view all withdrawals" ON public.saques;
CREATE POLICY "Admins can view all withdrawals"
ON public.saques FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any withdrawal
DROP POLICY IF EXISTS "Admins can update any withdrawal" ON public.saques;
CREATE POLICY "Admins can update any withdrawal"
ON public.saques FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260329040226_6f7ecd35-2dbd-4b21-a00b-d2ad71b62662.sql
-- ----------------------------------------
-- Clean all public tables
DELETE FROM public.saques;
DELETE FROM public.comissoes;
DELETE FROM public.entregas;
DELETE FROM public.loja_entregadores;
DELETE FROM public.pedidos;
DELETE FROM public.produtos;
DELETE FROM public.lojas;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- Create 3 affiliates
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'afiliado1@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Carlos Silva","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'afiliado2@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Maria Santos","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'afiliado3@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Pedro Oliveira","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create 10 lojistas
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'pizzaria@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"João Pizza","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'burger@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Ana Burger","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'acai@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Lucas Açaí","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'lanche@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Fernanda Lanche","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'sushi@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Roberto Sushi","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'churrasco@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Marcos Grill","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'padaria@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Clara Pão","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'pastel@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Diego Pastel","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'marmita@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Juliana Marmita","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'doces@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Patricia Doces","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create 1 admin
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('c3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'admin@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Admin NOOV","role":"admin"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT id, id, json_build_object('sub', id, 'email', email)::jsonb, 'email', id::text, now(), now(), now()
FROM auth.users;

-- Update admin profile with codigo_admin
UPDATE public.profiles SET codigo_admin = 'ADM-NOOV' WHERE user_id = 'c3000000-0000-0000-0000-000000000001';

-- Create stores linked to affiliates
-- Afiliado 1 (Carlos): 4 stores
-- Afiliado 2 (Maria): 3 stores  
-- Afiliado 3 (Pedro): 3 stores
INSERT INTO public.lojas (id, user_id, nome, slug, segmento, afiliado_id) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'Pizzaria Napoli', 'pizzaria-napoli', 'pizzaria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Burger King House', 'burger-king-house', 'hamburgueria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'Açaí Tropical', 'acai-tropical', 'acaiteria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'Lanchonete Central', 'lanchonete-central', 'lanchonete', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', 'Sushi Master', 'sushi-master', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000006', 'Churrascaria Grill', 'churrascaria-grill', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000007', 'Padaria Doce Pão', 'padaria-doce-pao', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000008', 'b2000000-0000-0000-0000-000000000008', 'Pastelaria do Diego', 'pastelaria-diego', 'lanchonete', 'a1000000-0000-0000-0000-000000000003'),
  ('d4000000-0000-0000-0000-000000000009', 'b2000000-0000-0000-0000-000000000009', 'Marmitas da Ju', 'marmitas-da-ju', 'lanchonete', 'a1000000-0000-0000-0000-000000000003'),
  ('d4000000-0000-0000-0000-000000000010', 'b2000000-0000-0000-0000-000000000010', 'Doces da Paty', 'doces-da-paty', 'lanchonete', 'a1000000-0000-0000-0000-000000000003');

-- Pedidos
INSERT INTO public.pedidos (lojista_id, items, total, status, tipo, created_at) VALUES
  ('b2000000-0000-0000-0000-000000000001', '[]', 89.90, 'entregue', 'delivery', now() - interval '2 days'),
  ('b2000000-0000-0000-0000-000000000001', '[]', 120.00, 'entregue', 'delivery', now() - interval '5 days'),
  ('b2000000-0000-0000-0000-000000000002', '[]', 65.50, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000003', '[]', 45.00, 'entregue', 'delivery', now() - interval '3 days'),
  ('b2000000-0000-0000-0000-000000000004', '[]', 32.00, 'entregue', 'delivery', now() - interval '4 days'),
  ('b2000000-0000-0000-0000-000000000005', '[]', 150.00, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000006', '[]', 200.00, 'entregue', 'delivery', now() - interval '2 days'),
  ('b2000000-0000-0000-0000-000000000007', '[]', 55.00, 'entregue', 'delivery', now() - interval '6 days'),
  ('b2000000-0000-0000-0000-000000000008', '[]', 78.00, 'entregue', 'delivery', now() - interval '3 days'),
  ('b2000000-0000-0000-0000-000000000009', '[]', 95.00, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000010', '[]', 42.00, 'entregue', 'delivery', now() - interval '5 days'),
  ('b2000000-0000-0000-0000-000000000001', '[]', 180.00, 'entregue', 'delivery', now()),
  ('b2000000-0000-0000-0000-000000000005', '[]', 110.00, 'entregue', 'delivery', now()),
  ('b2000000-0000-0000-0000-000000000008', '[]', 67.00, 'entregue', 'delivery', now());

-- Comissões
INSERT INTO public.comissoes (afiliado_id, loja_id, valor_pedido, percentual, valor_comissao, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 89.90, 10, 8.99, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 120.00, 10, 12.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 180.00, 10, 18.00, 'pendente'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000002', 65.50, 10, 6.55, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000003', 45.00, 10, 4.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000004', 32.00, 10, 3.20, 'pendente'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000005', 150.00, 10, 15.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000005', 110.00, 10, 11.00, 'pendente'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000006', 200.00, 10, 20.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000007', 55.00, 10, 5.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000008', 78.00, 10, 7.80, 'pago'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000008', 67.00, 10, 6.70, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000009', 95.00, 10, 9.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000010', 42.00, 10, 4.20, 'pago');

-- ----------------------------------------
-- 20260329040334_726b190a-c8b0-420c-b537-19cd744d5f62.sql
-- ----------------------------------------
-- Add codigo_acesso column for affiliate panel login (separate from sharing link code)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_acesso text;

-- CREATE UNIQUE INDEX IF NOT EXISTS CREATE UNIQUE INDEX IF NOT EXISTS profiles_codigo_acesso_unique ON public.profiles (codigo_acesso) WHERE codigo_acesso IS NOT NULL;

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

-- ----------------------------------------
-- 20260329040600_de57ec04-031a-4f8f-aca3-d218c7d6054c.sql
-- ----------------------------------------
-- Allow anon/authenticated lookup by codigo_acesso for login
DROP POLICY IF EXISTS "Anyone can lookup by access code" ON public.profiles;
CREATE POLICY "Anyone can lookup by access code"
ON public.profiles
FOR SELECT
TO anon
USING (codigo_acesso IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can lookup by access code" ON public.profiles;
CREATE POLICY "Authenticated can lookup by access code"
ON public.profiles
FOR SELECT
TO authenticated
USING (codigo_acesso IS NOT NULL);

-- ----------------------------------------
-- 20260329041142_d9f87a99-6db0-403b-bac3-724d7e1e4a6a.sql
-- ----------------------------------------
-- Delete the broken admin user and recreate properly
-- First clean up dependent data
DELETE FROM public.user_roles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.identities WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.sessions WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.refresh_tokens WHERE user_id = 'c3000000-0000-0000-0000-000000000001'::text;
DELETE FROM auth.mfa_factors WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id = 'c3000000-0000-0000-0000-000000000001';

-- ----------------------------------------
-- 20260329043000_c4647108-92e8-4b99-9a6c-b252d4f17e8e.sql
-- ----------------------------------------
-- Plans table for admin to manage
CREATE TABLE IF NOT EXISTS public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  preco numeric NOT NULL DEFAULT 0,
  periodo text NOT NULL DEFAULT '/mês',
  descricao text,
  popular boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limites jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_texto text NOT NULL DEFAULT 'Assinar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Store subscription linking store to plan with locked price
CREATE TABLE IF NOT EXISTS public.loja_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  preco_assinado numeric NOT NULL,
  features_assinado jsonb NOT NULL DEFAULT '[]'::jsonb,
  limites_assinado jsonb NOT NULL DEFAULT '{}'::jsonb,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

-- RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_planos ENABLE ROW LEVEL SECURITY;

-- Plans: anyone can read active plans (landing page)
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.planos;
CREATE POLICY "Anyone can view active plans" ON public.planos FOR SELECT TO anon USING (ativo = true);
DROP POLICY IF EXISTS "Authenticated can view active plans" ON public.planos;
CREATE POLICY "Authenticated can view active plans" ON public.planos FOR SELECT TO authenticated USING (ativo = true);
DROP POLICY IF EXISTS "Admins can manage plans" ON public.planos;
CREATE POLICY "Admins can manage plans" ON public.planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Loja planos: lojistas see their own, admins see all
DROP POLICY IF EXISTS "Lojistas can view their plan" ON public.loja_planos;
CREATE POLICY "Lojistas can view their plan" ON public.loja_planos FOR SELECT TO authenticated USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can manage all loja_planos" ON public.loja_planos;
CREATE POLICY "Admins can manage all loja_planos" ON public.loja_planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default plans
INSERT INTO public.planos (nome, slug, preco, periodo, descricao, popular, ordem, features, limites, cta_texto) VALUES
('Start', 'start', 0, 'para sempre', 'Ideal para validar seu negócio e começar a vender', false, 1,
 '["Até 30 produtos", "Até 100 clientes", "Pedidos online", "Painel básico", "Branding NOOV", "Suporte por e-mail"]'::jsonb,
 '{"max_produtos": 30, "max_clientes": 100, "pdv": false, "entregas": false, "whatsapp": false, "cupons": false, "relatorios": false, "sem_branding": false, "multi_lojas": false, "api": false, "dominio": false}'::jsonb,
 'Começar Grátis'),
('Pro', 'pro', 97, '/mês', 'Para negócios em crescimento que querem escalar vendas', true, 2,
 '["Produtos ilimitados", "Clientes ilimitados", "PDV Balcão + Garçom", "Gestão de entregas", "Automação WhatsApp", "Cupons inteligentes", "Relatórios de lucro real", "Sem branding NOOV", "Suporte prioritário"]'::jsonb,
 '{"max_produtos": -1, "max_clientes": -1, "pdv": true, "entregas": true, "whatsapp": true, "cupons": true, "relatorios": true, "sem_branding": true, "multi_lojas": false, "api": false, "dominio": false}'::jsonb,
 'Assinar Pro'),
('Ultra', 'ultra', 197, '/mês', 'Tudo ilimitado para operação profissional de alto volume', false, 3,
 '["Tudo do Pro", "Multi-lojas", "API aberta", "Domínio personalizado", "Recompra automática", "Programa de fidelidade", "Relatórios de BI", "Gerente de conta dedicado"]'::jsonb,
 '{"max_produtos": -1, "max_clientes": -1, "pdv": true, "entregas": true, "whatsapp": true, "cupons": true, "relatorios": true, "sem_branding": true, "multi_lojas": true, "api": true, "dominio": true}'::jsonb,
 'Assinar Ultra');

-- ----------------------------------------
-- 20260329050022_2c4b0ed8-c5cd-4eb4-a916-c7fce7437fb0.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN pix_nome_favorecido text;

-- ----------------------------------------
-- 20260329053507_917cca52-9c82-459e-a85d-ec06056806c0.sql
-- ----------------------------------------
-- Allow admins to delete profiles
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
DROP POLICY IF EXISTS "Admins can delete any user_role" ON public.user_roles;
CREATE POLICY "Admins can delete any user_role"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete comissoes
DROP POLICY IF EXISTS "Admins can delete any commission" ON public.comissoes;
CREATE POLICY "Admins can delete any commission"
ON public.comissoes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete saques
DROP POLICY IF EXISTS "Admins can delete any withdrawal" ON public.saques;
CREATE POLICY "Admins can delete any withdrawal"
ON public.saques FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260329144109_b47a5341-518e-4085-80ea-d19af9c46efd.sql
-- ----------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view category images" ON storage.objects;
CREATE POLICY "Anyone can view category images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Authenticated users can upload category images" ON storage.objects;
CREATE POLICY "Authenticated users can upload category images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category-images');

DROP POLICY IF EXISTS "Authenticated users can update category images" ON storage.objects;
CREATE POLICY "Authenticated users can update category images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category-images')
WITH CHECK (bucket_id = 'category-images');

-- ----------------------------------------
-- 20260329150409_4fc25b22-1d65-43fd-8481-1a2c280c4dda.sql
-- ----------------------------------------
-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload product images
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow anyone to view product images (public bucket)
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to update their product images
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete their product images
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

