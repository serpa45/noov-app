INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view banners" ON storage.objects FOR SELECT TO public USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners');
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can delete banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners');