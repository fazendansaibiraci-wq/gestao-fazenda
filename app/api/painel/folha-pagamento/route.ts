import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR ou GERENTE
    if (session.user?.role !== 'GESTOR' && session.user?.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7)

    const [ano, mesNum] = mes.split('-').map(Number)
    const mesStart = startOfMonth(new Date(ano, mesNum - 1))
    const mesEnd = endOfMonth(new Date(ano, mesNum - 1))
    const diasUteisDoMes = getDaysInMonth(new Date(ano, mesNum - 1))

    // Buscar todos os funcionários ativos
    const funcionarios = await prisma.user.findMany({
      where: {
        role: 'FUNCIONARIO',
        active: true,
        tipoSalario: { not: null },
      },
    })

    // Verificar se há horas extras pendentes no período
    const horasExtrasPendentes = await prisma.aProvaçãoHoraExtra.count({
      where: {
        status: 'pendente',
        criadoEm: {
          gte: mesStart,
          lte: mesEnd,
        },
      },
    })

    const aviso = horasExtrasPendentes > 0
      ? `Existem ${horasExtrasPendentes} horas extras pendentes de aprovação. Aprove-as antes de exportar.`
      : null

    // Calcular dados de cada funcionário
    const folha = await Promise.all(
      funcionarios.map(async (func) => {
        // 1. Dias trabalhados (contar registros de atividade)
        const registrosAtividade = await prisma.registroAtividade.count({
          where: {
            funcionarioId: func.id,
            data: {
              gte: mesStart,
              lte: mesEnd,
            },
          },
        })

        // 2. Salário base (calculado)
        let salarioBase = 0
        if (func.tipoSalario === 'MENSAL' && func.salarioEntressafra) {
          // Salário mensal: (valor ÷ horas úteis) × dias trabalhados
          const horasDiaUtil = 8
          const horasUteisDoMes = diasUteisDoMes * horasDiaUtil
          const valorHora = func.salarioEntressafra / horasUteisDoMes
          salarioBase = valorHora * horasDiaUtil * registrosAtividade
        } else if (func.tipoSalario === 'DIARIO' && func.salarioEntressafra) {
          // Salário diário: valor/dia × dias trabalhados
          salarioBase = func.salarioEntressafra * registrosAtividade
        }

        // 3. Horas extras aprovadas
        const horasExtrasAp = await prisma.aProvaçãoHoraExtra.aggregate({
          where: {
            funcionarioId: func.id,
            status: 'aprovado',
            aprovadoEm: {
              gte: mesStart,
              lte: mesEnd,
            },
          },
          _sum: { horasExtras: true },
        })

        const horasExtrasValue = (horasExtrasAp._sum.horasExtras || 0) *
          (func.valorHoraExtraEntressafra || 0)

        // 4. Vales do mês
        const vales = await prisma.vale.aggregate({
          where: {
            usuarioId: func.id,
            mesPagamento: mes,
            status: { in: ['PENDENTE', 'DESCONTADO'] },
          },
          _sum: { valor: true },
        })

        // 5. Descontos (banco de horas negativo)
        const banco = await prisma.bancoHoras.findUnique({
          where: {
            funcionarioId: func.id,
          },
        })

        const horasNegativas = Math.max(0, -(banco?.saldoHoras || 0))
        const desconto = horasNegativas * ((func.salarioEntressafra || 0) / (diasUteisDoMes * 8))

        const liquido = salarioBase + horasExtrasValue - (vales._sum.valor || 0) - desconto

        return {
          id: func.id,
          nome: func.name,
          diasTrabalhados: registrosAtividade,
          salarioBase,
          horasExtras: horasExtrasValue,
          vales: vales._sum.valor || 0,
          descontos: desconto,
          liquido,
          bancoHoras: banco?.saldoHoras || 0,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        funcionarios: folha,
        aviso,
        mes,
        periodo: `${mesStart.toLocaleDateString('pt-BR')} a ${mesEnd.toLocaleDateString('pt-BR')}`,
      },
    })
  } catch (error) {
    console.error('GET /api/painel/folha-pagamento:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
