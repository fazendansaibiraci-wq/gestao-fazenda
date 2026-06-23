import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const implementos = await prisma.implemento.findMany({
      where: { status: true },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ success: true, data: implementos })
  } catch (error) {
    console.error('GET /api/implementos:', error)
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
    if (!body.nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const implemento = await prisma.implemento.create({
      data: {
        nome: body.nome,
        tipo: body.tipo || null,
        descricao: body.descricao || null,
        status: true,
      },
    })

    return NextResponse.json({ success: true, data: implemento }, { status: 201 })
  } catch (error) {
    console.error('POST /api/implementos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GESTOR', 'GERENTE'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const implemento = await prisma.implemento.update({
      where: { id: body.id },
      data: {
        nome: body.nome || undefined,
        tipo: body.tipo,
        descricao: body.descricao,
        status: body.status !== undefined ? body.status : undefined,
      },
    })

    return NextResponse.json({ success: true, data: implemento })
  } catch (error) {
    console.error('PUT /api/implementos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.implemento.update({
      where: { id },
      data: { status: false },
    })

    return NextResponse.json({ success: true, message: 'Implemento desativado' })
  } catch (error) {
    console.error('DELETE /api/implementos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
