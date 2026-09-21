-- Habilitar RLS na tabela de mensagens do Realtime
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se houver) para reescrever
DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Lojistas can subscribe to own store topics" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to any topic" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send to own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Lojistas can send to own store topics" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can send to any topic" ON realtime.messages;

-- ===================================================================
-- POLÍTICAS DE SELECT (inscrição / recebimento de mensagens)
-- ===================================================================

-- 1. Administradores podem se inscrever em qualquer tópico
CREATE POLICY "Admins can subscribe to any topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Usuários autenticados podem se inscrever em tópicos pessoais
--    Convenção: o tópico deve conter o user_id, ex: 'user:{uid}', 'pedidos:{uid}', 'profiles:{uid}'
CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'user:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'pedidos:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'profiles:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'comissoes:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'saques:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'entregas:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'admin_mensagens:' || auth.uid()::text || '%'
);

-- 3. Lojistas podem se inscrever em tópicos das suas lojas
--    Convenção: 'loja:{loja_id}', 'pdv_pedidos:{loja_id}', 'pedidos_loja:{loja_id}'
CREATE POLICY "Lojistas can subscribe to own store topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.user_id = auth.uid()
      AND (
        realtime.topic() = 'loja:' || l.id::text
        OR realtime.topic() = 'pdv_pedidos:' || l.id::text
        OR realtime.topic() = 'pedidos_loja:' || l.id::text
        OR realtime.topic() = 'entregas_loja:' || l.id::text
      )
  )
);

-- ===================================================================
-- POLÍTICAS DE INSERT (envio de mensagens broadcast/presence)
-- ===================================================================

-- 1. Administradores podem enviar para qualquer tópico
CREATE POLICY "Admins can send to any topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Usuários autenticados podem enviar para seus tópicos pessoais
CREATE POLICY "Authenticated users can send to own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'user:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'pedidos:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'profiles:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'comissoes:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'saques:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'entregas:' || auth.uid()::text || '%'
  OR realtime.topic() LIKE 'admin_mensagens:' || auth.uid()::text || '%'
);

-- 3. Lojistas podem enviar para tópicos das suas lojas
CREATE POLICY "Lojistas can send to own store topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lojas l
    WHERE l.user_id = auth.uid()
      AND (
        realtime.topic() = 'loja:' || l.id::text
        OR realtime.topic() = 'pdv_pedidos:' || l.id::text
        OR realtime.topic() = 'pedidos_loja:' || l.id::text
        OR realtime.topic() = 'entregas_loja:' || l.id::text
      )
  )
);
