import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const registroId = formData.get('registroId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }
    if (!registroId) {
      return NextResponse.json({ error: 'ID do registro não informado' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são aceitos' }, { status: 400 })
    }

    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo: 5MB' }, { status: 400 })
    }

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: registroId },
      select: { id: true, funcionarioId: true },
    })

    if (!registro) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    const isGestorOuGerente = ['GESTOR', 'GERENTE', 'AGRONOMO'].includes(session.user?.role || '')
    if (!isGestorOuGerente && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Sem permissão para este registro' }, { status: 403 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64}`

    const updated = await prisma.registroAtividade.update({
      where: { id: registroId },
      data: { atestadoUrl: dataUrl },
      select: { id: true, atestadoUrl: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Atestado enviado com sucesso',
      registroId: updated.id,
      hasAtestado: !!updated.atestadoUrl,
    })
  } catch (error) {
    console.error('POST /api/registros-atividade/atestado:', error)
    return NextResponse.json({ error: 'Erro interno ao processar arquivo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const registroId = searchParams.get('registroId')

    if (!registroId) {
      return NextResponse.json({ error: 'ID do registro não informado' }, { status: 400 })
    }

    const registro = await prisma.registroAtividade.findUnique({
      where: { id: registroId },
      select: { id: true, funcionarioId: true },
    })

    if (!registro) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }

    const isGestorOuGerente = ['GESTOR', 'GERENTE', 'AGRONOMO'].includes(session.user?.role || '')
    if (!isGestorOuGerente && registro.funcionarioId !== session.user?.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    await prisma.registroAtividade.update({
      where: { id: registroId },
      data: { atestadoUrl: null },
    })

    return NextResponse.json({ success: true, message: 'Atestado removido' })
  } catch (error) {
    console.error('DELETE /api/registros-atividade/atestado:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
