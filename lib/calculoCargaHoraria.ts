// Calcula a carga horária prevista para um dia específico, com base no dia
// da semana do registro.
//
// Domingo é especial: quando domingosPorMes está entre 1 e 3, não existe
// regra fixa de qual domingo é de trabalho — os funcionários combinam
// informalmente entre eles. Por isso:
// - No contexto de um Registro de Atividade real (contextoFalta=false, o
//   padrão): o próprio registro já é prova de que era a vez do
//   funcionário, então sempre retorna a carga prevista de domingo.
// - No contexto do cron de falta automática (contextoFalta=true): como
//   não dá pra prever qual domingo é de quem, nunca gera expectativa de
//   trabalho (e portanto nunca falta automática) num domingo quando
//   domingosPorMes está entre 1 e 3. Só considera domingo "esperado" se
//   domingosPorMes for 0 (nunca) ou >=4 (sempre) — os dois únicos casos
//   sem ambiguidade.
//
// Esta função é usada tanto na criação (POST) quanto na edição (PUT) de
// registros de atividade, e também pelo cron de alerta de ausência.

interface FuncionarioCargaHoraria {
  cargaHorariaSegSex?: number | null
  cargaHorariaSabado?: number | null
  cargaHorariaDomingo?: number | null
  domingosPorMes?: number | null
}

interface ConfigCargaHoraria {
  cargaHorariaEntressafra?: number | null
}

export function calcularCargaHorariaDia(
  dataRegistro: Date,
  funcionario: FuncionarioCargaHoraria | null | undefined,
  config: ConfigCargaHoraria | null | undefined,
  contextoFalta: boolean = false
): number {
  const diaSemana = dataRegistro.getUTCDay() // 0=Dom, 6=Sab
  const domingosPorMes = funcionario?.domingosPorMes ?? 2

  if (diaSemana === 0) {
    // Domingo
    if (domingosPorMes === 0) {
      return 0 // nunca trabalha domingo
    }
    if (domingosPorMes >= 4) {
      // trabalha todo domingo, sem ambiguidade
      return funcionario?.cargaHorariaDomingo ?? (config?.cargaHorariaEntressafra || 8)
    }
    // domingosPorMes entre 1 e 3: alternância informal, sem regra fixa
    if (contextoFalta) {
      // Não dá pra prever qual domingo é a vez do funcionário — nunca
      // gera expectativa de trabalho (e portanto nunca falta automática)
      // nesse caso.
      return 0
    }
    // Contexto de registro real: o registro já prova que era a vez dele.
    return funcionario?.cargaHorariaDomingo ?? (config?.cargaHorariaEntressafra || 8)
  } else if (diaSemana === 6) {
    return funcionario?.cargaHorariaSabado ?? (config?.cargaHorariaEntressafra || 8)
  } else {
    return funcionario?.cargaHorariaSegSex ?? (config?.cargaHorariaEntressafra || 8)
  }
}
