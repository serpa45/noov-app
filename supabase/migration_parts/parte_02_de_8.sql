-- ================================================================
-- PARTE 2 DE 8 | Migrações 31–60 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260329151902_386148f7-24e3-4070-bade-dba8dd209879.sql
-- ----------------------------------------
ALTER TABLE public.produtos
ADD COLUMN tag_novo boolean NOT NULL DEFAULT false,
ADD COLUMN tag_sugestao boolean NOT NULL DEFAULT false,
ADD COLUMN tag_destaque boolean NOT NULL DEFAULT false,
ADD COLUMN preco_promocional numeric DEFAULT NULL,
ADD COLUMN promocao_validade date DEFAULT NULL;

-- ----------------------------------------
-- 20260329153748_4f6e25b3-c343-41cb-8747-9c9a91cbbc35.sql
-- ----------------------------------------
ALTER TABLE public.produtos ADD COLUMN adicionais jsonb DEFAULT '[]'::jsonb;

-- ----------------------------------------
-- 20260329160610_2450b0dc-c251-4f00-b7ce-9ebb97f27299.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Anyone can view available products" ON public.produtos;
DROP POLICY IF EXISTS "Anyone can view store products" ON public.produtos;
CREATE POLICY "Anyone can view store products" ON public.produtos FOR SELECT TO anon USING (true);

-- ----------------------------------------
-- 20260329162817_b2b40f2f-058c-4f93-bb46-de83c85e2bfb.sql
-- ----------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;

-- ----------------------------------------
-- 20260329174837_79372666-77b2-4d40-9b04-eeb2e0c5d6d4.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN categorias_ordem jsonb DEFAULT '[]'::jsonb;

-- ----------------------------------------
-- 20260329180745_114d7f1f-c4a2-4c28-8251-b1ccad4fbf3d.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN cor_primaria text DEFAULT NULL;
ALTER TABLE public.lojas ADD COLUMN cor_secundaria text DEFAULT NULL;

-- ----------------------------------------
-- 20260329181657_62d240d9-c854-437a-9659-74e1a135d59f.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN banner_url text DEFAULT NULL;

-- ----------------------------------------
-- 20260329181736_61f27fa0-1619-4da4-bc5c-33722979ba30.sql
-- ----------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view banners" ON storage.objects;
CREATE POLICY "Anyone can view banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;
CREATE POLICY "Authenticated users can delete banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');

-- ----------------------------------------
-- 20260329184640_9a8f9763-8f8b-4ab6-9683-ffc15d33a27d.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
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

DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients" ON public.clientes FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can select by phone" ON public.clientes;
CREATE POLICY "Anyone can select by phone" ON public.clientes FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
CREATE POLICY "Anyone can update clients" ON public.clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clientes;
CREATE POLICY "Authenticated can view clients" ON public.clientes FOR SELECT TO authenticated USING (true);

-- ----------------------------------------
-- 20260329192246_d2910ca6-62db-46f2-ac03-eb3e412088ba.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260329203050_57abe4d9-f9e2-482e-a284-69d075b517d1.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Anyone can view loja_frete_bairros" ON public.loja_frete_bairros;
CREATE POLICY "Anyone can view loja_frete_bairros"
ON public.loja_frete_bairros
FOR SELECT
USING (true);

-- Lojista gerencia apenas os bairros da própria loja
DROP POLICY IF EXISTS "Lojistas can insert their store bairros" ON public.loja_frete_bairros;
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

-- ----------------------------------------
-- 20260329204052_b22845ce-c63f-4fc9-8945-66a5a5a1fdc8.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS formas_pagamento jsonb DEFAULT '["Dinheiro","PIX","Cartão de Crédito","Cartão de Débito"]'::jsonb;

-- ----------------------------------------
-- 20260329220857_de493f73-5a4e-4b18-b0b3-27f35463233c.sql
-- ----------------------------------------
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS foto_url text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-photos', 'client-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload client photos" ON storage.objects;
CREATE POLICY "Anyone can upload client photos"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'client-photos');

DROP POLICY IF EXISTS "Anyone can view client photos" ON storage.objects;
CREATE POLICY "Anyone can view client photos"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'client-photos');

DROP POLICY IF EXISTS "Anyone can update client photos" ON storage.objects;
CREATE POLICY "Anyone can update client photos"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'client-photos')
WITH CHECK (bucket_id = 'client-photos');

-- ----------------------------------------
-- 20260329223655_db768a8c-497e-478e-8a4c-de4687a11bdc.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_categoria_imagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  imagem_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(loja_id, categoria)
);

ALTER TABLE public.loja_categoria_imagens ENABLE ROW LEVEL SECURITY;

-- Lojista can manage their own category images
DROP POLICY IF EXISTS "Lojista can manage own category images" ON public.loja_categoria_imagens;
CREATE POLICY "Lojista can manage own category images"
  ON public.loja_categoria_imagens
  FOR ALL
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Anyone can view category images (for client menu)
DROP POLICY IF EXISTS "Anyone can view category images" ON public.loja_categoria_imagens;
CREATE POLICY "Anyone can view category images"
  ON public.loja_categoria_imagens
  FOR SELECT
  TO anon
  USING (true);

-- ----------------------------------------
-- 20260329234510_264a5acd-3c10-4b9f-8a8c-a98ef189f232.sql
-- ----------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;

-- ----------------------------------------
-- 20260330003529_c6d68167-6cd9-4a6e-a9b3-e8ed12642994.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Authenticated can view all store products" ON public.produtos;
CREATE POLICY "Authenticated can view all store products"
ON public.produtos
FOR SELECT
TO authenticated
USING (true);

-- ----------------------------------------
-- 20260330003604_4b747334-bc5d-4394-b575-81da220b15f5.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Anyone can view store owner pix info" ON public.profiles;
CREATE POLICY "Anyone can view store owner pix info"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  user_id IN (SELECT user_id FROM public.lojas WHERE ativo = true)
);

-- ----------------------------------------
-- 20260330015156_673ce616-d245-4803-8fb4-e550e154507f.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Anon can view orders by phone" ON public.pedidos;
CREATE POLICY "Anon can view orders by phone"
ON public.pedidos
FOR SELECT
TO anon
USING (true);

-- ----------------------------------------
-- 20260330180602_6b87fc29-7bc0-4cc7-a39b-2ecaa71ae848.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_globais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view global config" ON public.configuracoes_globais;
CREATE POLICY "Anyone can view global config" ON public.configuracoes_globais
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage global config" ON public.configuracoes_globais;
CREATE POLICY "Admins can manage global config" ON public.configuracoes_globais
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.configuracoes_globais (chave, valor) VALUES ('dias_teste_gratis', '7');

-- ----------------------------------------
-- 20260330185758_13529ea1-f296-4379-8cab-928d7e65da36.sql
-- ----------------------------------------
-- Add extra trial days column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS dias_teste_extra integer NOT NULL DEFAULT 0;

-- Create plan change history table
CREATE TABLE IF NOT EXISTS public.loja_plano_historico (
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

DROP POLICY IF EXISTS "Admins can manage plan history" ON public.loja_plano_historico;
CREATE POLICY "Admins can manage plan history"
  ON public.loja_plano_historico FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260330193017_f6fd985f-4a8e-4838-96f0-3cb16d85963b.sql
-- ----------------------------------------
UPDATE public.planos SET cta_texto = 'Assinar Start' WHERE slug = 'start';

-- ----------------------------------------
-- 20260330223049_7cdea68e-87b0-4d14-8653-e9dfbe46f521.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260330235242_1577512a-bc97-47eb-86eb-d1bb16c0ae74.sql
-- ----------------------------------------
-- Allow lojistas to INSERT their own plan
DROP POLICY IF EXISTS "Lojistas can insert their plan" ON public.loja_planos;
CREATE POLICY "Lojistas can insert their plan"
ON public.loja_planos
FOR INSERT TO authenticated
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);

-- Allow lojistas to UPDATE their own plan
DROP POLICY IF EXISTS "Lojistas can update their plan" ON public.loja_planos;
CREATE POLICY "Lojistas can update their plan"
ON public.loja_planos
FOR UPDATE TO authenticated
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
);

-- ----------------------------------------
-- 20260330235958_8dc82565-e46a-4acc-966a-8f9fb0cfae8f.sql
-- ----------------------------------------
-- Remove lojista INSERT/UPDATE policies on loja_planos (only admin should manage)
DROP POLICY IF EXISTS "Lojistas can insert their plan" ON public.loja_planos;
DROP POLICY IF EXISTS "Lojistas can update their plan" ON public.loja_planos;

-- ----------------------------------------
-- 20260331001431_f177ac05-c5f0-4caa-96b6-cb4f8ae0afc6.sql
-- ----------------------------------------
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 100, "max_armazenamento_mb": 512}'::jsonb WHERE slug = 'start';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 1000, "max_armazenamento_mb": 2048}'::jsonb WHERE slug = 'pro';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": -1, "max_armazenamento_mb": 10240}'::jsonb WHERE slug = 'ultra';

-- ----------------------------------------
-- 20260331012808_df2ebe93-7d7f-4e89-b459-03c7a3d1b5a8.sql
-- ----------------------------------------
ALTER TABLE public.planos ADD COLUMN comissao_afiliado numeric NOT NULL DEFAULT 10;

-- ----------------------------------------
-- 20260331014328_39ca54e2-721b-4c76-9eba-60a50496f481.sql
-- ----------------------------------------
-- Delete all non-admin users from auth.users (cascades to profiles, user_roles, etc.)
DELETE FROM auth.users
WHERE id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';

-- Clean up any orphaned data
DELETE FROM public.lojas WHERE user_id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';
DELETE FROM public.comissoes WHERE true;
DELETE FROM public.saques WHERE true;
DELETE FROM public.loja_planos WHERE true;
DELETE FROM public.loja_plano_historico WHERE true;

-- ----------------------------------------
-- 20260331014648_cfcc5a54-59ff-4a77-97d1-fea0c86d2d17.sql
-- ----------------------------------------
DELETE FROM public.entregas WHERE true;
DELETE FROM public.comissoes WHERE true;
DELETE FROM public.saques WHERE true;
DELETE FROM public.pedidos WHERE true;
DELETE FROM public.loja_planos WHERE true;
DELETE FROM public.loja_plano_historico WHERE true;

-- ----------------------------------------
-- 20260331032256_3babecb6-f928-47d1-b056-f0976d683711.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'logos');

-- ----------------------------------------
-- 20260331032652_31c5cf1a-4815-446c-93c0-8dd733272a5b.sql
-- ----------------------------------------
ALTER TABLE public.loja_planos ADD COLUMN expira_em timestamp with time zone DEFAULT NULL;

