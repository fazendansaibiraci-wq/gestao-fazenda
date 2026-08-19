// Constantes compartilhadas da feature "Horas Não Identificadas" (ajuste de
// Registro de Atividade pra fechar buracos de horímetro entre abastecimento
// e atividades). NÃO confundir com o model/tela "Ajuste de Horímetro"
// (AjusteHorimetro / components/AjustarHorimetro.tsx), que é outra coisa —
// corrige Maquina.ultimoHorimetro direto.

// Valor fixo de tipoAtividade pra esses registros — não vem do cadastro de
// Tipos de Atividade (que continua livre/cadastrável pra atividades normais).
export const TIPO_ATIVIDADE_AJUSTE_HORIMETRO = 'AJUSTE_HORIMETRO'

// Email do usuário placeholder "Não Identificado" (criado via
// scripts/seed-usuario-nao-identificado.ts), usado como funcionarioId padrão
// nesses lançamentos quando não se sabe quem operou a máquina.
export const NAO_IDENTIFICADO_EMAIL = 'nao-identificado@sistema.local'
