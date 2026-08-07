'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Resultado {
  success: boolean
  importadas: number
  talhoesCriados: string[]
  produtosCriados: string[]
  puladas: { linha: number; motivo: string }[]
}

export default function ImportarAplicacaoInsumosPage() {
  const { status, data: session } = useSession()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const role = (session?.user as any)?.role

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { if (status === 'authenticated' && role !== 'GESTOR') router.push('/dashboard') }, [status, role, router])

  async function confirmar() {
    if (!senha) { setErro('Informe a senha'); return }
    if (!confirm('Confirma a GRAVAÇÃO REAL da importação de histórico de Aplicação de Insumos? Isso vai criar ~1084 registros no banco de produção. Essa ação não tem desfazer por aqui.')) return

    setLoading(true); setErro(''); setResultado(null)
    try {
      const r = await fetch('/api/admin/importar-aplicacao-insumos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro na importação')
      setResultado(d)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || status === 'unauthenticated' || (status === 'authenticated' && role !== 'GESTOR')) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar Aplicação de Insumos (histórico)</h1>
        <p className="text-sm text-gray-500">Página temporária, não listada no menu. Executa a importação real do histórico da planilha para AplicacaoInsumoItem. Só pode rodar uma vez.</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm mb-6">
        <strong>Atenção:</strong> essa ação grava dados reais no banco de produção e não tem desfazer por aqui. Confira o resumo do dry-run antes de confirmar.
      </div>

      {!resultado && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Senha de confirmação</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Senha definida em IMPORT_APLICACAO_INSUMOS_SECRET"
            />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
          <button
            onClick={confirmar}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Importando...' : 'Confirmar importação real'}
          </button>
        </div>
      )}

      {resultado && (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
            Importação concluída: <strong>{resultado.importadas}</strong> linha(s) gravada(s).
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Talhões novos ({resultado.talhoesCriados.length})</p>
            <ul className="text-sm text-gray-600 list-disc pl-5">
              {resultado.talhoesCriados.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Produtos novos ({resultado.produtosCriados.length})</p>
            <ul className="text-sm text-gray-600 list-disc pl-5">
              {resultado.produtosCriados.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Puladas ({resultado.puladas.length})</p>
            <ul className="text-sm text-gray-600 list-disc pl-5 max-h-64 overflow-y-auto">
              {resultado.puladas.map((p, i) => <li key={i}>linha {p.linha}: {p.motivo}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
