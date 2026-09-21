-- ================================================================
-- PARTE 6 DE 8 | Migrações 151–180 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260529143620_317e22dd-7bf8-40d6-9289-416b93eb2357.sql
-- ----------------------------------------
ALTER TABLE public.loja_adicionais ADD COLUMN IF NOT EXISTS disponivel BOOLEAN DEFAULT true;

-- ----------------------------------------
-- 20260530211555_e64810b7-d715-4efe-860b-4231d6f0e828.sql
-- ----------------------------------------
-- Settings (singleton)
CREATE TABLE IF NOT EXISTS public.system_rating_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.system_rating_settings (id, enabled) VALUES (1, false);

GRANT SELECT ON public.system_rating_settings TO anon, authenticated;
GRANT ALL ON public.system_rating_settings TO service_role;

ALTER TABLE public.system_rating_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read settings" ON public.system_rating_settings;
CREATE POLICY "Anyone can read settings"
ON public.system_rating_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.system_rating_settings;
CREATE POLICY "Admins can update settings"
ON public.system_rating_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ratings
CREATE TABLE IF NOT EXISTS public.system_ratings (
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

DROP POLICY IF EXISTS "Anyone can submit a rating" ON public.system_ratings;
CREATE POLICY "Anyone can submit a rating"
ON public.system_ratings FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read ratings" ON public.system_ratings;
CREATE POLICY "Admins can read ratings"
ON public.system_ratings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete ratings" ON public.system_ratings;
CREATE POLICY "Admins can delete ratings"
ON public.system_ratings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Opt-outs
CREATE TABLE IF NOT EXISTS public.system_rating_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_telefone TEXT NOT NULL UNIQUE,
  cliente_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.system_rating_optouts TO anon, authenticated;
GRANT SELECT ON public.system_rating_optouts TO authenticated;
GRANT ALL ON public.system_rating_optouts TO service_role;

ALTER TABLE public.system_rating_optouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can opt out" ON public.system_rating_optouts;
CREATE POLICY "Anyone can opt out"
ON public.system_rating_optouts FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read opt-outs" ON public.system_rating_optouts;
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

-- ----------------------------------------
-- 20260530213018_cc674fae-7458-4cca-9c60-c017ca20b86d.sql
-- ----------------------------------------
ALTER TABLE public.system_ratings ADD COLUMN loja_id UUID REFERENCES public.lojas(id);
ALTER TABLE public.system_rating_optouts ADD COLUMN loja_id UUID REFERENCES public.lojas(id);

-- Update grants to include the new column (though default often handles it)
GRANT ALL ON public.system_ratings TO authenticated, service_role;
GRANT ALL ON public.system_rating_optouts TO authenticated, service_role;

-- ----------------------------------------
-- 20260531135132_890c1671-19e7-473a-9c34-c6469f209792.sql
-- ----------------------------------------
ALTER TABLE public.loja_usuarios ADD COLUMN IF NOT EXISTS permissoes_acoes JSONB DEFAULT '{}'::jsonb;

-- ----------------------------------------
-- 20260531155301_96166771-5a01-4821-bb53-8bf2dd5e196e.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS categorias_estilo jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------
-- 20260531181421_36ba47f9-692c-4af7-9a15-5a37a2e8261d.sql
-- ----------------------------------------
-- Create support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- open, closed, pending
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
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
DROP POLICY IF EXISTS "Stores can view their own tickets" ON public.support_tickets;
CREATE POLICY "Stores can view their own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

DROP POLICY IF EXISTS "Stores can create their own tickets" ON public.support_tickets;
CREATE POLICY "Stores can create their own tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id));

DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL));

-- Policies for messages
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND codigo_admin IS NOT NULL))
        )
    );

DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.support_messages;
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

-- ----------------------------------------
-- 20260531182858_5c74c76b-a804-49b0-8efa-2cc7e5492d0e.sql
-- ----------------------------------------
-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.support_messages;

-- Re-create policies for tickets with corrected admin check
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all tickets" ON public.support_tickets
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;
CREATE POLICY "Admins can update all tickets" ON public.support_tickets
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL)
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Re-create policies for messages with corrected admin check
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.support_messages;
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );

DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.support_messages;
CREATE POLICY "Users can insert messages for their tickets" ON public.support_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND 
            (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = store_id) OR 
             EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND codigo_admin IS NOT NULL) OR
             EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
        )
    );

-- ----------------------------------------
-- 20260531192904_736e0994-f295-4c80-9a2a-b3ae3a722c6e.sql
-- ----------------------------------------
-- Add ticket_number column
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- CREATE SEQUENCE IF NOT EXISTS for ticket numbering
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

-- ----------------------------------------
-- 20260531194148_26a87395-1c60-44d5-a683-290c4483e547.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Anyone can insert/update their own session" ON public.online_users;
CREATE POLICY "Anyone can insert/update their own session" 
ON public.online_users 
FOR ALL 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all online users" ON public.online_users;
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

-- ----------------------------------------
-- 20260531195342_69ea70c3-4f29-4160-9067-221a423bee04.sql
-- ----------------------------------------
ALTER TABLE public.online_users 
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS navigation_history JSONB DEFAULT '[]'::jsonb;

-- Grant permissions (if not already granted)
GRANT ALL ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;
GRANT ALL ON public.online_users TO anon;

-- ----------------------------------------
-- 20260531200347_d12625d9-460f-42f6-a843-d26973aea466.sql
-- ----------------------------------------
-- Enable real-time for the online_users table
alter publication supabase_realtime add table public.online_users;

-- Ensure RLS allows the admin to delete entries if they want to clear the list
-- Assuming admin has permissions already, but just in case.
GRANT DELETE ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;

-- ----------------------------------------
-- 20260531200649_d4a9a0bf-2f17-4c68-bca3-a4adf38910a5.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260602003757_80404294-896c-4145-82e5-3cf4d399f647.sql
-- ----------------------------------------
-- Adicionar política de exclusão para tickets de suporte (admins)
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.support_tickets;
CREATE POLICY "Admins can delete tickets" 
ON public.support_tickets 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);

-- Adicionar política de exclusão para mensagens de suporte (admins)
DROP POLICY IF EXISTS "Admins can delete support messages" ON public.support_messages;
CREATE POLICY "Admins can delete support messages" 
ON public.support_messages 
FOR DELETE 
USING (
  (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.codigo_admin IS NOT NULL)) OR 
  (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);

-- ----------------------------------------
-- 20260603001646_5759acea-75af-4b76-8b25-5ecbefe92bd2.sql
-- ----------------------------------------
-- Remove vulnerable self-insert policy that allowed privilege escalation
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- Only admins may insert roles
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
CREATE POLICY "Admins can insert user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins may update roles
DROP POLICY IF EXISTS "Admins can update user_roles" ON public.user_roles;
CREATE POLICY "Admins can update user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260603002135_831aadd6-962a-4449-b1f0-4ab9d0755d00.sql
-- ----------------------------------------
-- Remover a política excessivamente permissiva
DROP POLICY IF EXISTS "Qualquer pessoa pode ler configurações" ON public.configuracoes_globais;

-- Criar política para leitura de configurações públicas (que não são códigos mestres)
DROP POLICY IF EXISTS "Configurações públicas são visíveis por todos" ON public.configuracoes_globais;
CREATE POLICY "Configurações públicas são visíveis por todos"
ON public.configuracoes_globais
FOR SELECT
USING (chave NOT IN ('master_code_lojista', 'master_code_afiliado'));

-- Criar política restrita para códigos mestres (apenas administradores)
DROP POLICY IF EXISTS "Códigos mestres são visíveis apenas por administradores" ON public.configuracoes_globais;
CREATE POLICY "Códigos mestres são visíveis apenas por administradores"
ON public.configuracoes_globais
FOR SELECT
USING (
  chave IN ('master_code_lojista', 'master_code_afiliado') 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- ----------------------------------------
-- 20260603002305_ed89abe6-8724-409d-a81c-3543820b82cb.sql
-- ----------------------------------------
-- 1. Remover a política antiga e criar uma com o nome correto da coluna
DROP POLICY IF EXISTS "Public can view active certificate content" ON public.qz_certificates;
DROP POLICY IF EXISTS "O público pode visualizar o conteúdo do certificado ativo" ON public.qz_certificates;

DROP POLICY IF EXISTS "Public can view active certificate metadata" ON public.qz_certificates;
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
DROP POLICY IF EXISTS "Admins can view all certificate data" ON public.qz_certificates;
CREATE POLICY "Admins can view all certificate data"
ON public.qz_certificates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------
-- 20260603002521_cf94c0af-38b4-46f3-a97c-bd5eec159793.sql
-- ----------------------------------------
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
DROP POLICY IF EXISTS "Users can upload own logos" ON storage.objects;
CREATE POLICY "Users can upload own logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own logos" ON storage.objects;
CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

DROP POLICY IF EXISTS "Users can delete own logos" ON storage.objects;
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
DROP POLICY IF EXISTS "Users can upload own banners" ON storage.objects;
CREATE POLICY "Users can upload own banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own banners" ON storage.objects;
CREATE POLICY "Users can update own banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'banners'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

DROP POLICY IF EXISTS "Users can delete own banners" ON storage.objects;
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
DROP POLICY IF EXISTS "Users can upload own product images" ON storage.objects;
CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- ----------------------------------------
-- 20260603002651_15a8477a-23b6-4d21-a3f3-144fa15b2840.sql
-- ----------------------------------------
-- Remover política insegura de UPDATE (era aplicada à role 'public', incluindo anônimos)
DROP POLICY IF EXISTS "Users can update their own client data" ON public.clientes;
DROP POLICY IF EXISTS "Qualquer pessoa pode atualizar os dados dos clientes" ON public.clientes;

-- Nova política: apenas lojistas donos da loja do cliente, ou admins, podem atualizar
DROP POLICY IF EXISTS "Lojistas can update their store clients" ON public.clientes;
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

-- ----------------------------------------
-- 20260605111705_c7c16785-c915-487b-abf8-0b2ea5dd605b.sql
-- ----------------------------------------
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.pdv_mesas(id);
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pdv_pedidos TO service_role;
GRANT ALL ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO anon;

-- ----------------------------------------
-- 20260605130257_a3c080bd-b2c6-40c1-be38-b6979efb7f5d.sql
-- ----------------------------------------
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='last_added_at') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN last_added_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='order_type') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN order_type TEXT DEFAULT 'local';
  END IF;
END $$;

-- ----------------------------------------
-- 20260605135737_83b4f709-556a-42be-be94-adea1872b111.sql
-- ----------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'local';
GRANT ALL ON public.pedidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT SELECT ON public.pedidos TO anon;

-- ----------------------------------------
-- 20260605155812_f9749ccd-66f3-45cc-a25e-1c75eb02032d.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260605185521_70c314b4-58ff-4750-ba18-6f9c8176c771.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Permitir leitura pública de usuários da loja para comanda" ON public.loja_usuarios;
CREATE POLICY "Permitir leitura pública de usuários da loja para comanda" ON public.loja_usuarios FOR SELECT USING (true);

-- ----------------------------------------
-- 20260605211025_a531aad4-9456-4d98-bab0-347f6c3c8dd5.sql
-- ----------------------------------------
-- Ajustar políticas para a tabela produtos
DROP POLICY IF EXISTS "Lojistas can insert their products" ON public.produtos;
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
DROP POLICY IF EXISTS "Users can insert addons for their own stores" ON public.loja_adicionais;
CREATE POLICY "Users can insert addons for their own stores" ON public.loja_adicionais 
FOR INSERT TO authenticated 
WITH CHECK (
  loja_id IN (
    SELECT id FROM public.lojas WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update addons from their own stores" ON public.loja_adicionais;
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
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.lojas WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------
-- 20260606145032_60ed6afe-53a3-45d7-9dc5-03db061b6a2f.sql
-- ----------------------------------------
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC;
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS promo_duracao_meses INTEGER DEFAULT 0;

ALTER TABLE public.loja_planos ADD COLUMN IF NOT EXISTS promo_pagamentos_feitos INTEGER DEFAULT 0;

-- ----------------------------------------
-- 20260606172259_36dc7d68-1529-4d2f-9b8e-8f849323c14b.sql
-- ----------------------------------------
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

-- ----------------------------------------
-- 20260607173905_95cc7900-971b-4478-b92d-604fefb944f9.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS integration_fee_rate NUMERIC DEFAULT 0;
COMMENT ON COLUMN public.lojas.integration_fee_rate IS 'Taxa de integração do Mercado Pago em porcentagem (ex: 1.5 para 1.5%)';

-- ----------------------------------------
-- 20260609133106_193bf18c-3151-4157-af79-f1771f9fabe4.sql
-- ----------------------------------------
ALTER TABLE public.pdv_pedidos ADD COLUMN IF NOT EXISTS garcom_nome TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_pedidos TO authenticated;
GRANT ALL ON public.pdv_pedidos TO service_role;

-- ----------------------------------------
-- 20260610025201_b48c6deb-62a3-4ee3-9f2b-c9f3cca6b3e3.sql
-- ----------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;

-- ----------------------------------------
-- 20260615194923_c57262ff-39d6-47bb-89b5-e7c1c30225e4.sql
-- ----------------------------------------
ALTER TABLE public.system_rating_settings ADD COLUMN IF NOT EXISTS event_image_url TEXT;

