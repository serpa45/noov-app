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