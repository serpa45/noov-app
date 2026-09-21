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