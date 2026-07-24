import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const funcionarioId = session.user.id as string

    const dozeMesesAtras = new Date()
    dozeMesesAtras.setMonth(dozeMesesAtras.getMonth() - 11)
    dozeMesesAtras.setDate(1)
    dozeMesesAtras.setHours(0, 0, 0, 0)

    const registros = await prisma.registroAtividade.findMany({
      where: {
        funcionarioId,
        data: { gte: dozeMesesAtras },
      },
      select: {
        data: true,
        horasCalculadas: true,
        horasprevistasdia: true,
        isFalta: true,
        ehHoraExtra: true,
        tipoAtividade: true,
        talhao: { select: { nome: true } },
      },
      orderBy: { data: 'asc' },
    })

    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const mesesMap = new Map<string, { mes: number; ano: number; diasTrabalhados: number; horasTrabalhadas: number; horasExtras: number; faltas: number }>()
    for (let i = 0; i < 12; i++) {
      const d = new Date(dozeMesesAtras)
      d.setMonth(d.getMonth() + i)
      const chave = `${d.getFullYear()}-${d.getMonth()}`
      mesesMap.set(chave, { mes: d.getMonth(), ano: d.getFullYear(), diasTrabalhados: 0, horasTrabalhadas: 0, horasExtras: 0, faltas: 0 })
    }

    const porAtividadeMap = new Map<string, { dias: number; horas: number }>()
    const porTalhaoMap = new Map<string, { dias: number; horas: number }>()

    for (const r of registros) {
      const d = new Date(r.data)
      const chave = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
      const mesEntry = mesesMap.get(chave)

      if (r.isFalta) {
        if (mesEntry) mesEntry.faltas++
        continue
      }

      const horas = r.horasCalculadas || 0
      if (mesEntry) {
        mesEntry.diasTrabalhados++
        mesEntry.horasTrabalhadas += horas
        if (r.ehHoraExtra && r.horasprevistasdia != null) {
          mesEntry.horasExtras += Math.max(0, horas - r.horasprevistasdia)
        }
      }

      if (r.tipoAtividade) {
        const entry = porAtividadeMap.get(r.tipoAtividade) || { dias: 0, horas: 0 }
        entry.dias++
        entry.horas += horas
        porAtividadeMap.set(r.tipoAtividade, entry)
      }

      if (r.talhao?.nome) {
        const entry = porTalhaoMap.get(r.talhao.nome) || { dias: 0, horas: 0 }
        entry.dias++
        entry.horas += horas
        porTalhaoMap.set(r.talhao.nome, entry)
      }
    }

    const historicoMensal = Array.from(mesesMap.values()).map((m) => ({
      label: `${nomesMeses[m.mes]}/${String(m.ano).slice(2)}`,
      diasTrabalhados: m.diasTrabalhados,
      horasTrabalhadas: Math.round(m.horasTrabalhadas * 10) / 10,
      horasExtras: Math.round(m.horasExtras * 10) / 10,
      faltas: m.faltas,
    }))

    const porAtividade = Array.from(porAtividadeMap.entries())
      .map(([tipoAtividade, v]) => ({ tipoAtividade, dias: v.dias, horas: Math.round(v.horas * 10) / 10 }))
      .sort((a, b) => b.horas - a.horas)

    const porTalhao = Array.from(porTalhaoMap.entries())
      .map(([talhao, v]) => ({ talhao, dias: v.dias, horas: Math.round(v.horas * 10) / 10 }))
      .sort((a, b) => b.horas - a.horas)

    return NextResponse.json({ success: true, data: { historicoMensal, porAtividade, porTalhao } })
  } catch (error) {
    console.error('GET /api/relatorio-funcionario:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
