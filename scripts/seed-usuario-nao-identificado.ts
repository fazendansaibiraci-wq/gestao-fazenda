/**
 * Script one-off idempotente: cria o usuário placeholder "Não Identificado",
 * usado como funcionarioId padrão nos lançamentos de "Horas Não
 * Identificadas" (feature de reconciliação de horímetro x combustível).
 *
 * Esse usuário NUNCA faz login (active: false, senha é um hash de string
 * aleatória descartada). Ele só existe pra aparecer no dropdown de
 * funcionário do Registro de Atividade quando o gestor não sabe (ainda)
 * quem operou a máquina no intervalo que está sendo ajustado.
 *
 * Idempotente: se um usuário com o email abaixo já existir, o script não
 * faz nada (só informa o id existente). Seguro rodar mais de uma vez.
 *
 * Usa o driver `pg` diretamente, em vez de @prisma/client — mesmo motivo
 * do scripts/import-aplicacao-insumos.ts: `npx prisma generate` não
 * funciona neste ambiente (bloqueio de rede a binaries.prisma.sh).
 *
 *   DATABASE_URL="postgres://..." npx ts-node scripts/seed-usuario-nao-identificado.ts --dry-run
 *   DATABASE_URL="postgres://..." npx ts-node scripts/seed-usuario-nao-identificado.ts
 *
 * Requer a variável de ambiente DATABASE_URL apontando pro Postgres (Railway).
 */

import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { NAO_IDENTIFICADO_EMAIL } from '../lib/ajusteHorimetro'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

const NAO_IDENTIFICADO_NOME = 'Não Identificado'

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina a variável de ambiente DATABASE_URL antes de rodar o script.')
  process.exit(1)
}

// Gera um id no mesmo formato visual dos ids do Prisma (cuid), só pra manter
// consistência ao olhar a tabela — não precisa bater com o algoritmo cuid()
// de verdade, a coluna `id` é só `String @id`, sem validação de formato.
function gerarIdEstiloCuid(): string {
  return 'c' + randomUUID().replace(/-/g, '').slice(0, 24)
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    const existente = await client.query(
      'SELECT id, name, email, role, active FROM users WHERE email = $1',
      [NAO_IDENTIFICADO_EMAIL]
    )

    if (existente.rows.length > 0) {
      console.log('✓ Usuário "Não Identificado" já existe, nada a fazer.')
      console.log(JSON.stringify(existente.rows[0], null, 2))
      return
    }

    // Sanity check adicional: garante que não existe nenhum outro usuário
    // com o mesmo nome "Não Identificado" sob um email diferente (evita
    // duplicidade lógica mesmo que o email não colida).
    const porNome = await client.query('SELECT id, email FROM users WHERE name = $1', [NAO_IDENTIFICADO_NOME])
    if (porNome.rows.length > 0) {
      console.error('ERRO: já existe um usuário chamado "Não Identificado" com email diferente do esperado:')
      console.error(JSON.stringify(porNome.rows, null, 2))
      console.error('Aborting — resolva a duplicidade manualmente antes de rodar o script de novo.')
      process.exit(1)
    }

    const senhaAleatoria = randomBytes(32).toString('hex') // nunca usada pra login de verdade
    const senhaHash = await bcrypt.hash(senhaAleatoria, 10)
    const id = gerarIdEstiloCuid()

    console.log(`Vai criar usuário:`)
    console.log(`  id:     ${id}`)
    console.log(`  name:   ${NAO_IDENTIFICADO_NOME}`)
    console.log(`  email:  ${NAO_IDENTIFICADO_EMAIL}`)
    console.log(`  role:   FUNCIONARIO`)
    console.log(`  active: false`)

    if (DRY_RUN) {
      console.log('\n--dry-run: nada foi gravado no banco.')
      return
    }

    // "updatedAt" não tem default no banco (Prisma implementa @updatedAt só
    // no client, não como default de coluna) — precisa ser setado explicitamente
    // num INSERT via SQL puro, senão viola NOT NULL. Confirmado via
    // information_schema.columns antes de escrever este script.
    await client.query(
      `INSERT INTO users (id, email, password, name, role, active, "bancoHorasAtivo", "pagamentoProporcionalDiario", "ocultarRegistroAtividades", "domingosPorMes", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'FUNCIONARIO', false, false, false, false, 2, now(), now())`,
      [id, NAO_IDENTIFICADO_EMAIL, senhaHash, NAO_IDENTIFICADO_NOME]
    )

    console.log(`\n✓ Usuário "Não Identificado" criado com sucesso. id: ${id}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('❌ Erro ao rodar o seed:', e)
  process.exit(1)
})
