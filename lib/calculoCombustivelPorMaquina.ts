interface AbastecimentoParaCalculo {
  maquinaId: string
  data: Date | string
  horasTrabalhadad?: number | null
  litrosAbastecidos?: number | null
  custoAbastecimento?: number | null
  valorPorLitro?: number | null
  maquina?: { nome?: string } | null
}

interface MaquinaAdicionalParaCalculo {
  maquinaId?: string | null
  horasMaquina?: number | null
  horimetroInicial?: number | null
  horimetroFinal?: number | null
}

interface RegistroMaquinaParaCalculo {
  maquinaId?: string | null
  data: Date | string
  horasMaquina?: number | null
  horimetroInicial?: number | null
  horimetroFinal?: number | null
  // Máquinas extras do mesmo registro (troca de máquina no mesmo dia/
  // atividade — RegistroAtividadeMaquina). Cada uma entra na conferência
  // cruzada da SUA PRÓPRIA máquina, não da máquina principal do registro.
  // Não têm data própria: herdam a data do registro pai pro filtro.
  maquinasAdicionais?: MaquinaAdicionalParaCalculo[] | null
}

export interface ResumoCombustivelMaquina {
  maquinaId: string
  nomeMaquina: string
  totalHoras: number
  totalLitros: number
  custoTotal: number
  consumoMedioLH: number
  horasRegistradasAtividades: number
  divergente: boolean
}

/**
 * Agrupa abastecimentos por máquina e calcula o consumo médio (L/h) e demais
 * totais, com uma checagem cruzada opcional contra as horas de máquina
 * registradas nas atividades (`registros`). Aceita um filtro de data opcional
 * (aplicado tanto aos abastecimentos quanto aos registros de atividade).
 *
 * Extraído de app/modules/relatorios/page.tsx (getResumoCombustivelPorMaquina)
 * para ser reaproveitado também pelo dashboard, mantendo o comportamento
 * idêntico ao do relatório de Combustível.
 */
export function calcularCombustivelPorMaquina(
  abastecimentos: AbastecimentoParaCalculo[],
  registros: RegistroMaquinaParaCalculo[] = [],
  filtroDataInicio?: string,
  filtroDataFim?: string
): ResumoCombustivelMaquina[] {
  const abastecimentosFiltrados = abastecimentos.filter((a: any) => {
    if (filtroDataInicio && new Date(a.data) < new Date(filtroDataInicio)) return false
    if (filtroDataFim && new Date(a.data) > new Date(filtroDataFim)) return false
    return true
  })

  const registrosMaquinaFiltrados: MaquinaAdicionalParaCalculo[] = []
  registros.forEach((r: any) => {
    if (filtroDataInicio && new Date(r.data) < new Date(filtroDataInicio)) return
    if (filtroDataFim && new Date(r.data) > new Date(filtroDataFim)) return
    if (r.maquinaId) {
      registrosMaquinaFiltrados.push({
        maquinaId: r.maquinaId,
        horasMaquina: r.horasMaquina,
        horimetroInicial: r.horimetroInicial,
        horimetroFinal: r.horimetroFinal,
      })
    }
    ;(r.maquinasAdicionais || []).forEach((m: any) => {
      if (!m.maquinaId) return
      registrosMaquinaFiltrados.push({
        maquinaId: m.maquinaId,
        horasMaquina: m.horasMaquina,
        horimetroInicial: m.horimetroInicial,
        horimetroFinal: m.horimetroFinal,
      })
    })
  })

  const gruposPorMaquina: Record<string, any[]> = {}
  abastecimentosFiltrados.forEach((a: any) => {
    if (!gruposPorMaquina[a.maquinaId]) gruposPorMaquina[a.maquinaId] = []
    gruposPorMaquina[a.maquinaId].push(a)
  })

  const resumo = Object.entries(gruposPorMaquina).map(([maquinaId, abs]: any) => {
    const nomeMaquina = abs[0]?.maquina?.nome || maquinaId
    const totalHoras = abs.reduce((acc: number, a: any) => acc + (a.horasTrabalhadad || 0), 0)
    const totalLitros = abs.reduce((acc: number, a: any) => acc + (a.litrosAbastecidos || 0), 0)
    const custoTotal = abs.reduce(
      (acc: number, a: any) => acc + (a.custoAbastecimento ?? (a.litrosAbastecidos || 0) * (a.valorPorLitro || 0)),
      0
    )
    const consumoMedioLH = totalHoras > 0 ? totalLitros / totalHoras : 0
    // Mesmo "plano B" usado na reconciliação por intervalo (Registro de
    // Atividades): se horasMaquina não foi preenchido no registro, cai pro
    // cálculo via horímetro (final - inicial). Sem isso, registros sem
    // horasMaquina populado eram contados como 0h aqui, mesmo tendo
    // horímetro completo — subestimando o total e gerando falso positivo
    // de divergência mesmo quando os intervalos já estavam corretos.
    const horasRegistradasAtividades = registrosMaquinaFiltrados
      .filter((r: any) => r.maquinaId === maquinaId)
      .reduce((acc: number, r: any) => {
        if (r.horasMaquina != null) return acc + r.horasMaquina
        if (r.horimetroFinal != null && r.horimetroInicial != null) return acc + (r.horimetroFinal - r.horimetroInicial)
        return acc
      }, 0)

    // Divergência entre o horímetro (totalHoras) e as horas registradas nas
    // atividades, em qualquer direção, usada como conferência cruzada.
    const base = totalHoras > 0 ? totalHoras : horasRegistradasAtividades
    const divergente = base > 0 && Math.abs(totalHoras - horasRegistradasAtividades) / base > 0.2

    return {
      maquinaId,
      nomeMaquina,
      totalHoras,
      totalLitros,
      custoTotal,
      consumoMedioLH,
      horasRegistradasAtividades,
      divergente,
    }
  })

  resumo.sort((a, b) => b.consumoMedioLH - a.consumoMedioLH)

  return resumo
}
