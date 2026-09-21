## Objetivo

Fazer o ícone de alerta (laranja pulsante) no header do `/lojista` aparecer **apenas** quando algo na página `/lojista/plano` estiver em estado crítico — ou seja, quando alguma barra de uso ficar vermelha (≥ 90%) ou houver um alerta de erro equivalente.

## Critérios de "estado crítico"

Replicar exatamente a lógica que pinta as barras de vermelho em `MeuPlano.tsx`:

- Uso de produtos ≥ 90% do limite do plano
- Uso de clientes ≥ 90% do limite do plano
- Uso de pedidos do mês ≥ 90% do limite do plano
- Trial expirado e sem plano ativo
- Plano ativo vencendo em ≤ 3 dias (`licenseDaysRemaining <= 3`)

Limites `Infinity` (ilimitado) nunca disparam alerta.

## Implementação

1. **Novo hook** `src/hooks/usePlanCriticalStatus.ts`
   - Recebe `user` do `AuthContext` e usa `useTrialStatus`.
   - Faz as mesmas queries leves usadas em `MeuPlano.tsx`:
     - `lojas` (por `user_id`) para obter `loja.id` e `plano_id`
     - `loja_planos` ativo + join com `planos` para obter `limites`
     - `count` de `produtos`, `clientes`, `pedidos` do mês corrente (mesmo cálculo de `MeuPlano.tsx`)
   - Calcula `pctProdutos`, `pctClientes`, `pctPedidos`.
   - Retorna `{ isCritical: boolean }` quando qualquer condição acima for verdadeira.
   - Usa `staleTime` razoável (ex: 60s) para não sobrecarregar o header.

2. **`src/components/admin/AdminLayout.tsx`** (linhas 286-299)
   - Importar e chamar `usePlanCriticalStatus()`.
   - Renderizar o botão de alerta condicionalmente: `{isCritical && (...)}`.
   - Manter o `navigate(${base}/plano)` no clique e o estilo atual (ícone laranja pulsante + badge "UP").

## Fora de escopo

- Não alterar a página `/lojista/plano`.
- Não mudar a lógica de cores das barras (continuam vermelhas em ≥ 90%).
- Sem mudanças em backend/RLS — apenas leitura via queries já existentes.
