-- Métricas reais do projeto Supabase para a tela admin.
-- Substitui créditos fictícios do Lovable Cloud.

CREATE OR REPLACE FUNCTION public.get_system_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth, pg_catalog
AS $$
DECLARE
  result jsonb;
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'database', jsonb_build_object(
      'size_bytes', pg_database_size(current_database()),
      'size_pretty', pg_size_pretty(pg_database_size(current_database())),
      'tables', (SELECT count(*)::int FROM pg_stat_user_tables WHERE schemaname = 'public'),
      'rows', (SELECT coalesce(sum(n_live_tup), 0)::bigint FROM pg_stat_user_tables WHERE schemaname = 'public'),
      'columns', (
        SELECT count(*)::bigint
        FROM information_schema.columns
        WHERE table_schema = 'public'
      ),
      'top_tables', coalesce((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
          SELECT
            relname::text AS name,
            n_live_tup::bigint AS rows,
            pg_total_relation_size(relid)::bigint AS size_bytes,
            pg_size_pretty(pg_total_relation_size(relid)) AS size_pretty
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(relid) DESC
          LIMIT 12
        ) t
      ), '[]'::jsonb)
    ),
    'storage', jsonb_build_object(
      'total_bytes', coalesce((
        SELECT sum(coalesce((o.metadata->>'size')::bigint, 0))
        FROM storage.objects o
      ), 0),
      'file_count', coalesce((SELECT count(*)::bigint FROM storage.objects), 0),
      'by_bucket', coalesce((
        SELECT jsonb_agg(row_to_json(b)::jsonb)
        FROM (
          SELECT
            o.bucket_id AS bucket,
            count(*)::bigint AS files,
            coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0)::bigint AS bytes
          FROM storage.objects o
          GROUP BY o.bucket_id
          ORDER BY 3 DESC
        ) b
      ), '[]'::jsonb),
      'by_loja', coalesce((
        SELECT jsonb_agg(row_to_json(l)::jsonb)
        FROM (
          SELECT
            lj.nome AS nome,
            lj.id::text AS loja_id,
            count(*)::bigint AS files,
            coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0)::bigint AS bytes
          FROM storage.objects o
          INNER JOIN public.lojas lj
            ON lj.id::text = split_part(o.name, '/', 1)
          WHERE position('/' IN o.name) > 0
          GROUP BY lj.id, lj.nome
          HAVING coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0) > 0
          ORDER BY 4 DESC
          LIMIT 40
        ) l
      ), '[]'::jsonb)
    ),
    'counts', jsonb_build_object(
      'auth_users', (SELECT count(*)::bigint FROM auth.users),
      'lojas', (SELECT count(*)::bigint FROM public.lojas),
      'lojas_ativas', (SELECT count(*)::bigint FROM public.lojas WHERE ativo IS TRUE),
      'produtos', (SELECT count(*)::bigint FROM public.produtos),
      'pedidos', (SELECT count(*)::bigint FROM public.pedidos),
      'pedidos_hoje', (
        SELECT count(*)::bigint FROM public.pedidos
        WHERE created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
      ),
      'clientes', (SELECT count(*)::bigint FROM public.profiles)
    ),
    'activity', coalesce((
      SELECT jsonb_agg(row_to_json(a)::jsonb)
      FROM (
        SELECT
          to_char(d.day, 'DD/MM') AS dia,
          d.day::date AS date,
          coalesce(p.qtd, 0)::int AS pedidos,
          coalesce(al.qtd, 0)::int AS acessos
        FROM generate_series(
          (current_date - 6),
          current_date,
          interval '1 day'
        ) AS d(day)
        LEFT JOIN (
          SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*)::int AS qtd
          FROM public.pedidos
          WHERE created_at >= (current_date - 6)
          GROUP BY 1
        ) p ON p.day = d.day::date
        LEFT JOIN (
          SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(DISTINCT session_id)::int AS qtd
          FROM public.access_logs
          WHERE created_at >= (current_date - 6)
          GROUP BY 1
        ) al ON al.day = d.day::date
        ORDER BY d.day
      ) a
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_usage() TO service_role;
