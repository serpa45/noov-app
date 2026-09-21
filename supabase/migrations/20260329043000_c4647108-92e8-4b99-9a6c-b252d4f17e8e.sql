
-- Plans table for admin to manage
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  preco numeric NOT NULL DEFAULT 0,
  periodo text NOT NULL DEFAULT '/mês',
  descricao text,
  popular boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limites jsonb NOT NULL DEFAULT '{}'::jsonb,
  cta_texto text NOT NULL DEFAULT 'Assinar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Store subscription linking store to plan with locked price
CREATE TABLE public.loja_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id),
  preco_assinado numeric NOT NULL,
  features_assinado jsonb NOT NULL DEFAULT '[]'::jsonb,
  limites_assinado jsonb NOT NULL DEFAULT '{}'::jsonb,
  assinado_em timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loja_id)
);

-- RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_planos ENABLE ROW LEVEL SECURITY;

-- Plans: anyone can read active plans (landing page)
CREATE POLICY "Anyone can view active plans" ON public.planos FOR SELECT TO anon USING (ativo = true);
CREATE POLICY "Authenticated can view active plans" ON public.planos FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "Admins can manage plans" ON public.planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Loja planos: lojistas see their own, admins see all
CREATE POLICY "Lojistas can view their plan" ON public.loja_planos FOR SELECT TO authenticated USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all loja_planos" ON public.loja_planos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed default plans
INSERT INTO public.planos (nome, slug, preco, periodo, descricao, popular, ordem, features, limites, cta_texto) VALUES
('Start', 'start', 0, 'para sempre', 'Ideal para validar seu negócio e começar a vender', false, 1,
 '["Até 30 produtos", "Até 100 clientes", "Pedidos online", "Painel básico", "Branding NOOV", "Suporte por e-mail"]'::jsonb,
 '{"max_produtos": 30, "max_clientes": 100, "pdv": false, "entregas": false, "whatsapp": false, "cupons": false, "relatorios": false, "sem_branding": false, "multi_lojas": false, "api": false, "dominio": false}'::jsonb,
 'Começar Grátis'),
('Pro', 'pro', 97, '/mês', 'Para negócios em crescimento que querem escalar vendas', true, 2,
 '["Produtos ilimitados", "Clientes ilimitados", "PDV Balcão + Garçom", "Gestão de entregas", "Automação WhatsApp", "Cupons inteligentes", "Relatórios de lucro real", "Sem branding NOOV", "Suporte prioritário"]'::jsonb,
 '{"max_produtos": -1, "max_clientes": -1, "pdv": true, "entregas": true, "whatsapp": true, "cupons": true, "relatorios": true, "sem_branding": true, "multi_lojas": false, "api": false, "dominio": false}'::jsonb,
 'Assinar Pro'),
('Ultra', 'ultra', 197, '/mês', 'Tudo ilimitado para operação profissional de alto volume', false, 3,
 '["Tudo do Pro", "Multi-lojas", "API aberta", "Domínio personalizado", "Recompra automática", "Programa de fidelidade", "Relatórios de BI", "Gerente de conta dedicado"]'::jsonb,
 '{"max_produtos": -1, "max_clientes": -1, "pdv": true, "entregas": true, "whatsapp": true, "cupons": true, "relatorios": true, "sem_branding": true, "multi_lojas": true, "api": true, "dominio": true}'::jsonb,
 'Assinar Ultra');
