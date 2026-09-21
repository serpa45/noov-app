-- Clean up existing policies for the relevant buckets to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can upload client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can update client photos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
    DROP POLICY IF EXISTS "Public Access Banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
    
    -- Also drop common names that might exist from default setups
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
END $$;

-- 1. client-photos bucket (for customers)
CREATE POLICY "Public Access Client Photos" ON storage.objects FOR SELECT USING (bucket_id = 'client-photos');
CREATE POLICY "Anyone can upload client photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client-photos');
CREATE POLICY "Anyone can update client photos" ON storage.objects FOR UPDATE USING (bucket_id = 'client-photos');

-- 2. avatars bucket (for lojistas, delivery, affiliates)
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 3. logos bucket (for lojistas)
CREATE POLICY "Public Access Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Authenticated users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- 4. banners bucket (for lojistas)
CREATE POLICY "Public Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update banners" ON storage.objects FOR UPDATE USING (bucket_id = 'banners' AND auth.role() = 'authenticated');
