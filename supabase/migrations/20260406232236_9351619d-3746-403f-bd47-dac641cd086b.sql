-- Add taxa_entrega column to store the exact delivery fee at order creation
ALTER TABLE public.pedidos ADD COLUMN taxa_entrega numeric DEFAULT 0;