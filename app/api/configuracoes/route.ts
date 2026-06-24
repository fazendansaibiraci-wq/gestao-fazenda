import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let config = await prisma.configuracaoGlobal.findFirst()

    // Se não existir, cria um registro padrão
    if (!config) {
      config = await prisma.configuracaoGlobal.create({
        data: {
          cargaHorariaEntressafra: 8,
          inicioSafra: null,
          fimSafra: null,
        },
      })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('GET /api/configuracoes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    let config = await prisma.configuracaoGlobal.findFirst()

    if (!config) {
      config = await prisma.configuracaoGlobal.create({
        data: {
          cargaHorariaEntressafra: body.cargaHorariaEntressafra ?? 8,
          inicioSafra: body.inicioSafra ? new Date(body.inicioSafra) : null,
          fimSafra: body.fimSafra ? new Date(body.fimSafra) : null,
        },
      })
    } else {
      config = await prisma.configuracaoGlobal.update({
        where: { id: config.id },
        data: {
          cargaHorariaEntressafra: body.cargaHorariaEntressafra ?? config.cargaHorariaEntressafra,
          inicioSafra: body.inicioSafra ? new Date(body.inicioSafra) : null,
          fimSafra: body.fimSafra ? new Date(body.fimSafra) : null,
        },
      })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('PUT /api/configuracoes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
