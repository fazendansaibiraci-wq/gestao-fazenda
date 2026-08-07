/**
 * Script one-off: importa o histórico de "APLICAÇÃO_DE_INSUMOS.xlsx" para AplicacaoInsumoItem.
 *
 * Usa o driver `pg` (node-postgres) diretamente, em vez de @prisma/client — isso evita
 * depender de `npx prisma generate`, que não funciona no ambiente onde este script foi
 * escrito (bloqueio de rede a binaries.prisma.sh). Roda com `ts-node`:
 *
 *   DATABASE_URL="postgres://..." npx ts-node scripts/import-aplicacao-insumos.ts --file="./APLICAÇÃO_DE_INSUMOS.xlsx" --dry-run
 *   DATABASE_URL="postgres://..." npx ts-node scripts/import-aplicacao-insumos.ts --file="./APLICAÇÃO_DE_INSUMOS.xlsx"
 *
 * Flags:
 *   --file=<caminho>          Caminho da planilha (obrigatório)
 *   --dry-run                 Não grava nada no banco, só loga o que faria
 *   --registrado-por=<userId> Sobrescreve o usuário usado em registradoPorId
 *                              (por padrão usa o primeiro usuário com role GESTOR)
 *
 * Requer a variável de ambiente DATABASE_URL apontando pro Postgres (Railway).
 * As colunas da tabela aplicacao_insumo_itens e das demais tabelas usadas aqui
 * (talhoes, produtos, safras, users) têm nomes em camelCase entre aspas
 * (convenção padrão do Prisma), por isso todo SQL abaixo usa identificadores
 * entre aspas duplas onde necessário.
 */

import ExcelJS from 'exceljs'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'

// ─────────────────────────────────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const fileArg = args.find(a => a.startsWith('--file='))
const FILE_PATH = fileArg ? fileArg.split('=').slice(1).join('=') : './APLICAÇÃO_DE_INSUMOS.xlsx'
const registradoPorArg = args.find(a => a.startsWith('--registrado-por='))
const REGISTRADO_POR_OVERRIDE = registradoPorArg ? registradoPorArg.split('=')[1] : null

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina a variável de ambiente DATABASE_URL antes de rodar o script.')
  process.exit(1)
}

const client = new Client({ connectionString: process.env.DATABASE_URL })

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function normalizar(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

// Nomes de safra no banco podem vir com prefixo "SAFRA " (ex: "SAFRA 25/26")
// enquanto a planilha traz só "25/26". Normaliza removendo esse prefixo antes
// de comparar, sem afetar a comparação de talhão/produto.
function normalizarSafra(s: unknown): string {
  return normalizar(s).replace(/^SAFRA\s+/, '')
}

// Sinônimos manuais de nome de talhão: planilha usa um nome, banco já tem
// outro cadastrado para o mesmo talhão físico.
// Combinado com o usuário: "ABACATE" (planilha) == "ABACATEIRO" (banco).
// NÃO adicionar "MN MATO"/"MN DIVISA" -> "MUNDO NOVO": são talhões novos e
// distintos, sem relação com o "MUNDO NOVO" já cadastrado — confirmado
// pelo usuário, devem ser criados normalmente como talhão novo.
const SINONIMOS_TALHAO: Record<string, string> = {
  'ABACATE': 'ABACATEIRO',
}

function normalizarTalhao(s: unknown): string {
  const chave = normalizar(s)
  return SINONIMOS_TALHAO[chave] || chave
}

// Sinônimos manuais de nome de produto: planilha usa um nome, banco já tem
// outro cadastrado para o mesmo insumo (grafia/abreviação diferente).
// Validado pelo usuário contra a lista completa de produtos do banco (98).
const SINONIMOS_PRODUTO: Record<string, string> = {
  'DACAFE CERRADO': 'STOLLER DACAFE CERRADO',
  'EPINGLE': 'EPINGLE 100',
  'HS FOLIAR': 'FERTILIZANTE MISTO HS FOLIAR',
  'OBERON': 'OBERONN',
  'PLEDGE': 'PLEDGE (FLUMIZIN)',
  'ROUNDUP WG': 'ROUND UP WG',
  'TRANSPECT': 'TRASPECT (CLETODIM)',
  'VILORA 240': 'VILORA 240 (ESTEIO)',
}

function normalizarProduto(s: unknown): string {
  const chave = normalizar(s)
  return SINONIMOS_PRODUTO[chave] || chave
}

const ATIVIDADE_MAP: Record<string, string> = {
  'HERBICIDA': 'HERBICIDA',
  'PULVERIZACAO': 'PULVERIZACAO',
  'DRENCH': 'DRENCH',
  'ADUBACAO': 'ADUBACAO',
  'CORRECAO DE SOLO': 'CORRECAO_SOLO',
}

function mapAtividade(raw: unknown): string | null {
  const key = normalizar(raw)
  return ATIVIDADE_MAP[key] || null
}

function excelDateToJs(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    // Excel serial date (base 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30))
    return new Date(epoch.getTime() + value * 86400000)
  }
  const parsed = new Date(String(value))
  return isNaN(parsed.getTime()) ? null : parsed
}

function toFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value as any
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result // célula de fórmula: usa o valor calculado
    if (v instanceof Date) return v
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('')
    if ('text' in v) return v.text
    if ('hyperlink' in v) return v.text ?? v.hyperlink
  }
  return v
}

// ─────────────────────────────────────────────────────────────────────────
// Leitura da planilha
// ─────────────────────────────────────────────────────────────────────────

interface LinhaTabela1 {
  linha: number
  talhao: string
  area: number | null
  atividadeRaw: string
  atividade: string | null
  produto: string
  unidade: string
  valorUnitario: number | null
  qtd: number | null
  numBombas: number | null
  totalQtd: number | null
  valorTotal: number | null
  data: Date | null
  numAplicacao: number
  numAplicacaoTextoOriginal: string | null
  safraRaw: string
}

async function lerPlanilha(caminho: string) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminho)

  const wsPrincipal = wb.getWorksheet('APLICAÇÃO INSUMOS')
  if (!wsPrincipal) throw new Error('Aba "APLICAÇÃO INSUMOS" não encontrada na planilha')

  // Cabeçalho na linha 2
  const headerRow = wsPrincipal.getRow(2)
  const colIndex: Record<string, number> = {}
  headerRow.eachCell((cell, colNumber) => {
    const texto = normalizar(cell.value)
    colIndex[texto] = colNumber
  })

  function col(nome: string): number {
    const idx = colIndex[normalizar(nome)]
    if (!idx) throw new Error(`Coluna "${nome}" não encontrada no cabeçalho (linha 2) da aba APLICAÇÃO INSUMOS`)
    return idx
  }

  const cTalhao = col('TALHÃO')
  const cArea = col('AREA (HÁ)')
  const cAtividade = col('ATIVIDADE')
  const cProduto = col('PRODUTO')
  const cUn = col('UN')
  const cValorUn = col('VALOR UN (R$)')
  const cQtd = col('QTD (KG/LT)')
  const cNumBombas = col('N° DE BOMBAS')
  const cTotal = col('TOTAL (KG/LT)')
  const cValorTotal = col('V. TOTAL (R$)')
  const cData = col('DATA FINAL')
  const cNumAplicacao = col('NUM. APLICAÇÃO')
  const cSafra = col('SAFRA')

  // Correção pontual de erro de digitação na planilha original, confirmada
  // pelo usuário: linha 707 (160 MATO / CANTUS) tem SAFRA "25/27", que não
  // existe — deveria ser "25/26" (a safra ativa cadastrada). Corrige só essa
  // linha específica (por número), sem alterar o arquivo original nem criar
  // uma regra geral de normalização de "25/27" -> "25/26".
  const CORRECAO_SAFRA_POR_LINHA: Record<number, string> = {
    707: '25/26',
  }

  const linhas: LinhaTabela1[] = []
  for (let r = 3; r <= wsPrincipal.rowCount; r++) {
    const row = wsPrincipal.getRow(r)
    const talhao = String(cellValue(row.getCell(cTalhao)) ?? '').trim()
    if (!talhao) continue // linha vazia, fim da tabela ou linha sem talhão

    const atividadeRaw = String(cellValue(row.getCell(cAtividade)) ?? '').trim()
    const safraRawOriginal = String(cellValue(row.getCell(cSafra)) ?? '').trim()
    const safraRaw = CORRECAO_SAFRA_POR_LINHA[r] ?? safraRawOriginal

    linhas.push({
      linha: r,
      talhao,
      area: toFloatOrNull(cellValue(row.getCell(cArea))),
      atividadeRaw,
      atividade: mapAtividade(atividadeRaw),
      produto: String(cellValue(row.getCell(cProduto)) ?? '').trim(),
      unidade: String(cellValue(row.getCell(cUn)) ?? '').trim(),
      valorUnitario: toFloatOrNull(cellValue(row.getCell(cValorUn))),
      qtd: toFloatOrNull(cellValue(row.getCell(cQtd))),
      numBombas: toFloatOrNull(cellValue(row.getCell(cNumBombas))),
      totalQtd: toFloatOrNull(cellValue(row.getCell(cTotal))),
      valorTotal: toFloatOrNull(cellValue(row.getCell(cValorTotal))),
      data: excelDateToJs(cellValue(row.getCell(cData))),
      numAplicacao: toFloatOrNull(cellValue(row.getCell(cNumAplicacao))) || 1,
      numAplicacaoTextoOriginal: (() => {
        const bruto = cellValue(row.getCell(cNumAplicacao))
        return toFloatOrNull(bruto) === null && bruto !== null && bruto !== undefined && String(bruto).trim() !== ''
          ? String(bruto).trim()
          : null
      })(),
      safraRaw,
    })
  }

  // Planilha1: Tabela2 (A,B = TALHÃO, AREA) e Tabela3 (D,E,F = INSUMO, UN, V.UNITARIO)
  const wsAux = wb.getWorksheet('Planilha1')
  const areaPorTalhao = new Map<string, number>()
  const produtoLookup = new Map<string, { unidade: string; valorUnitario: number }>()

  if (wsAux) {
    for (let r = 1; r <= wsAux.rowCount; r++) {
      const row = wsAux.getRow(r)
      const nomeTalhao = String(cellValue(row.getCell(1)) ?? '').trim()
      const areaTalhao = toFloatOrNull(cellValue(row.getCell(2)))
      if (nomeTalhao && areaTalhao !== null) {
        areaPorTalhao.set(normalizarTalhao(nomeTalhao), areaTalhao)
      }

      const nomeInsumo = String(cellValue(row.getCell(4)) ?? '').trim()
      const unInsumo = String(cellValue(row.getCell(5)) ?? '').trim()
      const valorInsumo = toFloatOrNull(cellValue(row.getCell(6)))
      if (nomeInsumo && valorInsumo !== null) {
        produtoLookup.set(normalizarProduto(nomeInsumo), { unidade: unInsumo || 'un', valorUnitario: valorInsumo })
      }
    }
  }

  return { linhas, areaPorTalhao, produtoLookup }
}

// ─────────────────────────────────────────────────────────────────────────
// Acesso ao banco (pg puro)
// ─────────────────────────────────────────────────────────────────────────

interface SafraRow { id: string; nome: string }
interface TalhaoRow { id: string; nome: string; area: number | null }
interface ProdutoRow { id: string; nomeComercial: string; unidadeMedida: string; valorUnitario: number }

async function carregarSafras(): Promise<SafraRow[]> {
  const r = await client.query('SELECT id, nome FROM safras')
  return r.rows
}

async function carregarTalhoes(): Promise<TalhaoRow[]> {
  const r = await client.query('SELECT id, nome, area FROM talhoes')
  return r.rows
}

async function carregarProdutos(): Promise<ProdutoRow[]> {
  const r = await client.query('SELECT id, "nomeComercial", "unidadeMedida", "valorUnitario" FROM produtos')
  return r.rows
}

async function buscarGestor(): Promise<{ id: string } | null> {
  const r = await client.query(
    `SELECT id FROM users WHERE role = 'GESTOR' ORDER BY "createdAt" ASC LIMIT 1`
  )
  return r.rows[0] || null
}

async function criarTalhao(nome: string, area: number | null): Promise<TalhaoRow> {
  const id = randomUUID()
  const r = await client.query(
    `INSERT INTO talhoes (id, nome, area, status, "dataCriacao", "ultimaAtualizacao")
     VALUES ($1, $2, $3, 'ATIVO', now(), now())
     RETURNING id, nome, area`,
    [id, nome, area]
  )
  return r.rows[0]
}

async function criarProduto(nomeComercial: string, categoria: string, unidadeMedida: string, valorUnitario: number): Promise<ProdutoRow> {
  const id = randomUUID()
  const r = await client.query(
    `INSERT INTO produtos (id, "nomeComercial", categoria, "unidadeMedida", "valorUnitario", status, "quantidadeEstoque", "estoqueMinimo", "dataCriacao", "ultimaAtualizacao")
     VALUES ($1, $2, $3, $4, $5, true, 0, 0, now(), now())
     RETURNING id, "nomeComercial", "unidadeMedida", "valorUnitario"`,
    [id, nomeComercial, categoria, unidadeMedida, valorUnitario]
  )
  return r.rows[0]
}

async function criarAplicacaoInsumoItem(item: {
  talhaoId: string
  areaHaSnapshot: number | null
  atividade: string
  produtoId: string
  unidadeSnapshot: string
  valorUnitarioSnapshot: number
  qtd: number | null
  numBombas: number | null
  totalQtd: number
  valorTotal: number
  data: Date
  numAplicacao: number
  safraId: string
  observacao: string | null
  registradoPorId: string
}) {
  const id = randomUUID()
  await client.query(
    `INSERT INTO aplicacao_insumo_itens
       (id, "talhaoId", "areaHaSnapshot", atividade, "produtoId", "unidadeSnapshot", "valorUnitarioSnapshot",
        qtd, "numBombas", "totalQtd", "valorTotal", data, "numAplicacao", "safraId", observacao, "registradoPorId", "dataCriacao")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())`,
    [
      id,
      item.talhaoId,
      item.areaHaSnapshot,
      item.atividade,
      item.produtoId,
      item.unidadeSnapshot,
      item.valorUnitarioSnapshot,
      item.qtd,
      item.numBombas,
      item.totalQtd,
      item.valorTotal,
      item.data,
      item.numAplicacao,
      item.safraId,
      item.observacao,
      item.registradoPorId,
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Lendo planilha: ${FILE_PATH}`)
  console.log(DRY_RUN ? 'Modo: DRY-RUN (nada será gravado)' : 'Modo: GRAVAÇÃO REAL')

  const { linhas, areaPorTalhao, produtoLookup } = await lerPlanilha(FILE_PATH)
  console.log(`Linhas lidas na Tabela1: ${linhas.length}`)

  await client.connect()

  try {
    // Safras existentes
    const safrasExistentes = await carregarSafras()
    const safraPorNome = new Map(safrasExistentes.map(s => [normalizarSafra(s.nome), s]))

    // Usuário para registradoPorId
    let registradoPorId = REGISTRADO_POR_OVERRIDE
    if (!registradoPorId) {
      const gestor = await buscarGestor()
      if (!gestor) {
        console.error('ERRO: nenhum usuário com role GESTOR encontrado. Rode novamente com --registrado-por=<userId>.')
        process.exit(1)
      }
      registradoPorId = gestor.id
    }
    console.log(`registradoPorId: ${registradoPorId}`)

    // Talhões e produtos já existentes
    const talhoesExistentes = await carregarTalhoes()
    const talhaoPorNome = new Map(talhoesExistentes.map(t => [normalizarTalhao(t.nome), t]))

    const produtosExistentes = await carregarProdutos()
    const produtoPorNome = new Map(produtosExistentes.map(p => [normalizarProduto(p.nomeComercial), p]))

    const talhoesCriados: string[] = []
    const produtosCriados: string[] = []
    const puladas: { linha: number; motivo: string }[] = []
    const safrasFaltantes = new Set<string>()

    let importadas = 0

    for (const l of linhas) {
      // --- Atividade ---
      if (!l.atividade) {
        puladas.push({ linha: l.linha, motivo: `Atividade não reconhecida: "${l.atividadeRaw}"` })
        continue
      }

      // --- Safra ---
      const safraKey = normalizarSafra(l.safraRaw)
      const safra = safraKey ? safraPorNome.get(safraKey) : undefined
      if (!safra) {
        safrasFaltantes.add(l.safraRaw)
        puladas.push({ linha: l.linha, motivo: `Safra sem correspondência: "${l.safraRaw}"` })
        continue
      }

      // --- Talhão (busca ou cria) ---
      const talhaoKey = normalizarTalhao(l.talhao)
      let talhao = talhaoPorNome.get(talhaoKey)
      if (!talhao) {
        const area = l.area ?? areaPorTalhao.get(talhaoKey) ?? null
        if (DRY_RUN) {
          talhao = { id: `novo-talhao-${talhaoKey}`, nome: l.talhao, area }
        } else {
          talhao = await criarTalhao(l.talhao, area)
        }
        talhaoPorNome.set(talhaoKey, talhao)
        talhoesCriados.push(`${l.talhao} (área: ${area ?? 'desconhecida'})`)
      }

      // --- Produto (busca ou cria) ---
      const produtoKey = normalizarProduto(l.produto)
      let produto = produtoPorNome.get(produtoKey)
      if (!produto) {
        const lookup = produtoLookup.get(produtoKey)
        const unidadeMedida = l.unidade || lookup?.unidade || 'un'
        const valorUnitario = l.valorUnitario ?? lookup?.valorUnitario ?? 0
        const categoria = ATIVIDADE_LABEL(l.atividade)
        if (DRY_RUN) {
          produto = { id: `novo-produto-${produtoKey}`, nomeComercial: l.produto, unidadeMedida, valorUnitario }
        } else {
          produto = await criarProduto(l.produto, categoria, unidadeMedida, valorUnitario)
        }
        produtoPorNome.set(produtoKey, produto)
        produtosCriados.push(`${l.produto} (${unidadeMedida}, R$ ${valorUnitario})`)
      }

      // --- Quantidades ---
      const totalQtd = l.totalQtd
      if (totalQtd === null) {
        puladas.push({ linha: l.linha, motivo: 'TOTAL (KG/LT) vazio' })
        continue
      }
      if (!l.data) {
        puladas.push({ linha: l.linha, motivo: 'DATA FINAL vazia ou inválida' })
        continue
      }

      // Para itens de histórico, prioriza o preço da PRÓPRIA linha da planilha
      // (preço vigente na época da aplicação), caindo para o preço atual do
      // produto no banco só se a linha não tiver preço. Isso é específico deste
      // script de importação de histórico — o fluxo normal da API (novos
      // lançamentos pela tela) continua usando sempre o preço atual do produto.
      const valorUnitarioSnapshot = l.valorUnitario && l.valorUnitario > 0 ? l.valorUnitario : produto.valorUnitario
      const valorTotal = totalQtd * valorUnitarioSnapshot

      // Algumas linhas trazem texto em NUM. APLICAÇÃO em vez de número
      // (ex: "DESSECAÇÃO", "POS COLHEITA", "ETHREL") — nesses casos
      // numAplicacao já caiu pro default 1, mas preserva o texto original
      // em observacao para não perder essa informação do histórico.
      const observacao = l.numAplicacaoTextoOriginal
        ? `NUM. APLICAÇÃO original (planilha): ${l.numAplicacaoTextoOriginal}`
        : null

      if (DRY_RUN) {
        console.log(`[dry-run] linha ${l.linha}: ${l.talhao} / ${l.produto} / ${l.atividade} / total=${totalQtd} / valor=${valorTotal.toFixed(2)}${observacao ? ' / obs=' + observacao : ''}`)
      } else {
        await criarAplicacaoInsumoItem({
          talhaoId: talhao.id,
          areaHaSnapshot: talhao.area ?? null,
          atividade: l.atividade,
          produtoId: produto.id,
          unidadeSnapshot: produto.unidadeMedida,
          valorUnitarioSnapshot,
          qtd: l.qtd,
          numBombas: l.numBombas,
          totalQtd,
          valorTotal,
          data: l.data,
          numAplicacao: l.numAplicacao,
          safraId: safra.id,
          observacao,
          registradoPorId: registradoPorId!,
        })
      }
      importadas++
    }

    console.log('\n===== RESUMO =====')
    console.log(`Linhas na planilha: ${linhas.length}`)
    console.log(`Importadas: ${importadas}`)
    console.log(`Talhões novos: ${talhoesCriados.length}`)
    talhoesCriados.forEach(t => console.log(`  - ${t}`))
    console.log(`Produtos novos: ${produtosCriados.length}`)
    produtosCriados.forEach(p => console.log(`  - ${p}`))
    console.log(`Puladas: ${puladas.length}`)
    puladas.forEach(p => console.log(`  - linha ${p.linha}: ${p.motivo}`))
    if (safrasFaltantes.size > 0) {
      console.log('\nATENÇÃO: as seguintes safras da planilha não têm correspondência no banco. Nenhuma safra foi criada automaticamente.')
      console.log('Cadastre-as manualmente (ou me diga o nome exato já cadastrado) e rode o script novamente:')
      Array.from(safrasFaltantes).forEach(s => console.log(`  - "${s}"`))
    }
    if (DRY_RUN) {
      console.log('\nDRY-RUN concluído. Nenhum dado foi gravado. Revise o resumo acima antes de rodar sem --dry-run.')
    } else {
      console.log('\nImportação gravada no banco.')
    }
  } finally {
    await client.end()
  }
}

function ATIVIDADE_LABEL(atividade: string): string {
  const labels: Record<string, string> = {
    HERBICIDA: 'Herbicida',
    PULVERIZACAO: 'Pulverização',
    DRENCH: 'Drench',
    ADUBACAO: 'Adubação',
    CORRECAO_SOLO: 'Correção de Solo',
  }
  return labels[atividade] || atividade
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
