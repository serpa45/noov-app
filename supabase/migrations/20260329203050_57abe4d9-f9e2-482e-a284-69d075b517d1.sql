-- Vincular frete por bairro por loja (lojista)
CREATE TABLE IF NOT EXISTS public.loja_frete_bairros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  bairro TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loja_frete_bairros_loja_bairro_key UNIQUE (loja_id, bairro)
);

CREATE INDEX IF NOT EXISTS idx_loja_frete_bairros_loja_id ON public.loja_frete_bairros(loja_id);
CREATE INDEX IF NOT EXISTS idx_loja_frete_bairros_loja_bairro ON public.loja_frete_bairros(loja_id, bairro);

ALTER TABLE public.loja_frete_bairros ENABLE ROW LEVEL SECURITY;

-- SELECT público (cardápio público precisa exibir taxa por bairro)
DROP POLICY IF EXISTS "Anyone can view loja_frete_bairros" ON public.loja_frete_bairros;
CREATE POLICY "Anyone can view loja_frete_bairros"
ON public.loja_frete_bairros
FOR SELECT
USING (true);

-- Lojista gerencia apenas os bairros da própria loja
DROP POLICY IF EXISTS "Lojistas can insert their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can insert their store bairros"
ON public.loja_frete_bairros
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lojistas can update their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can update their store bairros"
ON public.loja_frete_bairros
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Lojistas can delete their store bairros" ON public.loja_frete_bairros;
CREATE POLICY "Lojistas can delete their store bairros"
ON public.loja_frete_bairros
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR loja_id IN (
    SELECT l.id
    FROM public.lojas l
    WHERE l.user_id = auth.uid()
  )
);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_loja_frete_bairros_updated_at ON public.loja_frete_bairros;
CREATE TRIGGER trg_loja_frete_bairros_updated_at
BEFORE UPDATE ON public.loja_frete_bairros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill dos dados já existentes em lojas.frete_bairros
INSERT INTO public.loja_frete_bairros (loja_id, bairro, valor)
SELECT
  l.id AS loja_id,
  trim(elem->>'bairro') AS bairro,
  COALESCE(NULLIF(elem->>'valor', '')::NUMERIC, 0) AS valor
FROM public.lojas l
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.frete_bairros, '[]'::jsonb)) AS elem
WHERE trim(COALESCE(elem->>'bairro', '')) <> ''
ON CONFLICT (loja_id, bairro)
DO UPDATE SET
  valor = EXCLUDED.valor,
  updated_at = now();