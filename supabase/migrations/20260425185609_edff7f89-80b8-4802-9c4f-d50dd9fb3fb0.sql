-- Enable Realtime for the produtos table
ALTER TABLE public.produtos REPLICA IDENTITY FULL;

-- Check if the table is already in the publication to avoid error
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'produtos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
    END IF;
END $$;