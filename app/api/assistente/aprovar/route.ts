import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR
    if (session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionId, preview } = body

    if (!sessionId || !preview) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: sessionId, preview' },
        { status: 400 }
      )
    }

    // Validar sessão
    const chat = await prisma.assistantChat.findUnique({
      where: { id: sessionId },
    })

    if (!chat || chat.usuarioId !== (session.user?.id as string)) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Logar a aprovação
    const log = await prisma.assistantLog.create({
      data: {
        usuarioId: session.user?.id as string,
        tipoAlteracao: preview.tipo || 'desconhecido',
        descricaoSolicitacao: preview.descricao || '',
        previa: JSON.stringify(preview, null, 2),
        status: 'APROVADO',
        dataAprovacao: new Date(),
      },
    })

    // Aqui entraríamos a lógica para APLICAR a alteração
    // Por MVP, apenas logamos a aprovação
    // Em produção, teríamos:
    // - Validação rigorosa do tipo de alteração
    // - Aplicação segura no banco de dados
    // - Rollback automático se houver erro
    // - Notificação de sucesso/erro

    return NextResponse.json({
      success: true,
      logId: log.id,
      message: 'Alteração aprovada e registrada em log',
      detalhes: {
        tipo: preview.tipo,
        descricao: preview.descricao,
        aprovadoEm: new Date(),
      },
    })
  } catch (error) {
    console.error('POST /api/assistente/aprovar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
