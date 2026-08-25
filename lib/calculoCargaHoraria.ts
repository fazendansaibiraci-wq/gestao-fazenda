// Calcula a carga horária prevista para um dia específico.
//
// A partir de 24/08/2026: a jornada individual cadastrada por funcionário
// (Segunda a Sexta / Sábado / Domingo) só vale nos dias que caem dentro da
// Safra — é lá que cada funcionário tem sua própria carga horária. Fora da
// Safra (Entressafra), a carga horária passa a ser a mesma pra todo mundo:
// o número único cadastrado em Configurações Gerais
// (ConfiguracaoGlobal.cargaHorariaEntressafra), ignorando a jornada
// individual. Antes disso, a jornada individual era usada o ano inteiro,
// inclusive na Entressafra — o que pagava/descontava hora extra errado
// pra quem tinha jornada de Safra maior que a de Entressafra.
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
}

export function calcularCargaHorariaDia(
  dataRegistro: Date,
  funcionario: FuncionarioCargaHoraria | null | undefined,
  config: ConfigCargaHoraria | null | undefined,
  contextoFalta: boolean = false,
  estaNaSafra: boolean = false
): number {
  const diaSemana = dataRegistro.getUTCDay() // 0=Dom, 6=Sab
  const domingosPorMes = funcionario?.domingosPorMes ?? 2

  // Carga horária "normal" do dia, já resolvendo Safra (jornada
  // individual) vs Entressafra (número único global).
  const cargaPadraoDoDia = (): number => {
    if (!estaNaSafra) return config?.cargaHorariaEntressafra || 8
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
      return cargaPadraoDoDia()
    }
    // domingosPorMes entre 1 e 3: alternância informal, sem regra fixa
    if (contextoFalta) {
      // Não dá pra prever qual domingo é a vez do funcionário — nunca
      // gera expectativa de trabalho (e portanto nunca falta automática)
      // nesse caso.
      return 0
    }
    // Contexto de registro real: o registro já prova que era a vez dele.
    return cargaPadraoDoDia()
  }
  return cargaPadraoDoDia()
}
