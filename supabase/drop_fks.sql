-- Dropar FKs temporariamente para permitir restore
ALTER TABLE public.lojas DROP CONSTRAINT IF EXISTS lojas_plano_id_exclusivo_fkey;
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_pdv_pedido_id_fkey;
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_category_flavor_id_fkey;
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_loja_id_fkey;
ALTER TABLE public.loja_planos DROP CONSTRAINT IF EXISTS loja_planos_loja_id_fkey;
ALTER TABLE public.loja_entregadores DROP CONSTRAINT IF EXISTS loja_entregadores_loja_id_fkey;
ALTER TABLE public.comissoes DROP CONSTRAINT IF EXISTS comissoes_loja_id_fkey;
ALTER TABLE public.entregas DROP CONSTRAINT IF EXISTS entregas_pedido_id_fkey;
SELECT 'FKs removidas com sucesso' as status;
