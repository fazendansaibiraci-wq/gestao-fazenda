import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const talhoes = await prisma.talhao.findMany({
      select: {
        id: true,
        nome: true,
        area: true,
        variedade: true,
        status: true,
      },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ success: true, data: talhoes })
  } catch (error) {
    console.error('GET /api/talhoes:', error)
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
    if (!body.nome || !body.area) {
      return NextResponse.json({ error: 'Nome e área são obrigatórios' }, { status: 400 })
    }

    const talhao = await prisma.talhao.create({
      data: {
        nome: body.nome,
        area: parseFloat(body.area),
        variedade: body.variedade,
        status: body.status || 'ATIVO',
      },
    })

    return NextResponse.json({ success: true, data: talhao }, { status: 201 })
  } catch (error) {
    console.error('POST /api/talhoes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
