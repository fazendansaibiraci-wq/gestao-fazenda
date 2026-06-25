import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const produtos = await prisma.produto.findMany({
      orderBy: { nomeComercial: 'asc' },
    })

    return NextResponse.json({ success: true, data: produtos })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'AGRONOMO', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.nomeComercial || !body.categoria || !body.unidadeMedida) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const existente = await prisma.produto.findFirst({
      where: {
        nomeComercial: {
          equals: body.nomeComercial.trim(),
          mode: 'insensitive',
        },
      },
    })

    if (existente) {
      return NextResponse.json(
        { error: `Já existe um produto cadastrado com o nome "${existente.nomeComercial}"` },
        { status: 409 }
      )
    }

    const produto = await prisma.produto.create({
      data: {
        nomeComercial: body.nomeComercial.trim(),
        categoria: body.categoria,
        unidadeMedida: body.unidadeMedida,
        valorUnitario: body.valorUnitario ? parseFloat(body.valorUnitario) : null,
        fornecedor: body.fornecedor,
        status: body.status !== false,
      },
    })

    return NextResponse.json({ success: true, data: produto }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
