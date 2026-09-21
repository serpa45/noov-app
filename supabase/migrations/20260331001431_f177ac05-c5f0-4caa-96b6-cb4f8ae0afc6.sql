
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 100, "max_armazenamento_mb": 512}'::jsonb WHERE slug = 'start';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": 1000, "max_armazenamento_mb": 2048}'::jsonb WHERE slug = 'pro';
UPDATE public.planos SET limites = limites || '{"max_pedidos_mes": -1, "max_armazenamento_mb": 10240}'::jsonb WHERE slug = 'ultra';
