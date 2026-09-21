-- Add column to track which year the birthday was last dismissed
ALTER TABLE public.clientes
ADD COLUMN aniversario_visto_ano INTEGER;

-- Comment for documentation
COMMENT ON COLUMN public.clientes.aniversario_visto_ano IS 'Ano em que o aniversariante foi marcado como visto pelo lojista';