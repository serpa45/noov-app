-- Enable real-time for the online_users table
alter publication supabase_realtime add table public.online_users;

-- Ensure RLS allows the admin to delete entries if they want to clear the list
-- Assuming admin has permissions already, but just in case.
GRANT DELETE ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;
