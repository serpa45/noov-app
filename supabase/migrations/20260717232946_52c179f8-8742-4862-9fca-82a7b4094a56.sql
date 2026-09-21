ALTER TABLE public.online_users REPLICA IDENTITY FULL;
ALTER TABLE public.access_logs REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='access_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs';
  END IF;
END $$;