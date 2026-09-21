
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;

CREATE POLICY "Admin upload installers" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update installers" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete installers" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read installers" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'installers');
