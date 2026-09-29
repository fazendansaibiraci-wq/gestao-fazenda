import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Produtos usados por atividade (aba "Produtos por Atividade" da Aplicação de Insumos).
// Tabela separada da Aplicação de Insumos; não mexe em estoque.
//   GET  ?tipoAtividade=&safraId=&talhaoId=&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
//   POST { itens: [{ tipoAtividade, safraId, talhaoId, produtoId, data: 'YYYY-MM-DD', quantidade, observacao? }] }

const podeEditar = (role?: string) => role === 'GESTOR' || role === 'GERENTE'
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tipoAtividade = searchParams.get('tipoAtividade')
    const safraId = searchParams.get('safraId')
    const talhaoId = searchParams.get('talhaoId')
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const where: any = {}
    if (tipoAtividade) where.tipoAtividade = tipoAtividade
    if (safraId) where.safraId = safraId
    if (talhaoId) where.talhaoId = talhaoId
    if ((dataInicio && DATA_RE.test(dataInicio)) || (dataFim && DATA_RE.test(dataFim))) {
      where.data = {}
      if (dataInicio && DATA_RE.test(dataInicio)) where.data.gte = new Date(`${dataInicio}T00:00:00-03:00`)
      if (dataFim && DATA_RE.test(dataFim)) where.data.lte = new Date(`${dataFim}T23:59:59.999-03:00`)
    }

    const itens = await prisma.produtoAtividade.findMany({
      where,
      include: {
        talhao: { select: { id: true, nome: true, area: true } },
        produto: { select: { id: true, nomeComercial: true, unidadeMedida: true } },
        safra: { select: { id: true, nome: true } },
        registradoPor: { select: { id: true, name: true } },
      },
      orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
    })

    return NextResponse.json({ success: true, data: itens })
  } catch (error) {
    console.error('GET /api/produtos-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !podeEditar(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const itens: any[] = Array.isArray(body) ? body : body?.itens
    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: 'Envie ao menos um lançamento' }, { status: 400 })
    }

    const normalizados = []
    for (const [i, item] of itens.entries()) {
      const tipoAtividade = typeof item?.tipoAtividade === 'string' ? item.tipoAtividade.trim() : ''
      const quantidade = typeof item?.quantidade === 'number' ? item.quantidade : parseFloat(String(item?.quantidade ?? '').replace(',', '.'))
      if (!tipoAtividade || !item.safraId || !item.talhaoId || !item.produtoId || !item.data) {
        return NextResponse.json({ error: `Linha ${i + 1}: informe atividade, safra, talhão, produto e data` }, { status: 400 })
      }
      if (!DATA_RE.test(String(item.data))) {
        return NextResponse.json({ error: `Linha ${i + 1}: data inválida` }, { status: 400 })
      }
      if (!isFinite(quantidade) || quantidade <= 0) {
        return NextResponse.json({ error: `Linha ${i + 1}: quantidade precisa ser maior que zero` }, { status: 400 })
      }
      normalizados.push({ ...item, tipoAtividade, quantidade })
    }

    const ids = (campo: string) => Array.from(new Set(normalizados.map((i: any) => i[campo] as string)))
    const [produtos, talhoes, safras] = await Promise.all([
      prisma.produto.findMany({ where: { id: { in: ids('produtoId') } } }),
      prisma.talhao.findMany({ where: { id: { in: ids('talhaoId') } }, select: { id: true } }),
      prisma.safra.findMany({ where: { id: { in: ids('safraId') } }, select: { id: true } }),
    ])
    const produtoMap = new Map(produtos.map(p => [p.id, p] as const))
    const talhaoSet = new Set(talhoes.map(t => t.id))
    const safraSet = new Set(safras.map(s => s.id))

    for (const item of normalizados) {
      if (!produtoMap.has(item.produtoId)) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 400 })
      if (!talhaoSet.has(item.talhaoId)) return NextResponse.json({ error: 'Talhão não encontrado' }, { status: 400 })
      if (!safraSet.has(item.safraId)) return NextResponse.json({ error: 'Safra não encontrada' }, { status: 400 })
    }

    const criados = await prisma.$transaction(
      normalizados.map((item: any) => {
        const produto = produtoMap.get(item.produtoId)!
        return prisma.produtoAtividade.create({
          data: {
            tipoAtividade: item.tipoAtividade,
            safraId: item.safraId,
            talhaoId: item.talhaoId,
            produtoId: item.produtoId,
            // Meio-dia de Brasília: evita a data "voltar um dia" ao converter fuso.
            data: new Date(`${item.data}T12:00:00-03:00`),
            quantidade: item.quantidade,
            unidadeSnapshot: produto.unidadeMedida,
            valorUnitarioSnapshot: produto.valorUnitario,
            valorTotal: item.quantidade * produto.valorUnitario,
            observacao: typeof item.observacao === 'string' && item.observacao.trim() ? item.observacao.trim() : null,
            registradoPorId: session.user?.id as string,
          },
        })
      })
    )

    return NextResponse.json({ success: true, data: criados }, { status: 201 })
  } catch (error) {
    console.error('POST /api/produtos-atividade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
