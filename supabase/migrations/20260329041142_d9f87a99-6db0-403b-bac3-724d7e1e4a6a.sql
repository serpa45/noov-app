
-- Delete the broken admin user and recreate properly
-- First clean up dependent data
DELETE FROM public.user_roles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.identities WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.sessions WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.refresh_tokens WHERE user_id = 'c3000000-0000-0000-0000-000000000001'::text;
DELETE FROM auth.mfa_factors WHERE user_id = 'c3000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id = 'c3000000-0000-0000-0000-000000000001';
