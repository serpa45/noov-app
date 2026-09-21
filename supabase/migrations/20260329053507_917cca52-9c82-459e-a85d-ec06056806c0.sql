
-- Allow admins to delete profiles
CREATE POLICY "Admins can delete any profile"
ON public.profiles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete any user_role"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete comissoes
CREATE POLICY "Admins can delete any commission"
ON public.comissoes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete saques
CREATE POLICY "Admins can delete any withdrawal"
ON public.saques FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
