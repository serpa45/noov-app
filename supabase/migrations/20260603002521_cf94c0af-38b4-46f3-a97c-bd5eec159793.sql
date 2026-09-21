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
CREATE POLICY "Users can upload own logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

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
CREATE POLICY "Users can upload own banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own banners"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'banners'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

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
CREATE POLICY "Users can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR public.has_role(auth.uid(), 'admin'::public.app_role))
);
