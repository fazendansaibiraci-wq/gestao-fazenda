// Calcula qual número de domingo é este no mês (1º, 2º, 3º ou 4º)
function getNumeroDomingoNoMes(data: Date): number {
  const dia = data.getUTCDate()
  return Math.ceil(dia / 7)
}

interface FuncionarioCargaHoraria {
  cargaHorariaSegSex?: number | null
  cargaHorariaSabado?: number | null
  cargaHorariaDomingo?: number | null
  domingosPorMes?: number | null
}

interface ConfigCargaHoraria {
  cargaHorariaEntressafra?: number | null
}

/**
 * Calcula a carga horária prevista para um dia específico, com base no dia da semana
 * do registro. Para domingos, verifica se aquele domingo específico é dia de trabalho
 * de acordo com funcionario.domingosPorMes (1º e 3º domingo quando domingosPorMes === 2,
 * os primeiros N domingos quando for 1 ou 3, todos quando >= 4, nenhum quando 0).
 *
 * Esta função é usada tanto na criação (POST) quanto na edição (PUT) de registros de
 * atividade, para que a carga horária prevista do dia seja sempre calculada da mesma
 * forma, independente de o funcionário estar em período de safra ou não.
 */
export function calcularCargaHorariaDia(
  dataRegistro: Date,
  funcionario: FuncionarioCargaHoraria | null | undefined,
  config: ConfigCargaHoraria | null | undefined
): number {
  const diaSemana = dataRegistro.getUTCDay() // 0=Dom, 6=Sab
  const domingosPorMes = funcionario?.domingosPorMes ?? 2

  if (diaSemana === 0) {
    // Domingo — verificar se este domingo é dia de trabalho
    const numeroDomingo = getNumeroDomingoNoMes(dataRegistro)
    let trabalhaEsteDomingo = false

    if (domingosPorMes === 0) {
      trabalhaEsteDomingo = false
    } else if (domingosPorMes >= 4) {
      trabalhaEsteDomingo = true
    } else if (domingosPorMes === 2) {
      // Trabalha no 1º e 3º domingo (alternado)
      trabalhaEsteDomingo = numeroDomingo === 1 || numeroDomingo === 3
    } else {
      // 1 ou 3 domingos: trabalha nos primeiros N
      trabalhaEsteDomingo = numeroDomingo <= domingosPorMes
    }

    return trabalhaEsteDomingo
      ? (funcionario?.cargaHorariaDomingo ?? (config?.cargaHorariaEntressafra || 8))
      : 0 // Domingo de folga: carga = 0, logo qualquer hora é extra
  } else if (diaSemana === 6) {
    return funcionario?.cargaHorariaSabado ?? (config?.cargaHorariaEntressafra || 8)
  } else {
    return funcionario?.cargaHorariaSegSex ?? (config?.cargaHorariaEntressafra || 8)
  }
}
