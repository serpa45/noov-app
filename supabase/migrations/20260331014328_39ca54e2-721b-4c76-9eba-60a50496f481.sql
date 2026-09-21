
-- Delete all non-admin users from auth.users (cascades to profiles, user_roles, etc.)
DELETE FROM auth.users
WHERE id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';

-- Clean up any orphaned data
DELETE FROM public.lojas WHERE user_id != 'a881b3f3-f5e1-4a30-9808-9e15b0129309';
DELETE FROM public.comissoes WHERE true;
DELETE FROM public.saques WHERE true;
DELETE FROM public.loja_planos WHERE true;
DELETE FROM public.loja_plano_historico WHERE true;
