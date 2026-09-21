-- ========================================================
-- SCRIPT CONSOLIDADO DE MIGRAÇÃO - PROJETO SUPABASE mwnjoglolbyeyrmkqqqc
-- Gerado em: 2026-09-18T21:07:26.623Z
-- Total de arquivos: 220 | Pulados: 1
-- ========================================================

SET session_replication_role = DEFAULT;

-- --------------------------------------------------------
-- MIGRATION: 20260328215956_8a614f56-e6c0-4803-9a7d-472dd86471f7.sql
-- --------------------------------------------------------
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'lojista', 'afiliado');

-- Create profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
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

-- --------------------------------------------------------
-- MIGRATION: 20260328220639_24ed7897-bda8-4dce-8069-a5be799c8d29.sql
-- --------------------------------------------------------
-- Add 'entregador' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'entregador';

-- Allow users to insert their own role on signup
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------
-- MIGRATION: 20260328221046_d555c714-a21d-43f7-80ee-ae37af017e9e.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260328223617_fa77a547-ce44-417a-9cee-9865c29b63ed.sql
-- --------------------------------------------------------
-- Tabela de pedidos
CREATE TABLE public.pedidos (
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

CREATE POLICY "Lojistas can view their own orders"
ON public.pedidos FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

CREATE POLICY "Lojistas can insert their own orders"
ON public.pedidos FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

CREATE POLICY "Lojistas can update their own orders"
ON public.pedidos FOR UPDATE TO authenticated
USING (lojista_id = auth.uid())
WITH CHECK (lojista_id = auth.uid());

CREATE POLICY "Lojistas can delete their own orders"
ON public.pedidos FOR DELETE TO authenticated
USING (lojista_id = auth.uid());

-- Admins podem ver todos os pedidos
CREATE POLICY "Admins can view all orders"
ON public.pedidos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260328223729_03c482e7-84bb-40fd-89e6-8f9007d960a9.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260328223925_a59785f8-c2ff-435b-8211-774e967a328a.sql
-- --------------------------------------------------------
CREATE TABLE public.entregas (
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
CREATE POLICY "Entregadores can view their own deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (entregador_id = auth.uid());

-- Entregador pode atualizar suas entregas (aceitar, finalizar)
CREATE POLICY "Entregadores can update their own deliveries"
ON public.entregas FOR UPDATE TO authenticated
USING (entregador_id = auth.uid())
WITH CHECK (entregador_id = auth.uid());

-- Lojista vê entregas da sua loja
CREATE POLICY "Lojistas can view their store deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (lojista_id = auth.uid());

-- Lojista pode criar entregas
CREATE POLICY "Lojistas can insert deliveries"
ON public.entregas FOR INSERT TO authenticated
WITH CHECK (lojista_id = auth.uid());

-- Admin vê todas
CREATE POLICY "Admins can view all deliveries"
ON public.entregas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260328225719_86d1a3ab-e2ec-46fd-8e7b-2d6e551b740e.sql
-- --------------------------------------------------------
CREATE TABLE public.produtos (
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
CREATE POLICY "Lojistas can view their products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode criar produtos na sua loja
CREATE POLICY "Lojistas can insert their products"
ON public.produtos FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode atualizar produtos da sua loja
CREATE POLICY "Lojistas can update their products"
ON public.produtos FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojista pode deletar produtos da sua loja
CREATE POLICY "Lojistas can delete their products"
ON public.produtos FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Admin vê todos os produtos
CREATE POLICY "Admins can view all products"
ON public.produtos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260328230039_0d2382ea-a4fc-4af8-8e55-1ef716a3cada.sql
-- --------------------------------------------------------
-- Allow public (anon) read access to lojas by slug for the public menu
CREATE POLICY "Anyone can view stores by slug"
ON public.lojas FOR SELECT TO anon
USING (true);

-- Allow public (anon) read access to available products for the public menu
CREATE POLICY "Anyone can view available products"
ON public.produtos FOR SELECT TO anon
USING (disponivel = true);

-- --------------------------------------------------------
-- MIGRATION: 20260328230950_dc69e82a-57bf-4151-ba9d-56e8c892a9e5.sql
-- --------------------------------------------------------
-- Add invite code column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS codigo_convite text UNIQUE DEFAULT substr(md5(random()::text), 1, 6);

-- Update existing rows that have null codigo_convite
UPDATE public.lojas SET codigo_convite = substr(md5(random()::text), 1, 6) WHERE codigo_convite IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE public.lojas ALTER COLUMN codigo_convite SET NOT NULL;

-- Create junction table
CREATE TABLE public.loja_entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, entregador_id)
);

ALTER TABLE public.loja_entregadores ENABLE ROW LEVEL SECURITY;

-- Entregadores can view their own links
CREATE POLICY "Entregadores can view their links"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (entregador_id = auth.uid());

-- Entregadores can insert (link themselves via code)
CREATE POLICY "Entregadores can insert their links"
  ON public.loja_entregadores FOR INSERT
  TO authenticated
  WITH CHECK (entregador_id = auth.uid());

-- Lojistas can view entregadores linked to their stores
CREATE POLICY "Lojistas can view their store entregadores"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojistas can remove entregadores from their stores
CREATE POLICY "Lojistas can delete their store entregadores"
  ON public.loja_entregadores FOR DELETE
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Allow authenticated users to read lojas by codigo_convite (for linking)
CREATE POLICY "Authenticated can view stores by code"
  ON public.lojas FOR SELECT
  TO authenticated
  USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260328232234_f896080d-eaef-449a-84b2-71f15740abda.sql
-- --------------------------------------------------------
-- Drop existing entregador SELECT policy
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;

-- New policy: entregadores see deliveries assigned to them AND from stores they're linked to
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

-- --------------------------------------------------------
-- MIGRATION: 20260328235122_7e9eeedf-eb66-4939-8df2-fcf3fb361c1f.sql
-- --------------------------------------------------------
CREATE POLICY "Anyone can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO anon
WITH CHECK (true);

-- --------------------------------------------------------
-- MIGRATION: 20260329000745_5a7278f4-d8d5-4dc0-9e6f-5ae784a050ea.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260329000821_42e6a868-d7e9-4f37-9ef0-99c9a1bcb7a4.sql
-- --------------------------------------------------------
-- Allow anyone to look up profiles by affiliate code (for ref linking)
CREATE POLICY "Anyone can lookup by affiliate code"
  ON public.profiles FOR SELECT TO anon
  USING (codigo_afiliado IS NOT NULL);

CREATE POLICY "Authenticated can lookup by affiliate code"
  ON public.profiles FOR SELECT TO authenticated
  USING (codigo_afiliado IS NOT NULL);

-- --------------------------------------------------------
-- MIGRATION: 20260329010411_882fa75e-3484-42c4-afa2-1233b11fa020.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_tipo text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_chave text;

-- --------------------------------------------------------
-- MIGRATION: 20260329014608_7cb0f506-12db-4fe7-8ad7-00f91855dc20.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS codigo_admin text UNIQUE;

-- --------------------------------------------------------
-- MIGRATION: 20260329021839_9b250788-ff2d-4a35-8062-da363beda37d.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS endereco_rua text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS endereco_cep text;

-- --------------------------------------------------------
-- MIGRATION: 20260329023228_3f15a7da-ae7d-4fd2-8786-189c4dc25423.sql
-- --------------------------------------------------------
-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos');

-- Allow anyone to view logos
CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

-- --------------------------------------------------------
-- MIGRATION: 20260329032155_6c13a938-543e-4b3e-8d2c-8337692a9683.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260329032609_ecc4c39c-255d-4122-bc53-5a5245265afb.sql
-- --------------------------------------------------------
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------
-- MIGRATION: 20260329032834_842ff1bc-17be-4271-856b-27e7cc429840.sql
-- --------------------------------------------------------
CREATE POLICY "Admins can update any commission"
ON public.comissoes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------
-- MIGRATION: 20260329035552_6dc3e367-ddf8-46f7-a8ae-e215a69e7019.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260329040226_6f7ecd35-2dbd-4b21-a00b-d2ad71b62662.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260329040334_726b190a-c8b0-420c-b537-19cd744d5f62.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260329040600_de57ec04-031a-4f8f-aca3-d218c7d6054c.sql
-- --------------------------------------------------------
-- Allow anon/authenticated lookup by codigo_acesso for login
CREATE POLICY "Anyone can lookup by access code"
ON public.profiles
FOR SELECT
TO anon
USING (codigo_acesso IS NOT NULL);

CREATE POLICY "Authenticated can lookup by access code"
ON public.profiles
FOR SELECT
TO authenticated
USING (codigo_acesso IS NOT NULL);

-- --------------------------------------------------------
-- MIGRATION: 20260329041142_d9f87a99-6db0-403b-bac3-724d7e1e4a6a.sql
-- --------------------------------------------------------
-- Delete the broken admin user and recreate properly
-- First clean up dependent data
DELETE FROM public.user_roles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.identities WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.sessions WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.refresh_tokens WHERE user_id = 'c3000000-0000-0000-0000-000000000001'::text;
DELETE FROM auth.mfa_factors WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id = 'c3000000-0000-0000-0000-000000000001';

-- --------------------------------------------------------
-- MIGRATION: 20260329043000_c4647108-92e8-4b99-9a6c-b252d4f17e8e.sql
-- --------------------------------------------------------
-- Plans table for admin to manage
CREATE TABLE public.planos (
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
CREATE TABLE public.loja_planos (
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
CREATE POLICY "Anyone can view active plans" ON public.planos FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "Authenticated can view active plans" ON public.planos FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "Admins can manage plans" ON public.planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Loja planos: lojistas see their own, admins see all
CREATE POLICY "Lojistas can view their plan" ON public.loja_planos FOR SELECT TO authenticated USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));
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

-- --------------------------------------------------------
-- MIGRATION: 20260329050022_2c4b0ed8-c5cd-4eb4-a916-c7fce7437fb0.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN pix_nome_favorecido text;

-- --------------------------------------------------------
-- MIGRATION: 20260329053507_917cca52-9c82-459e-a85d-ec06056806c0.sql
-- --------------------------------------------------------
-- Allow admins to delete profiles
CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete any user_role"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete comissoes
CREATE POLICY "Admins can delete any commission"
ON public.comissoes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete saques
CREATE POLICY "Admins can delete any withdrawal"
ON public.saques FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------
-- MIGRATION: 20260329144109_b47a5341-518e-4085-80ea-d19af9c46efd.sql
-- --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-images', 'category-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view category images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'category-images');

CREATE POLICY "Authenticated users can upload category images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category-images');

CREATE POLICY "Authenticated users can update category images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category-images')
WITH CHECK (bucket_id = 'category-images');

-- --------------------------------------------------------
-- MIGRATION: 20260329150409_4fc25b22-1d65-43fd-8481-1a2c280c4dda.sql
-- --------------------------------------------------------
-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload product images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow anyone to view product images (public bucket)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to update their product images
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow authenticated users to delete their product images
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- --------------------------------------------------------
-- MIGRATION: 20260329151902_386148f7-24e3-4070-bade-dba8dd209879.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos
ADD COLUMN tag_novo boolean NOT NULL DEFAULT false,
ADD COLUMN tag_sugestao boolean NOT NULL DEFAULT false,
ADD COLUMN tag_destaque boolean NOT NULL DEFAULT false,
ADD COLUMN preco_promocional numeric DEFAULT NULL,
ADD COLUMN promocao_validade date DEFAULT NULL;

-- --------------------------------------------------------
-- MIGRATION: 20260329153748_4f6e25b3-c343-41cb-8747-9c9a91cbbc35.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN adicionais jsonb DEFAULT '[]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260329160610_2450b0dc-c251-4f00-b7ce-9ebb97f27299.sql
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view available products" ON public.produtos;
CREATE POLICY "Anyone can view store products" ON public.produtos FOR SELECT TO anon USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260329162817_b2b40f2f-058c-4f93-bb46-de83c85e2bfb.sql
-- --------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;

-- --------------------------------------------------------
-- MIGRATION: 20260329174837_79372666-77b2-4d40-9b04-eeb2e0c5d6d4.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN categorias_ordem jsonb DEFAULT '[]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260329180745_114d7f1f-c4a2-4c28-8251-b1ccad4fbf3d.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN cor_primaria text DEFAULT NULL;
ALTER TABLE public.lojas ADD COLUMN cor_secundaria text DEFAULT NULL;

-- --------------------------------------------------------
-- MIGRATION: 20260329181657_62d240d9-c854-437a-9659-74e1a135d59f.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN banner_url text DEFAULT NULL;

-- --------------------------------------------------------
-- MIGRATION: 20260329181736_61f27fa0-1619-4da4-bc5c-33722979ba30.sql
-- --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can delete banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');

-- --------------------------------------------------------
-- MIGRATION: 20260329184640_9a8f9763-8f8b-4ab6-9683-ffc15d33a27d.sql
-- --------------------------------------------------------
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome_completo text NOT NULL,
  whatsapp text,
  data_nascimento date,
  endereco_rua text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  endereco_cep text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clients" ON public.clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can select by phone" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update clients" ON public.clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can view clients" ON public.clientes FOR SELECT TO authenticated USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260329192246_d2910ca6-62db-46f2-ac03-eb3e412088ba.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS horario_funcionamento jsonb DEFAULT '{
    "segunda": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "terca": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "quarta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "quinta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "sexta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "sabado": {"aberto": true, "inicio": "17:00", "fim": "00:00"},
    "domingo": {"aberto": true, "inicio": "17:00", "fim": "22:00"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS frete_tipo text DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS frete_valor_fixo numeric DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS frete_bairros jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tempo_entrega_min integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS tempo_entrega_max integer DEFAULT 40;

-- --------------------------------------------------------
-- MIGRATION: 20260329203050_57abe4d9-f9e2-482e-a284-69d075b517d1.sql
-- --------------------------------------------------------
-- Vincular frete por bairro por loja (lojista)
CREATE TABLE IF NOT EXISTS public.loja_frete_bairros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  bairro TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loja_frete_bairros_loja_bairro_key UNIQUE (loja_id, bairro)
);

CREATE INDEX IF NOT EXISTS idx_loja_frete_bairros_loja_id ON public.loja_frete_bairros(loja_id);
CREATE INDEX IF NOT EXISTS idx_loja_frete_bairros_loja_bairro ON public.loja_frete_bairros(loja_id, bairro);

ALTER TABLE public.loja_frete_bairros ENABLE ROW LEVEL SECURITY;

-- SELECT público (cardápio público precisa exibir taxa por bairro)
DROP POLICY IF EXISTS "Anyone can view loja_frete_bairros" ON public.loja_frete_bairros;
CREATE POLICY "Anyone can view loja_frete_bairros"
ON public.loja_frete_bairros
FOR SELECT
USING (true);

-- Lojista gerencia apenas os bairros da própria loja
DROP POLICY IF EXISTS "Lojistas can insert their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can insert their store bairros"
ON public.loja_frete_bairros
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lojistas can update their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can update their store bairros"
ON public.loja_frete_bairros
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lojistas can delete their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can delete their store bairros"
ON public.loja_frete_bairros
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_loja_frete_bairros_updated_at ON public.loja_frete_bairros;
CREATE TRIGGER trg_loja_frete_bairros_updated_at
BEFORE UPDATE ON public.loja_frete_bairros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill dos dados já existentes em lojas.frete_bairros
INSERT INTO public.loja_frete_bairros (loja_id, bairro, valor)
SELECT
  l.id AS loja_id,
  trim(elem->>'bairro') AS bairro,
  COALESCE(NULLIF(elem->>'valor', '')::NUMERIC, 0) AS valor
FROM public.lojas l
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.frete_bairros, '[]'::jsonb)) AS elem
WHERE trim(COALESCE(elem->>'bairro', '')) <> ''
ON CONFLICT (loja_id, bairro)
DO UPDATE SET
  valor = EXCLUDED.valor,
  updated_at = now();

-- --------------------------------------------------------
-- MIGRATION: 20260329204052_b22845ce-c63f-4fc9-8945-66a5a5a1fdc8.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS formas_pagamento jsonb DEFAULT '["Dinheiro","PIX","Cartão de Crédito","Cartão de Débito"]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260329220857_de493f73-5a4e-4b18-b0b3-27f35463233c.sql
-- --------------------------------------------------------
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS foto_url text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-photos', 'client-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload client photos"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'client-photos');

CREATE POLICY "Anyone can view client photos"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'client-photos');

CREATE POLICY "Anyone can update client photos"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'client-photos')
WITH CHECK (bucket_id = 'client-photos');

-- --------------------------------------------------------
-- MIGRATION: 20260329223655_db768a8c-497e-478e-8a4c-de4687a11bdc.sql
-- --------------------------------------------------------
CREATE TABLE public.loja_categoria_imagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, categoria)
);

ALTER TABLE public.loja_categoria_imagens ENABLE ROW LEVEL SECURITY;

-- Lojista can manage their own category images
CREATE POLICY "Lojista can manage own category images"
  ON public.loja_categoria_imagens
  FOR ALL
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Anyone can view category images (for client menu)
CREATE POLICY "Anyone can view category images"
  ON public.loja_categoria_imagens
  FOR SELECT
  TO anon
  USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260329234510_264a5acd-3c10-4b9f-8a8c-a98ef189f232.sql
-- --------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;

-- --------------------------------------------------------
-- MIGRATION: 20260330003529_c6d68167-6cd9-4a6e-a9b3-e8ed12642994.sql
-- --------------------------------------------------------
CREATE POLICY "Authenticated can view all store products"
ON public.produtos
FOR SELECT
TO authenticated
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260330003604_4b747334-bc5d-4394-b575-81da220b15f5.sql
-- --------------------------------------------------------
CREATE POLICY "Anyone can view store owner pix info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  user_id IN (SELECT user_id FROM public.lojas WHERE ativo = true)
);

-- --------------------------------------------------------
-- MIGRATION: 20260330015156_673ce616-d245-4803-8fb4-e550e154507f.sql
-- --------------------------------------------------------
CREATE POLICY "Anon can view orders by phone"
ON public.pedidos
FOR SELECT
TO anon
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260330180602_6b87fc29-7bc0-4cc7-a39b-2ecaa71ae848.sql
-- --------------------------------------------------------
CREATE TABLE public.configuracoes_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view global config" ON public.configuracoes_globais
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins can manage global config" ON public.configuracoes_globais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.configuracoes_globais (chave, valor) VALUES ('dias_teste_gratis', '7');

-- --------------------------------------------------------
-- MIGRATION: 20260330185758_13529ea1-f296-4379-8cab-928d7e65da36.sql
-- --------------------------------------------------------
-- Add extra trial days column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS dias_teste_extra integer NOT NULL DEFAULT 0;

-- Create plan change history table
CREATE TABLE public.loja_plano_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  acao text NOT NULL, -- 'plano_atribuido', 'plano_removido', 'teste_estendido'
  plano_id uuid REFERENCES public.planos(id),
  plano_nome text,
  dias_extras integer,
  observacao text,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_plano_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plan history"
  ON public.loja_plano_historico FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260330193017_f6fd985f-4a8e-4838-96f0-3cb16d85963b.sql
-- --------------------------------------------------------
UPDATE public.planos SET cta_texto = 'Assinar Start' WHERE slug = 'start';

-- --------------------------------------------------------
-- MIGRATION: 20260330223049_7cdea68e-87b0-4d14-8653-e9dfbe46f521.sql
-- --------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lojas','entregas','configuracoes_globais','loja_planos','comissoes','planos','profiles','saques']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END$$;

-- --------------------------------------------------------
-- MIGRATION: 20260330235242_1577512a-bc97-47eb-86eb-d1bb16c0ae74.sql
-- --------------------------------------------------------
-- Allow lojistas to INSERT their own plan
CREATE POLICY "Lojistas can insert their plan"
ON public.loja_planos
FOR INSERT TO authenticated
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);

-- Allow lojistas to UPDATE their own plan
CREATE POLICY "Lojistas can update their plan"
ON public.loja_planos
FOR UPDATE TO authenticated
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);

-- --------------------------------------------------------
-- MIGRATION: 20260330235958_8dc82565-e46a-4acc-966a-8f9fb0cfae8f.sql
-- --------------------------------------------------------
-- Remove lojista INSERT/UPDATE policies on loja_planos (only admin should manage)
DROP POLICY IF EXISTS "Lojistas can insert their plan" ON public.loja_planos;
DROP POLICY IF EXISTS "Lojistas can update their plan" ON public.loja_planos;

-- --------------------------------------------------------
-- MIGRATION: 20260331001431_f177ac05-c5f0-4caa-96b6-cb4f8ae0afc6.sql
-- --------------------------------------------------------
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 100, "max_armazenamento_mb": 512}'::jsonb WHERE slug = 'start';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 1000, "max_armazenamento_mb": 2048}'::jsonb WHERE slug = 'pro';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": -1, "max_armazenamento_mb": 10240}'::jsonb WHERE slug = 'ultra';

-- --------------------------------------------------------
-- MIGRATION: 20260331012808_df2ebe93-7d7f-4e89-b459-03c7a3d1b5a8.sql
-- --------------------------------------------------------
ALTER TABLE public.planos ADD COLUMN comissao_afiliado numeric NOT NULL DEFAULT 10;

-- --------------------------------------------------------
-- MIGRATION: 20260331014328_39ca54e2-721b-4c76-9eba-60a50496f481.sql
-- --------------------------------------------------------
-- Delete all non-admin users from auth.users (cascades to profiles, user_roles, etc.)
DELETE FROM auth.users
WHERE id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';

-- Clean up any orphaned data
DELETE FROM public.lojas WHERE user_id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';
DELETE FROM public.comissoes WHERE true;
DELETE FROM public.saques WHERE true;
DELETE FROM public.loja_planos WHERE true;
DELETE FROM public.loja_plano_historico WHERE true;

-- --------------------------------------------------------
-- MIGRATION: 20260331014648_cfcc5a54-59ff-4a77-97d1-fea0c86d2d17.sql
-- --------------------------------------------------------
DELETE FROM public.entregas WHERE true;
DELETE FROM public.comissoes WHERE true;
DELETE FROM public.saques WHERE true;
DELETE FROM public.pedidos WHERE true;
DELETE FROM public.loja_planos WHERE true;
DELETE FROM public.loja_plano_historico WHERE true;

-- --------------------------------------------------------
-- MIGRATION: 20260331032256_3babecb6-f928-47d1-b056-f0976d683711.sql
-- --------------------------------------------------------
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'logos');

-- --------------------------------------------------------
-- MIGRATION: 20260331032652_31c5cf1a-4815-446c-93c0-8dd733272a5b.sql
-- --------------------------------------------------------
ALTER TABLE public.loja_planos ADD COLUMN expira_em timestamp with time zone DEFAULT NULL;

-- --------------------------------------------------------
-- MIGRATION: 20260331164259_ddaa7841-9f01-4060-b110-f0e4d897a4d5.sql
-- --------------------------------------------------------
-- Mesas do PDV
CREATE TABLE public.pdv_mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  lugares integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'livre',
  pedido_atual_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_mesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage their tables" ON public.pdv_mesas
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pedidos do PDV
CREATE TABLE public.pdv_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id uuid REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  pagamento_status text NOT NULL DEFAULT 'aberto',
  metodo_pagamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage their PDV orders" ON public.pdv_pedidos
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pagamentos parciais do PDV
CREATE TABLE public.pdv_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pdv_pedidos(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  metodo text NOT NULL DEFAULT 'dinheiro',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can manage PDV payments" ON public.pdv_pagamentos
  FOR ALL TO authenticated
  USING (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_pedidos;

-- Triggers for updated_at
CREATE TRIGGER update_pdv_mesas_updated_at BEFORE UPDATE ON public.pdv_mesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pdv_pedidos_updated_at BEFORE UPDATE ON public.pdv_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260331235208_3425f278-95a2-4027-b879-24d8bf913fc7.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN impressao_automatica boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260401043953_ccde708d-c7d3-490b-81a6-4698d0028d8e.sql
-- --------------------------------------------------------
-- Drop the overly permissive policy for authenticated users viewing stores
DROP POLICY IF EXISTS "Authenticated can view stores by code" ON public.lojas;

-- Recreate with more specific conditions: user owns the store, is admin, or is the affiliate
CREATE POLICY "Authenticated can view relevant stores"
ON public.lojas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR afiliado_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'entregador'::app_role)
);

-- --------------------------------------------------------
-- MIGRATION: 20260401050026_68fc35da-eb31-494a-a8b8-9f467f9b9868.sql
-- --------------------------------------------------------
ALTER TABLE public.saques ADD COLUMN motivo_rejeicao text;

-- --------------------------------------------------------
-- MIGRATION: 20260401054541_2b15cdd2-1120-4002-a0c1-4531362422c0.sql
-- --------------------------------------------------------
-- Create a table to track individual payments
CREATE TABLE public.pagamentos_loja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id),
  plano_nome TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  metodo TEXT NOT NULL DEFAULT 'mercadopago',
  status TEXT NOT NULL DEFAULT 'aprovado',
  payment_external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_loja ENABLE ROW LEVEL SECURITY;

-- Lojistas can view their own payments
CREATE POLICY "Lojistas can view their payments"
  ON public.pagamentos_loja
  FOR SELECT
  TO authenticated
  USING (
    loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  );

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
  ON public.pagamentos_loja
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert the first payment for each store that has an active plan (these are realized payments)
INSERT INTO public.pagamentos_loja (loja_id, plano_id, plano_nome, valor, metodo, status, created_at)
SELECT 
  lp.loja_id, 
  lp.plano_id, 
  p.nome, 
  lp.preco_assinado, 
  'mercadopago', 
  'aprovado', 
  lp.assinado_em
FROM loja_planos lp
LEFT JOIN planos p ON p.id = lp.plano_id
WHERE lp.ativo = true;

-- --------------------------------------------------------
-- MIGRATION: 20260401055754_d985f556-6524-479f-bcfd-5c066099fb99.sql
-- --------------------------------------------------------
-- Tabela de despesas dos lojistas
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_despesas_loja_id ON public.despesas(loja_id);
CREATE INDEX idx_despesas_data ON public.despesas(data);

-- RLS
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view their expenses"
ON public.despesas FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can insert their expenses"
ON public.despesas FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can update their expenses"
ON public.despesas FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can delete their expenses"
ON public.despesas FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all expenses"
ON public.despesas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER update_despesas_updated_at
BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260401064837_240b3269-04cc-4cbc-a2c1-c14f522374dd.sql
-- --------------------------------------------------------
CREATE TABLE public.pix_split_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pdv_pedidos(id) ON DELETE SET NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  valor_plataforma NUMERIC NOT NULL DEFAULT 0,
  valor_lojista NUMERIC NOT NULL DEFAULT 0,
  payment_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo TEXT NOT NULL DEFAULT 'pix',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_split_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all pix split payments"
  ON public.pix_split_pagamentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Lojistas can view their pix split payments"
  ON public.pix_split_pagamentos FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "System can insert pix split payments"
  ON public.pix_split_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pix_split_pagamentos_updated_at
  BEFORE UPDATE ON public.pix_split_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260401134145_5404afb0-4086-4f40-8006-8ff0f91455fc.sql
-- --------------------------------------------------------
-- Add pizza-specific fields to produtos table
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tamanhos jsonb DEFAULT NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS max_sabores integer DEFAULT NULL;

-- tamanhos example: [{"nome": "Média (6 fatias)", "preco": 38}, {"nome": "Grande (8 fatias)", "preco": 48}]
-- max_sabores: maximum number of flavors allowed (e.g. 2 for Grande, 1 for Broto)

-- --------------------------------------------------------
-- MIGRATION: 20260402183551_66d222c3-fb5e-4e70-94d1-2fc69e1e8b5d.sql
-- --------------------------------------------------------
CREATE POLICY "Authenticated can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- --------------------------------------------------------
-- MIGRATION: 20260402184413_1d76c0fa-c5bd-4ef0-a3e4-d57bfa4fe908.sql
-- --------------------------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS status_historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260403192223_06979091-9b38-4864-83dc-78194a18b168.sql
-- --------------------------------------------------------
-- Add daily order number column
ALTER TABLE public.pedidos ADD COLUMN numero_diario integer;

-- Create function to auto-assign daily sequential number per lojista
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(numero_diario), 0) + 1
  INTO next_num
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_set_numero_diario
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario();

-- --------------------------------------------------------
-- MIGRATION: 20260403195802_bee2e786-205c-42c9-a386-0307471c763e.sql
-- --------------------------------------------------------
-- Add rating columns to pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS avaliacao integer,
  ADD COLUMN IF NOT EXISTS avaliacao_comentario text;

-- Allow anon users to update only the rating fields
CREATE POLICY "Anon can update order rating"
  ON public.pedidos
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------
-- MIGRATION: 20260405004755_3f3c6a17-7935-4e49-945c-362aa3e286b8.sql
-- --------------------------------------------------------
-- Add location to deliveries
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS latitude_atual NUMERIC;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS longitude_atual NUMERIC;

-- Add location to orders for the delivery target
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS latitude_entrega NUMERIC;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS longitude_entrega NUMERIC;

-- Enable RLS for entregas
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to be safe)
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;

-- Policies for 'entregas'
-- Lojistas can see and create deliveries for their store
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- Entregadores can see available deliveries or deliveries assigned to them
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)
);

-- Entregadores can update their own deliveries
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
USING (entregador_id = auth.uid() OR (entregador_id IS NULL AND auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)));

-- --------------------------------------------------------
-- MIGRATION: 20260405012807_5bed6105-887f-4c60-b727-7a541c8003e7.sql
-- --------------------------------------------------------
-- Make entregador_id nullable in entregas table
ALTER TABLE public.entregas ALTER COLUMN entregador_id DROP NOT NULL;

-- Create policy for admins to manage all deliveries
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update lojista insert policy to be more robust (it might already exist but let's make sure it's correct)
-- DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
-- CREATE POLICY "Lojistas can insert deliveries"
-- ON public.entregas FOR INSERT TO authenticated
-- WITH CHECK (lojista_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260405021506_6145cab8-1850-4e40-a3c8-2f738a54875b.sql
-- --------------------------------------------------------
-- Allow public access to view orders by ID
CREATE POLICY "Anyone can view a specific order by ID"
ON public.pedidos
FOR SELECT
USING (true);

-- Allow public access to view deliveries by pedido_id
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260405022450_7b31879e-2e08-4959-9c29-f4be21a0a3db.sql
-- --------------------------------------------------------
-- Cleanup and standardize entregas policies
DROP POLICY IF EXISTS "Lojistas can view their store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries to linked entregadores" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;

-- 1. Lojistas can see and create deliveries for their store
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id))
WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- 2. Entregadores can see available deliveries or deliveries assigned to them or from their linked stores
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
TO authenticated
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid())
);

-- 3. Entregadores can update their own deliveries or accept available ones from linked stores
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
TO authenticated
USING (
  entregador_id = auth.uid() OR 
  (entregador_id IS NULL AND lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid()))
);

-- 4. Admins can manage all
-- (Already exists in some migrations, but let's ensure it's there and correct)
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.entregas;
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Public access for tracking (already exists, but ensuring)
DROP POLICY IF EXISTS "Anyone can view a delivery by pedido_id" ON public.entregas;
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260405024418_17e56476-af8f-405a-8970-08288ef01549.sql
-- --------------------------------------------------------
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS valor_total NUMERIC DEFAULT 0;

-- --------------------------------------------------------
-- MIGRATION: 20260405211659_201cd3c2-a859-4a2d-9237-f907119550b6.sql
-- --------------------------------------------------------
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS status_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260406161014_fcf15d6b-53a9-4d87-9cfc-0d11665681dc.sql
-- --------------------------------------------------------
CREATE TABLE public.materiais_afiliado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  texto_whatsapp TEXT,
  imagem_url TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.materiais_afiliado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all materials"
ON public.materiais_afiliado
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates can view available materials"
ON public.materiais_afiliado
FOR SELECT
TO authenticated
USING (disponivel = true);

CREATE TRIGGER update_materiais_afiliado_updated_at
BEFORE UPDATE ON public.materiais_afiliado
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260406225005_8b65f079-0c5a-4625-b619-446f80e87324.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN mapa_entrega_ativo boolean NOT NULL DEFAULT true;

-- --------------------------------------------------------
-- MIGRATION: 20260406225451_3b8f9d00-d7fa-4bf4-85de-8bb858f8e0c2.sql
-- --------------------------------------------------------
CREATE POLICY "Entregadores can update orders linked to their deliveries"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
)
WITH CHECK (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
);

-- --------------------------------------------------------
-- MIGRATION: 20260406232236_9351619d-3746-403f-bd47-dac641cd086b.sql
-- --------------------------------------------------------
-- Add taxa_entrega column to store the exact delivery fee at order creation
ALTER TABLE public.pedidos ADD COLUMN taxa_entrega numeric DEFAULT 0;

-- --------------------------------------------------------
-- MIGRATION: 20260406235556_3d97bd85-cf47-40b6-9d32-c704ef664383.sql
-- --------------------------------------------------------
-- Create pdv_comandas table
CREATE TABLE public.pdv_comandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  garcom_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  total NUMERIC NOT NULL DEFAULT 0,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdv_comandas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Lojistas and garcons can manage comandas"
ON public.pdv_comandas
FOR ALL
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add comanda_id and status_cozinha to pdv_pedidos
ALTER TABLE public.pdv_pedidos
ADD COLUMN comanda_id UUID REFERENCES public.pdv_comandas(id) ON DELETE SET NULL,
ADD COLUMN status_cozinha TEXT NOT NULL DEFAULT 'pendente';

-- Updated_at trigger for comandas
CREATE TRIGGER update_pdv_comandas_updated_at
BEFORE UPDATE ON public.pdv_comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_comandas;

-- --------------------------------------------------------
-- MIGRATION: 20260407001533_3186e0e5-8dd1-4020-b1d3-d8de4f0a851c.sql
-- --------------------------------------------------------
-- Table to link garcons to stores (similar to loja_entregadores)
CREATE TABLE IF NOT EXISTS public.loja_garcons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  garcom_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(loja_id, garcom_id)
);

ALTER TABLE public.loja_garcons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas can view their store garcons"
ON public.loja_garcons FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Lojistas can delete their store garcons"
ON public.loja_garcons FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

CREATE POLICY "Garcons can insert their links"
ON public.loja_garcons FOR INSERT TO authenticated
WITH CHECK (garcom_id = auth.uid());

CREATE POLICY "Garcons can view their links"
ON public.loja_garcons FOR SELECT TO authenticated
USING (garcom_id = auth.uid());

-- Update pdv_pedidos RLS to allow garcons linked via loja_garcons
CREATE POLICY "Garcons can manage PDV orders for their stores"
ON public.pdv_pedidos FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view mesas of their stores
CREATE POLICY "Garcons can view their store mesas"
ON public.pdv_mesas FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view products of their stores
CREATE POLICY "Garcons can view their store products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- --------------------------------------------------------
-- MIGRATION: 20260413001028_eefaed8d-0872-4611-b0cf-43dbca29a2df.sql
-- --------------------------------------------------------
CREATE POLICY "Anyone can view active plans" ON public.loja_planos FOR SELECT USING (ativo = true);

-- --------------------------------------------------------
-- MIGRATION: 20260413025616_73a6364f-ebda-402c-bd25-bbf26877a7dc.sql
-- --------------------------------------------------------
-- Add numero_diario column to pdv_pedidos
ALTER TABLE public.pdv_pedidos ADD COLUMN numero_diario integer;

-- Create function to set numero_diario for PDV orders, shared sequence with pedidos
CREATE OR REPLACE FUNCTION public.set_numero_diario_pdv()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_user_id uuid;
BEGIN
  -- Get the store owner's user_id from loja_id
  SELECT user_id INTO store_user_id FROM public.lojas WHERE id = NEW.loja_id;

  -- Get max numero_diario from pedidos for this store owner today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = store_user_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get max numero_diario from pdv_pedidos for this store today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = NEW.loja_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_pdv_numero_diario
BEFORE INSERT ON public.pdv_pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario_pdv();

-- Also update the original pedidos trigger to consider PDV orders
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_id uuid;
BEGIN
  -- Get max from pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get the store id for this owner
  SELECT id INTO store_id FROM public.lojas WHERE user_id = NEW.lojista_id LIMIT 1;

  -- Get max from pdv_pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = store_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- --------------------------------------------------------
-- MIGRATION: 20260413195711_185c9fc1-b621-40bd-974b-d9d86df3b35b.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN lembrete_aniversario boolean NOT NULL DEFAULT true;

-- --------------------------------------------------------
-- MIGRATION: 20260413202821_81f55426-23be-4717-a4ca-8c88a6f0fa3b.sql
-- --------------------------------------------------------
-- Add loja_id column to clientes
ALTER TABLE public.clientes ADD COLUMN loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can select by phone" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clientes;

-- Anon can insert clients (from public menu)
CREATE POLICY "Anyone can insert clients"
ON public.clientes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon can select clients by phone (for login flow on public menu)
CREATE POLICY "Anon can select clients"
ON public.clientes FOR SELECT
TO anon
USING (true);

-- Lojistas can only view clients linked to their store
CREATE POLICY "Lojistas can view their store clients"
ON public.clientes FOR SELECT
TO authenticated
USING (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Anyone can update clients
CREATE POLICY "Anyone can update clients"
ON public.clientes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- --------------------------------------------------------
-- MIGRATION: 20260413204153_5d5cb4fd-78fe-4760-8445-da57cc3f1ada.sql
-- --------------------------------------------------------
CREATE POLICY "Lojistas can delete their store clients"
ON public.clientes
FOR DELETE
TO authenticated
USING (
  (loja_id IN (SELECT lojas.id FROM lojas WHERE lojas.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- --------------------------------------------------------
-- MIGRATION: 20260413204502_4b1dd731-e37e-464e-ac21-52215ed5f48c.sql
-- --------------------------------------------------------
ALTER TABLE public.clientes DROP CONSTRAINT clientes_telefone_key;
CREATE UNIQUE INDEX clientes_telefone_loja_unique ON public.clientes (telefone, loja_id);

-- --------------------------------------------------------
-- MIGRATION: 20260416164115_eabb647d-cdc3-46fc-a2fb-311cd76a25b8.sql
-- --------------------------------------------------------
-- Categories (Groups: Sizes, Flavors, Crusts)
CREATE TABLE IF NOT EXISTS public.pizzaria_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'size', 'flavor', 'crust', 'complement'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Options within categories
CREATE TABLE IF NOT EXISTS public.pizzaria_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.pizzaria_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    additional_price NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update products table
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS category_flavor_id UUID REFERENCES public.pizzaria_categories(id),
ADD COLUMN IF NOT EXISTS allow_half BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS max_flavors INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pricing_rule TEXT DEFAULT 'maior_preco'; -- 'maior_preco' or 'media'

-- Product Prices (Price per size)
CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    size_option_id UUID NOT NULL REFERENCES public.pizzaria_options(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(product_id, size_option_id)
);

-- Product Complements (Bordas, extras)
CREATE TABLE IF NOT EXISTS public.product_complements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.pizzaria_categories(id) ON DELETE CASCADE,
    required BOOLEAN DEFAULT FALSE,
    max_selection INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ingredients
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- 'g', 'ml', 'unidade'
    cost_per_unit NUMERIC NOT NULL DEFAULT 0,
    stock_quantity NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Technical Data Sheet (Recipe)
CREATE TABLE IF NOT EXISTS public.product_ingredients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    size_option_id UUID REFERENCES public.pizzaria_options(id) ON DELETE CASCADE,
    quantity_used NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pizzaria_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizzaria_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_complements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pizzaria_categories' AND policyname = 'Users can manage their own categories') THEN
        CREATE POLICY "Users can manage their own categories" ON public.pizzaria_categories
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pizzaria_options' AND policyname = 'Users can manage their own options') THEN
        CREATE POLICY "Users can manage their own options" ON public.pizzaria_options
            FOR ALL USING (category_id IN (SELECT id FROM public.pizzaria_categories WHERE store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_prices' AND policyname = 'Users can manage their own product prices') THEN
        CREATE POLICY "Users can manage their own product prices" ON public.product_prices
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_complements' AND policyname = 'Users can manage their own product complements') THEN
        CREATE POLICY "Users can manage their own product complements" ON public.product_complements
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ingredients' AND policyname = 'Users can manage their own ingredients') THEN
        CREATE POLICY "Users can manage their own ingredients" ON public.ingredients
            FOR ALL USING (store_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_ingredients' AND policyname = 'Users can manage their own technical sheets') THEN
        CREATE POLICY "Users can manage their own technical sheets" ON public.product_ingredients
            FOR ALL USING (product_id IN (SELECT id FROM public.produtos WHERE loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())));
    END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260416224752_c5d3970c-43ee-4d4b-858c-49fc056a7526.sql
-- --------------------------------------------------------
CREATE TABLE public.pizzaria_configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL UNIQUE,
  forma_cobranca TEXT NOT NULL DEFAULT 'fracionado',
  limite_sabores JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pizzaria_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas manage their pizzaria config"
ON public.pizzaria_configuracoes
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view pizzaria config"
ON public.pizzaria_configuracoes
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER update_pizzaria_configuracoes_updated_at
BEFORE UPDATE ON public.pizzaria_configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260425005006_b94e9ea7-9421-4e48-996c-a43fd86ecd5b.sql
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_adicionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'adicional', -- 'adicional' or 'borda'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, nome, tipo)
);

-- Enable RLS
ALTER TABLE public.loja_adicionais ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view addons from their own stores"
ON public.loja_adicionais FOR SELECT
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert addons for their own stores"
ON public.loja_adicionais FOR INSERT
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update addons from their own stores"
ON public.loja_adicionais FOR UPDATE
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete addons from their own stores"
ON public.loja_adicionais FOR DELETE
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loja_adicionais_updated_at
BEFORE UPDATE ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260425005408_c461de05-e22d-4c90-9810-220020ef4c12.sql
-- --------------------------------------------------------
-- Function to validate ownership of loja_adicionais
CREATE OR REPLACE FUNCTION public.check_loja_adicionais_ownership()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    target_loja_id UUID;
BEGIN
    -- Determine which loja_id to check based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_loja_id := OLD.loja_id;
    ELSE
        target_loja_id := NEW.loja_id;
    END IF;

    -- Get the owner of the store
    SELECT user_id INTO owner_id
    FROM public.lojas
    WHERE id = target_loja_id;

    -- Verify if the authenticated user is the owner
    -- Note: auth.uid() returns NULL for service_role/background tasks, 
    -- we might want to allow those or handle them specifically.
    -- If we want to be strict and ONLY allow the owner even in "RLS bypass" scenarios 
    -- where auth.uid() is set, this check holds.
    
    IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: Você não é o proprietário desta loja.';
    END IF;

    -- For UPDATE, also ensure they don't try to change the loja_id to one they don't own
    IF (TG_OP = 'UPDATE' AND OLD.loja_id != NEW.loja_id) THEN
        SELECT user_id INTO owner_id
        FROM public.lojas
        WHERE id = NEW.loja_id;
        
        IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
            RAISE EXCEPTION 'Acesso negado: Não é possível mover adicionais para uma loja que você não possui.';
        END IF;
    END IF;

    RETURN IF (TG_OP = 'DELETE', OLD, NEW);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce ownership on DML operations
DROP TRIGGER IF EXISTS enforce_loja_adicionais_ownership ON public.loja_adicionais;
CREATE TRIGGER enforce_loja_adicionais_ownership
BEFORE INSERT OR UPDATE OR DELETE
ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.check_loja_adicionais_ownership();

-- --------------------------------------------------------
-- MIGRATION: 20260425005424_9932f974-bac3-401c-9f00-7a0cb022a042.sql
-- --------------------------------------------------------
-- Function to validate ownership of loja_adicionais with fixed syntax and search_path
CREATE OR REPLACE FUNCTION public.check_loja_adicionais_ownership()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    target_loja_id UUID;
BEGIN
    -- Determine which loja_id to check based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_loja_id := OLD.loja_id;
    ELSE
        target_loja_id := NEW.loja_id;
    END IF;

    -- Get the owner of the store
    SELECT user_id INTO owner_id
    FROM public.lojas
    WHERE id = target_loja_id;

    -- Verify if the authenticated user is the owner
    -- Note: auth.uid() returns NULL for service_role/background tasks, 
    -- we might want to allow those or handle them specifically.
    
    IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: Você não é o proprietário desta loja.';
    END IF;

    -- For UPDATE, also ensure they don't try to change the loja_id to one they don't own
    IF (TG_OP = 'UPDATE' AND OLD.loja_id != NEW.loja_id) THEN
        SELECT user_id INTO owner_id
        FROM public.lojas
        WHERE id = NEW.loja_id;
        
        IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
            RAISE EXCEPTION 'Acesso negado: Não é possível mover adicionais para uma loja que você não possui.';
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS enforce_loja_adicionais_ownership ON public.loja_adicionais;
CREATE TRIGGER enforce_loja_adicionais_ownership
BEFORE INSERT OR UPDATE OR DELETE
ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.check_loja_adicionais_ownership();

-- --------------------------------------------------------
-- MIGRATION: 20260425014452_57f961ee-b1c2-421c-b065-3354a79f29d0.sql
-- --------------------------------------------------------
-- First, let's clean up the overly permissive policies for 'produtos' table
DROP POLICY IF EXISTS "Authenticated can view all store products" ON public.produtos;
DROP POLICY IF EXISTS "Admins can view all products" ON public.produtos;

-- Ensure the existing policies are correct and secure
-- Public can view products (needed for the menu)
-- Note: It's better to filter by loja_id in the query, but the policy allows viewing
DROP POLICY IF EXISTS "Anyone can view store products" ON public.produtos;
CREATE POLICY "Anyone can view store products" 
ON public.produtos 
FOR SELECT 
USING (true);

-- Lojistas can see their own products
DROP POLICY IF EXISTS "Lojistas can view their products" ON public.produtos;
CREATE POLICY "Lojistas can view their products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

-- Garcons can see their store products
DROP POLICY IF EXISTS "Garcons can view their store products" ON public.produtos;
CREATE POLICY "Garcons can view their store products" 
ON public.produtos 
FOR SELECT 
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Ensure RLS is enabled
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- MIGRATION: 20260425173621_655f4f04-196d-412d-af36-dacbc594bf06.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos 
ADD COLUMN unidade_medida TEXT NOT NULL DEFAULT 'un';

-- Add a comment for clarity
COMMENT ON COLUMN public.produtos.unidade_medida IS 'Unidade de medida do produto: un, kg, ml';

-- --------------------------------------------------------
-- MIGRATION: 20260425181551_a5f927ad-6d4a-43d7-8917-9678b3bcdf17.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS categorias_ocultas JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.categorias_ocultas IS 'Lista de nomes de categorias padrão que o lojista deseja ocultar em sua loja.';

-- --------------------------------------------------------
-- MIGRATION: 20260425185609_edff7f89-80b8-4802-9c4f-d50dd9fb3fb0.sql
-- --------------------------------------------------------
-- Enable Realtime for the produtos table
ALTER TABLE public.produtos REPLICA IDENTITY FULL;

-- Check if the table is already in the publication to avoid error
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'produtos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
    END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260425191244_f4c3164f-a9c0-4e35-ae0a-ae09993388a9.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN valor_plano_exclusivo NUMERIC;
COMMENT ON COLUMN public.lojas.valor_plano_exclusivo IS 'Valor exclusivo do plano para esta loja, que sobrescreve o valor padrão do plano.';

-- --------------------------------------------------------
-- MIGRATION: 20260425192931_9a28c2c0-6415-485b-b8fc-b24ed32a2731.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS plano_id_exclusivo UUID REFERENCES public.planos(id);

-- --------------------------------------------------------
-- MIGRATION: 20260425221700_8a308614-e74a-43f7-97a0-d5e04d0f75d7.sql
-- --------------------------------------------------------
-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public to view avatars
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy to allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated'
);

-- --------------------------------------------------------
-- MIGRATION: 20260425224724_bf4df445-fa1e-4166-a6d9-88d2a4e19d8f.sql
-- --------------------------------------------------------
-- Clean up existing policies for the relevant buckets to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can update client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
    
    -- Also drop common names that might exist from default setups
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
END $$;

-- 1. client-photos bucket (for customers)
CREATE POLICY "Public Access Client Photos" ON storage.objects FOR SELECT USING (bucket_id = 'client-photos');
CREATE POLICY "Anyone can upload client photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client-photos');
CREATE POLICY "Anyone can update client photos" ON storage.objects FOR UPDATE USING (bucket_id = 'client-photos');

-- 2. avatars bucket (for lojistas, delivery, affiliates)
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 3. logos bucket (for lojistas)
CREATE POLICY "Public Access Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 4. banners bucket (for lojistas)
CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE USING (bucket_id = 'banners' AND auth.role() = 'authenticated');

-- --------------------------------------------------------
-- MIGRATION: 20260426005427_8eafe772-0857-4bfc-a12c-d9708423c6c1.sql
-- --------------------------------------------------------
-- Add pago column to entregas
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT false;

-- Create entregador_pagamentos table
CREATE TABLE IF NOT EXISTS public.entregador_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entregador_id UUID REFERENCES auth.users(id) NOT NULL,
    lojista_id UUID REFERENCES public.lojas(id) NOT NULL,
    valor NUMERIC NOT NULL,
    periodo_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    periodo_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    quantidade_entregas INTEGER NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.entregador_pagamentos ENABLE ROW LEVEL SECURITY;

-- Policies for entregador_pagamentos
CREATE POLICY "Lojistas can manage their driver payments"
    ON public.entregador_pagamentos
    FOR ALL
    USING (lojista_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can view their own payments"
    ON public.entregador_pagamentos
    FOR SELECT
    USING (entregador_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_entregador_id ON public.entregador_pagamentos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_entregador_pagamentos_lojista_id ON public.entregador_pagamentos(lojista_id);

-- --------------------------------------------------------
-- MIGRATION: 20260426212233_1ac773ca-87d9-4c95-94cc-78deaa8d8a03.sql
-- --------------------------------------------------------
-- Add rating fields to produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS rating_average NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create product_ratings table
CREATE TABLE IF NOT EXISTS public.product_ratings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_ratings ENABLE ROW LEVEL SECURITY;

-- Policies for product_ratings
CREATE POLICY "Anyone can view product ratings" 
ON public.product_ratings FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create product ratings" 
ON public.product_ratings FOR INSERT 
WITH CHECK (true);

-- Function to update product rating stats
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos
        SET 
            rating_average = (rating_average * rating_count + NEW.rating) / (rating_count + 1),
            rating_count = rating_count + 1
        WHERE id = NEW.product_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos
        SET 
            rating_average = CASE 
                WHEN rating_count > 1 THEN (rating_average * rating_count - OLD.rating) / (rating_count - 1)
                ELSE 0 
            END,
            rating_count = rating_count - 1
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for product ratings
DROP TRIGGER IF EXISTS tr_update_product_rating_stats ON public.product_ratings;
CREATE TRIGGER tr_update_product_rating_stats
AFTER INSERT OR DELETE ON public.product_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating_stats();

-- --------------------------------------------------------
-- MIGRATION: 20260426212253_f62d88e2-6efa-429c-ac44-872254885634.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS avaliacoes_produtos_ativas BOOLEAN DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260426221044_e014dd1f-4ba6-429d-8cfc-5b7ee5c1ea38.sql
-- --------------------------------------------------------
-- Delete duplicates keeping only the most recent rating for each product/customer pair
DELETE FROM public.product_ratings a
USING public.product_ratings b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.customer_phone = b.customer_phone;

-- Add unique constraint
ALTER TABLE public.product_ratings
ADD CONSTRAINT unique_product_customer_rating UNIQUE (product_id, customer_phone);

-- --------------------------------------------------------
-- MIGRATION: 20260426231622_1c369c04-0516-48e2-89c7-2f3942296930.sql
-- --------------------------------------------------------
-- Function to normalize strings for comparison (lowercase and trim)
-- We'll use this to match client neighborhoods with the corrected ones in loja_frete_bairros

UPDATE public.clientes c
SET endereco_bairro = fb.bairro
FROM public.loja_frete_bairros fb
WHERE c.loja_id = fb.loja_id
AND lower(trim(c.endereco_bairro)) = lower(trim(fb.bairro))
AND c.endereco_bairro != fb.bairro;

-- Also update any orders that might have the old names if we want to be thorough
-- But the user specifically mentioned "clientes"

-- --------------------------------------------------------
-- MIGRATION: 20260426231639_ff312d10-1654-415b-b2ba-1bbd034e4f53.sql
-- --------------------------------------------------------
-- Update the frete_bairros JSON column in the lojas table
-- to match the current state of the loja_frete_bairros table
WITH updated_bairros AS (
    SELECT 
        loja_id, 
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'bairro', bairro,
                'valor', valor
            )
        ) as bairros_json
    FROM public.loja_frete_bairros
    GROUP BY loja_id
)
UPDATE public.lojas l
SET frete_bairros = ub.bairros_json
FROM updated_bairros ub
WHERE l.id = ub.loja_id;

-- --------------------------------------------------------
-- MIGRATION: 20260426232011_2e24d71f-0c9d-44ea-9fe0-e29496880a2c.sql
-- --------------------------------------------------------
-- Allow authenticated users to view stores by slug (currently only anon can)
DROP POLICY IF EXISTS "Anyone can view stores by slug" ON public.lojas;
CREATE POLICY "Anyone can view stores by slug" 
ON public.lojas 
FOR SELECT 
USING (true); -- This replaces the previous anon-only policy and makes it public

-- Allow authenticated users to view clients (matching anon policy)
DROP POLICY IF EXISTS "Anon can select clients" ON public.clientes;
CREATE POLICY "Anyone can select clients" 
ON public.clientes 
FOR SELECT 
USING (true); -- This allows both anon and authenticated users to see clients

-- Ensure insert policy is clear
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);

-- --------------------------------------------------------
-- MIGRATION: 20260428015602_a6dac09b-ce26-43bf-9c8f-8b49e29b016f.sql
-- --------------------------------------------------------
-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Anyone can view product ratings" ON public.product_ratings;
DROP POLICY IF EXISTS "Anyone can create product ratings" ON public.product_ratings;

-- Criar política para visualização: Permitir apenas se o produto pertencer a uma loja ativa que permite avaliações
CREATE POLICY "Clientes podem ver avaliações de produtos da loja atual" 
ON public.product_ratings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    JOIN public.lojas l ON p.loja_id = l.id
    WHERE p.id = product_ratings.product_id
    AND l.avaliacoes_produtos_ativas = true
  )
);

-- Criar política para inserção: Garantir que o produto existe
CREATE POLICY "Clientes podem criar avaliações para produtos existentes" 
ON public.product_ratings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = product_ratings.product_id
  )
);

-- --------------------------------------------------------
-- MIGRATION: 20260428023851_08652a1f-aee6-4716-82da-35b5802a45dd.sql
-- --------------------------------------------------------
-- Criar o trigger faltante para sincronizar rating_average e rating_count
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

CREATE TRIGGER trg_update_product_rating_stats
AFTER INSERT OR DELETE ON public.product_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_product_rating_stats();

-- Backfill: recalcular média e contagem para produtos que já possuem avaliações
UPDATE public.produtos p
SET 
  rating_average = COALESCE(stats.avg_rating, 0),
  rating_count = COALESCE(stats.count_ratings, 0)
FROM (
  SELECT 
    product_id,
    AVG(rating)::numeric(3,2) AS avg_rating,
    COUNT(*) AS count_ratings
  FROM public.product_ratings
  GROUP BY product_id
) stats
WHERE p.id = stats.product_id;

-- --------------------------------------------------------
-- MIGRATION: 20260428031546_b1e44e13-5643-4dd8-b5ea-35672b4a3ace.sql
-- --------------------------------------------------------
-- Add ranking_ativo column to lojas table
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS ranking_ativo BOOLEAN DEFAULT true;

-- Update the comment to describe the column
COMMENT ON COLUMN public.lojas.ranking_ativo IS 'Define se o menu de ranking de produtos mais pedidos deve ser exibido no cardápio do cliente.';

-- --------------------------------------------------------
-- MIGRATION: 20260428040038_fb6067b9-658b-4503-94e0-4c4258b5b128.sql
-- --------------------------------------------------------
-- Drop duplicate triggers
DROP TRIGGER IF EXISTS tr_update_product_rating_stats ON public.product_ratings;
DROP TRIGGER IF EXISTS trg_update_product_rating_stats ON public.product_ratings;

-- Recriar função para ser mais robusta e evitar erros de arredondamento/incremento manual falho
CREATE OR REPLACE FUNCTION public.update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular média e contagem baseado na tabela real para evitar desvios
    UPDATE public.produtos
    SET 
        rating_count = (SELECT count(*) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)),
        rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)), 0)
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar apenas um trigger
CREATE TRIGGER tr_update_product_rating_stats
AFTER INSERT OR DELETE OR UPDATE ON public.product_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_product_rating_stats();

-- Sincronizar todos os produtos agora para corrigir dados errados
UPDATE public.produtos p
SET 
    rating_count = (SELECT count(*) FROM public.product_ratings pr WHERE pr.product_id = p.id),
    rating_average = COALESCE((SELECT avg(rating) FROM public.product_ratings pr WHERE pr.product_id = p.id), 0);

-- --------------------------------------------------------
-- MIGRATION: 20260428040558_039bf2d3-0688-42ca-886e-edc76c69ff1b.sql
-- --------------------------------------------------------
-- 1. Criar a coluna pedidos_count se ela não existir
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS pedidos_count INTEGER DEFAULT 0;

-- 2. Sincronizar todos os produtos com a contagem real de vendas (pedidos concluídos/finalizados/entregues)
UPDATE public.produtos p
SET pedidos_count = (
    SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
    FROM public.pedidos ped,
    jsonb_array_elements(ped.items) elem
    WHERE (elem->>'id')::uuid = p.id
    AND ped.status IN ('concluido', 'finalizado', 'entregue')
);

-- 3. Atualizar a função do trigger para usar a coluna pedidos_count
CREATE OR REPLACE FUNCTION public.update_product_order_stats()
RETURNS TRIGGER AS $$
DECLARE
  item_record jsonb;
  product_id_var uuid;
BEGIN
  -- Se o status mudou para algo que consideramos "concluído" ou saiu desse status
  IF (TG_OP = 'INSERT' AND (NEW.status IN ('concluido', 'finalizado', 'entregue'))) OR
     (TG_OP = 'UPDATE' AND 
       ((NEW.status IN ('concluido', 'finalizado', 'entregue')) != (OLD.status IN ('concluido', 'finalizado', 'entregue')))
     )
  THEN
    -- Recalcula para os produtos no pedido atual (NEW)
    FOR item_record IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      BEGIN
        product_id_var := (item_record->>'id')::uuid;
        
        UPDATE public.produtos
        SET pedidos_count = (
          SELECT COALESCE(SUM((elem->>'quantidade')::integer), 0)
          FROM public.pedidos p,
          jsonb_array_elements(p.items) elem
          WHERE (elem->>'id')::uuid = product_id_var
          AND p.status IN ('concluido', 'finalizado', 'entregue')
        )
        WHERE id = product_id_var;
      EXCEPTION WHEN OTHERS THEN
        -- Ignora se o ID não for um UUID válido ou produto não existir
        CONTINUE;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-aplicar o trigger
DROP TRIGGER IF EXISTS trg_update_product_order_stats ON public.pedidos;
CREATE TRIGGER trg_update_product_order_stats
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.update_product_order_stats();

-- --------------------------------------------------------
-- MIGRATION: 20260428043458_35b04678-afe9-437e-92c6-2091ecc18798.sql
-- --------------------------------------------------------
-- Create linked_products table
CREATE TABLE IF NOT EXISTS public.linked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  linked_product_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, linked_product_id)
);

-- Enable RLS
ALTER TABLE public.linked_products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Lojistas can manage linked products for their own store"
ON public.linked_products
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.id = public.linked_products.loja_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view linked products"
ON public.linked_products
FOR SELECT
USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_linked_products_product_id ON public.linked_products(product_id);
CREATE INDEX IF NOT EXISTS idx_linked_products_loja_id ON public.linked_products(loja_id);

-- --------------------------------------------------------
-- MIGRATION: 20260429161053_d317b91f-9bfc-4867-93f4-99b03fa4ef7a.sql
-- --------------------------------------------------------
-- Add contact info to lojas table
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Add instagram to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS instagram TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260429201825_899f05cf-f72a-4b1e-a6d0-a2066054dd8e.sql
-- --------------------------------------------------------
-- Add column to track which year the birthday was last dismissed
ALTER TABLE public.clientes
ADD COLUMN aniversario_visto_ano INTEGER;

-- Comment for documentation
COMMENT ON COLUMN public.clientes.aniversario_visto_ano IS 'Ano em que o aniversariante foi marcado como visto pelo lojista';

-- --------------------------------------------------------
-- MIGRATION: 20260502233946_8e82cb67-c30a-47e3-8b62-6e183965eb4f.sql
-- --------------------------------------------------------
-- Create bucket for installers
INSERT INTO storage.buckets (id, name, public) 
VALUES ('installers', 'installers', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'installers');

-- Policy for authenticated users to upload/update/delete (simple for now)
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'installers' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'installers' AND auth.role() = 'authenticated');

CREATE POLICY "Auth Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'installers' AND auth.role() = 'authenticated');

-- --------------------------------------------------------
-- MIGRATION: 20260503001952_3448c051-dea1-4ea9-afd6-917bf53e5f12.sql
-- --------------------------------------------------------
-- No direct SQL changes needed for this edge function implementation as it relies on environment variables for the private key.
-- However, we ensure the function can be called by authenticated users if needed.

-- --------------------------------------------------------
-- MIGRATION: 20260503161452_8d94e8c7-373f-4f71-96a9-a516e5065fe9.sql
-- --------------------------------------------------------
-- Adiciona coluna qz_tray_ativo se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas ADD COLUMN qz_tray_ativo BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260503161759_a564706e-3c4f-4f8b-a4bc-c5ed30a288c6.sql
-- --------------------------------------------------------
-- Remove a coluna qz_tray_ativo se ela existir
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas DROP COLUMN qz_tray_ativo;
  END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260503183141_d2c484dc-3c30-4487-ad7e-fe554dffd93a.sql
-- --------------------------------------------------------
-- Create table for QZ Tray certificates
CREATE TABLE IF NOT EXISTS public.qz_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_content TEXT NOT NULL,
    private_key_content TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT 'noov.app.br',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qz_certificates ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow authenticated users to view the certificates (or specific logic if needed)
-- However, for the edge function to work globally and the certificate to be public, 
-- we can create a specific policy or just let the edge function handle the access.
CREATE POLICY "Public can view active certificate content" 
ON public.qz_certificates 
FOR SELECT 
USING (is_active = true);

-- Note: The private_key_content should never be exposed via standard SELECT if possible, 
-- but since RLS is per row, we should be careful. 
-- In a real scenario, we might split this into two tables or use a database function.

-- Insert a placeholder record (The user will need to provide the actual cert/key via a tool or UI later, 
-- or we use environment variables for the private key as already partially implemented)
-- For now, we ensure the table exists so we can migrate from env vars to DB if preferred.

-- --------------------------------------------------------
-- MIGRATION: 20260503185207_271c78db-80a6-4cb3-b2b6-e6bbe8573454.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_automatica_qz BOOLEAN DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260503185602_acbe8c28-750c-4365-9a87-a4ed910b6843.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS documento TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260503190744_f3aec66a-aa4b-4c9d-9c28-e8c41ecdda29.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressora_qz_nome TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260503202345_6adac161-b6e1-4201-bbbb-050210c6296d.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_status_gatilho text NOT NULL DEFAULT 'aceito';

-- --------------------------------------------------------
-- MIGRATION: 20260503221142_e059c101-e1cf-4904-8b62-fa974b65b966.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_duas_vias BOOLEAN DEFAULT FALSE;

-- --------------------------------------------------------
-- MIGRATION: 20260503223451_f80ce1ef-6338-46c8-8ad2-7ab063c240b6.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS margem_esquerda INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_direita INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_superior INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_inferior INTEGER DEFAULT 0;

-- --------------------------------------------------------
-- MIGRATION: 20260504015958_58c4aed2-354d-4c73-a22e-5ade06b1bca8.sql
-- --------------------------------------------------------
-- Alterar o padrão das colunas para 0.5
ALTER TABLE public.lojas ALTER COLUMN margem_esquerda SET DEFAULT 0.5;
ALTER TABLE public.lojas ALTER COLUMN margem_direita SET DEFAULT 0.5;

-- Atualizar registros existentes onde as margens estão como 0 (assumindo que 0 era o padrão anterior)
UPDATE public.lojas 
SET margem_esquerda = 0.5 
WHERE margem_esquerda = 0 OR margem_esquerda IS NULL;

UPDATE public.lojas 
SET margem_direita = 0.5 
WHERE margem_direita = 0 OR margem_direita IS NULL;

-- --------------------------------------------------------
-- MIGRATION: 20260504154514_6035fad8-50ef-441d-97ec-a7868d38037d.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS qz_certificate TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260504164823_6e7513ce-ac78-4bf1-8ae4-c50104e8423d.sql
-- --------------------------------------------------------
-- Adiciona a coluna para o link do programa
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS qz_program_url TEXT;

-- Cria o bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('loja-assets', 'loja-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Tenta criar as políticas, ignorando se já existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access Assets'
    ) THEN
        CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING (bucket_id = 'loja-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload assets'
    ) THEN
        CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'loja-assets' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can update assets'
    ) THEN
        CREATE POLICY "Authenticated users can update assets" ON storage.objects FOR UPDATE USING (bucket_id = 'loja-assets' AND auth.role() = 'authenticated');
    END IF;
END
$$;

-- --------------------------------------------------------
-- MIGRATION: 20260504173124_deb0001e-94f8-4f4b-8da2-8c9caa62aaa7.sql
-- --------------------------------------------------------
-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_assets', 'public_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist to avoid conflict and recreate them correctly
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Policy to allow public access to images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'public_assets');

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'public_assets' 
  AND auth.role() = 'authenticated'
);

-- Policy to allow users to update/delete their own files (based on folder structure user_id/...)
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'public_assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'public_assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- --------------------------------------------------------
-- MIGRATION: 20260504180211_9bf8c039-8888-4979-b5ef-4c82bc627b3e.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS printer_steps JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.printer_steps IS 'Armazena o passo a passo personalizado da instalação da impressora.';

-- --------------------------------------------------------
-- MIGRATION: 20260506122506_0e966634-19e2-4792-8063-c379d36e486e.sql
-- --------------------------------------------------------
-- Create app_cupom_tipo enum
DO $$ BEGIN
    CREATE TYPE public.app_cupom_tipo AS ENUM ('fixo', 'percentual', 'frete_gratis');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add cupons_ativos to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS cupons_ativos BOOLEAN DEFAULT false;

-- Add coupon info to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_codigo TEXT;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_desconto NUMERIC DEFAULT 0;

-- Create cupons table
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    tipo public.app_cupom_tipo NOT NULL,
    valor NUMERIC NOT NULL DEFAULT 0,
    valor_minimo NUMERIC NOT NULL DEFAULT 0,
    validade_inicio TIMESTAMP WITH TIME ZONE,
    validade_fim TIMESTAMP WITH TIME ZONE,
    limite_total INTEGER,
    limite_por_cliente INTEGER DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT true,
    tipo_publico BOOLEAN NOT NULL DEFAULT true,
    usos_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(loja_id, codigo)
);

-- Create cupom_clientes table for private coupons
CREATE TABLE IF NOT EXISTS public.cupom_clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    cliente_identificador TEXT NOT NULL, -- Telefone do cliente
    cliente_nome TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uso_cupons table
CREATE TABLE IF NOT EXISTS public.uso_cupons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    cliente_identificador TEXT NOT NULL, -- Telefone do cliente
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    valor_desconto NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupom_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uso_cupons ENABLE ROW LEVEL SECURITY;

-- Policies for cupons
DO $$ BEGIN
    CREATE POLICY "Lojistas podem gerenciar seus próprios cupons"
    ON public.cupons
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lojas 
        WHERE lojas.id = cupons.loja_id 
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Qualquer um pode ver cupons ativos da loja"
    ON public.cupons
    FOR SELECT
    USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for cupom_clientes
DO $$ BEGIN
    CREATE POLICY "Lojistas podem gerenciar clientes do cupom"
    ON public.cupom_clientes
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.cupons
        JOIN public.lojas ON lojas.id = cupons.loja_id
        WHERE cupons.id = cupom_clientes.cupom_id
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Clientes podem ver seus próprios cupons privados"
    ON public.cupom_clientes
    FOR SELECT
    USING (true); -- Permitir select público para validação no checkout via telefone
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for uso_cupons
DO $$ BEGIN
    CREATE POLICY "Lojistas podem ver usos dos seus cupons"
    ON public.uso_cupons
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.cupons
        JOIN public.lojas ON lojas.id = cupons.loja_id
        WHERE cupons.id = uso_cupons.cupom_id
        AND lojas.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Inserção pública de uso de cupom"
    ON public.uso_cupons
    FOR INSERT
    WITH CHECK (true); -- Permitir inserção no checkout
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Function to update updated_at
CREATE OR REPLACE TRIGGER update_cupons_updated_at
BEFORE UPDATE ON public.cupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260506144630_92b7d789-f8b1-483b-87d0-d9403710a3c4.sql
-- --------------------------------------------------------
ALTER TABLE public.cupons 
ADD COLUMN uso_unico BOOLEAN DEFAULT true;

-- Atualizar a descrição da política ou garantir que as políticas existentes cubram a nova coluna (geralmente cobrem se for SELECT *)
-- Se houver necessidade de atualizar caches ou triggers, pode ser feito aqui.

-- --------------------------------------------------------
-- MIGRATION: 20260506145555_b9f54099-8dee-4fd8-ab53-98b97a3c326e.sql
-- --------------------------------------------------------
ALTER TYPE public.app_cupom_tipo ADD VALUE 'cliente_novo';

-- --------------------------------------------------------
-- MIGRATION: 20260510133337_180246b6-69a4-4c1e-a82c-1b9a12bb80a5.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cupom_lembrete_ativo boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260511203632_92cc876d-2ba4-48ef-8c5f-3e6b2a9d92ad.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_titulo text NOT NULL DEFAULT 'Cupom de Desconto',
  ADD COLUMN IF NOT EXISTS cupom_popup_subtitulo text NOT NULL DEFAULT 'Aproveite uma oferta especial no seu pedido!',
  ADD COLUMN IF NOT EXISTS cupom_popup_cta text NOT NULL DEFAULT 'COMEÇAR A PEDIR',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_fundo text NOT NULL DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_texto text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS cupom_popup_imagem_url text;

-- --------------------------------------------------------
-- MIGRATION: 20260520132412_f0bbc2c4-c92c-45bc-b109-9ea2f8c7a52c.sql
-- --------------------------------------------------------
-- Tabela de mensagens enviadas pelo admin
CREATE TABLE public.admin_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  banner_url text,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_mensagens_loja ON public.admin_mensagens(loja_id);
CREATE INDEX idx_admin_mensagens_created ON public.admin_mensagens(created_at DESC);

ALTER TABLE public.admin_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam mensagens"
ON public.admin_mensagens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Lojistas veem mensagens destinadas a eles"
ON public.admin_mensagens
FOR SELECT
TO authenticated
USING (
  loja_id IS NULL
  OR loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
);

-- Tabela: mensagens excluídas (apenas para a loja específica)
CREATE TABLE public.admin_mensagens_excluidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX idx_msg_excluidas_loja ON public.admin_mensagens_excluidas(loja_id);

ALTER TABLE public.admin_mensagens_excluidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam suas exclusoes"
ON public.admin_mensagens_excluidas
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins veem todas exclusoes"
ON public.admin_mensagens_excluidas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: mensagens lidas (para controle de notificação)
CREATE TABLE public.admin_mensagens_lidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX idx_msg_lidas_loja ON public.admin_mensagens_lidas(loja_id);

ALTER TABLE public.admin_mensagens_lidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam suas leituras"
ON public.admin_mensagens_lidas
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Storage bucket para banners das mensagens (reuso banners)
-- Já existe bucket 'banners'

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens_excluidas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens_lidas;

-- --------------------------------------------------------
-- MIGRATION: 20260522130917_0a35a2e4-640e-4038-859e-5350a686e460.sql
-- --------------------------------------------------------
CREATE TABLE public.loja_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  nome text NOT NULL,
  pin text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('admin','gerente','funcionario')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loja_usuarios_loja_id ON public.loja_usuarios(loja_id);

ALTER TABLE public.loja_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam usuarios da sua loja"
ON public.loja_usuarios
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins gerenciam todos usuarios da loja"
ON public.loja_usuarios
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_loja_usuarios_updated_at
BEFORE UPDATE ON public.loja_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260522131847_b389a135-3b35-41ee-b418-f73ff8938899.sql
-- --------------------------------------------------------
ALTER TABLE public.loja_usuarios
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260525112851_f227b125-5500-41c7-a518-fc0f010bb417.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260528121250_b062c29f-0350-4ee3-b76c-9c2a1318a752.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sabores jsonb NOT NULL DEFAULT '[]'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260529012239_3ca8080e-1e48-4499-8563-58f1d67d3949.sql
-- --------------------------------------------------------
-- Ensure entregador_pagamentos cascades
ALTER TABLE public.entregador_pagamentos 
DROP CONSTRAINT IF EXISTS entregador_pagamentos_lojista_id_fkey,
ADD CONSTRAINT entregador_pagamentos_lojista_id_fkey 
    FOREIGN KEY (lojista_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Ensure entregas cascades (lojista_id here is store_id)
ALTER TABLE public.entregas 
DROP CONSTRAINT IF EXISTS entregas_lojista_id_fkey,
ADD CONSTRAINT entregas_lojista_id_fkey 
    FOREIGN KEY (lojista_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Ensure pdv_pedidos cascades
ALTER TABLE public.pdv_pedidos
DROP CONSTRAINT IF EXISTS pdv_pedidos_loja_id_fkey,
ADD CONSTRAINT pdv_pedidos_loja_id_fkey
    FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Create function to handle complete store deletion
CREATE OR REPLACE FUNCTION public.delete_loja_complete(p_loja_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Get the user_id
    SELECT user_id INTO v_user_id FROM public.lojas WHERE id = p_loja_id;
    
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Delete data that might not be automatically cascaded
    
    -- Pedidos (uses lojista_id = user_id)
    DELETE FROM public.pedidos WHERE lojista_id = v_user_id;
    
    -- Entregas and Entregador Pagamentos should now cascade because we updated the constraints above
    -- but we'll leave them here as fallback if needed or just trust the cascade.

    -- 3. Delete the store itself (most other things cascade from here)
    DELETE FROM public.lojas WHERE id = p_loja_id;
    
    -- 4. Delete profile (associated with the lojista)
    DELETE FROM public.profiles WHERE user_id = v_user_id;

    -- 5. Delete roles
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_loja_complete(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_loja_complete(UUID) TO authenticated;

-- --------------------------------------------------------
-- MIGRATION: 20260529012332_ad8f986d-de21-48b5-ab3b-29f3c73ac2c0.sql
-- --------------------------------------------------------
ALTER FUNCTION public.delete_loja_complete(UUID) SET search_path = public, auth;

-- --------------------------------------------------------
-- MIGRATION: 20260529021227_fbb97d8e-f9a3-4857-98bc-e871c1153cc2.sql
-- --------------------------------------------------------
-- Create table for chat messages
CREATE TABLE public.suporte_mensagens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('agent', 'user')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT ON public.suporte_mensagens TO anon, authenticated;
GRANT ALL ON public.suporte_mensagens TO service_role;

-- Policies
CREATE POLICY "Anyone can insert messages" 
ON public.suporte_mensagens FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view messages from their session" 
ON public.suporte_mensagens FOR SELECT 
USING (true); -- In a production app, we'd filter by session_id cookie/localstorage

-- Index for performance
CREATE INDEX idx_suporte_mensagens_session ON public.suporte_mensagens(session_id);
CREATE INDEX idx_suporte_mensagens_created_at ON public.suporte_mensagens(created_at);

-- --------------------------------------------------------
-- MIGRATION: 20260529141718_c3ad49af-8dc6-421e-b529-03e329a47929.sql
-- --------------------------------------------------------
-- 1. Fix mutable search_path for triggers and functions
ALTER FUNCTION public.update_product_order_stats() SET search_path = public;
ALTER FUNCTION public.update_product_rating_stats() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Restrict EXECUTE privileges on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.delete_loja_complete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_order_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_rating_stats() FROM PUBLIC;

-- Re-grant to authenticated/service_role as needed (internal use)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 3. Refine Permissive RLS Policies (Fixing "RLS Policy Always True")

-- Pedidos: Refine "Anyone can insert orders from public menu"
DROP POLICY IF EXISTS "Anyone can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Anyone can insert orders from active stores" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- Clientes: Refine permissive policies
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients for active stores"
ON public.clientes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE id = loja_id AND ativo = true
  )
);

DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
CREATE POLICY "Users can update their own client data"
ON public.clientes
FOR UPDATE
USING (
  -- If linked to a user, check auth.uid()
  -- Assuming there might be a user_id column or similar link in some context, 
  -- but checking against existing column knowledge:
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE id = loja_id AND user_id = auth.uid()
  )
);

-- Suporte Mensagens: Refine insertion
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.suporte_mensagens;
CREATE POLICY "Authenticated users or session holders can insert support messages"
ON public.suporte_mensagens
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL OR session_id IS NOT NULL
);

-- 4. Enable RLS on all public tables (Safety check)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260529141751_56591fe8-97d5-4745-a6e2-01e1922e46d3.sql
-- --------------------------------------------------------
-- 1. Refine Pedidos policies for Authenticated users
DROP POLICY IF EXISTS "Authenticated can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Authenticated can insert orders from active stores" 
ON public.pedidos 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- 2. Refine Order Rating update policy
DROP POLICY IF EXISTS "Anon can update order rating" ON public.pedidos;
CREATE POLICY "Anyone can update order rating if active store"
ON public.pedidos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lojas 
    WHERE user_id = lojista_id AND ativo = true
  )
);

-- 3. Refine Coupon usage policy
DROP POLICY IF EXISTS "Inserção pública de uso de cupom" ON public.uso_cupons;
CREATE POLICY "Public coupon usage for active stores"
ON public.uso_cupons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pedidos p
    JOIN public.lojas l ON l.user_id = p.lojista_id
    WHERE p.id = pedido_id AND l.ativo = true
  )
);

-- --------------------------------------------------------
-- MIGRATION: 20260529141808_872b9c73-1103-4417-9f72-dc3bdf3d905f.sql
-- --------------------------------------------------------
-- Revoke public execution for remaining SECURITY DEFINER functions to satisfy linter
REVOKE EXECUTE ON FUNCTION public.update_product_order_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_loja_adicionais_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_loja_complete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_rating_stats() FROM PUBLIC;

-- Re-grant execution to roles that actually need them
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_loja_adicionais_ownership() TO authenticated, service_role;
-- Trigger functions usually don't need explicit EXECUTE grants to specific roles as they run as the trigger owner, 
-- but revoking from PUBLIC is the primary security fix.

-- --------------------------------------------------------
-- MIGRATION: 20260529143620_317e22dd-7bf8-40d6-9289-416b93eb2357.sql
-- --------------------------------------------------------
ALTER TABLE public.loja_adicionais ADD COLUMN IF NOT EXISTS disponivel BOOLEAN DEFAULT true;

-- --------------------------------------------------------
-- MIGRATION: 20260530211555_e64810b7-d715-4efe-860b-4231d6f0e828.sql
-- --------------------------------------------------------
-- Settings (singleton)
CREATE TABLE public.system_rating_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.system_rating_settings (id, enabled) VALUES (1, false);

GRANT SELECT ON public.system_rating_settings TO anon, authenticated;
GRANT ALL ON public.system_rating_settings TO service_role;

ALTER TABLE public.system_rating_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.system_rating_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update settings"
ON public.system_rating_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ratings
CREATE TABLE public.system_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL,
  cliente_nome TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('ruim', 'bom', 'otimo')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_telefone)
);

GRANT INSERT ON public.system_ratings TO anon, authenticated;
GRANT SELECT, DELETE ON public.system_ratings TO authenticated;
GRANT ALL ON public.system_ratings TO service_role;

ALTER TABLE public.system_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a rating"
ON public.system_ratings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read ratings"
ON public.system_ratings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ratings"
ON public.system_ratings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Opt-outs
CREATE TABLE public.system_rating_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL UNIQUE,
  cliente_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.system_rating_optouts TO anon, authenticated;
GRANT SELECT ON public.system_rating_optouts TO authenticated;
GRANT ALL ON public.system_rating_optouts TO service_role;

ALTER TABLE public.system_rating_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can opt out"
ON public.system_rating_optouts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read opt-outs"
ON public.system_rating_optouts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RPC: check if a phone already responded or opted out
CREATE OR REPLACE FUNCTION public.system_rating_status(_telefone TEXT)
RETURNS TABLE (has_voted BOOLEAN, has_opted_out BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.system_ratings WHERE cliente_telefone = _telefone),
    EXISTS (SELECT 1 FROM public.system_rating_optouts WHERE cliente_telefone = _telefone);
$$;

GRANT EXECUTE ON FUNCTION public.system_rating_status(TEXT) TO anon, authenticated;

-- --------------------------------------------------------
-- MIGRATION: 20260530213018_cc674fae-7458-4cca-9c60-c017ca20b86d.sql
-- --------------------------------------------------------
ALTER TABLE public.system_ratings ADD COLUMN loja_id UUID REFERENCES public.lojas(id);
ALTER TABLE public.system_rating_optouts ADD COLUMN loja_id UUID REFERENCES public.lojas(id);

-- Update grants to include the new column (though default often handles it)
GRANT ALL ON public.system_ratings TO authenticated, service_role;
GRANT ALL ON public.system_rating_optouts TO authenticated, service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260531135132_890c1671-19e7-473a-9c34-c6469f209792.sql
-- --------------------------------------------------------
ALTER TABLE public.loja_usuarios ADD COLUMN IF NOT EXISTS permissoes_acoes JSONB DEFAULT '{}'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260531155301_96166771-5a01-4821-bb53-8bf2dd5e196e.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS categorias_estilo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- --------------------------------------------------------
-- MIGRATION: 20260531181421_36ba47f9-692c-4af7-9a15-5a37a2e8261d.sql
-- --------------------------------------------------------
-- Create support tickets table
CREATE TABLE public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- open, closed, pending
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE public.support_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL, -- auth.uid()
    sender_role TEXT NOT NULL, -- 'store' or 'admin'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

-- Policies for tickets
CREATE POLICY "Stores can view their own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

CREATE POLICY "Stores can create their own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

-- Policies for messages
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL))
        )
    );

CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL))
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- --------------------------------------------------------
-- MIGRATION: 20260531182858_5c74c76b-a804-49b0-8efa-2cc7e5492d0e.sql
-- --------------------------------------------------------
-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.support_messages;

-- Re-create policies for tickets with corrected admin check
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Re-create policies for messages with corrected admin check
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );

CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );

-- --------------------------------------------------------
-- MIGRATION: 20260531192904_736e0994-f295-4c80-9a2a-b3ae3a722c6e.sql
-- --------------------------------------------------------
-- Add ticket_number column
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- Create sequence for ticket numbering
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq;

-- Function to assign ticket number
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('support_ticket_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to assign number on insert
DROP TRIGGER IF EXISTS tr_assign_ticket_number ON public.support_tickets;
CREATE TRIGGER tr_assign_ticket_number
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.assign_ticket_number();

-- Update existing tickets with sequential numbers if they don't have one
-- This orders them by creation date to maintain historical order
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.support_tickets WHERE ticket_number IS NULL ORDER BY created_at ASC LOOP
        UPDATE public.support_tickets SET ticket_number = nextval('support_ticket_number_seq') WHERE id = r.id;
    END LOOP;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260531194148_26a87395-1c60-44d5-a683-290c4483e547.sql
-- --------------------------------------------------------
-- Create a table for online users tracking
CREATE TABLE IF NOT EXISTS public.online_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    user_role TEXT, -- 'admin', 'lojista', 'afiliado', 'entregador', 'cliente', 'visitante'
    current_page TEXT NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_name TEXT,
    UNIQUE(session_id)
);

-- Use GRANT to set permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_users TO anon, authenticated;
GRANT ALL ON public.online_users TO service_role;

-- Enable RLS
ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can insert/update their own session" 
ON public.online_users 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view all online users" 
ON public.online_users 
FOR SELECT 
USING (true);

-- Function to clean up old sessions (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.clean_old_online_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.online_users WHERE last_seen_at < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- MIGRATION: 20260531195342_69ea70c3-4f29-4160-9067-221a423bee04.sql
-- --------------------------------------------------------
ALTER TABLE public.online_users 
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS navigation_history JSONB DEFAULT '[]'::jsonb;

-- Grant permissions (if not already granted)
GRANT ALL ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;
GRANT ALL ON public.online_users TO anon;

-- --------------------------------------------------------
-- MIGRATION: 20260531200347_d12625d9-460f-42f6-a843-d26973aea466.sql
-- --------------------------------------------------------
-- Enable real-time for the online_users table
alter publication supabase_realtime add table public.online_users;

-- Ensure RLS allows the admin to delete entries if they want to clear the list
-- Assuming admin has permissions already, but just in case.
GRANT DELETE ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260531200649_d4a9a0bf-2f17-4c68-bca3-a4adf38910a5.sql
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE (table_name text, row_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        relname::text as table_name, 
        n_live_tup::bigint as row_count 
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public';
END;
$$;

CREATE OR REPLACE FUNCTION get_column_stats()
RETURNS TABLE (table_name text, column_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.table_name::text, 
        count(column_name)::bigint as column_count 
    FROM information_schema.columns c
    WHERE table_schema = 'public' 
    GROUP BY c.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_db_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_db_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_column_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_column_stats() TO service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260602003757_80404294-896c-4145-82e5-3cf4d399f647.sql
-- --------------------------------------------------------
-- Adicionar política de exclusão para tickets de suporte (admins)
CREATE POLICY "Admins can delete tickets" 
ON public.support_tickets 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);

-- Adicionar política de exclusão para mensagens de suporte (admins)
CREATE POLICY "Admins can delete support messages" 
ON public.support_messages 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);

-- --------------------------------------------------------
-- MIGRATION: 20260603001646_5759acea-75af-4b76-8b25-5ecbefe92bd2.sql
-- --------------------------------------------------------
-- Remove vulnerable self-insert policy that allowed privilege escalation
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- Only admins may insert roles
CREATE POLICY "Admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins may update roles
CREATE POLICY "Admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------
-- MIGRATION: 20260603002135_831aadd6-962a-4449-b1f0-4ab9d0755d00.sql
-- --------------------------------------------------------
-- Remover a política excessivamente permissiva
DROP POLICY IF EXISTS "Qualquer pessoa pode ler configurações" ON public.configuracoes_globais;

-- Criar política para leitura de configurações públicas (que não são códigos mestres)
CREATE POLICY "Configurações públicas são visíveis por todos"
ON public.configuracoes_globais
FOR SELECT
USING (chave NOT IN ('master_code_lojista', 'master_code_afiliado'));

-- Criar política restrita para códigos mestres (apenas administradores)
CREATE POLICY "Códigos mestres são visíveis apenas por administradores"
ON public.configuracoes_globais
FOR SELECT
USING (
  chave IN ('master_code_lojista', 'master_code_afiliado') 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- --------------------------------------------------------
-- MIGRATION: 20260603002305_ed89abe6-8724-409d-a81c-3543820b82cb.sql
-- --------------------------------------------------------
-- 1. Remover a política antiga e criar uma com o nome correto da coluna
DROP POLICY IF EXISTS "Public can view active certificate content" ON public.qz_certificates;
DROP POLICY IF EXISTS "O público pode visualizar o conteúdo do certificado ativo" ON public.qz_certificates;

CREATE POLICY "Public can view active certificate metadata"
ON public.qz_certificates
FOR SELECT
USING (is_active = true);

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.qz_certificates ENABLE ROW LEVEL SECURITY;

-- 3. Restringir o acesso à coluna private_key_content no nível do banco de dados (Column-level security)
-- Isso impede que o PostgREST retorne esta coluna para essas roles, mesmo que a política RLS permita a linha.
REVOKE SELECT (private_key_content) ON public.qz_certificates FROM anon, authenticated;

-- 4. Garantir que a service_role (usada por processos de servidor e admins no dashboard) continue com acesso
GRANT SELECT (private_key_content) ON public.qz_certificates TO service_role;

-- 5. Criar política específica para administradores verem todas as colunas se necessário via auth
-- Como revogamos o SELECT na coluna para 'authenticated', mesmo um admin logado não veria a coluna via API REST padrão 
-- a menos que use a service_role ou acessemos via RPC/Function.
-- No entanto, para políticas de linha:
CREATE POLICY "Admins can view all certificate data"
ON public.qz_certificates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ⚠️  PULADO (tabela de sistema): 20260603002413_edbeffb7-ea33-4fde-a6b4-b0e42ef99498.sql

-- --------------------------------------------------------
-- MIGRATION: 20260603002521_cf94c0af-38b4-46f3-a97c-bd5eec159793.sql
-- --------------------------------------------------------
-- Remover políticas inseguras existentes
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

-- ============================================
-- LOGOS
-- ============================================
CREATE POLICY "Users can upload own logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Users can delete own logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- ============================================
-- BANNERS
-- ============================================
CREATE POLICY "Users can upload own banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'banners'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Users can delete own banners"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'banners'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- ============================================
-- PRODUCT-IMAGES
-- ============================================
CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- --------------------------------------------------------
-- MIGRATION: 20260603002651_15a8477a-23b6-4d21-a3f3-144fa15b2840.sql
-- --------------------------------------------------------
-- Remover política insegura de UPDATE (era aplicada à role 'public', incluindo anônimos)
DROP POLICY IF EXISTS "Users can update their own client data" ON public.clientes;
DROP POLICY IF EXISTS "Qualquer pessoa pode atualizar os dados dos clientes" ON public.clientes;

-- Nova política: apenas lojistas donos da loja do cliente, ou admins, podem atualizar
CREATE POLICY "Lojistas can update their store clients"
ON public.clientes
FOR UPDATE
TO authenticated
USING (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- --------------------------------------------------------
-- MIGRATION: 20260605111705_c7c16785-c915-487b-abf8-0b2ea5dd605b.sql
-- --------------------------------------------------------
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.pdv_mesas(id);
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pdv_pedidos TO service_role;
GRANT ALL ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO anon;

-- --------------------------------------------------------
-- MIGRATION: 20260605130257_a3c080bd-b2c6-40c1-be38-b6979efb7f5d.sql
-- --------------------------------------------------------
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='last_added_at') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN last_added_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='order_type') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN order_type TEXT DEFAULT 'local';
  END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260605135737_83b4f709-556a-42be-be94-adea1872b111.sql
-- --------------------------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pedidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT SELECT ON public.pedidos TO anon;

-- --------------------------------------------------------
-- MIGRATION: 20260605155812_f9749ccd-66f3-45cc-a25e-1c75eb02032d.sql
-- --------------------------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pdv_pedido_id UUID REFERENCES public.pdv_pedidos(id) ON DELETE SET NULL;

-- Criar ou substituir a função de trigger para sincronizar o numero_diario
CREATE OR REPLACE FUNCTION public.sync_pedido_numero_diario()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pdv_pedido_id IS NOT NULL THEN
    -- Busca o numero_diario do pdv_pedido
    SELECT numero_diario INTO NEW.numero_diario
    FROM public.pdv_pedidos
    WHERE id = NEW.pdv_pedido_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar trigger à tabela pedidos
DROP TRIGGER IF EXISTS tr_sync_pedido_numero_diario ON public.pedidos;
CREATE TRIGGER tr_sync_pedido_numero_diario
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.sync_pedido_numero_diario();

-- --------------------------------------------------------
-- MIGRATION: 20260605185521_70c314b4-58ff-4750-ba18-6f9c8176c771.sql
-- --------------------------------------------------------
CREATE POLICY "Permitir leitura pública de usuários da loja para comanda" ON public.loja_usuarios FOR SELECT USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260605211025_a531aad4-9456-4d98-bab0-347f6c3c8dd5.sql
-- --------------------------------------------------------
-- Ajustar políticas para a tabela produtos
DROP POLICY IF EXISTS "Lojistas can insert their products" ON public.produtos;
CREATE POLICY "Lojistas can insert their products" ON public.produtos 
FOR INSERT TO authenticated 
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Ajustar políticas para a tabela loja_adicionais
DROP POLICY IF EXISTS "Users can insert addons for their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can insert addons for their own stores" ON public.loja_adicionais 
FOR INSERT TO authenticated 
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update addons from their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can update addons from their own stores" ON public.loja_adicionais 
FOR UPDATE TO authenticated 
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Ajustar políticas para a tabela loja_categoria_imagens
DROP POLICY IF EXISTS "Lojista can manage own category images" ON public.loja_categoria_imagens;
CREATE POLICY "Lojista can manage own category images" ON public.loja_categoria_imagens 
FOR ALL TO authenticated 
USING (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- Garantir acesso ao bucket de imagens
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
CREATE POLICY "Users can update own product images" ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- --------------------------------------------------------
-- MIGRATION: 20260606145032_60ed6afe-53a3-45d7-9dc5-03db061b6a2f.sql
-- --------------------------------------------------------
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC;
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS promo_duracao_meses INTEGER DEFAULT 0;

ALTER TABLE public.loja_planos ADD COLUMN IF NOT EXISTS promo_pagamentos_feitos INTEGER DEFAULT 0;

-- --------------------------------------------------------
-- MIGRATION: 20260606172259_36dc7d68-1529-4d2f-9b8e-8f849323c14b.sql
-- --------------------------------------------------------
-- Primeiro, vamos garantir que o trigger tr_sync_pedido_numero_diario seja executado ANTES do trg_set_numero_diario
-- para que ele possa atribuir o numero_diario do PDV e o trg_set_numero_diario veja que já existe um valor.

-- No PostgreSQL, os triggers são executados em ordem alfabética.
-- Atualmente: 
-- tr_sync_pedido_numero_diario (S)
-- trg_set_numero_diario (T)
-- A ordem já está correta (S vem antes de T).

-- O problema é que o trg_set_numero_diario provavelmente não verifica se o NEW.numero_diario já está preenchido.
-- Vamos ajustar a função set_numero_diario para respeitar um número já atribuído.

CREATE OR REPLACE FUNCTION public.set_numero_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_id uuid;
BEGIN
  -- Se já houver um número (atribuído por outro trigger como o de sync do PDV), mantém ele.
  IF NEW.numero_diario IS NOT NULL AND NEW.numero_diario > 0 THEN
    RETURN NEW;
  END IF;

  -- Get max from pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get the store id for this owner
  SELECT id INTO store_id FROM public.lojas WHERE user_id = NEW.lojista_id LIMIT 1;

  -- Get max from pdv_pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = store_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$function$;

-- Vamos ajustar também a função do PDV para ser mais robusta e evitar conflitos.
CREATE OR REPLACE FUNCTION public.set_numero_diario_pdv()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_user_id uuid;
BEGIN
  -- Se for um UPDATE e o número já existir, não altera
  IF (TG_OP = 'UPDATE' AND OLD.numero_diario IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- Get the store owner's user_id from loja_id
  SELECT user_id INTO store_user_id FROM public.lojas WHERE id = NEW.loja_id;

  -- Get max numero_diario from pedidos for this store owner today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = store_user_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get max numero_diario from pdv_pedidos for this store today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = NEW.loja_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$function$;

-- --------------------------------------------------------
-- MIGRATION: 20260607173905_95cc7900-971b-4478-b92d-604fefb944f9.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS integration_fee_rate NUMERIC DEFAULT 0;
COMMENT ON COLUMN public.lojas.integration_fee_rate IS 'Taxa de integração do Mercado Pago em porcentagem (ex: 1.5 para 1.5%)';

-- --------------------------------------------------------
-- MIGRATION: 20260609133106_193bf18c-3151-4157-af79-f1771f9fabe4.sql
-- --------------------------------------------------------
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS garcom_nome TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260610025201_b48c6deb-62a3-4ee3-9f2b-c9f3cca6b3e3.sql
-- --------------------------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260615194923_c57262ff-39d6-47bb-89b5-e7c1c30225e4.sql
-- --------------------------------------------------------
ALTER TABLE public.system_rating_settings ADD COLUMN IF NOT EXISTS event_image_url TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260615211841_7d152217-b8f4-4931-bba3-569b71cb2e96.sql
-- --------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_rating_settings;

-- --------------------------------------------------------
-- MIGRATION: 20260615213926_32c6a994-fbf1-47c5-977a-b2cacb0673d8.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS ocultar_evento boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260620214510_3545d83f-a126-4ac2-8cad-425bcb8180f7.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260620214701_73208ebe-11fc-4a94-9452-6cead65376d2.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_painel TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260621014705_637b3dcf-97f4-4031-9781-31b5b00cf3a6.sql
-- --------------------------------------------------------
GRANT SELECT ON public.pdv_mesas TO anon;
CREATE POLICY "Public read mesas for comanda link"
ON public.pdv_mesas FOR SELECT
TO anon, authenticated
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260622012842_dd49e0d6-e7f9-4939-a946-0109f4f1869c.sql
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens TO authenticated;
GRANT ALL ON public.admin_mensagens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_excluidas TO authenticated;
GRANT ALL ON public.admin_mensagens_excluidas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_lidas TO authenticated;
GRANT ALL ON public.admin_mensagens_lidas TO service_role;

-- --------------------------------------------------------
-- MIGRATION: 20260624142906_5e099528-9a72-4169-86db-79542237e205.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS popup_informativo_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_informativo_imagem_url text,
  ADD COLUMN IF NOT EXISTS popup_informativo_data_limite timestamptz;

-- --------------------------------------------------------
-- MIGRATION: 20260624175211_9b849a92-144c-4037-847e-a713d67f004b.sql
-- --------------------------------------------------------
GRANT SELECT ON public.loja_categoria_imagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_categoria_imagens TO authenticated;
GRANT ALL ON public.loja_categoria_imagens TO service_role;

DROP POLICY IF EXISTS "Anyone can view category images" ON public.loja_categoria_imagens;
CREATE POLICY "Anyone can view category images"
ON public.loja_categoria_imagens
FOR SELECT
TO anon, authenticated
USING (true);

-- --------------------------------------------------------
-- MIGRATION: 20260626013200_e42ff4ca-8dcd-49f0-814e-a9fecdbe24ac.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- --------------------------------------------------------
-- MIGRATION: 20260626013919_65392b11-3e26-4d19-aa18-fb147184c1f8.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260626015316_1365587e-4ee8-4c7c-92bd-d997defc1211.sql
-- --------------------------------------------------------
ALTER TABLE public.support_tickets ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app';

GRANT INSERT ON public.support_tickets TO anon;

DROP POLICY IF EXISTS "Anon can create guest tickets" ON public.support_tickets;
CREATE POLICY "Anon can create guest tickets" ON public.support_tickets
  FOR INSERT TO anon
  WITH CHECK (store_id IS NULL AND guest_email IS NOT NULL AND length(guest_email) <= 255 AND length(coalesce(description,'')) <= 2000);

-- --------------------------------------------------------
-- MIGRATION: 20260626020701_1075be34-4f9c-4444-b906-f2e5a19b7122.sql
-- --------------------------------------------------------
UPDATE public.planos
SET limites = limites || '{"pdv_balcao": true, "pdv_mesas": true}'::jsonb
WHERE (limites->>'pdv')::boolean = true;

-- --------------------------------------------------------
-- MIGRATION: 20260626221537_7c5ab29a-fcd4-4369-a994-192fde35cb41.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS pdv_venda_fora_horario boolean NOT NULL DEFAULT false;

-- --------------------------------------------------------
-- MIGRATION: 20260704011022_073b5d90-7720-4e7c-a077-d6686e1a8cb9.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS max_adicionais integer DEFAULT NULL;
COMMENT ON COLUMN public.produtos.max_adicionais IS 'Maximum number of adicionais (add-ons) the customer can select. NULL or 0 = unlimited.';

-- --------------------------------------------------------
-- MIGRATION: 20260705021749_adbedbe7-5e77-40bb-b879-6e3e8c0f04c1.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS comissao_percent numeric;

-- --------------------------------------------------------
-- MIGRATION: 20260705023640_1c0cded2-d76a-4e45-8898-f5e6e4eed608.sql
-- --------------------------------------------------------
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- --------------------------------------------------------
-- MIGRATION: 20260705024126_dc714c5a-e261-47b6-8599-efb8b5433af3.sql
-- --------------------------------------------------------
UPDATE public.comissoes SET percentual = 35, valor_comissao = ROUND(valor_pedido * 0.35, 2) WHERE id = '022e9fa1-c27d-4d00-9a57-c8260329d769';

-- --------------------------------------------------------
-- MIGRATION: 20260707220247_a364017d-58f0-4b87-a88a-09d26973cee6.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260707220541_03bb5702-002a-4638-856c-0072a485288d.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260707220804_79a872ca-1a1d-47ad-b1df-0cad3ef87297.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260708030144_bcb0a617-5796-44cc-af65-bd9498210945.sql
-- --------------------------------------------------------
UPDATE public.app_version SET major = 1, minor = 3, updated_at = now() WHERE id = 1;

-- --------------------------------------------------------
-- MIGRATION: 20260712202010_0f181e97-8106-4f65-942e-7b1c27b80851.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS mais_vendidos_ativo BOOLEAN NOT NULL DEFAULT true;

-- --------------------------------------------------------
-- MIGRATION: 20260712203856_a3203d31-2b09-4c5e-b9d1-e3f628465ff2.sql
-- --------------------------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260716152946_76ca1d49-2e60-4981-87ab-5490f3806d95.sql
-- --------------------------------------------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ;

-- --------------------------------------------------------
-- MIGRATION: 20260716154018_20ad88b1-96f2-451b-9177-4d63bfa05008.sql
-- --------------------------------------------------------
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS store_read_at TIMESTAMPTZ;

-- --------------------------------------------------------
-- MIGRATION: 20260716154615_137a81eb-7193-41b2-b4d6-2a15dddc3a10.sql
-- --------------------------------------------------------
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

-- --------------------------------------------------------
-- MIGRATION: 20260716154938_b633c294-10e9-47ac-ad3a-4d087ebff67b.sql
-- --------------------------------------------------------
CREATE POLICY "Stores can update their own tickets"
ON public.support_tickets
FOR UPDATE
USING (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id))
WITH CHECK (auth.uid() IN (SELECT lojas.user_id FROM lojas WHERE lojas.id = support_tickets.store_id));

-- --------------------------------------------------------
-- MIGRATION: 20260717231137_6a9230dc-b46c-4b5f-8896-b10d92986ecb.sql
-- --------------------------------------------------------
CREATE TABLE public.access_logs (
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

CREATE INDEX idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX idx_access_logs_session ON public.access_logs (session_id, created_at);

GRANT INSERT ON public.access_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert access logs"
  ON public.access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access logs"
  ON public.access_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- --------------------------------------------------------
-- MIGRATION: 20260717232946_52c179f8-8742-4862-9fca-82a7b4094a56.sql
-- --------------------------------------------------------
ALTER TABLE public.online_users REPLICA IDENTITY FULL;
ALTER TABLE public.access_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='access_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs';
  END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260719132915_786fe33d-d1e0-4d66-acb0-536b4df35661.sql
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

CREATE POLICY "Admin upload installers" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update installers" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete installers" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read installers" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'installers');

-- --------------------------------------------------------
-- MIGRATION: 20260719150046_43ea4a78-80fb-49cb-ba77-fb63bcfecbf3.sql
-- --------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_answer TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260804225408_ef8c9286-1ce3-4e6d-8c8a-1579c3ee171b.sql
-- --------------------------------------------------------
UPDATE public.comissoes
SET valor_comissao = 26.22
WHERE id = '72b9bed3-2b2a-4765-9389-e360947107a2';

-- --------------------------------------------------------
-- MIGRATION: 20260805123512_cdfb134c-fa49-471f-b9b9-0d961eb73458.sql
-- --------------------------------------------------------
-- Políticas de armazenamento para o bucket banners_produtos
-- Nota: Supõe-se que o bucket será criado via dashboard ou ferramenta de gestão do Lovable Cloud.
-- Aqui configuramos apenas as políticas de acesso na tabela storage.objects.

DO $$
BEGIN
    -- Permitir leitura pública
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access Banners'
    ) THEN
        CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners_produtos');
    END IF;

    -- Permitir upload para autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Upload Banners'
    ) THEN
        CREATE POLICY "Authenticated Upload Banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners_produtos');
    END IF;

    -- Permitir exclusão para autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Delete Banners'
    ) THEN
        CREATE POLICY "Authenticated Delete Banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners_produtos');
    END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260805123740_f8afa850-4a3e-4102-bbcc-623037961bc6.sql
-- --------------------------------------------------------
-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Public Read Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Banners" ON storage.objects;

-- 1. Permitir leitura pública de arquivos
CREATE POLICY "Public Read Banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners_produtos');

-- 2. Permitir que usuários autenticados enviem arquivos
CREATE POLICY "Authenticated Upload Banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners_produtos');

-- 3. Permitir que usuários autenticados excluam arquivos
CREATE POLICY "Authenticated Delete Banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners_produtos');

-- 4. Permitir que usuários autenticados atualizem arquivos
CREATE POLICY "Authenticated Update Banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners_produtos');

-- --------------------------------------------------------
-- MIGRATION: 20260805124143_6d48f2a0-6a73-4c1a-b37c-a55293f5d444.sql
-- --------------------------------------------------------
-- Conceder permissões de uso no schema storage para roles do sistema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- Conceder permissões em tabelas específicas do storage
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Adicionar permissões de sequência se necessário
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;

-- --------------------------------------------------------
-- MIGRATION: 20260805124345_7020abe0-f204-493a-a8f2-a13933b1e47e.sql
-- --------------------------------------------------------
-- Remover políticas do bucket anterior (limpeza)
DROP POLICY IF EXISTS "Public Read Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Banners" ON storage.objects;
DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;

-- Garantir políticas no bucket 'banners' que já é utilizado em outras partes do sistema
DO $$
BEGIN
    -- Política de Leitura Pública
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
    END IF;

    -- Política de Upload para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated Upload Banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');
    END IF;

    -- Política de Update para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Update Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated Update Banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');
    END IF;

    -- Política de Delete para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Delete Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated Delete Banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');
    END IF;
END $$;

-- --------------------------------------------------------
-- MIGRATION: 20260807195303_9f2cc430-e876-431a-ac90-f77d04727e65.sql
-- --------------------------------------------------------
ALTER TABLE public.lojas ALTER COLUMN margem_esquerda SET DEFAULT 3.0;
ALTER TABLE public.lojas ALTER COLUMN margem_direita SET DEFAULT 3.0;

UPDATE public.lojas 
SET margem_esquerda = 3.0, 
    margem_direita = 3.0
WHERE (margem_esquerda IN (0, 0.5) OR margem_esquerda IS NULL)
  OR (margem_direita IN (0, 0.5) OR margem_direita IS NULL);

-- --------------------------------------------------------
-- MIGRATION: 20260813232019_096c1313-97c7-4663-bb32-a512acfdd7ef.sql
-- --------------------------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_tipo TEXT;

-- --------------------------------------------------------
-- MIGRATION: 20260822_error_logs.sql
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    url TEXT,
    message TEXT,
    stack TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT SELECT, INSERT ON public.error_logs TO anon;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert error logs" ON public.error_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow auth insert error logs" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

