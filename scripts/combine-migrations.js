import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const outputFile = path.join(process.cwd(), 'supabase', 'combined_migration.sql');

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Encontrados ${files.length} arquivos de migração SQL.`);

// Arquivos que tocam tabelas de sistema do Supabase (realtime.messages, etc.)
// e que causam erro 42501 "must be owner" no Supabase Cloud.
const SKIP_FILES = [
  '20260603002413_edbeffb7-ea33-4fde-a6b4-b0e42ef99498.sql', // realtime.messages RLS
];

let combined = `-- ========================================================\n`;
combined += `-- SCRIPT CONSOLIDADO DE MIGRAÇÃO - PROJETO SUPABASE mwnjoglolbyeyrmkqqqc\n`;
combined += `-- Gerado em: ${new Date().toISOString()}\n`;
combined += `-- Total de arquivos: ${files.length} | Pulados: ${SKIP_FILES.length}\n`;
combined += `-- ========================================================\n\n`;

// Cabeçalho com configurações de sessão para evitar erros de permissão comuns
combined += `SET session_replication_role = DEFAULT;\n\n`;

let skipped = 0;
for (const file of files) {
  if (SKIP_FILES.includes(file)) {
    combined += `-- ⚠️  PULADO (tabela de sistema): ${file}\n\n`;
    skipped++;
    continue;
  }
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf8').trim();
  combined += `-- --------------------------------------------------------\n`;
  combined += `-- MIGRATION: ${file}\n`;
  combined += `-- --------------------------------------------------------\n`;
  combined += content + `\n\n`;
}

fs.writeFileSync(outputFile, combined, 'utf8');
console.log(`✅ Arquivo consolidado criado: ${outputFile}`);
console.log(`   Tamanho: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
console.log(`   Total incluídos: ${files.length - skipped} | Pulados: ${skipped}`);
