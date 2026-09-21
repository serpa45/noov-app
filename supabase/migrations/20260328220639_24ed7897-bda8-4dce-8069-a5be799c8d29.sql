
-- Add 'entregador' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'entregador';

-- Allow users to insert their own role on signup
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
