interface AbastecimentoParaCalculo {
  maquinaId: string
  data: Date | string
  horasTrabalhadad?: number | null
  litrosAbastecidos?: number | null
  custoAbastecimento?: number | null
  valorPorLitro?: number | null
  maquina?: { nome?: string } | null
}

interface RegistroMaquinaParaCalculo {
  maquinaId?: string | null
  data: Date | string
  horasMaquina?: number | null
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

  const registrosMaquinaFiltrados = registros.filter((r: any) => {
    if (!r.maquinaId) return false
    if (filtroDataInicio && new Date(r.data) < new Date(filtroDataInicio)) return false
    if (filtroDataFim && new Date(r.data) > new Date(filtroDataFim)) return false
    return true
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
    const horasRegistradasAtividades = registrosMaquinaFiltrados
      .filter((r: any) => r.maquinaId === maquinaId)
      .reduce((acc: number, r: any) => acc + (r.horasMaquina || 0), 0)

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
