
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS horario_funcionamento jsonb DEFAULT '{
    "segunda": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "terca": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "quarta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "quinta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "sexta": {"aberto": true, "inicio": "18:00", "fim": "23:00"},
    "sabado": {"aberto": true, "inicio": "17:00", "fim": "00:00"},
    "domingo": {"aberto": true, "inicio": "17:00", "fim": "22:00"}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS frete_tipo text DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS frete_valor_fixo numeric DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS frete_bairros jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tempo_entrega_min integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS tempo_entrega_max integer DEFAULT 40;
