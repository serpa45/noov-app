ALTER TABLE public.system_ratings ADD COLUMN loja_id UUID REFERENCES public.lojas(id);
ALTER TABLE public.system_rating_optouts ADD COLUMN loja_id UUID REFERENCES public.lojas(id);

-- Update grants to include the new column (though default often handles it)
GRANT ALL ON public.system_ratings TO authenticated, service_role;
GRANT ALL ON public.system_rating_optouts TO authenticated, service_role;