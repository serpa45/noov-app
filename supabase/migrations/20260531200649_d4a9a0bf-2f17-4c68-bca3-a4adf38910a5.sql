CREATE OR REPLACE FUNCTION get_db_stats()
RETURNS TABLE (table_name text, row_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        relname::text as table_name, 
        n_live_tup::bigint as row_count 
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public';
END;
$$;

CREATE OR REPLACE FUNCTION get_column_stats()
RETURNS TABLE (table_name text, column_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.table_name::text, 
        count(column_name)::bigint as column_count 
    FROM information_schema.columns c
    WHERE table_schema = 'public' 
    GROUP BY c.table_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_db_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_db_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_column_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_column_stats() TO service_role;