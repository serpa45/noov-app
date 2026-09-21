-- Remove a coluna qz_tray_ativo se ela existir
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas DROP COLUMN qz_tray_ativo;
  END IF;
END $$;