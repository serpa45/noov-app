import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectOrderStatuses() {
  console.log('=== INSPEÇÃO DE PEDIDOS E STATUS NO BANCO DE DADOS ===\n');

  // Buscar todos os pedidos
  const { data: pedidos, error: pErr } = await supabase.from('pedidos').select('id, total, status, created_at');
  const { data: pdvPedidos, error: pdvErr } = await supabase.from('pdv_pedidos').select('id, total, status, created_at');

  if (pErr) console.log('Erro pedidos:', pErr);
  if (pdvErr) console.log('Erro pdv_pedidos:', pdvErr);

  console.log(`Total pedidos na tabela 'pedidos': ${pedidos?.length || 0}`);
  console.log(`Total pedidos na tabela 'pdv_pedidos': ${pdvPedidos?.length || 0}`);

  // Statuses em pedidos
  const statusCountPedidos = {};
  let totalValorPedidos = 0;
  pedidos?.forEach(p => {
    statusCountPedidos[p.status] = (statusCountPedidos[p.status] || 0) + 1;
    totalValorPedidos += Number(p.total || 0);
  });

  console.log('\nStatus na tabela pedidos:', statusCountPedidos);

  // Statuses em pdv_pedidos
  const statusCountPdv = {};
  let totalValorPdv = 0;
  pdvPedidos?.forEach(p => {
    statusCountPdv[p.status] = (statusCountPdv[p.status] || 0) + 1;
    totalValorPdv += Number(p.total || 0);
  });

  console.log('Status na tabela pdv_pedidos:', statusCountPdv);

  // Filtrar por mês atual (ou setembro de 2026 / mês do sistema)
  const now = new Date();
  console.log(`\nData atual do servidor/sistema: ${now.toISOString()}`);

  // Agrupar pedidos por ano-mês
  const pedidosPorMes = {};
  pedidos?.forEach(p => {
    const monthKey = p.created_at.slice(0, 7); // YYYY-MM
    if (!pedidosPorMes[monthKey]) pedidosPorMes[monthKey] = { count: 0, total: 0, byStatus: {} };
    pedidosPorMes[monthKey].count++;
    pedidosPorMes[monthKey].total += Number(p.total || 0);
    pedidosPorMes[monthKey].byStatus[p.status] = (pedidosPorMes[monthKey].byStatus[p.status] || 0) + 1;
  });

  console.log('\nResumo de pedidos por mês na tabela pedidos:');
  Object.keys(pedidosPorMes).sort().forEach(m => {
    console.log(`  ${m}: ${pedidosPorMes[m].count} pedidos, Total: R$ ${pedidosPorMes[m].total.toFixed(2)}`, pedidosPorMes[m].byStatus);
  });

  const pdvPorMes = {};
  pdvPedidos?.forEach(p => {
    const monthKey = p.created_at.slice(0, 7);
    if (!pdvPorMes[monthKey]) pdvPorMes[monthKey] = { count: 0, total: 0, byStatus: {} };
    pdvPorMes[monthKey].count++;
    pdvPorMes[monthKey].total += Number(p.total || 0);
    pdvPorMes[monthKey].byStatus[p.status] = (pdvPorMes[monthKey].byStatus[p.status] || 0) + 1;
  });

  console.log('\nResumo de pedidos por mês na tabela pdv_pedidos:');
  Object.keys(pdvPorMes).sort().forEach(m => {
    console.log(`  ${m}: ${pdvPorMes[m].count} pedidos, Total: R$ ${pdvPorMes[m].total.toFixed(2)}`, pdvPorMes[m].byStatus);
  });
}

inspectOrderStatuses().catch(console.error);
