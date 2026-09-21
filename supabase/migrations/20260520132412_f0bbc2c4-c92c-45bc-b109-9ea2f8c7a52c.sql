
-- Tabela de mensagens enviadas pelo admin
CREATE TABLE public.admin_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  banner_url text,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_mensagens_loja ON public.admin_mensagens(loja_id);
CREATE INDEX idx_admin_mensagens_created ON public.admin_mensagens(created_at DESC);

ALTER TABLE public.admin_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam mensagens"
ON public.admin_mensagens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Lojistas veem mensagens destinadas a eles"
ON public.admin_mensagens
FOR SELECT
TO authenticated
USING (
  loja_id IS NULL
  OR loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
);

-- Tabela: mensagens excluídas (apenas para a loja específica)
CREATE TABLE public.admin_mensagens_excluidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX idx_msg_excluidas_loja ON public.admin_mensagens_excluidas(loja_id);

ALTER TABLE public.admin_mensagens_excluidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam suas exclusoes"
ON public.admin_mensagens_excluidas
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

CREATE POLICY "Admins veem todas exclusoes"
ON public.admin_mensagens_excluidas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: mensagens lidas (para controle de notificação)
CREATE TABLE public.admin_mensagens_lidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.admin_mensagens(id) ON DELETE CASCADE,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, loja_id)
);

CREATE INDEX idx_msg_lidas_loja ON public.admin_mensagens_lidas(loja_id);

ALTER TABLE public.admin_mensagens_lidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojistas gerenciam suas leituras"
ON public.admin_mensagens_lidas
FOR ALL
TO authenticated
USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

-- Storage bucket para banners das mensagens (reuso banners)
-- Já existe bucket 'banners'

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens_excluidas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_mensagens_lidas;
