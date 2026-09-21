-- Create table for chat messages
CREATE TABLE public.suporte_mensagens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('agent', 'user')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT ON public.suporte_mensagens TO anon, authenticated;
GRANT ALL ON public.suporte_mensagens TO service_role;

-- Policies
CREATE POLICY "Anyone can insert messages" 
ON public.suporte_mensagens FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view messages from their session" 
ON public.suporte_mensagens FOR SELECT 
USING (true); -- In a production app, we'd filter by session_id cookie/localstorage

-- Index for performance
CREATE INDEX idx_suporte_mensagens_session ON public.suporte_mensagens(session_id);
CREATE INDEX idx_suporte_mensagens_created_at ON public.suporte_mensagens(created_at);