-- ================================================================
-- PARTE 8 DE 8 | Migrações 211–219 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260719150046_43ea4a78-80fb-49cb-ba77-fb63bcfecbf3.sql
-- ----------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS security_answer TEXT;

-- ----------------------------------------
-- 20260804225408_ef8c9286-1ce3-4e6d-8c8a-1579c3ee171b.sql
-- ----------------------------------------
UPDATE public.comissoes
SET valor_comissao = 26.22
WHERE id = '72b9bed3-2b2a-4765-9389-e360947107a2';

-- ----------------------------------------
-- 20260805123512_cdfb134c-fa49-471f-b9b9-0d961eb73458.sql
-- ----------------------------------------
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
        DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners_produtos');
    END IF;

    -- Permitir upload para autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Upload Banners'
    ) THEN
        DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
CREATE POLICY "Authenticated Upload Banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners_produtos');
    END IF;

    -- Permitir exclusão para autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Delete Banners'
    ) THEN
        DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
CREATE POLICY "Authenticated Delete Banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners_produtos');
    END IF;
END $$;

-- ----------------------------------------
-- 20260805123740_f8afa850-4a3e-4102-bbcc-623037961bc6.sql
-- ----------------------------------------
-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Public Read Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Banners" ON storage.objects;

-- 1. Permitir leitura pública de arquivos
DROP POLICY IF EXISTS "Public Read Banners" ON storage.objects;
CREATE POLICY "Public Read Banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners_produtos');

-- 2. Permitir que usuários autenticados enviem arquivos
DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
CREATE POLICY "Authenticated Upload Banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners_produtos');

-- 3. Permitir que usuários autenticados excluam arquivos
DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
CREATE POLICY "Authenticated Delete Banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners_produtos');

-- 4. Permitir que usuários autenticados atualizem arquivos
DROP POLICY IF EXISTS "Authenticated Update Banners" ON storage.objects;
CREATE POLICY "Authenticated Update Banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners_produtos');

-- ----------------------------------------
-- 20260805124143_6d48f2a0-6a73-4c1a-b37c-a55293f5d444.sql
-- ----------------------------------------
-- Conceder permissões de uso no schema storage para roles do sistema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- Conceder permissões em tabelas específicas do storage
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Adicionar permissões de sequência se necessário
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;

-- ----------------------------------------
-- 20260805124345_7020abe0-f204-493a-a8f2-a13933b1e47e.sql
-- ----------------------------------------
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
        DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
    END IF;

    -- Política de Upload para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        DROP POLICY IF EXISTS "Authenticated Upload Banners" ON storage.objects;
CREATE POLICY "Authenticated Upload Banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');
    END IF;

    -- Política de Update para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Update Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        DROP POLICY IF EXISTS "Authenticated Update Banners" ON storage.objects;
CREATE POLICY "Authenticated Update Banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');
    END IF;

    -- Política de Delete para Autenticados
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Delete Banners' AND tablename = 'objects' AND schemaname = 'storage') THEN
        DROP POLICY IF EXISTS "Authenticated Delete Banners" ON storage.objects;
CREATE POLICY "Authenticated Delete Banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');
    END IF;
END $$;

-- ----------------------------------------
-- 20260807195303_9f2cc430-e876-431a-ac90-f77d04727e65.sql
-- ----------------------------------------
ALTER TABLE public.lojas ALTER COLUMN margem_esquerda SET DEFAULT 3.0;
ALTER TABLE public.lojas ALTER COLUMN margem_direita SET DEFAULT 3.0;

UPDATE public.lojas 
SET margem_esquerda = 3.0, 
    margem_direita = 3.0
WHERE (margem_esquerda IN (0, 0.5) OR margem_esquerda IS NULL)
  OR (margem_direita IN (0, 0.5) OR margem_direita IS NULL);

-- ----------------------------------------
-- 20260813232019_096c1313-97c7-4663-bb32-a512acfdd7ef.sql
-- ----------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_tipo TEXT;

-- ----------------------------------------
-- 20260822_error_logs.sql
-- ----------------------------------------
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

DROP POLICY IF EXISTS "Allow anon insert error logs" ON public.error_logs;
CREATE POLICY "Allow anon insert error logs" ON public.error_logs FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Allow auth insert error logs" ON public.error_logs;
CREATE POLICY "Allow auth insert error logs" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view all logs" ON public.error_logs;
CREATE POLICY "Admins can view all logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

