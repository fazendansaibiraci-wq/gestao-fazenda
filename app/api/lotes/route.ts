import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'COLHEITA'
    const safraId = searchParams.get('safraId')

    const where: any = { statusAtual: status }
    if (safraId) where.safraId = safraId

    const lotes = await prisma.lote.findMany({
      where,
      include: {
        chegadas: true,
        etapaTerreiro: true,
        etapaBeneficio: true,
        etapaClassificacao: true,
        etapaArmazem: true,
      },
      orderBy: { dataCriacao: 'desc' },
    })

    return NextResponse.json({ success: true, data: lotes })
  } catch (error) {
    console.error('GET /api/lotes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    if (!body.safraId || !body.chegadas || body.chegadas.length === 0) {
      return NextResponse.json({ error: 'SafraId e chegadas são obrigatórios' }, { status: 400 })
    }

    // Calcular total em litros
    const quantidadeTotal = body.chegadas.reduce((acc: number, c: any) => acc + c.quantidadeLitros, 0)

    // Gerar ID único para o lote (ex: L2526-001)
    const dataAtual = new Date()
    const ano = dataAtual.getFullYear().toString().slice(-2)
    const mes = (dataAtual.getMonth() + 1).toString().padStart(2, '0')

    const ultimoLote = await prisma.lote.findMany({
      where: {
        identificador: {
          startsWith: `L${ano}${mes}`,
        },
      },
      orderBy: { identificador: 'desc' },
      take: 1,
    })

    const proximoNumero = ultimoLote.length > 0
      ? parseInt(ultimoLote[0].identificador.slice(-3)) + 1
      : 1

    const identificador = `L${ano}${mes}-${proximoNumero.toString().padStart(3, '0')}`

    // Criar lote com chegadas
    const lote = await prisma.lote.create({
      data: {
        identificador,
        safraId: body.safraId,
        tipoOperacao: 'ORIGEM',
        statusAtual: 'COLHEITA',
        quantidadeTotal,
        quantidadeAltual: quantidadeTotal,
        criadorId: session.user?.id as string,

        chegadas: {
          createMany: {
            data: body.chegadas.map((c: any) => ({
              safraId: body.safraId,
              talhaoId: c.talhaoId,
              tipoColheita: c.tipoColheita,
              quantidade: c.quantidade,
              unidadeOriginal: c.unidadeOriginal,
              quantidadeLitros: c.quantidadeLitros,
              responsavelId: session.user?.id as string,
            })),
          },
        },
      },
      include: {
        chegadas: true,
      },
    })

    return NextResponse.json(
      { success: true, data: lote, message: `Lote ${identificador} criado com sucesso` },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/lotes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
