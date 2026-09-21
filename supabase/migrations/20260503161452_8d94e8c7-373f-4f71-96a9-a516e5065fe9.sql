-- Adiciona coluna qz_tray_ativo se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lojas' AND column_name = 'qz_tray_ativo') THEN
    ALTER TABLE public.lojas ADD COLUMN qz_tray_ativo BOOLEAN DEFAULT TRUE;
  END IF;
END $$;