-- Add contact info to lojas table
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS instagram TEXT;

-- Add instagram to clientes table
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS instagram TEXT;