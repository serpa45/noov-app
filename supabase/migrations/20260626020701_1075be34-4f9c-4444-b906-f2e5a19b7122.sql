UPDATE public.planos
SET limites = limites || '{"pdv_balcao": true, "pdv_mesas": true}'::jsonb
WHERE (limites->>'pdv')::boolean = true;