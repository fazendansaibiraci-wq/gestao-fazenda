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
          regimeSalarial: 'ENTRESSAFRA',
          inicioSafra: null,
          fimSafra: null,
          lembreteTurmasTexto: null,
          lembreteTurmasAtivo: false,
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
    if (!session || ((session.user as any)?.role !== 'GESTOR' && (session.user as any)?.role !== 'GERENTE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    let config = await prisma.configuracaoGlobal.findFirst()

    if (!config) {
      config = await prisma.configuracaoGlobal.create({
        data: {
          cargaHorariaEntressafra: body.cargaHorariaEntressafra ?? 8,
          regimeSalarial: body.regimeSalarial === 'SAFRA' ? 'SAFRA' : 'ENTRESSAFRA',
          inicioSafra: body.inicioSafra ? new Date(body.inicioSafra) : null,
          fimSafra: body.fimSafra ? new Date(body.fimSafra) : null,
          lembreteTurmasTexto: body.lembreteTurmasTexto ?? null,
          lembreteTurmasAtivo: body.lembreteTurmasAtivo ?? false,
        },
      })
    } else {
      config = await prisma.configuracaoGlobal.update({
        where: { id: config.id },
        data: {
          cargaHorariaEntressafra: body.cargaHorariaEntressafra ?? config.cargaHorariaEntressafra,
          // Regime salarial: botão manual (ver enum RegimeSalarial no
          // schema) — só grava se vier explicitamente no body, pra não
          // resetar o regime ativo a cada save de outro campo.
          regimeSalarial:
            body.regimeSalarial === 'SAFRA' || body.regimeSalarial === 'ENTRESSAFRA'
              ? body.regimeSalarial
              : config.regimeSalarial,
          // inicioSafra/fimSafra não são mais controlados pela tela de
          // Configurações (a fonte da verdade passou a ser a Safra ATIVA em
          // Cadastros → Safras) — só grava se vier explicitamente no body,
          // pra não zerar o valor existente a cada save.
          inicioSafra: body.inicioSafra !== undefined ? (body.inicioSafra ? new Date(body.inicioSafra) : null) : config.inicioSafra,
          fimSafra: body.fimSafra !== undefined ? (body.fimSafra ? new Date(body.fimSafra) : null) : config.fimSafra,
          lembreteTurmasTexto:
            body.lembreteTurmasTexto !== undefined ? body.lembreteTurmasTexto : config.lembreteTurmasTexto,
          lembreteTurmasAtivo:
            body.lembreteTurmasAtivo !== undefined ? body.lembreteTurmasAtivo : config.lembreteTurmasAtivo,
        },
      })
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('PUT /api/configuracoes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
