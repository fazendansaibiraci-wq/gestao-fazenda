import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcularCargaHorariaDia } from '@/lib/calculoCargaHoraria'

// Recalcula "horasprevistasdia" (carga contratual) e, em cascata,
// horasExtras/horasDevidas/ehHoraExtra de Registros de Atividade já
// lançados — pra quando o cadastro do funcionário muda (ex: carga horária
// segunda-a-sexta) DEPOIS que alguns dias já foram lançados. Esses campos
// são gravados como uma "fotografia" na hora da criação (não recalculados
// automaticamente), então precisam ser atualizados manualmente com essa
// rota quando o gestor quiser que dias já lançados reflitam o cadastro
// atual.
//
// NÃO mexe em horasCalculadas (horas realmente trabalhadas, vindas de
// Entrada/Saída) — só no que depende da carga contratual esperada.
// NÃO mexe em registros de Falta ou Ajuste de Horímetro (essa lógica de
// extras/devidas nem se aplica a eles).
//
// Sempre roda em modo "dryRun" (só relatório, sem gravar nada) a menos que
// o body explicitamente mande `confirmar: true` — pensado pra UI sempre
// mostrar uma prévia antes de aplicar de verdade.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { funcionarioId, dataInicio, dataFim, confirmar } = body

    if (!dataInicio || !dataFim) {
      return NextResponse.json({ error: 'Informe dataInicio e dataFim' }, { status: 400 })
    }

    const inicio = new Date(dataInicio + 'T00:00:00')
    const fim = new Date(dataFim + 'T23:59:59')

    const [registros, config] = await Promise.all([
      prisma.registroAtividade.findMany({
        where: {
          ...(funcionarioId ? { funcionarioId } : {}),
          data: { gte: inicio, lte: fim },
          isFalta: false,
          isAjusteHorimetro: false,
          horasCalculadas: { not: null },
        },
        include: {
          funcionario: {
            select: {
              id: true,
              name: true,
              cargaHorariaSegSex: true,
              cargaHorariaSabado: true,
              cargaHorariaDomingo: true,
              domingosPorMes: true,
              valorHoraExtraSafra: true,
              valorHoraExtraEntressafra: true,
            },
          },
        },
        orderBy: { data: 'asc' },
      }),
      prisma.configuracaoGlobal.findFirst(),
    ])

    const safraAtiva = await prisma.safra.findFirst({
      where: { status: 'ATIVA' },
      orderBy: { dataInicio: 'desc' },
    })

    const mudancas: {
      id: string
      data: string
      funcionarioNome: string
      cargaAntes: number
      cargaDepois: number
      extrasAntes: number
      extrasDepois: number
      devidasAntes: number
      devidasDepois: number
    }[] = []

    for (const reg of registros) {
      const dataRegistro = new Date(reg.data)
      const cargaHorariaDia = calcularCargaHorariaDia(dataRegistro, reg.funcionario, config)
      const cargaAntes = reg.horasprevistasdia ?? (config?.cargaHorariaEntressafra || 8)

      if (Math.abs(cargaHorariaDia - cargaAntes) < 0.01) continue // sem mudança real

      const horasCalculadas = reg.horasCalculadas ?? 0
      // "Antes": horasExtras/horasDevidas nunca ficam salvos como campo —
      // são sempre derivados (horasCalculadas vs carga contratual), igual
      // faz o resto do app. Recalcula o "antes" aqui do mesmo jeito, só que
      // usando a carga contratual ANTIGA (a que já estava salva).
      let extrasAntes = 0
      let devidasAntes = 0
      if (horasCalculadas > cargaAntes) {
        extrasAntes = horasCalculadas - cargaAntes
      } else if (horasCalculadas < cargaAntes) {
        devidasAntes = cargaAntes - horasCalculadas
      }

      let horasExtras = 0
      let horasDevidas = 0
      let ehHoraExtra = false
      if (horasCalculadas > cargaHorariaDia) {
        horasExtras = horasCalculadas - cargaHorariaDia
        ehHoraExtra = true
      } else if (horasCalculadas < cargaHorariaDia) {
        horasDevidas = cargaHorariaDia - horasCalculadas
      }

      mudancas.push({
        id: reg.id,
        data: reg.data.toISOString().split('T')[0],
        funcionarioNome: reg.funcionario.name,
        cargaAntes: Math.round(cargaAntes * 100) / 100,
        cargaDepois: Math.round(cargaHorariaDia * 100) / 100,
        extrasAntes: Math.round(extrasAntes * 100) / 100,
        extrasDepois: Math.round(horasExtras * 100) / 100,
        devidasAntes: Math.round(devidasAntes * 100) / 100,
        devidasDepois: Math.round(horasDevidas * 100) / 100,
      })

      if (confirmar) {
        await prisma.registroAtividade.update({
          where: { id: reg.id },
          data: {
            horasprevistasdia: cargaHorariaDia,
            ehHoraExtra,
            // Mesma regra usada no POST/PUT normal ao criar/editar um
            // registro — mantém consistência com o resto do app.
            statusAprovacao: ehHoraExtra ? 'pendente' : 'aprovado',
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      confirmado: !!confirmar,
      totalAnalisados: registros.length,
      totalAlterados: mudancas.length,
      mudancas: mudancas.slice(0, 50), // preview: até 50 linhas de exemplo
      mudancasOmitidas: Math.max(0, mudancas.length - 50),
    })
  } catch (error: any) {
    console.error('Erro ao recalcular carga contratual:', error)
    return NextResponse.json({ error: 'Erro ao recalcular carga contratual' }, { status: 500 })
  }
}
