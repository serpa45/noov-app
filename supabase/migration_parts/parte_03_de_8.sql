-- ================================================================
-- PARTE 3 DE 8 | Migrações 61–90 de 219
-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam
-- ================================================================

-- ----------------------------------------
-- 20260331164259_ddaa7841-9f01-4060-b110-f0e4d897a4d5.sql
-- ----------------------------------------
-- Mesas do PDV
CREATE TABLE IF NOT EXISTS public.pdv_mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  lugares integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'livre',
  pedido_atual_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can manage their tables" ON public.pdv_mesas;
CREATE POLICY "Lojistas can manage their tables" ON public.pdv_mesas
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pedidos do PDV
CREATE TABLE IF NOT EXISTS public.pdv_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id uuid REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  pagamento_status text NOT NULL DEFAULT 'aberto',
  metodo_pagamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can manage their PDV orders" ON public.pdv_pedidos;
CREATE POLICY "Lojistas can manage their PDV orders" ON public.pdv_pedidos
  FOR ALL TO authenticated
  USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

-- Pagamentos parciais do PDV
CREATE TABLE IF NOT EXISTS public.pdv_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pdv_pedidos(id) ON DELETE CASCADE,
  valor numeric NOT NULL,
  metodo text NOT NULL DEFAULT 'dinheiro',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pdv_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can manage PDV payments" ON public.pdv_pagamentos;
CREATE POLICY "Lojistas can manage PDV payments" ON public.pdv_pagamentos
  FOR ALL TO authenticated
  USING (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (pedido_id IN (SELECT id FROM pdv_pedidos WHERE loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())) OR has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_pedidos;

-- Triggers for updated_at
CREATE TRIGGER update_pdv_mesas_updated_at BEFORE UPDATE ON public.pdv_mesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pdv_pedidos_updated_at BEFORE UPDATE ON public.pdv_pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------
-- 20260331235208_3425f278-95a2-4027-b879-24d8bf913fc7.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN impressao_automatica boolean NOT NULL DEFAULT false;

-- ----------------------------------------
-- 20260401043953_ccde708d-c7d3-490b-81a6-4698d0028d8e.sql
-- ----------------------------------------
-- Drop the overly permissive policy for authenticated users viewing stores
DROP POLICY IF EXISTS "Authenticated can view stores by code" ON public.lojas;

-- Recreate with more specific conditions: user owns the store, is admin, or is the affiliate
DROP POLICY IF EXISTS "Authenticated can view relevant stores" ON public.lojas;
CREATE POLICY "Authenticated can view relevant stores"
ON public.lojas
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR afiliado_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'entregador'::app_role)
);

-- ----------------------------------------
-- 20260401050026_68fc35da-eb31-494a-a8b8-9f467f9b9868.sql
-- ----------------------------------------
ALTER TABLE public.saques ADD COLUMN motivo_rejeicao text;

-- ----------------------------------------
-- 20260401054541_2b15cdd2-1120-4002-a0c1-4531362422c0.sql
-- ----------------------------------------
-- Create a table to track individual payments
CREATE TABLE IF NOT EXISTS public.pagamentos_loja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES public.planos(id),
  plano_nome TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  metodo TEXT NOT NULL DEFAULT 'mercadopago',
  status TEXT NOT NULL DEFAULT 'aprovado',
  payment_external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_loja ENABLE ROW LEVEL SECURITY;

-- Lojistas can view their own payments
DROP POLICY IF EXISTS "Lojistas can view their payments" ON public.pagamentos_loja;
CREATE POLICY "Lojistas can view their payments"
  ON public.pagamentos_loja
  FOR SELECT
  TO authenticated
  USING (
    loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  );

-- Admins can manage all payments
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.pagamentos_loja;
CREATE POLICY "Admins can manage all payments"
  ON public.pagamentos_loja
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert the first payment for each store that has an active plan (these are realized payments)
INSERT INTO public.pagamentos_loja (loja_id, plano_id, plano_nome, valor, metodo, status, created_at)
SELECT 
  lp.loja_id, 
  lp.plano_id, 
  p.nome, 
  lp.preco_assinado, 
  'mercadopago', 
  'aprovado', 
  lp.assinado_em
FROM loja_planos lp
LEFT JOIN planos p ON p.id = lp.plano_id
WHERE lp.ativo = true;

-- ----------------------------------------
-- 20260401055754_d985f556-6524-479f-bcfd-5c066099fb99.sql
-- ----------------------------------------
-- Tabela de despesas dos lojistas
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_despesas_loja_id ON public.despesas(loja_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON public.despesas(data);

-- RLS
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can view their expenses" ON public.despesas;
CREATE POLICY "Lojistas can view their expenses"
ON public.despesas FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Lojistas can insert their expenses" ON public.despesas;
CREATE POLICY "Lojistas can insert their expenses"
ON public.despesas FOR INSERT TO authenticated
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Lojistas can update their expenses" ON public.despesas;
CREATE POLICY "Lojistas can update their expenses"
ON public.despesas FOR UPDATE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Lojistas can delete their expenses" ON public.despesas;
CREATE POLICY "Lojistas can delete their expenses"
ON public.despesas FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all expenses" ON public.despesas;
CREATE POLICY "Admins can manage all expenses"
ON public.despesas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER update_despesas_updated_at
BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 20260401064837_240b3269-04cc-4cbc-a2c1-c14f522374dd.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.pix_split_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pdv_pedidos(id) ON DELETE SET NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  comissao_percentual NUMERIC NOT NULL DEFAULT 0,
  valor_plataforma NUMERIC NOT NULL DEFAULT 0,
  valor_lojista NUMERIC NOT NULL DEFAULT 0,
  payment_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  metodo TEXT NOT NULL DEFAULT 'pix',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_split_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all pix split payments" ON public.pix_split_pagamentos;
CREATE POLICY "Admins can manage all pix split payments"
  ON public.pix_split_pagamentos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Lojistas can view their pix split payments" ON public.pix_split_pagamentos;
CREATE POLICY "Lojistas can view their pix split payments"
  ON public.pix_split_pagamentos FOR SELECT
  TO authenticated
  USING (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert pix split payments" ON public.pix_split_pagamentos;
CREATE POLICY "System can insert pix split payments"
  ON public.pix_split_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pix_split_pagamentos_updated_at
  BEFORE UPDATE ON public.pix_split_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 20260401134145_5404afb0-4086-4f40-8006-8ff0f91455fc.sql
-- ----------------------------------------
-- Add pizza-specific fields to produtos table
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tamanhos jsonb DEFAULT NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS max_sabores integer DEFAULT NULL;

-- tamanhos example: [{"nome": "Média (6 fatias)", "preco": 38}, {"nome": "Grande (8 fatias)", "preco": 48}]
-- max_sabores: maximum number of flavors allowed (e.g. 2 for Grande, 1 for Broto)

-- ----------------------------------------
-- 20260402183551_66d222c3-fb5e-4e70-94d1-2fc69e1e8b5d.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Authenticated can insert orders from public menu" ON public.pedidos;
CREATE POLICY "Authenticated can insert orders from public menu"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ----------------------------------------
-- 20260402184413_1d76c0fa-c5bd-4ef0-a3e4-d57bfa4fe908.sql
-- ----------------------------------------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS status_historico jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------
-- 20260403192223_06979091-9b38-4864-83dc-78194a18b168.sql
-- ----------------------------------------
-- Add daily order number column
ALTER TABLE public.pedidos ADD COLUMN numero_diario integer;

-- CREATE OR REPLACE FUNCTION to auto-assign daily sequential number per lojista
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(numero_diario), 0) + 1
  INTO next_num
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_set_numero_diario
BEFORE INSERT ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario();

-- ----------------------------------------
-- 20260403195802_bee2e786-205c-42c9-a386-0307471c763e.sql
-- ----------------------------------------
-- Add rating columns to pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS avaliacao integer,
  ADD COLUMN IF NOT EXISTS avaliacao_comentario text;

-- Allow anon users to update only the rating fields
DROP POLICY IF EXISTS "Anon can update order rating" ON public.pedidos;
CREATE POLICY "Anon can update order rating"
  ON public.pedidos
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------
-- 20260405004755_3f3c6a17-7935-4e49-945c-362aa3e286b8.sql
-- ----------------------------------------
-- Add location to deliveries
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS latitude_atual NUMERIC;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS longitude_atual NUMERIC;

-- Add location to orders for the delivery target
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS latitude_entrega NUMERIC;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS longitude_entrega NUMERIC;

-- Enable RLS for entregas
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to be safe)
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;

-- Policies for 'entregas'
-- Lojistas can see and create deliveries for their store
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- Entregadores can see available deliveries or deliveries assigned to them
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)
);

-- Entregadores can update their own deliveries
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
USING (entregador_id = auth.uid() OR (entregador_id IS NULL AND auth.uid() IN (SELECT entregador_id FROM public.loja_entregadores WHERE loja_id = public.entregas.lojista_id)));

-- ----------------------------------------
-- 20260405012807_5bed6105-887f-4c60-b727-7a541c8003e7.sql
-- ----------------------------------------
-- Make entregador_id nullable in entregas table
ALTER TABLE public.entregas ALTER COLUMN entregador_id DROP NOT NULL;

-- Create policy for admins to manage all deliveries
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.entregas;
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update lojista insert policy to be more robust (it might already exist but let's make sure it's correct)
-- DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
-- CREATE POLICY "Lojistas can insert deliveries"
-- ON public.entregas FOR INSERT TO authenticated
-- WITH CHECK (lojista_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- 20260405021506_6145cab8-1850-4e40-a3c8-2f738a54875b.sql
-- ----------------------------------------
-- Allow public access to view orders by ID
DROP POLICY IF EXISTS "Anyone can view a specific order by ID" ON public.pedidos;
CREATE POLICY "Anyone can view a specific order by ID"
ON public.pedidos
FOR SELECT
USING (true);

-- Allow public access to view deliveries by pedido_id
DROP POLICY IF EXISTS "Anyone can view a delivery by pedido_id" ON public.entregas;
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);

-- ----------------------------------------
-- 20260405022450_7b31879e-2e08-4959-9c29-f4be21a0a3db.sql
-- ----------------------------------------
-- Cleanup and standardize entregas policies
DROP POLICY IF EXISTS "Lojistas can view their store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can insert deliveries to linked entregadores" ON public.entregas;
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update linked store deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can view their own deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Entregadores can update their own deliveries" ON public.entregas;

-- 1. Lojistas can see and create deliveries for their store
DROP POLICY IF EXISTS "Lojistas can manage deliveries for their orders" ON public.entregas;
CREATE POLICY "Lojistas can manage deliveries for their orders" 
ON public.entregas
FOR ALL 
TO authenticated
USING (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id))
WITH CHECK (auth.uid() IN (SELECT user_id FROM public.lojas WHERE id = lojista_id));

-- 2. Entregadores can see available deliveries or deliveries assigned to them or from their linked stores
DROP POLICY IF EXISTS "Entregadores can view available and assigned deliveries" ON public.entregas;
CREATE POLICY "Entregadores can view available and assigned deliveries" 
ON public.entregas
FOR SELECT 
TO authenticated
USING (
  entregador_id IS NULL OR 
  entregador_id = auth.uid() OR
  lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid())
);

-- 3. Entregadores can update their own deliveries or accept available ones from linked stores
DROP POLICY IF EXISTS "Entregadores can update their deliveries" ON public.entregas;
CREATE POLICY "Entregadores can update their deliveries" 
ON public.entregas
FOR UPDATE 
TO authenticated
USING (
  entregador_id = auth.uid() OR 
  (entregador_id IS NULL AND lojista_id IN (SELECT loja_id FROM public.loja_entregadores WHERE entregador_id = auth.uid()))
);

-- 4. Admins can manage all
-- (Already exists in some migrations, but let's ensure it's there and correct)
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.entregas;
DROP POLICY IF EXISTS "Admins can manage all deliveries" ON public.entregas;
CREATE POLICY "Admins can manage all deliveries"
ON public.entregas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Public access for tracking (already exists, but ensuring)
DROP POLICY IF EXISTS "Anyone can view a delivery by pedido_id" ON public.entregas;
DROP POLICY IF EXISTS "Anyone can view a delivery by pedido_id" ON public.entregas;
CREATE POLICY "Anyone can view a delivery by pedido_id"
ON public.entregas
FOR SELECT
USING (true);

-- ----------------------------------------
-- 20260405024418_17e56476-af8f-405a-8970-08288ef01549.sql
-- ----------------------------------------
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS valor_total NUMERIC DEFAULT 0;

-- ----------------------------------------
-- 20260405211659_201cd3c2-a859-4a2d-9237-f907119550b6.sql
-- ----------------------------------------
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS status_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------
-- 20260406161014_fcf15d6b-53a9-4d87-9cfc-0d11665681dc.sql
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.materiais_afiliado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  texto_whatsapp TEXT,
  imagem_url TEXT,
  disponivel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.materiais_afiliado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all materials" ON public.materiais_afiliado;
CREATE POLICY "Admins can manage all materials"
ON public.materiais_afiliado
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Affiliates can view available materials" ON public.materiais_afiliado;
CREATE POLICY "Affiliates can view available materials"
ON public.materiais_afiliado
FOR SELECT
TO authenticated
USING (disponivel = true);

CREATE TRIGGER update_materiais_afiliado_updated_at
BEFORE UPDATE ON public.materiais_afiliado
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- 20260406225005_8b65f079-0c5a-4625-b619-446f80e87324.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN mapa_entrega_ativo boolean NOT NULL DEFAULT true;

-- ----------------------------------------
-- 20260406225451_3b8f9d00-d7fa-4bf4-85de-8bb858f8e0c2.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Entregadores can update orders linked to their deliveries" ON public.pedidos;
CREATE POLICY "Entregadores can update orders linked to their deliveries"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
)
WITH CHECK (
  id IN (
    SELECT pedido_id FROM public.entregas
    WHERE entregador_id = auth.uid()
    AND pedido_id IS NOT NULL
  )
);

-- ----------------------------------------
-- 20260406232236_9351619d-3746-403f-bd47-dac641cd086b.sql
-- ----------------------------------------
-- Add taxa_entrega column to store the exact delivery fee at order creation
ALTER TABLE public.pedidos ADD COLUMN taxa_entrega numeric DEFAULT 0;

-- ----------------------------------------
-- 20260406235556_3d97bd85-cf47-40b6-9d32-c704ef664383.sql
-- ----------------------------------------
-- Create pdv_comandas table
CREATE TABLE IF NOT EXISTS public.pdv_comandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES public.pdv_mesas(id) ON DELETE SET NULL,
  garcom_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  total NUMERIC NOT NULL DEFAULT 0,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pdv_comandas ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Lojistas and garcons can manage comandas" ON public.pdv_comandas;
CREATE POLICY "Lojistas and garcons can manage comandas"
ON public.pdv_comandas
FOR ALL
USING (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid())
  OR garcom_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Add comanda_id and status_cozinha to pdv_pedidos
ALTER TABLE public.pdv_pedidos
ADD COLUMN comanda_id UUID REFERENCES public.pdv_comandas(id) ON DELETE SET NULL,
ADD COLUMN status_cozinha TEXT NOT NULL DEFAULT 'pendente';

-- Updated_at trigger for comandas
CREATE TRIGGER update_pdv_comandas_updated_at
BEFORE UPDATE ON public.pdv_comandas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.pdv_comandas;

-- ----------------------------------------
-- 20260407001533_3186e0e5-8dd1-4020-b1d3-d8de4f0a851c.sql
-- ----------------------------------------
-- Table to link garcons to stores (similar to loja_entregadores)
CREATE TABLE IF NOT EXISTS public.loja_garcons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  garcom_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(loja_id, garcom_id)
);

ALTER TABLE public.loja_garcons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lojistas can view their store garcons" ON public.loja_garcons;
CREATE POLICY "Lojistas can view their store garcons"
ON public.loja_garcons FOR SELECT TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Lojistas can delete their store garcons" ON public.loja_garcons;
CREATE POLICY "Lojistas can delete their store garcons"
ON public.loja_garcons FOR DELETE TO authenticated
USING (loja_id IN (SELECT id FROM lojas WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Garcons can insert their links" ON public.loja_garcons;
CREATE POLICY "Garcons can insert their links"
ON public.loja_garcons FOR INSERT TO authenticated
WITH CHECK (garcom_id = auth.uid());

DROP POLICY IF EXISTS "Garcons can view their links" ON public.loja_garcons;
CREATE POLICY "Garcons can view their links"
ON public.loja_garcons FOR SELECT TO authenticated
USING (garcom_id = auth.uid());

-- Update pdv_pedidos RLS to allow garcons linked via loja_garcons
DROP POLICY IF EXISTS "Garcons can manage PDV orders for their stores" ON public.pdv_pedidos;
CREATE POLICY "Garcons can manage PDV orders for their stores"
ON public.pdv_pedidos FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view mesas of their stores
DROP POLICY IF EXISTS "Garcons can view their store mesas" ON public.pdv_mesas;
CREATE POLICY "Garcons can view their store mesas"
ON public.pdv_mesas FOR ALL TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()))
WITH CHECK (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- Allow garcons to view products of their stores
DROP POLICY IF EXISTS "Garcons can view their store products" ON public.produtos;
CREATE POLICY "Garcons can view their store products"
ON public.produtos FOR SELECT TO authenticated
USING (loja_id IN (SELECT loja_id FROM loja_garcons WHERE garcom_id = auth.uid()));

-- ----------------------------------------
-- 20260413001028_eefaed8d-0872-4611-b0cf-43dbca29a2df.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.loja_planos;
CREATE POLICY "Anyone can view active plans" ON public.loja_planos FOR SELECT USING (ativo = true);

-- ----------------------------------------
-- 20260413025616_73a6364f-ebda-402c-bd25-bbf26877a7dc.sql
-- ----------------------------------------
-- Add numero_diario column to pdv_pedidos
ALTER TABLE public.pdv_pedidos ADD COLUMN numero_diario integer;

-- CREATE OR REPLACE FUNCTION to set numero_diario for PDV orders, shared sequence with pedidos
CREATE OR REPLACE FUNCTION public.set_numero_diario_pdv()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_user_id uuid;
BEGIN
  -- Get the store owner's user_id from loja_id
  SELECT user_id INTO store_user_id FROM public.lojas WHERE id = NEW.loja_id;

  -- Get max numero_diario from pedidos for this store owner today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = store_user_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get max numero_diario from pdv_pedidos for this store today
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = NEW.loja_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_pdv_numero_diario
BEFORE INSERT ON public.pdv_pedidos
FOR EACH ROW
EXECUTE FUNCTION public.set_numero_diario_pdv();

-- Also update the original pedidos trigger to consider PDV orders
CREATE OR REPLACE FUNCTION public.set_numero_diario()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  max_pedidos integer;
  max_pdv integer;
  store_id uuid;
BEGIN
  -- Get max from pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pedidos
  FROM public.pedidos
  WHERE lojista_id = NEW.lojista_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  -- Get the store id for this owner
  SELECT id INTO store_id FROM public.lojas WHERE user_id = NEW.lojista_id LIMIT 1;

  -- Get max from pdv_pedidos
  SELECT COALESCE(MAX(numero_diario), 0)
  INTO max_pdv
  FROM public.pdv_pedidos
  WHERE loja_id = store_id
    AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

  next_num := GREATEST(max_pedidos, max_pdv) + 1;
  NEW.numero_diario := next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ----------------------------------------
-- 20260413195711_185c9fc1-b621-40bd-974b-d9d86df3b35b.sql
-- ----------------------------------------
ALTER TABLE public.lojas ADD COLUMN lembrete_aniversario boolean NOT NULL DEFAULT true;

-- ----------------------------------------
-- 20260413202821_81f55426-23be-4717-a4ca-8c88a6f0fa3b.sql
-- ----------------------------------------
-- Add loja_id column to clientes
ALTER TABLE public.clientes ADD COLUMN loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can select by phone" ON public.clientes;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clientes;

-- Anon can insert clients (from public menu)
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clientes;
CREATE POLICY "Anyone can insert clients"
ON public.clientes FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon can select clients by phone (for login flow on public menu)
DROP POLICY IF EXISTS "Anon can select clients" ON public.clientes;
CREATE POLICY "Anon can select clients"
ON public.clientes FOR SELECT
TO anon
USING (true);

-- Lojistas can only view clients linked to their store
DROP POLICY IF EXISTS "Lojistas can view their store clients" ON public.clientes;
CREATE POLICY "Lojistas can view their store clients"
ON public.clientes FOR SELECT
TO authenticated
USING (
  loja_id IN (SELECT id FROM public.lojas WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Anyone can update clients
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clientes;
CREATE POLICY "Anyone can update clients"
ON public.clientes FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ----------------------------------------
-- 20260413204153_5d5cb4fd-78fe-4760-8445-da57cc3f1ada.sql
-- ----------------------------------------
DROP POLICY IF EXISTS "Lojistas can delete their store clients" ON public.clientes;
CREATE POLICY "Lojistas can delete their store clients"
ON public.clientes
FOR DELETE
TO authenticated
USING (
  (loja_id IN (SELECT lojas.id FROM lojas WHERE lojas.user_id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ----------------------------------------
-- 20260413204502_4b1dd731-e37e-464e-ac21-52215ed5f48c.sql
-- ----------------------------------------
ALTER TABLE public.clientes DROP CONSTRAINT clientes_telefone_key;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_telefone_loja_unique ON public.clientes (telefone, loja_id);

