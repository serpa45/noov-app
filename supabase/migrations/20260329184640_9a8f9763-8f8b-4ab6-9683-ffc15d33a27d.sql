
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome_completo text NOT NULL,
  whatsapp text,
  data_nascimento date,
  endereco_rua text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  endereco_cep text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clients" ON public.clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can select by phone" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update clients" ON public.clientes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can view clients" ON public.clientes FOR SELECT TO authenticated USING (true);
