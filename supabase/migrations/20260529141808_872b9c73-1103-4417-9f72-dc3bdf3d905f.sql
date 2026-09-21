-- Revoke public execution for remaining SECURITY DEFINER functions to satisfy linter
REVOKE EXECUTE ON FUNCTION public.update_product_order_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_loja_adicionais_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_loja_complete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_rating_stats() FROM PUBLIC;

-- Re-grant execution to roles that actually need them
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_loja_adicionais_ownership() TO authenticated, service_role;
-- Trigger functions usually don't need explicit EXECUTE grants to specific roles as they run as the trigger owner, 
-- but revoking from PUBLIC is the primary security fix.
