
-- Clean all public tables
DELETE FROM public.saques;
DELETE FROM public.comissoes;
DELETE FROM public.entregas;
DELETE FROM public.loja_entregadores;
DELETE FROM public.pedidos;
DELETE FROM public.produtos;
DELETE FROM public.lojas;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- Create 3 affiliates
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'afiliado1@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Carlos Silva","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'afiliado2@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Maria Santos","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'afiliado3@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Pedro Oliveira","role":"afiliado"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create 10 lojistas
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('b2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'pizzaria@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"João Pizza","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'burger@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Ana Burger","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'acai@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Lucas Açaí","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'lanche@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Fernanda Lanche","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'sushi@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Roberto Sushi","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'churrasco@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Marcos Grill","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'padaria@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Clara Pão","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'pastel@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Diego Pastel","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'marmita@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Juliana Marmita","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), ''),
  ('b2000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'doces@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Patricia Doces","role":"lojista"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create 1 admin
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at, confirmation_token)
VALUES
  ('c3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'admin@teste.com', crypt('123456', gen_salt('bf')), now(), '{"full_name":"Admin NOOV","role":"admin"}'::jsonb, 'authenticated', 'authenticated', now(), now(), '');

-- Create identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT id, id, json_build_object('sub', id, 'email', email)::jsonb, 'email', id::text, now(), now(), now()
FROM auth.users;

-- Update admin profile with codigo_admin
UPDATE public.profiles SET codigo_admin = 'ADM-NOOV' WHERE user_id = 'c3000000-0000-0000-0000-000000000001';

-- Create stores linked to affiliates
-- Afiliado 1 (Carlos): 4 stores
-- Afiliado 2 (Maria): 3 stores  
-- Afiliado 3 (Pedro): 3 stores
INSERT INTO public.lojas (id, user_id, nome, slug, segmento, afiliado_id) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'Pizzaria Napoli', 'pizzaria-napoli', 'pizzaria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Burger King House', 'burger-king-house', 'hamburgueria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000003', 'Açaí Tropical', 'acai-tropical', 'acaiteria', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000004', 'Lanchonete Central', 'lanchonete-central', 'lanchonete', 'a1000000-0000-0000-0000-000000000001'),
  ('d4000000-0000-0000-0000-000000000005', 'b2000000-0000-0000-0000-000000000005', 'Sushi Master', 'sushi-master', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000006', 'b2000000-0000-0000-0000-000000000006', 'Churrascaria Grill', 'churrascaria-grill', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000007', 'b2000000-0000-0000-0000-000000000007', 'Padaria Doce Pão', 'padaria-doce-pao', 'lanchonete', 'a1000000-0000-0000-0000-000000000002'),
  ('d4000000-0000-0000-0000-000000000008', 'b2000000-0000-0000-0000-000000000008', 'Pastelaria do Diego', 'pastelaria-diego', 'lanchonete', 'a1000000-0000-0000-0000-000000000003'),
  ('d4000000-0000-0000-0000-000000000009', 'b2000000-0000-0000-0000-000000000009', 'Marmitas da Ju', 'marmitas-da-ju', 'lanchonete', 'a1000000-0000-0000-0000-000000000003'),
  ('d4000000-0000-0000-0000-000000000010', 'b2000000-0000-0000-0000-000000000010', 'Doces da Paty', 'doces-da-paty', 'lanchonete', 'a1000000-0000-0000-0000-000000000003');

-- Pedidos
INSERT INTO public.pedidos (lojista_id, items, total, status, tipo, created_at) VALUES
  ('b2000000-0000-0000-0000-000000000001', '[]', 89.90, 'entregue', 'delivery', now() - interval '2 days'),
  ('b2000000-0000-0000-0000-000000000001', '[]', 120.00, 'entregue', 'delivery', now() - interval '5 days'),
  ('b2000000-0000-0000-0000-000000000002', '[]', 65.50, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000003', '[]', 45.00, 'entregue', 'delivery', now() - interval '3 days'),
  ('b2000000-0000-0000-0000-000000000004', '[]', 32.00, 'entregue', 'delivery', now() - interval '4 days'),
  ('b2000000-0000-0000-0000-000000000005', '[]', 150.00, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000006', '[]', 200.00, 'entregue', 'delivery', now() - interval '2 days'),
  ('b2000000-0000-0000-0000-000000000007', '[]', 55.00, 'entregue', 'delivery', now() - interval '6 days'),
  ('b2000000-0000-0000-0000-000000000008', '[]', 78.00, 'entregue', 'delivery', now() - interval '3 days'),
  ('b2000000-0000-0000-0000-000000000009', '[]', 95.00, 'entregue', 'delivery', now() - interval '1 day'),
  ('b2000000-0000-0000-0000-000000000010', '[]', 42.00, 'entregue', 'delivery', now() - interval '5 days'),
  ('b2000000-0000-0000-0000-000000000001', '[]', 180.00, 'entregue', 'delivery', now()),
  ('b2000000-0000-0000-0000-000000000005', '[]', 110.00, 'entregue', 'delivery', now()),
  ('b2000000-0000-0000-0000-000000000008', '[]', 67.00, 'entregue', 'delivery', now());

-- Comissões
INSERT INTO public.comissoes (afiliado_id, loja_id, valor_pedido, percentual, valor_comissao, status) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 89.90, 10, 8.99, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 120.00, 10, 12.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000001', 180.00, 10, 18.00, 'pendente'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000002', 65.50, 10, 6.55, 'pago'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000003', 45.00, 10, 4.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000001', 'd4000000-0000-0000-0000-000000000004', 32.00, 10, 3.20, 'pendente'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000005', 150.00, 10, 15.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000005', 110.00, 10, 11.00, 'pendente'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000006', 200.00, 10, 20.00, 'pago'),
  ('a1000000-0000-0000-0000-000000000002', 'd4000000-0000-0000-0000-000000000007', 55.00, 10, 5.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000008', 78.00, 10, 7.80, 'pago'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000008', 67.00, 10, 6.70, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000009', 95.00, 10, 9.50, 'pendente'),
  ('a1000000-0000-0000-0000-000000000003', 'd4000000-0000-0000-0000-000000000010', 42.00, 10, 4.20, 'pago');
