
CREATE TABLE public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id uuid NULL,
  user_name text,
  user_role text,
  page text,
  path text,
  event_type text NOT NULL DEFAULT 'page',
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX idx_access_logs_session ON public.access_logs (session_id, created_at);

GRANT INSERT ON public.access_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert access logs"
  ON public.access_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view access logs"
  ON public.access_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access logs"
  ON public.access_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
