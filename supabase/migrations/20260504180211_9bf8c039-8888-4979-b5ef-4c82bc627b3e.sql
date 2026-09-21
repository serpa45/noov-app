ALTER TABLE public.lojas 
ADD COLUMN IF NOT EXISTS printer_steps JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lojas.printer_steps IS 'Armazena o passo a passo personalizado da instalação da impressora.';