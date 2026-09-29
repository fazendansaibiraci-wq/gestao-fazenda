import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Atividades registradas pelos funcionários (Registro de Atividades), para a
// aba "Atividades e Produtos" da Aplicação de Insumos.
//   GET ?safraId=                     lista agrupada por Tipo de Atividade
//   GET ?safraId=&tipoAtividade=      detalhe: registros, talhões e produtos lançados
// Só horas (sem custos) — nenhum dado de salário sai daqui.

const iso = (d: Date) => d.toISOString().slice(0, 10)
const chave = (s: string) => s.trim().toUpperCase()
// Tipos gerados automaticamente pelo sistema, que não são atividade de campo.
const IGNORAR = new Set(['BANCO_HORAS', 'FERIADO'])

const horasMaquinaDoRegistro = (r: {
  maquinaId: string | null
  horasMaquina: number | null
  maquinasAdicionais: { horasMaquina: number | null; horimetroInicial: number | null; horimetroFinal: number | null }[]
}) => {
  let h = r.maquinaId ? (r.horasMaquina || 0) : 0
  for (const m of r.maquinasAdicionais) {
    h += m.horasMaquina != null
      ? m.horasMaquina
      : (m.horimetroFinal != null && m.horimetroInicial != null ? m.horimetroFinal - m.horimetroInicial : 0)
  }
  return h
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const safraId = searchParams.get('safraId') || ''
    const tipoAtividade = (searchParams.get('tipoAtividade') || '').trim()
    if (!safraId) return NextResponse.json({ error: 'Informe a safra' }, { status: 400 })

    const baseWhere: any = { safraId, isFalta: false, isAjusteHorimetro: false }

    // ─── Detalhe de uma atividade ──────────────────────────────────────────
    if (tipoAtividade) {
      const filtro = { equals: tipoAtividade, mode: 'insensitive' as const }
      const [registros, produtos] = await Promise.all([
        prisma.registroAtividade.findMany({
          where: { ...baseWhere, tipoAtividade: filtro },
          select: {
            id: true, data: true, horaEntrada: true, horaSaida: true, horasCalculadas: true,
            maquinaId: true, horasMaquina: true, aprovadoAtividadeEm: true,
            funcionario: { select: { id: true, name: true } },
            talhao: { select: { id: true, nome: true, area: true } },
            maquina: { select: { nome: true } },
            maquinasAdicionais: { select: { horasMaquina: true, horimetroInicial: true, horimetroFinal: true, maquina: { select: { nome: true } } } },
          },
          orderBy: [{ data: 'asc' }, { horaEntrada: 'asc' }],
        }),
        prisma.produtoAtividade.findMany({
          where: { safraId, tipoAtividade: filtro },
          include: {
            talhao: { select: { id: true, nome: true } },
            produto: { select: { id: true, nomeComercial: true } },
            registradoPor: { select: { name: true } },
          },
          orderBy: [{ data: 'asc' }, { dataCriacao: 'asc' }],
        }),
      ])

      const talhoes = new Map<string, { id: string; nome: string; area: number | null; ultimaData: string }>()
      for (const r of registros) {
        if (!r.talhao) continue
        const d = iso(r.data)
        const t = talhoes.get(r.talhao.id)
        if (!t) talhoes.set(r.talhao.id, { id: r.talhao.id, nome: r.talhao.nome, area: r.talhao.area, ultimaData: d })
        else if (d > t.ultimaData) t.ultimaData = d
      }

      return NextResponse.json({
        success: true,
        data: {
          registros: registros.map((r) => ({
            id: r.id,
            data: iso(r.data),
            horaEntrada: r.horaEntrada,
            horaSaida: r.horaSaida,
            funcionario: r.funcionario?.name || '-',
            talhao: r.talhao?.nome || null,
            horasHH: r.horasCalculadas || 0,
            horasHM: horasMaquinaDoRegistro(r),
            maquinas: [r.maquina?.nome, ...r.maquinasAdicionais.map((m) => m.maquina?.nome)].filter(Boolean),
            aprovado: !!r.aprovadoAtividadeEm,
          })),
          talhoes: Array.from(talhoes.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
          produtos: produtos.map((p) => ({
            id: p.id,
            data: iso(p.data),
            talhao: p.talhao?.nome || '-',
            produto: p.produto?.nomeComercial || '-',
            quantidade: p.quantidade,
            unidade: p.unidadeSnapshot,
            valorTotal: p.valorTotal,
            registradoPor: p.registradoPor?.name || '-',
          })),
        },
      })
    }

    // ─── Lista agrupada por atividade ──────────────────────────────────────
    const [registros, produtos] = await Promise.all([
      prisma.registroAtividade.findMany({
        where: baseWhere,
        select: {
          tipoAtividade: true, data: true, horasCalculadas: true, maquinaId: true, horasMaquina: true,
          aprovadoAtividadeEm: true, talhaoId: true,
          maquinasAdicionais: { select: { horasMaquina: true, horimetroInicial: true, horimetroFinal: true } },
        },
      }),
      prisma.produtoAtividade.findMany({ where: { safraId }, select: { tipoAtividade: true, valorTotal: true } }),
    ])

    const grupos = new Map<string, { nome: string; registros: number; aprovados: number; horasHH: number; horasHM: number; talhoes: Set<string>; inicio: string; fim: string; valorProdutos: number }>()
    for (const r of registros) {
      if (!r.tipoAtividade || IGNORAR.has(chave(r.tipoAtividade))) continue
      const k = chave(r.tipoAtividade)
      const d = iso(r.data)
      if (!grupos.has(k)) grupos.set(k, { nome: r.tipoAtividade.trim(), registros: 0, aprovados: 0, horasHH: 0, horasHM: 0, talhoes: new Set(), inicio: d, fim: d, valorProdutos: 0 })
      const g = grupos.get(k)!
      g.registros++
      if (r.aprovadoAtividadeEm) g.aprovados++
      g.horasHH += r.horasCalculadas || 0
      g.horasHM += horasMaquinaDoRegistro(r)
      if (r.talhaoId) g.talhoes.add(r.talhaoId)
      if (d < g.inicio) g.inicio = d
      if (d > g.fim) g.fim = d
    }
    for (const p of produtos) {
      const g = grupos.get(chave(p.tipoAtividade))
      if (g) g.valorProdutos += p.valorTotal || 0
    }

    return NextResponse.json({
      success: true,
      data: Array.from(grupos.values())
        .map((g) => ({ ...g, talhoes: g.talhoes.size }))
        .sort((a, b) => (a.fim < b.fim ? 1 : a.fim > b.fim ? -1 : a.nome.localeCompare(b.nome, 'pt-BR'))),
    })
  } catch (error) {
    console.error('GET /api/atividades-registradas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
