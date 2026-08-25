// Calcula a carga horária prevista para um dia específico.
//
// Na Safra: jornada individual cadastrada por funcionário (Segunda a
// Sexta / Sábado / Domingo, em Cadastro de Funcionário → Jornada de
// Trabalho) — cada um tem a sua.
//
// Na Entressafra: mesma jornada pra todo mundo, cadastrada em
// Configurações Gerais, com um valor por dia da semana (Segunda a
// Quinta / Sexta / Sábado / Domingo) — não mais um número único igual
// em todos os dias. Sábado e Domingo não são trabalhados por padrão
// (ficam zerados a menos que explicitamente configurados).
//
// A ambiguidade de domingo (domingosPorMes) só existe na Safra — na
// Entressafra o fim de semana é sempre folga, sem exceção:
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
// registros de atividade, no recálculo de carga contratual, no atestado
// médico, no Resumo Mensal e pelo cron de alerta de ausência.

interface FuncionarioCargaHoraria {
  cargaHorariaSegSex?: number | null
  cargaHorariaSabado?: number | null
  cargaHorariaDomingo?: number | null
  domingosPorMes?: number | null
}

interface ConfigCargaHoraria {
  cargaHorariaEntressafra?: number | null
  cargaHorariaEntressafraSegQui?: number | null
  cargaHorariaEntressafraSexta?: number | null
  cargaHorariaEntressafraSabado?: number | null
  cargaHorariaEntressafraDomingo?: number | null
}

export function calcularCargaHorariaDia(
  dataRegistro: Date,
  funcionario: FuncionarioCargaHoraria | null | undefined,
  config: ConfigCargaHoraria | null | undefined,
  contextoFalta: boolean = false,
  estaNaSafra: boolean = false
): number {
  const diaSemana = dataRegistro.getUTCDay() // 0=Dom, 1=Seg...4=Qui, 5=Sex, 6=Sab

  if (!estaNaSafra) {
    // Entressafra: mesma jornada pra todo mundo, fixa por dia da semana.
    // Sábado e Domingo não são trabalhados (0 por padrão, a menos que
    // explicitamente configurados em Configurações Gerais).
    if (diaSemana === 0) return config?.cargaHorariaEntressafraDomingo ?? 0
    if (diaSemana === 6) return config?.cargaHorariaEntressafraSabado ?? 0
    if (diaSemana === 5) return config?.cargaHorariaEntressafraSexta ?? (config?.cargaHorariaEntressafra || 8)
    return config?.cargaHorariaEntressafraSegQui ?? (config?.cargaHorariaEntressafra || 8)
  }

  // Safra: jornada individual do funcionário.
  const domingosPorMes = funcionario?.domingosPorMes ?? 2
  const cargaSafraDoDia = (): number => {
    if (diaSemana === 0) return funcionario?.cargaHorariaDomingo ?? (config?.cargaHorariaEntressafra || 8)
    if (diaSemana === 6) return funcionario?.cargaHorariaSabado ?? (config?.cargaHorariaEntressafra || 8)
    return funcionario?.cargaHorariaSegSex ?? (config?.cargaHorariaEntressafra || 8)
  }

  if (diaSemana === 0) {
    // Domingo
    if (domingosPorMes === 0) {
      return 0 // nunca trabalha domingo
    }
    if (domingosPorMes >= 4) {
      // trabalha todo domingo, sem ambiguidade
      return cargaSafraDoDia()
    }
    // domingosPorMes entre 1 e 3: alternância informal, sem regra fixa
    if (contextoFalta) {
      // Não dá pra prever qual domingo é a vez do funcionário — nunca
      // gera expectativa de trabalho (e portanto nunca falta automática)
      // nesse caso.
      return 0
    }
    // Contexto de registro real: o registro já prova que era a vez dele.
    return cargaSafraDoDia()
  }
  return cargaSafraDoDia()
}
