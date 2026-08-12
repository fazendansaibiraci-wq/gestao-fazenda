import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const locais = await prisma.local.findMany({
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ success: true, data: locais })
  } catch (error) {
    console.error('GET /api/locais:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.nome || !body.nome.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const local = await prisma.local.create({
      data: {
        nome: body.nome.trim(),
      },
    })

    return NextResponse.json({ success: true, data: local }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um local com este nome' }, { status: 409 })
    }
    console.error('POST /api/locais:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
