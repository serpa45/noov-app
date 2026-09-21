-- Ensure entregador_pagamentos cascades
ALTER TABLE public.entregador_pagamentos 
DROP CONSTRAINT IF EXISTS entregador_pagamentos_lojista_id_fkey,
ADD CONSTRAINT entregador_pagamentos_lojista_id_fkey 
    FOREIGN KEY (lojista_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Ensure entregas cascades (lojista_id here is store_id)
ALTER TABLE public.entregas 
DROP CONSTRAINT IF EXISTS entregas_lojista_id_fkey,
ADD CONSTRAINT entregas_lojista_id_fkey 
    FOREIGN KEY (lojista_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Ensure pdv_pedidos cascades
ALTER TABLE public.pdv_pedidos
DROP CONSTRAINT IF EXISTS pdv_pedidos_loja_id_fkey,
ADD CONSTRAINT pdv_pedidos_loja_id_fkey
    FOREIGN KEY (loja_id) REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Create function to handle complete store deletion
CREATE OR REPLACE FUNCTION public.delete_loja_complete(p_loja_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Get the user_id
    SELECT user_id INTO v_user_id FROM public.lojas WHERE id = p_loja_id;
    
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 2. Delete data that might not be automatically cascaded
    
    -- Pedidos (uses lojista_id = user_id)
    DELETE FROM public.pedidos WHERE lojista_id = v_user_id;
    
    -- Entregas and Entregador Pagamentos should now cascade because we updated the constraints above
    -- but we'll leave them here as fallback if needed or just trust the cascade.

    -- 3. Delete the store itself (most other things cascade from here)
    DELETE FROM public.lojas WHERE id = p_loja_id;
    
    -- 4. Delete profile (associated with the lojista)
    DELETE FROM public.profiles WHERE user_id = v_user_id;

    -- 5. Delete roles
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_loja_complete(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_loja_complete(UUID) TO authenticated;
