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
