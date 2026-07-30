import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const whereData: any = {}
    if (dataInicio) whereData.gte = new Date(dataInicio)
    if (dataFim) whereData.lte = new Date(dataFim)
    const temFiltroData = Object.keys(whereData).length > 0

    const produtoDiesel = await prisma.produto.findFirst({
      where: { nomeComercial: { contains: 'DIESEL', mode: 'insensitive' } },
    })

    const [entradasAntigas, entradasNovas, saidas, ajustes, produtos] = await Promise.all([
      prisma.entradaDiesel.findMany({
        where: temFiltroData ? { data: whereData } : undefined,
      }),
      prisma.entradaProduto.findMany({
        where: temFiltroData ? { data: whereData } : undefined,
        include: { produto: { select: { nomeComercial: true, unidadeMedida: true } } },
      }),
      prisma.saidaProduto.findMany({
        where: temFiltroData ? { data: whereData } : undefined,
        include: {
          produto: { select: { nomeComercial: true, unidadeMedida: true } },
          talhao: { select: { nome: true } },
          safra: { select: { nome: true } },
          registradoPor: { select: { name: true } },
        },
      }),
      prisma.ajusteEstoque.findMany({
        where: temFiltroData ? { data: whereData } : undefined,
        include: {
          produto: { select: { nomeComercial: true, unidadeMedida: true } },
          registradoPor: { select: { name: true } },
        },
      }),
      prisma.produto.findMany({
        where: { status: true },
        orderBy: { nomeComercial: 'asc' },
      }),
    ])

    const movimentacoes = [
      ...entradasAntigas.map((e) => ({
        data: e.data,
        tipo: 'entrada' as const,
        produto: produtoDiesel?.nomeComercial || 'Diesel',
        unidade: 'L',
        quantidade: e.litrosRecebidos,
        talhao: null as string | null,
        safra: null as string | null,
        registradoPor: e.fornecedor || null,
        observacao: e.nf ? `NF ${e.nf}` : null,
      })),
      ...entradasNovas.map((e) => ({
        data: e.data,
        tipo: 'entrada' as const,
        produto: e.produto?.nomeComercial || '',
        unidade: e.produto?.unidadeMedida || '',
        quantidade: e.quantidade,
        talhao: null as string | null,
        safra: null as string | null,
        registradoPor: e.fornecedor || null,
        observacao: e.numeroNota ? `NF ${e.numeroNota}` : null,
      })),
      ...saidas.map((s) => ({
        data: s.data,
        tipo: 'saida' as const,
        produto: s.produto?.nomeComercial || '',
        unidade: s.produto?.unidadeMedida || '',
        quantidade: s.quantidade,
        talhao: s.talhao?.nome || null,
        safra: s.safra?.nome || null,
        registradoPor: s.registradoPor?.name || null,
        observacao: s.observacao || null,
      })),
      ...ajustes.map((a) => ({
        data: a.data,
        tipo: 'ajuste' as const,
        produto: a.produto?.nomeComercial || '',
        unidade: a.produto?.unidadeMedida || '',
        quantidade: a.diferenca,
        talhao: null as string | null,
        safra: null as string | null,
        registradoPor: a.registradoPor?.name || null,
        observacao: a.observacao || null,
      })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    const resumoPorProduto = produtos.map((p) => ({
      nome: p.nomeComercial,
      categoria: p.categoria,
      unidade: p.unidadeMedida,
      quantidadeEstoque: p.quantidadeEstoque,
      valorUnitario: p.valorUnitario,
      valorEmEstoque: p.quantidadeEstoque * p.valorUnitario,
    }))

    return NextResponse.json({ success: true, data: { resumoPorProduto, movimentacoes } })
  } catch (error) {
    console.error('GET /api/relatorios/estoque:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
