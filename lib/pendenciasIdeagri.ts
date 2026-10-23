import type { PrismaClient } from '@prisma/client'

// Fila de conferência com o Ideagri: tudo que mexe no estoque do app
// (transferência, saída, devolução, entrada de NF-e, ajuste) precisa ser
// lançado também no Ideagri. Fica "pendente" até alguém marcar como
// lançado. Só conta o que foi registrado a partir do início da fila: o que
// veio antes já estava no Ideagri (ou veio dele pelo CSV).
export const INICIO_FILA_IDEAGRI = new Date('2026-10-23T00:00:00-03:00')

export type TipoMovimento = 'transferencia' | 'saida' | 'devolucao' | 'entrada' | 'ajuste'

export interface ItemFila {
  tipo: TipoMovimento
  // Uma entrada de NF-e agrupa todos os itens da nota (marca tudo junto).
  ids: string[]
  chave: string
  data: Date
  registradoEm: Date
  registradoPor: string | null
  titulo: string
  detalhe: string
  linhas: string[]
  lancadoEm: Date | null
  lancadoPor: string | null
}

const fmt = (n: number) => (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const un = (u?: string | null) => (u || '').toLowerCase()

// status: 'pendentes' (não lançados) ou 'lancados' (lançados nos últimos 60 dias).
export async function listarFilaIdeagri(prisma: PrismaClient, status: 'pendentes' | 'lancados'): Promise<ItemFila[]> {
  const desde = status === 'lancados' ? new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) : null
  const filtro: any =
    status === 'pendentes'
      ? { dataCriacao: { gte: INICIO_FILA_IDEAGRI }, lancadoIdeagriEm: null }
      : { dataCriacao: { gte: INICIO_FILA_IDEAGRI }, lancadoIdeagriEm: { gte: desde } }

  const produto = { select: { nomeComercial: true, unidadeMedida: true } }
  const nomeLocal = { select: { nome: true } }
  const quem = { select: { name: true } }

  const [transferencias, saidas, devolucoes, entradas, ajustes] = await Promise.all([
    prisma.transferenciaEstoque.findMany({
      where: filtro,
      include: { produto, localOrigem: nomeLocal, localDestino: nomeLocal, registradoPor: quem },
    }),
    prisma.saidaProduto.findMany({
      // Abastecimento de diesel tem controle próprio: fica fora da fila.
      where: { ...filtro, abastecimento: { is: null } },
      include: { produto, local: nomeLocal, talhao: nomeLocal, registradoPor: quem },
    }),
    prisma.devolucaoProduto.findMany({
      where: filtro,
      include: { produto, local: nomeLocal, registradoPor: quem, saida: { select: { data: true, talhao: nomeLocal } } },
    }),
    prisma.entradaProduto.findMany({
      where: filtro,
      include: { produto, local: nomeLocal, registradoPor: quem },
      orderBy: { dataCriacao: 'asc' },
    }),
    prisma.ajusteEstoque.findMany({
      where: filtro,
      include: { produto, local: nomeLocal, registradoPor: quem },
    }),
  ])

  const itens: ItemFila[] = []

  for (const t of transferencias) {
    itens.push({
      tipo: 'transferencia',
      ids: [t.id],
      chave: `transferencia:${t.id}`,
      data: t.data,
      registradoEm: t.dataCriacao,
      registradoPor: t.registradoPor?.name || null,
      titulo: `${t.produto.nomeComercial} · ${fmt(t.quantidade)} ${un(t.produto.unidadeMedida)}`,
      detalhe: `${t.localOrigem?.nome || '—'} → ${t.localDestino?.nome || '—'}${t.observacao ? ` · ${t.observacao}` : ''}`,
      linhas: [],
      lancadoEm: t.lancadoIdeagriEm,
      lancadoPor: t.lancadoIdeagriPor,
    })
  }

  for (const s of saidas) {
    const partes = [`de ${s.local?.nome || '—'}`]
    if (s.talhao?.nome) partes.push(`Talhão ${s.talhao.nome}`)
    if (s.tipoAtividade) partes.push(s.tipoAtividade)
    if (s.tipo) partes.push(s.tipo)
    if (s.observacao) partes.push(s.observacao)
    itens.push({
      tipo: 'saida',
      ids: [s.id],
      chave: `saida:${s.id}`,
      data: s.data,
      registradoEm: s.dataCriacao,
      registradoPor: s.registradoPor?.name || null,
      titulo: `${s.produto.nomeComercial} · ${fmt(s.quantidade)} ${un(s.produto.unidadeMedida)}`,
      detalhe: partes.join(' · '),
      linhas: [],
      lancadoEm: s.lancadoIdeagriEm,
      lancadoPor: s.lancadoIdeagriPor,
    })
  }

  for (const d of devolucoes) {
    const origem = `sobra da saída de ${dataBR(d.saida.data)}${d.saida.talhao?.nome ? ` (Talhão ${d.saida.talhao.nome})` : ''}`
    itens.push({
      tipo: 'devolucao',
      ids: [d.id],
      chave: `devolucao:${d.id}`,
      data: d.data,
      registradoEm: d.dataCriacao,
      registradoPor: d.registradoPor?.name || null,
      titulo: `${d.produto.nomeComercial} · ${fmt(d.quantidade)} ${un(d.produto.unidadeMedida)}`,
      detalhe: `volta para ${d.local?.nome || '—'} · ${origem}${d.observacao ? ` · ${d.observacao}` : ''}`,
      linhas: [],
      lancadoEm: d.lancadoIdeagriEm,
      lancadoPor: d.lancadoIdeagriPor,
    })
  }

  // Entradas: uma linha por nota.
  const notas = new Map<string, ItemFila>()
  for (const e of entradas) {
    const chaveNota = e.chaveAcesso || `${e.fornecedor || ''}|${e.numeroNota || ''}|${e.serieNota || ''}|${e.id}`
    const linha = `${e.produto.nomeComercial} · ${fmt(e.quantidade)} ${un(e.produto.unidadeMedida)}`
    const existente = notas.get(chaveNota)
    if (existente) {
      existente.ids.push(e.id)
      existente.linhas.push(linha)
      if (!e.lancadoIdeagriEm) existente.lancadoEm = null
      continue
    }
    notas.set(chaveNota, {
      tipo: 'entrada',
      ids: [e.id],
      chave: `entrada:${chaveNota}`,
      data: e.data,
      registradoEm: e.dataCriacao,
      registradoPor: e.registradoPor?.name || null,
      titulo: `NF ${e.numeroNota || '—'} · ${e.fornecedor || 'Fornecedor não informado'}`,
      detalhe: `entrada em ${e.local?.nome || '—'}`,
      linhas: [linha],
      lancadoEm: e.lancadoIdeagriEm,
      lancadoPor: e.lancadoIdeagriPor,
    })
  }
  for (const n of Array.from(notas.values())) {
    n.titulo += ` · ${n.ids.length} produto${n.ids.length === 1 ? '' : 's'}`
    itens.push(n)
  }

  for (const a of ajustes) {
    const sinal = a.diferenca > 0 ? '+' : ''
    itens.push({
      tipo: 'ajuste',
      ids: [a.id],
      chave: `ajuste:${a.id}`,
      data: a.data,
      registradoEm: a.dataCriacao,
      registradoPor: a.registradoPor?.name || null,
      titulo: `${a.produto.nomeComercial} · ${fmt(a.quantidadeAnterior)} → ${fmt(a.quantidadeNova)} ${un(a.produto.unidadeMedida)} (${sinal}${fmt(a.diferenca)})`,
      detalhe: `${a.local?.nome || '—'} · ${a.observacao}`,
      linhas: [],
      lancadoEm: a.lancadoIdeagriEm,
      lancadoPor: a.lancadoIdeagriPor,
    })
  }

  // Mais antigos primeiro: é a ordem pra lançar no Ideagri.
  itens.sort((a, b) => a.registradoEm.getTime() - b.registradoEm.getTime())
  if (status === 'lancados') itens.reverse()
  return itens
}

export async function contarPendenciasIdeagri(prisma: PrismaClient): Promise<number> {
  const filtro = { dataCriacao: { gte: INICIO_FILA_IDEAGRI }, lancadoIdeagriEm: null }
  const [t, s, d, entradas, a] = await Promise.all([
    prisma.transferenciaEstoque.count({ where: filtro }),
    prisma.saidaProduto.count({ where: { ...filtro, abastecimento: { is: null } } }),
    prisma.devolucaoProduto.count({ where: filtro }),
    prisma.entradaProduto.findMany({ where: filtro, select: { id: true, chaveAcesso: true, fornecedor: true, numeroNota: true, serieNota: true } }),
    prisma.ajusteEstoque.count({ where: filtro }),
  ])
  const notas = new Set(entradas.map((e) => e.chaveAcesso || `${e.fornecedor || ''}|${e.numeroNota || ''}|${e.serieNota || ''}|${e.id}`))
  return t + s + d + notas.size + a
}

// Marca como lançadas no Ideagri todas as pendências (usado quando a pessoa
// confirma, na importação do CSV, que elas já estão no Ideagri).
export async function marcarTodasPendentesIdeagri(prisma: PrismaClient, quem: string | null) {
  const filtro = { dataCriacao: { gte: INICIO_FILA_IDEAGRI }, lancadoIdeagriEm: null }
  const data = { lancadoIdeagriEm: new Date(), lancadoIdeagriPor: quem }
  await prisma.$transaction([
    prisma.transferenciaEstoque.updateMany({ where: filtro, data }),
    prisma.saidaProduto.updateMany({ where: { ...filtro, abastecimento: { is: null } }, data }),
    prisma.devolucaoProduto.updateMany({ where: filtro, data }),
    prisma.entradaProduto.updateMany({ where: filtro, data }),
    prisma.ajusteEstoque.updateMany({ where: filtro, data }),
  ])
}
