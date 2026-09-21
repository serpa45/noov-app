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

async function inspectStoresAndOrders() {
  console.log('=== INSPEÇÃO DE LOJAS E SEUS TOTAIIS DE VENDAS ===\n');

  const { data: lojas } = await supabase.from('lojas').select('id, user_id, nome, slug');
  console.log('Lojas cadastradas:', lojas);

  for (const loja of lojas || []) {
    console.log(`\n--- LOJA: ${loja.nome} (id: ${loja.id}, user_id: ${loja.user_id}) ---`);

    // Pedidos da loja (delivery + pdv)
    const { data: pedidos } = await supabase.from('pedidos').select('id, total, status, created_at').eq('lojista_id', loja.user_id);
    const { data: pdvPedidos } = await supabase.from('pdv_pedidos').select('id, total, status, created_at').eq('loja_id', loja.id);

    console.log(`Pedidos delivery total: ${pedidos?.length || 0}`);
    console.log(`Pedidos PDV total: ${pdvPedidos?.length || 0}`);

    // Somar total por mês para esta loja
    const mesMap = {};

    pedidos?.forEach(p => {
      const month = p.created_at.slice(0, 7);
      if (!mesMap[month]) mesMap[month] = { totalBruto: 0, totalValidos: 0, countTotal: 0, countValidos: 0, statuses: {} };
      mesMap[month].countTotal++;
      mesMap[month].totalBruto += Number(p.total || 0);
      mesMap[month].statuses[p.status] = (mesMap[month].statuses[p.status] || 0) + 1;

      // Status considerados válidos no Dashboard.tsx
      if (['finalizado', 'entregue'].includes(p.status)) {
        mesMap[month].totalValidos += Number(p.total || 0);
        mesMap[month].countValidos++;
      }
    });

    pdvPedidos?.forEach(p => {
      const month = p.created_at.slice(0, 7);
      if (!mesMap[month]) mesMap[month] = { totalBruto: 0, totalValidos: 0, countTotal: 0, countValidos: 0, statuses: {} };
      mesMap[month].countTotal++;
      mesMap[month].totalBruto += Number(p.total || 0);
      mesMap[month].statuses[`pdv_${p.status}`] = (mesMap[month].statuses[`pdv_${p.status}`] || 0) + 1;

      if (['finalizado', 'fechado'].includes(p.status)) {
        mesMap[month].totalValidos += Number(p.total || 0);
        mesMap[month].countValidos++;
      }
    });

    console.log('Totais por mês para a loja:');
    Object.keys(mesMap).sort().forEach(m => {
      console.log(`  ${m}: Count Total=${mesMap[m].countTotal} (Validos=${mesMap[m].countValidos}), Total Bruto=R$ ${mesMap[m].totalBruto.toFixed(2)}, Total Válidos=R$ ${mesMap[m].totalValidos.toFixed(2)}`, mesMap[m].statuses);
    });
  }
}

inspectStoresAndOrders().catch(console.error);
