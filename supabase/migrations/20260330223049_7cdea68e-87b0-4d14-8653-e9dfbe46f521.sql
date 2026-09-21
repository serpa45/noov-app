DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lojas','entregas','configuracoes_globais','loja_planos','comissoes','planos','profiles','saques']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END$$;