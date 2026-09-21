GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens TO authenticated;
GRANT ALL ON public.admin_mensagens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_excluidas TO authenticated;
GRANT ALL ON public.admin_mensagens_excluidas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_mensagens_lidas TO authenticated;
GRANT ALL ON public.admin_mensagens_lidas TO service_role;