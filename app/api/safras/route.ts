import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const safras = await prisma.safra.findMany({
      orderBy: { dataInicio: 'desc' },
    })

    return NextResponse.json({ success: true, data: safras })
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
    if (!body.nome || !body.dataInicio) {
      return NextResponse.json({ error: 'Nome e data são obrigatórios' }, { status: 400 })
    }

    const safra = await prisma.safra.create({
      data: {
        nome: body.nome,
        dataInicio: new Date(body.dataInicio),
        dataFim: body.dataFim ? new Date(body.dataFim) : null,
        status: body.status || 'ATIVA',
      },
    })

    return NextResponse.json({ success: true, data: safra }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
