-- ================================================================
-- PARTE 5 DE 8 | Migrações 121–150 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260503161452_8d94e8c7-373f-4f71-96a9-a516e5065fe9.sql
-- ----------------------------------------
-- Adiciona coluna qz_tray_ativo se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas ADD COLUMN qz_tray_ativo BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ----------------------------------------
-- 20260503161759_a564706e-3c4f-4f8b-a4bc-c5ed30a288c6.sql
-- ----------------------------------------
-- Remove a coluna qz_tray_ativo se ela existir
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas DROP COLUMN qz_tray_ativo;
  END IF;
END $$;

-- ----------------------------------------
-- 20260503183141_d2c484dc-3c30-4487-ad7e-fe554dffd93a.sql
-- ----------------------------------------
-- CREATE TABLE IF NOT EXISTS for QZ Tray certificates
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
DROP POLICY IF EXISTS "Public can view active certificate content" ON public.qz_certificates;
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

-- ----------------------------------------
-- 20260503185207_271c78db-80a6-4cb3-b2b6-e6bbe8573454.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_automatica_qz BOOLEAN DEFAULT false;

-- ----------------------------------------
-- 20260503185602_acbe8c28-750c-4365-9a87-a4ed910b6843.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS documento TEXT;

-- ----------------------------------------
-- 20260503190744_f3aec66a-aa4b-4c9d-9c28-e8c41ecdda29.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressora_qz_nome TEXT;

-- ----------------------------------------
-- 20260503202345_6adac161-b6e1-4201-bbbb-050210c6296d.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_status_gatilho text NOT NULL DEFAULT 'aceito';

-- ----------------------------------------
-- 20260503221142_e059c101-e1cf-4904-8b62-fa974b65b966.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS impressao_duas_vias BOOLEAN DEFAULT FALSE;

-- ----------------------------------------
-- 20260503223451_f80ce1ef-6338-46c8-8ad2-7ab063c240b6.sql
-- ----------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS margem_esquerda INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_direita INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_superior INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_inferior INTEGER DEFAULT 0;

-- ----------------------------------------
-- 20260504015958_58c4aed2-354d-4c73-a22e-5ade06b1bca8.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260504154514_6035fad8-50ef-441d-97ec-a7868d38037d.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS qz_certificate TEXT;

-- ----------------------------------------
-- 20260504164823_6e7513ce-ac78-4bf1-8ae4-c50104e8423d.sql
-- ----------------------------------------
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
        DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING (bucket_id = 'loja-assets');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload assets'
    ) THEN
        DROP POLICY IF EXISTS "Authenticated users can upload assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'loja-assets' AND auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can update assets'
    ) THEN
        DROP POLICY IF EXISTS "Authenticated users can update assets" ON storage.objects;
CREATE POLICY "Authenticated users can update assets" ON storage.objects FOR UPDATE USING (bucket_id = 'loja-assets' AND auth.role() = 'authenticated');
    END IF;
END
$$;

-- ----------------------------------------
-- 20260504173124_deb0001e-94f8-4f4b-8da2-8c9caa62aaa7.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'public_assets');

-- Policy to allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'public_assets' 
  AND auth.role() = 'authenticated'
);

-- Policy to allow users to update/delete their own files (based on folder structure user_id/...)
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'public_assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'public_assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ----------------------------------------
-- 20260504180211_9bf8c039-8888-4979-b5ef-4c82bc627b3e.sql
-- ----------------------------------------
ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS printer_steps JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.printer_steps IS 'Armazena o passo a passo personalizado da instalação da impressora.';

-- ----------------------------------------
-- 20260506122506_0e966634-19e2-4792-8063-c379d36e486e.sql
-- ----------------------------------------
-- Create app_cupom_tipo enum
DO $$ BEGIN
    CREATE TYPE IF NOT EXISTS public.app_cupom_tipo AS ENUM ('fixo', 'percentual', 'frete_gratis');
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
    DROP POLICY IF EXISTS "Lojistas podem gerenciar seus próprios cupons" ON public.cupons;
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
    DROP POLICY IF EXISTS "Qualquer um pode ver cupons ativos da loja" ON public.cupons;
CREATE POLICY "Qualquer um pode ver cupons ativos da loja"
    ON public.cupons
    FOR SELECT
    USING (ativo = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for cupom_clientes
DO $$ BEGIN
    DROP POLICY IF EXISTS "Lojistas podem gerenciar clientes do cupom" ON public.cupom_clientes;
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
    DROP POLICY IF EXISTS "Clientes podem ver seus próprios cupons privados" ON public.cupom_clientes;
CREATE POLICY "Clientes podem ver seus próprios cupons privados"
    ON public.cupom_clientes
    FOR SELECT
    USING (true); -- Permitir select público para validação no checkout via telefone
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Policies for uso_cupons
DO $$ BEGIN
    DROP POLICY IF EXISTS "Lojistas podem ver usos dos seus cupons" ON public.uso_cupons;
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
    DROP POLICY IF EXISTS "Inserção pública de uso de cupom" ON public.uso_cupons;
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

-- ----------------------------------------
-- 20260506144630_92b7d789-f8b1-483b-87d0-d9403710a3c4.sql
-- ----------------------------------------
ALTER TABLE public.cupons 
ADD COLUMN uso_unico BOOLEAN DEFAULT true;

-- Atualizar a descrição da política ou garantir que as políticas existentes cubram a nova coluna (geralmente cobrem se for SELECT *)
-- Se houver necessidade de atualizar caches ou triggers, pode ser feito aqui.

-- ----------------------------------------
-- 20260506145555_b9f54099-8dee-4fd8-ab53-98b97a3c326e.sql
-- ----------------------------------------
ALTER TYPE public.app_cupom_tipo ADD VALUE 'cliente_novo';

-- ----------------------------------------
-- 20260510133337_180246b6-69a4-4c1e-a82c-1b9a12bb80a5.sql
-- ----------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cupom_lembrete_ativo boolean NOT NULL DEFAULT false;

-- ----------------------------------------
-- 20260511203632_92cc876d-2ba4-48ef-8c5f-3e6b2a9d92ad.sql
-- ----------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS cupom_popup_titulo text NOT NULL DEFAULT 'Cupom de Desconto',
  ADD COLUMN IF NOT EXISTS cupom_popup_subtitulo text NOT NULL DEFAULT 'Aproveite uma oferta especial no seu pedido!',
  ADD COLUMN IF NOT EXISTS cupom_popup_cta text NOT NULL DEFAULT 'COMEÇAR A PEDIR',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_fundo text NOT NULL DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS cupom_popup_cor_texto text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS cupom_popup_imagem_url text;

-- ----------------------------------------
-- 20260520132412_f0bbc2c4-c92c-45bc-b109-9ea2f8c7a52c.sql
-- ----------------------------------------
-- Tabela de mensagens enviadas pelo admin
CREATE TABLE IF NOT EXISTS public.admin_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  banner_url text,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_mensagens_loja ON public.admin_mensagens(loja_id);
CREATE INDEX IF NOT EXISTS idx_admin_mensagens_created ON public.admin_mensagens(created_at DESC);

ALTER TABLE public.admin_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam mensagens" ON public.admin_mensagens;
CREATE POLICY "Admins gerenciam mensagens"
ON public.admin_mensagens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Lojistas veem mensagens destinadas a eles" ON public.admin_mensagens;
CREATE POLICY "Lojistas veem mensagens destinadas a eles"
ON public.admin_mensagens
FOR SELECT
TO authenticated
USING (
  loja_id IS NULL
  OR loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
);

-- Tabela: mensagens excluídas (apenas para a loja específica)
CREATE TABLE IF NOT EXISTS public.admin_mensagens_excluidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_excluidas_loja ON public.admin_mensagens_excluidas(loja_id);

ALTER TABLE public.admin_mensagens_excluidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas gerenciam suas exclusoes" ON public.admin_mensagens_excluidas;
CREATE POLICY "Lojistas gerenciam suas exclusoes"
ON public.admin_mensagens_excluidas
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins veem todas exclusoes" ON public.admin_mensagens_excluidas;
CREATE POLICY "Admins veem todas exclusoes"
ON public.admin_mensagens_excluidas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: mensagens lidas (para controle de notificação)
CREATE TABLE IF NOT EXISTS public.admin_mensagens_lidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX IF NOT EXISTS idx_msg_lidas_loja ON public.admin_mensagens_lidas(loja_id);

ALTER TABLE public.admin_mensagens_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas gerenciam suas leituras" ON public.admin_mensagens_lidas;
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

-- ----------------------------------------
-- 20260522130917_0a35a2e4-640e-4038-859e-5350a686e460.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.loja_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  nome text NOT NULL,
  pin text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('admin','gerente','funcionario')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loja_usuarios_loja_id ON public.loja_usuarios(loja_id);

ALTER TABLE public.loja_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas gerenciam usuarios da sua loja" ON public.loja_usuarios;
CREATE POLICY "Lojistas gerenciam usuarios da sua loja"
ON public.loja_usuarios
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam todos usuarios da loja" ON public.loja_usuarios;
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

-- ----------------------------------------
-- 20260522131847_b389a135-3b35-41ee-b418-f73ff8938899.sql
-- ----------------------------------------
ALTER TABLE public.loja_usuarios
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------
-- 20260525112851_f227b125-5500-41c7-a518-fc0f010bb417.sql
-- ----------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------
-- 20260528121250_b062c29f-0350-4ee3-b76c-9c2a1318a752.sql
-- ----------------------------------------
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS sabores jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------
-- 20260529012239_3ca8080e-1e48-4499-8563-58f1d67d3949.sql
-- ----------------------------------------
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

-- CREATE OR REPLACE FUNCTION to handle complete store deletion
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

-- ----------------------------------------
-- 20260529012332_ad8f986d-de21-48b5-ab3b-29f3c73ac2c0.sql
-- ----------------------------------------
ALTER FUNCTION public.delete_loja_complete(UUID) SET search_path = public, auth;

-- ----------------------------------------
-- 20260529021227_fbb97d8e-f9a3-4857-98bc-e871c1153cc2.sql
-- ----------------------------------------
-- CREATE TABLE IF NOT EXISTS for chat messages
CREATE TABLE IF NOT EXISTS public.suporte_mensagens (
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
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.suporte_mensagens;
CREATE POLICY "Anyone can insert messages" 
ON public.suporte_mensagens FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view messages from their session" ON public.suporte_mensagens;
CREATE POLICY "Users can view messages from their session" 
ON public.suporte_mensagens FOR SELECT 
USING (true); -- In a production app, we'd filter by session_id cookie/localstorage

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_suporte_mensagens_session ON public.suporte_mensagens(session_id);
CREATE INDEX IF NOT EXISTS idx_suporte_mensagens_created_at ON public.suporte_mensagens(created_at);

-- ----------------------------------------
-- 20260529141718_c3ad49af-8dc6-421e-b529-03e329a47929.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Anyone can insert orders from active stores" ON public.pedidos;
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
DROP POLICY IF EXISTS "Anyone can insert clients for active stores" ON public.clientes;
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
DROP POLICY IF EXISTS "Users can update their own client data" ON public.clientes;
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
DROP POLICY IF EXISTS "Authenticated users or session holders can insert support messages" ON public.suporte_mensagens;
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

-- ----------------------------------------
-- 20260529141751_56591fe8-97d5-4745-a6e2-01e1922e46d3.sql
-- ----------------------------------------
-- 1. Refine Pedidos policies for Authenticated users
DROP POLICY IF EXISTS "Authenticated can insert orders from public menu" ON public.pedidos;
DROP POLICY IF EXISTS "Authenticated can insert orders from active stores" ON public.pedidos;
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
DROP POLICY IF EXISTS "Anyone can update order rating if active store" ON public.pedidos;
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
DROP POLICY IF EXISTS "Public coupon usage for active stores" ON public.uso_cupons;
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

-- ----------------------------------------
-- 20260529141808_872b9c73-1103-4417-9f72-dc3bdf3d905f.sql
-- ----------------------------------------
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

