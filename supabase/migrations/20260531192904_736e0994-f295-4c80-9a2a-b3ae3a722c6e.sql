-- Add ticket_number column
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- Create sequence for ticket numbering
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq;

-- Function to assign ticket number
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := nextval('support_ticket_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to assign number on insert
DROP TRIGGER IF EXISTS tr_assign_ticket_number ON public.support_tickets;
CREATE TRIGGER tr_assign_ticket_number
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.assign_ticket_number();

-- Update existing tickets with sequential numbers if they don't have one
-- This orders them by creation date to maintain historical order
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.support_tickets WHERE ticket_number IS NULL ORDER BY created_at ASC LOOP
        UPDATE public.support_tickets SET ticket_number = nextval('support_ticket_number_seq') WHERE id = r.id;
    END LOOP;
END $$;
