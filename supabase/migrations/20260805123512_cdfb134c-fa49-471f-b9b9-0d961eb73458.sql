
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
