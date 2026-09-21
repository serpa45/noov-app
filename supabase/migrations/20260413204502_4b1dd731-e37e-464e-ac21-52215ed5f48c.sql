ALTER TABLE public.clientes DROP CONSTRAINT clientes_telefone_key;
CREATE UNIQUE INDEX clientes_telefone_loja_unique ON public.clientes (telefone, loja_id);