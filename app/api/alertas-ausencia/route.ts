import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any)?.role
    const userId = (session.user as any)?.id

    const { searchParams } = new URL(request.url)
    const mesParam = searchParams.get('mes')

    const agora = new Date()
    let ano: number
    let mesNum: number
    if (mesParam) {
      const [anoStr, mesStr] = mesParam.split('-')
      ano = Number(anoStr)
      mesNum = Number(mesStr)
    } else {
      ano = agora.getFullYear()
      mesNum = agora.getMonth() + 1
    }

    // Intervalo a verificar: do dia 1 do mês até ontem, nunca incluindo hoje,
    // e sempre dentro dos limites do próprio mês informado.
    const inicioMes = new Date(ano, mesNum - 1, 1)
    const ultimoDiaMes = new Date(ano, mesNum, 0)
    const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1)
    const fimIntervalo = ontem < ultimoDiaMes ? ontem : ultimoDiaMes

    if (fimIntervalo < inicioMes) {
      // Mês futuro (ou hoje é dia 1 do mês corrente): não há dias passados a checar ainda.
      return NextResponse.json({ success: true, data: [] })
    }

    const config = await prisma.configuracaoGlobal.findFirst()

    const whereUser: any = { active: true }
    if (userRole === 'FUNCIONARIO') {
      whereUser.id = userId
    } else {
      whereUser.role = 'FUNCIONARIO'
    }

    const funcionarios = await prisma.user.findMany({
      where: whereUser,
      select: {
        id: true,
        name: true,
        cargaHorariaSegSex: true,
        cargaHorariaSabado: true,
        cargaHorariaDomingo: true,
        domingosPorMes: true,
      },
    })

    if (funcionarios.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const funcionarioIds = funcionarios.map((f) => f.id)

    // Limite exclusivo (registros são gravados ao meio-dia UTC do próprio dia,
    // então o fim do intervalo precisa incluir o dia inteiro de fimIntervalo).
    const limiteExclusivo = new Date(fimIntervalo)
    limiteExclusivo.setDate(limiteExclusivo.getDate() + 1)

    const registros = await prisma.registroAtividade.findMany({
      where: {
        funcionarioId: { in: funcionarioIds },
        data: { gte: inicioMes, lt: limiteExclusivo },
      },
      select: { funcionarioId: true, data: true },
    })

    const registrosPorFuncionario = new Map<string, Set<string>>()
    for (const reg of registros) {
      const chave = reg.data.toISOString().split('T')[0]
      if (!registrosPorFuncionario.has(reg.funcionarioId)) {
        registrosPorFuncionario.set(reg.funcionarioId, new Set())
      }
      registrosPorFuncionario.get(reg.funcionarioId)!.add(chave)
    }

    const ultimoDia = fimIntervalo.getDate()
    const resultado: { funcionarioId: string; nome: string; diasFaltantes: string[] }[] = []

    for (const func of funcionarios) {
      const datasRegistradas = registrosPorFuncionario.get(func.id) || new Set<string>()
      const diasFaltantes: string[] = []

      for (let dia = 1; dia <= ultimoDia; dia++) {
        const dataDia = new Date(ano, mesNum - 1, dia)
        const cargaDia = calcularCargaHorariaDia(dataDia, func, config)

        if (cargaDia > 0) {
          const chave = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          if (!datasRegistradas.has(chave)) {
            diasFaltantes.push(chave)
          }
        }
      }

      if (diasFaltantes.length > 0) {
        resultado.push({ funcionarioId: func.id, nome: func.name, diasFaltantes })
      }
    }

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error('GET /api/alertas-ausencia:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
