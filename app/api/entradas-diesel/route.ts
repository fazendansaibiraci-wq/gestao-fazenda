import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entradasAntigas = await prisma.entradaDiesel.findMany({
      orderBy: { data: 'desc' },
    })

    const produtoDiesel = await prisma.produto.findFirst({
      where: { nomeComercial: { contains: 'DIESEL', mode: 'insensitive' } },
    })

    const entradasNovas = produtoDiesel
      ? await prisma.entradaProduto.findMany({
          where: { produtoId: produtoDiesel.id },
          orderBy: { data: 'desc' },
        })
      : []

    const listaUnificada = [
      ...entradasAntigas.map((e) => ({
        id: e.id,
        data: e.data,
        litrosRecebidos: e.litrosRecebidos,
        valorPorLitro: e.valorPorLitro,
        custoTotal: e.custoTotal,
        nf: e.nf,
        fornecedor: e.fornecedor,
        origem: 'antigo' as const,
      })),
      ...entradasNovas.map((e) => ({
        id: e.id,
        data: e.data,
        litrosRecebidos: e.quantidade,
        valorPorLitro: e.valorUnitario,
        custoTotal: e.quantidade * e.valorUnitario,
        nf: e.numeroNota,
        fornecedor: e.fornecedor,
        origem: 'nfe' as const,
      })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    return NextResponse.json({ success: true, data: listaUnificada })
  } catch (error) {
    console.error('GET /api/entradas-diesel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.data || !body.litrosRecebidos || !body.valorPorLitro) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const custoTotal = body.litrosRecebidos * body.valorPorLitro

    const entrada = await prisma.entradaDiesel.create({
      data: {
        data: new Date(body.data),
        litrosRecebidos: body.litrosRecebidos,
        valorPorLitro: body.valorPorLitro,
        custoTotal,
        nf: body.nf,
        fornecedor: body.fornecedor,
        observacao: body.observacao,
      },
    })

    return NextResponse.json(
      { success: true, data: entrada, message: 'Entrada registrada' },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/entradas-diesel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
