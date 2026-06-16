import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const lote = await prisma.lote.findUnique({
      where: { id: params.id },
      include: {
        chegadas: true,
        etapaTerreiro: true,
        etapaSecador: true,
        etapaTulha: true,
        etapaBeneficio: true,
        etapaClassificacao: true,
        etapaSilo: true,
        etapaArmazem: true,
        criador: true,
      },
    })

    if (!lote) {
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: lote })
  } catch (error) {
    console.error('GET /api/lotes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas usuários com role GESTOR podem deletar
    if (session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const lote = await prisma.lote.findUnique({ where: { id: params.id } })
    if (!lote) {
      return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    }

    // Deletar apenas se estiver em COLHEITA
    if (lote.statusAtual !== 'COLHEITA') {
      return NextResponse.json(
        { error: 'Apenas lotes em COLHEITA podem ser deletados' },
        { status: 400 }
      )
    }

    await prisma.lote.delete({ where: { id: params.id } })

    return NextResponse.json({
      success: true,
      message: `Lote ${lote.identificador} deletado`,
    })
  } catch (error) {
    console.error('DELETE /api/lotes/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
