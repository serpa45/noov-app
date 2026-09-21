-- Conceder permissões de uso no schema storage para roles do sistema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- Conceder permissões em tabelas específicas do storage
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Adicionar permissões de sequência se necessário
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;
