
-- Add rating columns to pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS avaliacao integer,
  ADD COLUMN IF NOT EXISTS avaliacao_comentario text;

-- Allow anon users to update only the rating fields
CREATE POLICY "Anon can update order rating"
  ON public.pedidos
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
