-- Function to validate ownership of loja_adicionais
CREATE OR REPLACE FUNCTION public.check_loja_adicionais_ownership()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
    target_loja_id UUID;
BEGIN
    -- Determine which loja_id to check based on the operation
    IF (TG_OP = 'DELETE') THEN
        target_loja_id := OLD.loja_id;
    ELSE
        target_loja_id := NEW.loja_id;
    END IF;

    -- Get the owner of the store
    SELECT user_id INTO owner_id
    FROM public.lojas
    WHERE id = target_loja_id;

    -- Verify if the authenticated user is the owner
    -- Note: auth.uid() returns NULL for service_role/background tasks, 
    -- we might want to allow those or handle them specifically.
    -- If we want to be strict and ONLY allow the owner even in "RLS bypass" scenarios 
    -- where auth.uid() is set, this check holds.
    
    IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado: Você não é o proprietário desta loja.';
    END IF;

    -- For UPDATE, also ensure they don't try to change the loja_id to one they don't own
    IF (TG_OP = 'UPDATE' AND OLD.loja_id != NEW.loja_id) THEN
        SELECT user_id INTO owner_id
        FROM public.lojas
        WHERE id = NEW.loja_id;
        
        IF (auth.uid() IS NOT NULL AND (owner_id IS NULL OR owner_id != auth.uid())) THEN
            RAISE EXCEPTION 'Acesso negado: Não é possível mover adicionais para uma loja que você não possui.';
        END IF;
    END IF;

    RETURN IF (TG_OP = 'DELETE', OLD, NEW);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce ownership on DML operations
DROP TRIGGER IF EXISTS enforce_loja_adicionais_ownership ON public.loja_adicionais;
CREATE TRIGGER enforce_loja_adicionais_ownership
BEFORE INSERT OR UPDATE OR DELETE
ON public.loja_adicionais
FOR EACH ROW
EXECUTE FUNCTION public.check_loja_adicionais_ownership();
