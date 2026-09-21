-- Remover a política excessivamente permissiva
DROP POLICY IF EXISTS "Qualquer pessoa pode ler configurações" ON public.configuracoes_globais;

-- Criar política para leitura de configurações públicas (que não são códigos mestres)
CREATE POLICY "Configurações públicas são visíveis por todos"
ON public.configuracoes_globais
FOR SELECT
USING (chave NOT IN ('master_code_lojista', 'master_code_afiliado'));

-- Criar política restrita para códigos mestres (apenas administradores)
CREATE POLICY "Códigos mestres são visíveis apenas por administradores"
ON public.configuracoes_globais
FOR SELECT
USING (
  chave IN ('master_code_lojista', 'master_code_afiliado') 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);