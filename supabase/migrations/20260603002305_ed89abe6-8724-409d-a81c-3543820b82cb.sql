-- 1. Remover a política antiga e criar uma com o nome correto da coluna
DROP POLICY IF EXISTS "Public can view active certificate content" ON public.qz_certificates;
DROP POLICY IF EXISTS "O público pode visualizar o conteúdo do certificado ativo" ON public.qz_certificates;

CREATE POLICY "Public can view active certificate metadata"
ON public.qz_certificates
FOR SELECT
USING (is_active = true);

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.qz_certificates ENABLE ROW LEVEL SECURITY;

-- 3. Restringir o acesso à coluna private_key_content no nível do banco de dados (Column-level security)
-- Isso impede que o PostgREST retorne esta coluna para essas roles, mesmo que a política RLS permita a linha.
REVOKE SELECT (private_key_content) ON public.qz_certificates FROM anon, authenticated;

-- 4. Garantir que a service_role (usada por processos de servidor e admins no dashboard) continue com acesso
GRANT SELECT (private_key_content) ON public.qz_certificates TO service_role;

-- 5. Criar política específica para administradores verem todas as colunas se necessário via auth
-- Como revogamos o SELECT na coluna para 'authenticated', mesmo um admin logado não veria a coluna via API REST padrão 
-- a menos que use a service_role ou acessemos via RPC/Function.
-- No entanto, para políticas de linha:
CREATE POLICY "Admins can view all certificate data"
ON public.qz_certificates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
