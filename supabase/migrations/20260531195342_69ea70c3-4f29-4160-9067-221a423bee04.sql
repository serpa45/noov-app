ALTER TABLE public.online_users 
ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS navigation_history JSONB DEFAULT '[]'::jsonb;

-- Grant permissions (if not already granted)
GRANT ALL ON public.online_users TO authenticated;
GRANT ALL ON public.online_users TO service_role;
GRANT ALL ON public.online_users TO anon;
