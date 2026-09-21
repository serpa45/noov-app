
ALTER TABLE public.support_tickets ALTER COLUMN store_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'app';

GRANT INSERT ON public.support_tickets TO anon;

DROP POLICY IF EXISTS "Anon can create guest tickets" ON public.support_tickets;
CREATE POLICY "Anon can create guest tickets" ON public.support_tickets
  FOR INSERT TO anon
  WITH CHECK (store_id IS NULL AND guest_email IS NOT NULL AND length(guest_email) <= 255 AND length(coalesce(description,'')) <= 2000);
