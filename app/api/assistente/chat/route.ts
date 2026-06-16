import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Anthropic } from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// System prompt com contexto do negócio
const SYSTEM_PROMPT = `Você é um Assistente de IA especializado em gerenciar o sistema Gestão Fazenda - um software PWA para agricultura.

CONTEXTO DO SISTEMA:
- Módulos: M1 (Atividades), M2 (Combustível), M3 (Receitas), M4 (Rastreabilidade), M5 (Painel), M6 (Configurações), M7 (Assistente)
- Tecnologia: Next.js 14, TypeScript, Prisma, PostgreSQL, NextAuth, Tailwind CSS
- Usuários: Funcionário, Gerente, Agrônomo, Gestor

REGRAS DE NEGÓCIO IMPORTANTES:
1. M1 (Atividades): 12 tipos de atividades, cálculo automático de horas, banco de horas
2. M2 (Combustível): 3 abas (Abastecimento, Entrada Diesel, Painel Estoque), cálculo L/h automático
3. M3 (Receitas): Receitas base, aplicações de insumo, ajustes per talhão
4. M4 (Rastreabilidade): 7 etapas de processamento de café, fusão de lotes, validação de peneiras (soma 100%)
5. M5 (Painel): Folha de pagamento com cálculos complexos, lançamento de vales, permissões por role
6. Permissões: Classificação (M4) = apenas GERENTE/GESTOR; Assistente (M7) = apenas GESTOR

TIPOS DE ALTERAÇÃO SUPORTADOS:
- Adicionar/remover campos em formulários
- Mudar regras de cálculo (com validação de impacto)
- Criar novos relatórios (com dados disponíveis)
- Alterar textos e labels
- Mudar permissões (validando constraints)
- Corrigir erros (bugs)

PROCESSO:
1. Entender a alteração solicitada
2. Validar se é possível (regras de negócio)
3. Gerar prévia detalhada em JSON com:
   - tipo: "campo" | "regra" | "relatorio" | "permissao" | "validacao" | "texto"
   - descricao: descrição clara da mudança
   - detalhes: JSON com detalhes específicos
   - riscos: possíveis impactos
4. Aguardar aprovação explícita do usuário

NÃO sugira alterações que:
- Violem as regras de negócio
- Quebrem integrações entre módulos
- Removam dados históricos sem backup
- Mudem permissões críticas sem justificativa

Responda de forma clara e profissional. Sempre explique o impacto de qualquer alteração sugerida.`;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Apenas GESTOR
    if (session.user?.role !== 'GESTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, sessionId, mensagem } = body

    // ============ AÇÃO: INICIAR ============
    if (action === 'iniciar') {
      const chat = await prisma.assistantChat.create({
        data: {
          usuarioId: session.user?.id as string,
          titulo: 'Conversa de IA - ' + new Date().toLocaleString('pt-BR'),
        },
      })

      return NextResponse.json({
        success: true,
        sessionId: chat.id,
        message: 'Sessão iniciada',
      })
    }

    // ============ AÇÃO: ENVIAR ============
    if (action === 'enviar') {
      if (!sessionId || !mensagem) {
        return NextResponse.json(
          { error: 'Parâmetros obrigatórios: sessionId, mensagem' },
          { status: 400 }
        )
      }

      // Validar que a sessão pertence ao usuário
      const chat = await prisma.assistantChat.findUnique({
        where: { id: sessionId },
        include: { mensagens: true },
      })

      if (!chat || chat.usuarioId !== (session.user?.id as string)) {
        return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
      }

      // Salvar mensagem do usuário
      await prisma.chatMessage.create({
        data: {
          chatId: sessionId,
          papel: 'usuario',
          conteudo: mensagem,
        },
      })

      // Preparar histórico para Claude
      const historico = chat.mensagens.map((m) => ({
        role: m.papel === 'usuario' ? ('user' as const) : ('assistant' as const),
        content: m.conteudo,
      }))

      historico.push({
        role: 'user' as const,
        content: mensagem,
      })

      // Chamar Claude API
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: historico,
      })

      const resposta =
        response.content[0].type === 'text' ? response.content[0].text : 'Erro ao processar'

      // Tentar extrair prévia JSON da resposta
      let preview = null
      const jsonMatch = resposta.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        try {
          preview = JSON.parse(jsonMatch[1])
        } catch (e) {
          // JSON inválido, ignorar
        }
      }

      // Salvar resposta do assistente
      await prisma.chatMessage.create({
        data: {
          chatId: sessionId,
          papel: 'assistant',
          conteudo: resposta,
        },
      })

      return NextResponse.json({
        success: true,
        resposta,
        preview,
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/assistente/chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
