'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Package, Merge2 } from 'lucide-react'

export default function SiloPage() {
  const { data: session, status } = useSession()
  const [silos, setSilos] = useState<any[]>([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modeFusao, setModeFusao] = useState(false)
  const [loteSelecionado, setLoteSelecionado] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/lotes?status=SILO')
      if (res.ok) {
        const data = await res.json()
        setLotes(data.data || [])
      }
      // Initialize silos
      setSilos([
        { id: 1, nome: 'Silo Peneira 17+', lotes: [] },
        { id: 2, nome: 'Silo Peneira 16', lotes: [] },
        { id: 3, nome: 'Silo Bica Corrida', lotes: [] },
      ])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status])

  const handleAlocarSilo = async (loteId: string, siloId: number) => {
    try {
      const res = await fetch('/api/etapas/silo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          siloId,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lote alocado ao Silo com sucesso')
        load()
      } else {
        alert('Erro ao alocar lote')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  const handleFusaoLotes = async (siloId: number) => {
    if (!loteSelecionado) {
      alert('Selecione um lote para fusão')
      return
    }

    const loteSecundario = prompt('ID do segundo lote para fusão (ex: L2526-001):')
    if (!loteSecundario) return

    try {
      const res = await fetch('/api/etapas/silo/fusao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotePrincipal: loteSelecionado,
          loteSecundario,
          siloId,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lotes fundidos no Silo com sucesso')
        setModeFusao(false)
        setLoteSelecionado(null)
        load()
      } else {
        alert('Erro ao fundir lotes')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Package className="w-8 h-8" />
          Etapa 6: Silos
        </h2>
        <p className="text-gray-600 mt-1">Armazenagem em silos com possibilidade de fusão</p>
      </div>

      {/* Toggle de Modo */}
      <div className="card">
        <div className="flex gap-2">
          <button
            onClick={() => setModeFusao(false)}
            className={`px-4 py-2 rounded font-medium transition ${
              !modeFusao ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            Alocar Lotes
          </button>
          <button
            onClick={() => setModeFusao(true)}
            className={`px-4 py-2 rounded font-medium transition flex items-center gap-2 ${
              modeFusao ? 'bg-primary text-white' : 'bg-gray-200'
            }`}
          >
            <Merge2 className="w-4 h-4" />
            Fusionar Lotes
          </button>
        </div>
      </div>

      {!modeFusao ? (
        <>
          {/* Silos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {silos.map((silo) => {
              const lotesNoSilo = lotes.filter((l: any) =>
                silo.lotes.includes(l.id)
              )

              return (
                <div key={silo.id} className="card">
                  <h4 className="font-semibold text-lg mb-2">{silo.nome}</h4>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">
                      {lotesNoSilo.length} lote(s) armazenado(s)
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Lotes */}
          <div className="card">
            <h3 className="font-semibold mb-4">Lotes para Armazenar</h3>

            {lotes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum lote classificado</p>
            ) : (
              <div className="space-y-3">
                {lotes.map((lote: any) => (
                  <div key={lote.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                        </p>
                        {lote.etapaClassificacao && (
                          <p className="text-xs text-gray-600 mt-1">
                            <strong>Peneira 17+:</strong> {lote.etapaClassificacao.peneira17Plus}%
                          </p>
                        )}
                      </div>

                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAlocarSilo(lote.id, parseInt(e.target.value))
                          }
                        }}
                        className="border rounded px-3 py-2 text-sm"
                      >
                        <option value="">Alocar em Silo...</option>
                        {silos.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Modo Fusão */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Merge2 className="w-5 h-5 text-primary" />
              Fusionar Lotes em Silo
            </h3>

            <div className="space-y-4">
              <div>
                <label className="font-semibold text-sm">Selecione o lote principal:</label>
                <select
                  value={loteSelecionado || ''}
                  onChange={(e) => setLoteSelecionado(e.target.value || null)}
                  className="border rounded px-3 py-2 w-full mt-2"
                >
                  <option value="">Escolher lote...</option>
                  {lotes.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.identificador} ({l.quantidadeTotal.toFixed(0)} L)
                    </option>
                  ))}
                </select>
              </div>

              {loteSelecionado && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {silos.map((silo) => (
                    <button
                      key={silo.id}
                      onClick={() => handleFusaoLotes(silo.id)}
                      className="btn btn-primary py-3"
                    >
                      {silo.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Armazenagem em Silos</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Tipos de Silo:</strong> Peneira 17+, Peneira 16, Bica Corrida</li>
          <li>• <strong>Fusão:</strong> Combine lotes classificados no mesmo silo</li>
          <li>• <strong>Armazenagem:</strong> Lotes já classificados e prontos para venda</li>
          <li>• <strong>Próxima etapa:</strong> Armazém (saída para venda)</li>
        </ul>
      </div>
    </div>
  )
}
