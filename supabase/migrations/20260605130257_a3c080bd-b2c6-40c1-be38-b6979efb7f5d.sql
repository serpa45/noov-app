DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='last_added_at') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN last_added_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pdv_pedidos' AND column_name='order_type') THEN
    ALTER TABLE public.pdv_pedidos ADD COLUMN order_type TEXT DEFAULT 'local';
  END IF;
END $$;