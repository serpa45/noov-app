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
