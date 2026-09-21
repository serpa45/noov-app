
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
