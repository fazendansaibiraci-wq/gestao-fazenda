import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const abastecimentos = await prisma.abastecimentoTrator.findMany({
      include: { maquina: true },
      orderBy: { data: 'desc' },
    })

    return NextResponse.json({ success: true, data: abastecimentos })
  } catch (error) {
    console.error('GET /api/abastecimentos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['GERENTE', 'GESTOR'].includes(session.user?.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.maquinaId || !body.data || !body.horimetroAtual || !body.litrosAbastecidos || !body.valorPorLitro) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Obter horímetro anterior
    const abastecimentoAnterior = await prisma.abastecimentoTrator.findFirst({
      where: { maquinaId: body.maquinaId, data: { lt: new Date(body.data) } },
      orderBy: { data: 'desc' },
    })

    const horimetroAnterior = abastecimentoAnterior?.horimetroAtual || 0
    const horasTrabalhadad = abastecimentoAnterior
      ? Math.max(0, body.horimetroAtual - abastecimentoAnterior.horimetroAtual)
      : 0

    // Trava física: o horímetro não pode ter avançado mais horas do que
    // o tempo real que passou desde o abastecimento anterior dessa
    // máquina. Isso pega erros de digitação (dígito a mais/faltando) na
    // hora do cadastro, antes de virar um número impossível no histórico.
    if (abastecimentoAnterior) {
      const elapsedMs = new Date(body.data).getTime() - new Date(abastecimentoAnterior.data).getTime()
      const elapsedHoras = elapsedMs / (1000 * 60 * 60)
      if (horasTrabalhadad > elapsedHoras) {
        return NextResponse.json(
          {
            error: `Horímetro implausível: essa leitura indicaria ${horasTrabalhadad.toFixed(1)}h de uso da máquina, mas só se passaram ${elapsedHoras.toFixed(1)}h desde o abastecimento anterior (${new Date(abastecimentoAnterior.data).toLocaleDateString('pt-BR')}). Um horímetro não pode avançar mais rápido que o tempo real — confira se não faltou ou sobrou um dígito no valor digitado.`,
          },
          { status: 400 }
        )
      }
    }

    const consumoLporH = horasTrabalhadad > 0 ? body.litrosAbastecidos / horasTrabalhadad : 0
    const custoAbastecimento = body.litrosAbastecidos * body.valorPorLitro

    // Calcular média histórica
    const historico = await prisma.abastecimentoTrator.findMany({
      where: { maquinaId: body.maquinaId },
    })

    const consumoMedio = historico.length > 0
      ? historico.reduce((acc, a) => acc + (a.consumoLporH || 0), 0) / historico.length
      : 0

    const alertaConsumo = consumoLporH > consumoMedio * 1.2

    const abastecimento = await prisma.abastecimentoTrator.create({
      data: {
        data: new Date(body.data),
        maquinaId: body.maquinaId,
        horimetroAtual: body.horimetroAtual,
        horimetroanterior: horimetroAnterior,
        litrosAbastecidos: body.litrosAbastecidos,
        valorPorLitro: body.valorPorLitro,
        horasTrabalhadad,
        consumoLporH,
        custoAbastecimento,
        consumoMedio,
        alertaConsumo,
        observacao: body.observacao,
      },
      include: { maquina: true },
    })

    // Atualizar horímetro da máquina
    const maquinaAtual = await prisma.maquina.findUnique({ where: { id: body.maquinaId } })
    if (maquinaAtual && body.horimetroAtual > (maquinaAtual.ultimoHorimetro || 0)) {
      await prisma.maquina.update({
        where: { id: body.maquinaId },
        data: { ultimoHorimetro: body.horimetroAtual },
      })
    }

    return NextResponse.json(
      { success: true, data: abastecimento, message: 'Abastecimento registrado' },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/abastecimentos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
