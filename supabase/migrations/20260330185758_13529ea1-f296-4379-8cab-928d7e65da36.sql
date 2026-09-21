
-- Add extra trial days column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS dias_teste_extra integer NOT NULL DEFAULT 0;

-- Create plan change history table
CREATE TABLE public.loja_plano_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  acao text NOT NULL, -- 'plano_atribuido', 'plano_removido', 'teste_estendido'
  plano_id uuid REFERENCES public.planos(id),
  plano_nome text,
  dias_extras integer,
  observacao text,
  admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loja_plano_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage plan history"
  ON public.loja_plano_historico FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
