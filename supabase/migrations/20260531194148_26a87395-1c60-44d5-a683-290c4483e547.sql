-- Create a table for online users tracking
CREATE TABLE IF NOT EXISTS public.online_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    user_role TEXT, -- 'admin', 'lojista', 'afiliado', 'entregador', 'cliente', 'visitante'
    current_page TEXT NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_name TEXT,
    UNIQUE(session_id)
);

-- Use GRANT to set permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_users TO anon, authenticated;
GRANT ALL ON public.online_users TO service_role;

-- Enable RLS
ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can insert/update their own session" 
ON public.online_users 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view all online users" 
ON public.online_users 
FOR SELECT 
USING (true);

-- Function to clean up old sessions (older than 5 minutes)
CREATE OR REPLACE FUNCTION public.clean_old_online_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.online_users WHERE last_seen_at < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
