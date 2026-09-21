
-- Add invite code column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS codigo_convite text UNIQUE DEFAULT substr(md5(random()::text), 1, 6);

-- Update existing rows that have null codigo_convite
UPDATE public.lojas SET codigo_convite = substr(md5(random()::text), 1, 6) WHERE codigo_convite IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE public.lojas ALTER COLUMN codigo_convite SET NOT NULL;

-- Create junction table
CREATE TABLE public.loja_entregadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  entregador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id, entregador_id)
);

ALTER TABLE public.loja_entregadores ENABLE ROW LEVEL SECURITY;

-- Entregadores can view their own links
CREATE POLICY "Entregadores can view their links"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (entregador_id = auth.uid());

-- Entregadores can insert (link themselves via code)
CREATE POLICY "Entregadores can insert their links"
  ON public.loja_entregadores FOR INSERT
  TO authenticated
  WITH CHECK (entregador_id = auth.uid());

-- Lojistas can view entregadores linked to their stores
CREATE POLICY "Lojistas can view their store entregadores"
  ON public.loja_entregadores FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Lojistas can remove entregadores from their stores
CREATE POLICY "Lojistas can delete their store entregadores"
  ON public.loja_entregadores FOR DELETE
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Allow authenticated users to read lojas by codigo_convite (for linking)
CREATE POLICY "Authenticated can view stores by code"
  ON public.lojas FOR SELECT
  TO authenticated
  USING (true);
