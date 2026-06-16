'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ArrowRight, CheckCircle } from 'lucide-react'

export default function ClassificacaoPage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('CLASSIFICACAO')
  const [loteEmEdicao, setLoteEmEdicao] = useState<string | null>(null)

  const [peneiras, setPeneiras] = useState({
    peneira17Plus: 0,
    peneira16: 0,
    peneira15: 0,
    moca10: 0,
    peneira13: 0,
    catacao: 0,
    fundo: 0,
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch(`/api/lotes?status=${filtro}`)
      if (res.ok) {
        const data = await res.json()
        setLotes(data.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [filtro])

  const somaTotal = Object.values(peneiras).reduce((a, b) => a + b, 0)
  const validoParaEnvio = Math.abs(somaTotal - 100) < 0.01

  const handleRegistrarClassificacao = async (loteId: string, lote: any) => {
    if (!validoParaEnvio) {
      alert('A soma das peneiras deve ser 100%')
      return
    }

    const pontuacaoBebida = prompt('Pontuação da bebida (0-100):', '85')
    if (!pontuacaoBebida) return

    const umidadeFinal = prompt('Umidade final (%):', '11')
    if (!umidadeFinal) return

    try {
      const res = await fetch('/api/etapas/classificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          ...peneiras,
          pontuacaoBebida: parseFloat(pontuacaoBebida),
          umidadeFinal: parseFloat(umidadeFinal),
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Classificação registrada e lote movido para Silo')
        setLoteEmEdicao(null)
        setPeneiras({
          peneira17Plus: 0,
          peneira16: 0,
          peneira15: 0,
          moca10: 0,
          peneira13: 0,
          catacao: 0,
          fundo: 0,
        })
        load()
      } else {
        alert('Erro ao registrar classificação')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const lotesDisponiveis = lotes.filter((l: any) => l.statusAtual === filtro)

  const peneirasDisplay = [
    { key: 'peneira17Plus', label: 'Peneira 17+' },
    { key: 'peneira16', label: 'Peneira 16' },
    { key: 'peneira15', label: 'Peneira 15' },
    { key: 'moca10', label: 'Moça 10' },
    { key: 'peneira13', label: 'Peneira 13' },
    { key: 'catacao', label: 'Catação' },
    { key: 'fundo', label: 'Fundo' },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <CheckCircle className="w-8 h-8" />
          Etapa 5b: Classificação Física
        </h2>
        <p className="text-gray-600 mt-1">Peneiramento e análise da qualidade do café (Gerente/Sócio)</p>
      </div>

      {/* Aviso de Permissão */}
      {session?.user?.role !== 'GERENTE' && session?.user?.role !== 'GESTOR' && (
        <div className="card bg-yellow-50 border-l-4 border-yellow-500">
          <p className="text-sm font-medium text-yellow-800">
            ⚠️ Acesso Restrito: Apenas Gerentes e Gestores podem classificar lotes
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filtros</h3>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="CLASSIFICACAO">Aguardando Classificação</option>
          <option value="SILO">Lotes Classificados (em Silo)</option>
        </select>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          {filtro === 'CLASSIFICACAO' ? 'Lotes Aguardando Classificação' : 'Lotes Classificados'}
        </h3>

        {lotesDisponiveis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum lote nesta etapa</p>
        ) : (
          <div className="space-y-4">
            {lotesDisponiveis.map((lote: any) => (
              <div key={lote.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                    </p>
                  </div>

                  {filtro === 'CLASSIFICACAO' &&
                    (session?.user?.role === 'GERENTE' || session?.user?.role === 'GESTOR') && (
                      <button
                        onClick={() => setLoteEmEdicao(lote.id)}
                        className="btn btn-primary text-sm"
                      >
                        Classificar
                      </button>
                    )}
                </div>

                {loteEmEdicao === lote.id && (
                  <div className="bg-gray-50 rounded p-4 space-y-4 border-t">
                    <h5 className="font-semibold">Peneiramento</h5>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {peneirasDisplay.map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-gray-600">{label} (%)</label>
                          <input
                            type="number"
                            value={peneiras[key as keyof typeof peneiras]}
                            onChange={(e) =>
                              setPeneiras({
                                ...peneiras,
                                [key]: parseFloat(e.target.value) || 0,
                              })
                            }
                            step="0.1"
                            min="0"
                            max="100"
                            className="border rounded px-2 py-1 w-full mt-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Validação */}
                    <div
                      className={`p-3 rounded text-sm font-medium ${
                        validoParaEnvio
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      Soma total: {somaTotal.toFixed(2)}% {validoParaEnvio ? '✓' : '(deve ser 100%)'}
                    </div>

                    {/* Botões */}
                    <div className="flex gap-2 pt-2 border-t">
                      <button
                        onClick={() => handleRegistrarClassificacao(lote.id, lote)}
                        disabled={!validoParaEnvio}
                        className="btn btn-primary flex-1 text-sm flex items-center justify-center gap-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Confirmar Classificação
                      </button>
                      <button
                        onClick={() => setLoteEmEdicao(null)}
                        className="btn btn-outline flex-1 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {lote.etapaClassificacao && (
                  <div className="mt-4 pt-4 border-t text-xs text-gray-600 space-y-1">
                    <p>
                      <strong>Peneira 17+:</strong> {lote.etapaClassificacao.peneira17Plus}%
                    </p>
                    <p>
                      <strong>Pontuação:</strong> {lote.etapaClassificacao.pontuacaoBebida}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Classificação Física</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Peneiras:</strong> 17+, 16, 15, Moça 10, 13, Catação, Fundo</li>
          <li>• <strong>Validação obrigatória:</strong> Soma das peneiras = 100%</li>
          <li>• <strong>Pontuação:</strong> Avaliação sensorial da bebida (0-100)</li>
          <li>• <strong>Acesso restrito:</strong> Apenas Gerentes e Gestores</li>
          <li>• <strong>Próxima etapa:</strong> Armazenamento em Silos</li>
        </ul>
      </div>
    </div>
  )
}
