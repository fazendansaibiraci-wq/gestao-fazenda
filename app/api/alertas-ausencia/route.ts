import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'

// O servidor (Vercel) roda em UTC, não no horário de Brasília. Usar
// new Date().getFullYear()/getMonth()/getDate() direto reflete o dia em UTC,
// que a partir de ~21h no horário do Brasil já virou o dia seguinte em UTC —
// fazendo o sistema tratar o dia atual (ainda em andamento no Brasil) como
// "ontem" e gerar falta automática indevida. Esta função obtém os componentes
// de data corretos no fuso America/Sao_Paulo, independente do fuso do servidor.
function obterDataHojeBrasil(): { ano: number; mes: number; dia: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [{ value: ano }, , { value: mes }, , { value: dia }] = formatter.formatToParts(new Date())
  return { ano: Number(ano), mes: Number(mes), dia: Number(dia) }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any)?.role
    const userId = (session.user as any)?.id

    const { searchParams } = new URL(request.url)
    const mesParam = searchParams.get('mes')

    const { ano: anoHojeBR, mes: mesHojeBR, dia: diaHojeBR } = obterDataHojeBrasil()

    let ano: number
    let mesNum: number
    if (mesParam) {
      const [anoStr, mesStr] = mesParam.split('-')
      ano = Number(anoStr)
      mesNum = Number(mesStr)
    } else {
      ano = anoHojeBR
      mesNum = mesHojeBR
    }

    // Intervalo a verificar: do dia 1 do mês até ontem, nunca incluindo hoje,
    // e sempre dentro dos limites do próprio mês informado.
    const inicioMes = new Date(ano, mesNum - 1, 1)
    const ultimoDiaMes = new Date(ano, mesNum, 0)
    const ontem = new Date(anoHojeBR, mesHojeBR - 1, diaHojeBR - 1)
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

    // Primeiro identifica os dias faltantes de cada funcionário (lógica já existente).
    const candidatosPorFuncionario: { func: (typeof funcionarios)[number]; diasFaltantes: string[] }[] = []

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
        candidatosPorFuncionario.push({ func, diasFaltantes })
      }
    }

    if (candidatosPorFuncionario.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Falta automática não tem talhão real (não é uma atividade feita em
    // algum lugar) — talhaoId fica null. Mantém só a safra pra contexto
    // temporal do registro.
    let safraAtual = null
    if (config?.inicioSafra && config?.fimSafra) {
      safraAtual = await prisma.safra.findFirst({
        where: {
          dataInicio: { lte: config.fimSafra },
          OR: [{ dataFim: null }, { dataFim: { gte: config.inicioSafra } }],
        },
      })
    }
    if (!safraAtual) {
      safraAtual = await prisma.safra.findFirst()
    }

    const resultado: { funcionarioId: string; nome: string; diasFaltantes: string[] }[] = []

    if (safraAtual) {
      for (const { func, diasFaltantes } of candidatosPorFuncionario) {
        const diasGerados: string[] = []

        for (const chave of diasFaltantes) {
          // Checagem extra, logo antes de criar, pra evitar duplicar a falta caso
          // essa API seja chamada mais de uma vez em sequência rápida (ex: efeito
          // duplo do React, ou o usuário atualizando a página várias vezes).
          const inicioDia = new Date(chave)
          const fimDia = new Date(chave)
          fimDia.setDate(fimDia.getDate() + 1)

          const jaExiste = await prisma.registroAtividade.findFirst({
            where: {
              funcionarioId: func.id,
              data: { gte: inicioDia, lt: fimDia },
            },
          })

          if (jaExiste) continue

          await prisma.registroAtividade.create({
            data: {
              funcionarioId: func.id,
              data: new Date(chave + 'T12:00:00.000Z'),
              isFalta: true,
              motivoFalta: 'nao_registrado',
              periodoFalta: 'DIA_INTEIRO',
              observacao: 'Falta gerada automaticamente por ausência de registro',
              status: 'CONCLUIDO',
              horaEntrada: '00:00',
              tipoAtividade: 'GERAIS',
              safraId: safraAtual.id,
            },
          })

          diasGerados.push(chave)
        }

        if (diasGerados.length > 0) {
          resultado.push({ funcionarioId: func.id, nome: func.name, diasFaltantes: diasGerados })
        }
      }
    } else {
      console.error('GET /api/alertas-ausencia: nenhum talhão ativo ou safra encontrada para gerar faltas automáticas')
    }

    return NextResponse.json({ success: true, data: resultado })
  } catch (error) {
    console.error('GET /api/alertas-ausencia:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
