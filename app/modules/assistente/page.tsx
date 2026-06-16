'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Send, Loader, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'

interface Message {
  id?: string
  papel: 'usuario' | 'assistant'
  conteudo: string
  preview?: string
}

export default function AssistentePage() {
  const { data: session, status } = useSession()
  const [mensagens, setMensagens] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'PROPRIETARIO') {
      redirect('/modules')
    }
  }, [status])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const iniciarConversa = async () => {
    try {
      const res = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'iniciar' }),
      })

      if (res.ok) {
        const data = await res.json()
        setSessionId(data.sessionId)
        setMensagens([
          {
            papel: 'assistant',
            conteudo: 'Olá! Sou o Assistente de IA da Gestão Fazenda. Posso ajudar você a fazer alterações no sistema. Como posso ajudar?',
          },
        ])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && !sessionId) {
      iniciarConversa()
    }
  }, [status])

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !sessionId) return

    const mensagemUsuario: Message = { papel: 'usuario', conteudo: input }
    setMensagens((prev) => [...prev, mensagemUsuario])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviar',
          sessionId,
          mensagem: input,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const mensagemAssistente: Message = {
          papel: 'assistant',
          conteudo: data.resposta,
          preview: data.preview,
        }
        setMensagens((prev) => [...prev, mensagemAssistente])

        if (data.preview) {
          setPreviewData(data.preview)
          setShowPreview(true)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao comunicar com IA')
    } finally {
      setLoading(false)
    }
  }

  const handleAprovarAlteracao = async () => {
    if (!previewData) return

    try {
      const res = await fetch('/api/assistente/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          preview: previewData,
        }),
      })

      if (res.ok) {
        alert('Alteração aprovada e aplicada com sucesso')
        setShowPreview(false)
        setPreviewData(null)
      }
    } catch (err) {
      alert('Erro ao aplicar alteração')
    }
  }

  const handleRejeitarAlteracao = () => {
    setShowPreview(false)
    setPreviewData(null)
  }

  const handleLimparChat = () => {
    setMensagens([])
    setSessionId(null)
    iniciarConversa()
  }

  if (status === 'loading') {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'PROPRIETARIO') {
    return (
      <div className="card bg-red-50 border-l-4 border-red-500">
        <p className="text-red-800 font-medium">
          ❌ Acesso Restrito: Apenas Gestores podem usar o Assistente de IA
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-primary">🤖 Assistente de IA</h1>
        <p className="text-gray-600 mt-1">Chat inteligente para gerenciar alterações no sistema</p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 card overflow-y-auto space-y-4">
        {mensagens.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>Inicie uma conversa com o assistente</p>
          </div>
        ) : (
          <>
            {mensagens.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.papel === 'usuario' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.papel === 'usuario'
                      ? 'bg-primary text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-2 rounded-lg rounded-bl-none flex items-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">IA analisando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Preview de Alterações */}
      {showPreview && previewData && (
        <div className="card bg-yellow-50 border-l-4 border-yellow-500 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900">Prévia da Alteração</h3>
              <p className="text-sm text-yellow-800 mt-1">{previewData.descricao}</p>
              {previewData.detalhes && (
                <div className="mt-2 bg-white p-2 rounded text-xs font-mono text-gray-700 max-h-40 overflow-y-auto">
                  {JSON.stringify(previewData.detalhes, null, 2)}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAprovarAlteracao}
              className="btn btn-primary flex items-center gap-2 flex-1"
            >
              <CheckCircle className="w-4 h-4" />
              Aprovar e Aplicar
            </button>
            <button
              onClick={handleRejeitarAlteracao}
              className="btn btn-outline flex-1"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleEnviarMensagem} className="card space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva a alteração que deseja fazer..."
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:border-primary"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Enviar
          </button>
          <button
            type="button"
            onClick={handleLimparChat}
            className="btn btn-outline flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Sugestões Rápidas */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInput('Adicionar novo campo no formulário')}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            ➕ Adicionar campo
          </button>
          <button
            type="button"
            onClick={() => setInput('Mudar regra de cálculo')}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            🔢 Alterar regra
          </button>
          <button
            type="button"
            onClick={() => setInput('Criar novo relatório')}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            📊 Novo relatório
          </button>
          <button
            type="button"
            onClick={() => setInput('Corrigir erro')}
            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
          >
            🐛 Corrigir bug
          </button>
        </div>
      </form>
    </div>
  )
}
