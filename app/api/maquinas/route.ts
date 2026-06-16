import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const maquinas = await prisma.maquina.findMany({
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ success: true, data: maquinas })
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
    if (!body.nome || !body.tipo) {
      return NextResponse.json({ error: 'Nome e tipo são obrigatórios' }, { status: 400 })
    }

    const maquina = await prisma.maquina.create({
      data: {
        nome: body.nome,
        tipo: body.tipo,
        marca: body.marca,
        modelo: body.modelo,
        ano: body.ano,
        placa: body.placa,
        status: body.status || 'ATIVA',
        ultimoHorimetro: 0,
      },
    })

    return NextResponse.json({ success: true, data: maquina }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
