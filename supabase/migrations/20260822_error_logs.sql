CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    url TEXT,
    message TEXT,
    stack TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT SELECT, INSERT ON public.error_logs TO anon;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert error logs" ON public.error_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow auth insert error logs" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all logs" ON public.error_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
