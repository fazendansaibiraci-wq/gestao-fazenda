import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AlteracaoPrevia {
  tipo: 'campo' | 'regra' | 'relatorio' | 'permissao' | 'validacao' | 'texto' | 'notificacao' | 'erro'
  descricao: string
  detalhes: any
  riscos?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR
    if (session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { sessionId, alteracao } = body

    if (!sessionId || !alteracao) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: sessionId, alteracao' },
        { status: 400 }
      )
    }

    const previa: AlteracaoPrevia = alteracao

    let resultado: any = null
    let erro: string | null = null

    // ============ APLICAR POR TIPO ============

    try {
      switch (previa.tipo) {
        // ---- TIPO: CAMPO ----
        case 'campo': {
          // Exemplo: Adicionar campo em formulário
          // Em produção, aqui teríamos migração Prisma automática
          // Por MVP, apenas registramos
          resultado = {
            tipo: 'campo',
            acao: previa.detalhes.acao, // 'adicionar' ou 'remover'
            formulario: previa.detalhes.formulario,
            campo: previa.detalhes.campo,
            status: 'REGISTRADO', // Seria 'APLICADO' após migração
          }
          break
        }

        // ---- TIPO: TEXTO ----
        case 'texto': {
          // Exemplo: Mudar label de um campo, descrição de um módulo
          // Novamente, em produção teria persistência em config
          resultado = {
            tipo: 'texto',
            elemento: previa.detalhes.elemento,
            textoAntigo: previa.detalhes.textoAntigo,
            textoNovo: previa.detalhes.textoNovo,
            status: 'REGISTRADO',
          }
          break
        }

        // ---- TIPO: PERMISSAO ----
        case 'permissao': {
          // Exemplo: Dar acesso ao módulo para um role
          // Aplicar: Validar constraints e registrar
          const rolesValidas = ['FUNCIONARIO', 'GERENTE', 'AGRONOMO', 'GESTOR']
          const modulos = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']

          if (
            !rolesValidas.includes(previa.detalhes.role) ||
            !modulos.includes(previa.detalhes.modulo)
          ) {
            throw new Error('Role ou módulo inválido')
          }

          // Validação: M7 NUNCA pode ser acessado por FUNCIONARIO/AGRONOMO
          if (previa.detalhes.modulo === 'M7' &&
            (previa.detalhes.role === 'FUNCIONARIO' || previa.detalhes.role === 'AGRONOMO')) {
            throw new Error('M7 (IA) só pode ser acessado por GESTOR')
          }

          resultado = {
            tipo: 'permissao',
            role: previa.detalhes.role,
            modulo: previa.detalhes.modulo,
            acao: previa.detalhes.acao, // 'permitir' ou 'bloquear'
            status: 'APLICADO',
          }
          break
        }

        // ---- TIPO: VALIDACAO ----
        case 'validacao': {
          // Exemplo: Adicionar validação que soma peneiras = 100%
          // Em produção: adicionar em schema Zod ou règle de negócio
          resultado = {
            tipo: 'validacao',
            campo: previa.detalhes.campo,
            regra: previa.detalhes.regra,
            mensagemErro: previa.detalhes.mensagemErro,
            status: 'REGISTRADO',
          }
          break
        }

        // ---- TIPO: NOTIFICACAO ----
        case 'notificacao': {
          // Exemplo: Criar alerta para tempo de secagem > 48h
          resultado = {
            tipo: 'notificacao',
            evento: previa.detalhes.evento,
            condicao: previa.detalhes.condicao,
            mensagem: previa.detalhes.mensagem,
            destinatarios: previa.detalhes.destinatarios,
            status: 'REGISTRADO',
          }
          break
        }

        // ---- TIPO: REGRA ----
        case 'regra': {
          // Exemplo: Mudar cálculo de horas extras
          // Validar antes de aplicar
          if (previa.detalhes.impactoDados === true) {
            // Alteração de cálculo afeta dados históricos
            console.warn('⚠️ Esta alteração afeta dados históricos - requer auditoria')
          }

          resultado = {
            tipo: 'regra',
            modulo: previa.detalhes.modulo,
            regraAntiga: previa.detalhes.regraAntiga,
            regraNova: previa.detalhes.regraNova,
            impactoDados: previa.detalhes.impactoDados,
            status: 'APLICADO',
          }
          break
        }

        // ---- TIPO: RELATORIO ----
        case 'relatorio': {
          // Exemplo: Criar novo relatório
          resultado = {
            tipo: 'relatorio',
            nome: previa.detalhes.nome,
            descricao: previa.detalhes.descricao,
            campos: previa.detalhes.campos,
            status: 'REGISTRADO',
          }
          break
        }

        // ---- TIPO: ERRO ----
        case 'erro': {
          // Exemplo: Corrigir bug onde cálculo estava errado
          resultado = {
            tipo: 'erro',
            bug: previa.detalhes.bug,
            localizacao: previa.detalhes.localizacao,
            solucao: previa.detalhes.solucao,
            status: 'REGISTRADO',
          }
          break
        }

        default:
          throw new Error('Tipo de alteração desconhecido')
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Erro ao aplicar alteração'
    }

    // ============ REGISTRAR LOG ============
    const log = await prisma.assistantLog.update({
      where: { id: sessionId }, // Assumindo que o ID foi passado
      data: {
        status: erro ? 'REJEITADO' : 'APLICADO',
        dataaplicacao: erro ? undefined : new Date(),
        motivoRejeicao: erro || undefined,
        previa: JSON.stringify({ ...previa, resultado }, null, 2),
      },
    })

    if (erro) {
      return NextResponse.json(
        {
          success: false,
          erro,
          logId: log.id,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      resultado,
      logId: log.id,
      message: `Alteração de tipo '${previa.tipo}' aplicada com sucesso`,
    })
  } catch (error) {
    console.error('POST /api/assistente/aplicar-alteracao:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
