import { prisma } from './prisma'

// Máquinas adicionais usadas na mesma atividade/dia (ver comentário no
// model RegistroAtividadeMaquina, schema.prisma) — pra quando o
// funcionário troca de máquina durante o dia. Etapa 1 (27/08/2026): só
// cadastro, com a mesma validação de sequência de horímetro que a
// máquina principal já tinha. Os cálculos de combustível/custo por
// hora-máquina/painéis ainda NÃO somam essas máquinas extras.

export interface MaquinaAdicionalInput {
  maquinaId: string
  horimetroInicial: number
  horimetroFinal: number
  implementoUtilizado?: string | null
}

// Checagens básicas de horímetro (iguais às já usadas pra máquina
// principal): final > inicial, diferença de até 24h por registro.
export function validarHorimetroBasico(horimetroInicial: number, horimetroFinal: number): string | null {
  if (horimetroFinal <= horimetroInicial) return 'Horímetro final deve ser maior que inicial'
  if (horimetroFinal - horimetroInicial > 24) return 'Diferença de horímetro inválida: máximo de 24h por registro'
  return null
}

// Último horímetro conhecido de uma máquina, considerando tanto
// RegistroAtividade.maquinaId (máquina principal, de qualquer registro)
// quanto RegistroAtividadeMaquina.maquinaId (máquina adicional, de
// qualquer registro) — pra não deixar cadastrar um horímetro menor que
// algo já registrado em nenhuma das duas formas. Abastecimento não entra
// nessa conta (é uma leitura separada, mesma regra de sempre).
// `excluirRegistroId` evita comparar um registro sendo editado contra
// ele mesmo.
export async function buscarUltimoHorimetroConhecido(
  maquinaId: string,
  excluirRegistroId?: string
): Promise<number> {
  const [ultimaPrincipal, ultimaAdicional] = await Promise.all([
    prisma.registroAtividade.findFirst({
      where: {
        maquinaId,
        horimetroFinal: { not: null },
        ...(excluirRegistroId ? { id: { not: excluirRegistroId } } : {}),
      },
      orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
      select: { horimetroFinal: true },
    }),
    prisma.registroAtividadeMaquina.findFirst({
      where: {
        maquinaId,
        ...(excluirRegistroId ? { registroAtividadeId: { not: excluirRegistroId } } : {}),
      },
      orderBy: [{ registroAtividade: { data: 'desc' } }, { dataCriacao: 'desc' }],
      select: { horimetroFinal: true },
    }),
  ])
  return Math.max(ultimaPrincipal?.horimetroFinal || 0, ultimaAdicional?.horimetroFinal || 0)
}

// Valida uma lista de máquinas adicionais: cada uma passa pelas mesmas
// regras da máquina principal (final>inicial, diff<=24h, e — fora do modo
// de ajuste de horímetro — não pode retroceder em relação ao último
// horímetro conhecido dessa máquina). Retorna a primeira mensagem de erro
// encontrada, ou null se tudo válido.
export async function validarMaquinasAdicionais(
  maquinasAdicionais: MaquinaAdicionalInput[],
  isAjusteHorimetro: boolean,
  excluirRegistroId?: string
): Promise<string | null> {
  for (const m of maquinasAdicionais) {
    if (!m.maquinaId || m.horimetroInicial == null || m.horimetroFinal == null) {
      return 'Cada máquina adicional precisa de máquina, horímetro inicial e final preenchidos'
    }
    const erroBasico = validarHorimetroBasico(m.horimetroInicial, m.horimetroFinal)
    if (erroBasico) return erroBasico

    if (!isAjusteHorimetro) {
      const ultimoConhecido = await buscarUltimoHorimetroConhecido(m.maquinaId, excluirRegistroId)
      if (m.horimetroInicial < ultimoConhecido) {
        return `Horímetro inicial (${m.horimetroInicial}h) de uma das máquinas adicionais não pode ser menor que o último horímetro conhecido dessa máquina (${ultimoConhecido}h). Verifique o valor digitado.`
      }
    }
  }
  return null
}

// Atualiza Maquina.ultimoHorimetro pra cada máquina adicional recém-salva
// (mesma regra "só se for maior" já usada pra máquina principal).
export async function atualizarUltimoHorimetroMaquinasAdicionais(
  maquinasAdicionais: MaquinaAdicionalInput[]
): Promise<void> {
  for (const m of maquinasAdicionais) {
    const maquinaAtual = await prisma.maquina.findUnique({ where: { id: m.maquinaId } })
    if (maquinaAtual && m.horimetroFinal > (maquinaAtual.ultimoHorimetro || 0)) {
      await prisma.maquina.update({
        where: { id: m.maquinaId },
        data: { ultimoHorimetro: m.horimetroFinal },
      })
    }
  }
}
