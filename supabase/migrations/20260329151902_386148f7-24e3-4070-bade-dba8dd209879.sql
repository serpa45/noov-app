
ALTER TABLE public.produtos
ADD COLUMN tag_novo boolean NOT NULL DEFAULT false,
ADD COLUMN tag_sugestao boolean NOT NULL DEFAULT false,
ADD COLUMN tag_destaque boolean NOT NULL DEFAULT false,
ADD COLUMN preco_promocional numeric DEFAULT NULL,
ADD COLUMN promocao_validade date DEFAULT NULL;
