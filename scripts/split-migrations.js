import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const outputDir = path.join(process.cwd(), 'supabase', 'migration_parts');

// Arquivos que tocam tabelas de sistema - PULAR
const SKIP_FILES = [
  '20260603002413_edbeffb7-ea33-4fde-a6b4-b0e42ef99498.sql', // realtime.messages RLS
];

const MIGRATIONS_PER_PART = 30;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
for (const f of fs.readdirSync(outputDir)) fs.unlinkSync(path.join(outputDir, f));

const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !SKIP_FILES.includes(f))
  .sort();

console.log(`Total: ${files.length + SKIP_FILES.length} | Incluídos: ${files.length} | Pulados: ${SKIP_FILES.length}`);

/**
 * Torna o SQL idempotente — pode rodar várias vezes sem erro de "already exists".
 */
function makeIdempotent(sql) {
  // CREATE TABLE -> CREATE TABLE IF NOT EXISTS
  sql = sql.replace(/\bCREATE TABLE\s+(?!IF NOT EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ');

  // CREATE TYPE -> CREATE TYPE IF NOT EXISTS
  sql = sql.replace(/\bCREATE TYPE\s+(?!IF NOT EXISTS)/gi, 'CREATE TYPE IF NOT EXISTS ');

  // CREATE INDEX -> CREATE INDEX IF NOT EXISTS
  sql = sql.replace(/\bCREATE INDEX\s+(?!IF NOT EXISTS|CONCURRENTLY)/gi, 'CREATE INDEX IF NOT EXISTS ');
  sql = sql.replace(/\bCREATE UNIQUE INDEX\s+(?!IF NOT EXISTS|CONCURRENTLY)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

  // CREATE FUNCTION / PROCEDURE -> CREATE OR REPLACE
  sql = sql.replace(/\bCREATE FUNCTION\s+/gi, 'CREATE OR REPLACE FUNCTION ');
  sql = sql.replace(/\bCREATE PROCEDURE\s+/gi, 'CREATE OR REPLACE PROCEDURE ');

  // CREATE VIEW -> CREATE OR REPLACE VIEW
  sql = sql.replace(/\bCREATE VIEW\s+(?!IF NOT EXISTS)/gi, 'CREATE OR REPLACE VIEW ');

  // CREATE SEQUENCE -> CREATE SEQUENCE IF NOT EXISTS
  sql = sql.replace(/\bCREATE SEQUENCE\s+(?!IF NOT EXISTS)/gi, 'CREATE SEQUENCE IF NOT EXISTS ');

  // CREATE POLICY -> adiciona DROP IF EXISTS antes
  sql = sql.replace(
    /CREATE POLICY\s+"([^"]+)"\s+ON\s+([^\s(]+)/gi,
    (match, policyName, tableName) => {
      return `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n${match}`;
    }
  );

  return sql;
}

const totalParts = Math.ceil(files.length / MIGRATIONS_PER_PART);
let partIndex = 1;

for (let i = 0; i < files.length; i += MIGRATIONS_PER_PART) {
  const chunk = files.slice(i, i + MIGRATIONS_PER_PART);
  const partName = `parte_${String(partIndex).padStart(2, '0')}_de_${totalParts}.sql`;
  const partPath = path.join(outputDir, partName);

  let content = `-- ================================================================\n`;
  content += `-- PARTE ${partIndex} DE ${totalParts} | Migrações ${i + 1}–${Math.min(i + MIGRATIONS_PER_PART, files.length)} de ${files.length}\n`;
  content += `-- ⚠️  Script idempotente — pode ser rodado mesmo que objetos já existam\n`;
  content += `-- ================================================================\n\n`;

  for (const file of chunk) {
    const filePath = path.join(migrationsDir, file);
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const sql = makeIdempotent(raw);
    content += `-- ----------------------------------------\n`;
    content += `-- ${file}\n`;
    content += `-- ----------------------------------------\n`;
    content += sql + `\n\n`;
  }

  fs.writeFileSync(partPath, content, 'utf8');
  const sizeKb = (fs.statSync(partPath).size / 1024).toFixed(1);
  console.log(`✅ ${partName} → ${sizeKb} KB`);
  partIndex++;
}

console.log(`\n🎉 ${totalParts} arquivos gerados em: ${outputDir}`);
console.log(`   Todos os scripts são idempotentes (IF NOT EXISTS / OR REPLACE).`);
