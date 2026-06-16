'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ArrowRight, Archive, Merge2 } from 'lucide-react'

export default function TulhaPage() {
  const { data: session, status } = useSession()
  const [tulhas, setTulhas] = useState<any[]>([])
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('SECADOR')
  const [loteSelecionado, setLoteSelecionado] = useState<string | null>(null)
  const [modeFusao, setModeFusao] = useState(false)

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
      // Initialize 6 tulhas
      setTulhas([
        { id: 1, nome: 'Tulha 1', capacidade: 76000, lotes: [] },
        { id: 2, nome: 'Tulha 2', capacidade: 76000, lotes: [] },
        { id: 3, nome: 'Tulha 3', capacidade: 76000, lotes: [] },
        { id: 4, nome: 'Tulha 4', capacidade: 76000, lotes: [] },
        { id: 5, nome: 'Tulha 5', capacidade: 76000, lotes: [] },
        { id: 6, nome: 'Tulha 6', capacidade: 76000, lotes: [] },
      ])
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

  const handleRegistrarTulha = async (loteId: string, tulhaId: number) => {
    try {
      const res = await fetch('/api/etapas/tulha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          tulhaId,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lote alocado à Tulha com sucesso')
        load()
      } else {
        alert('Erro ao registrar etapa')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  const handleFusaoLotes = async (tulhaId: number) => {
    if (!loteSelecionado) {
      alert('Selecione um lote para fusão')
      return
    }

    const loteSecundario = prompt('ID do segundo lote para fusão (ex: L2526-001):')
    if (!loteSecundario) return

    try {
      const res = await fetch('/api/etapas/tulha/fusao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotePrincipal: loteSelecionado,
          loteSecundario,
          tulhaId,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lotes fundidos com sucesso')
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

  const lotesDisponiveis = lotes.filter((l: any) =>
    filtro === 'SECADOR' ? l.statusAtual === 'SECADOR' : l.statusAtual === 'TULHA'
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Archive className="w-8 h-8" />
          Etapa 4: Tulha de Descanso
        </h2>
        <p className="text-gray-600 mt-1">Gerencie o descanso dos lotes nas tulhas (76.000 L cada) e realize fusões</p>
      </div>

      {/* Toggle de Modo */}
      <div className="card">
        <div className="flex gap-2 mb-4">
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
          {/* Status das Tulhas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tulhas.map((tulha) => {
              const usedCapacity = lotesDisponiveis
                .filter((l: any) => tulha.lotes.includes(l.id))
                .reduce((sum: number, l: any) => sum + l.quantidadeTotal, 0)

              return (
                <div key={tulha.id} className="card">
                  <h4 className="font-semibold text-lg mb-2">{tulha.nome}</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-600">Capacidade</p>
                      <p className="font-bold text-lg">{tulha.capacidade.toLocaleString('pt-BR')} L</p>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 transition-all"
                        style={{ width: `${(usedCapacity / tulha.capacidade) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {usedCapacity.toLocaleString('pt-BR')} L / {tulha.capacidade.toLocaleString('pt-BR')} L
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Filtros */}
          <div className="card">
            <h3 className="font-semibold mb-3">Filtros</h3>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="SECADOR">Lotes em Secador (prontos para Tulha)</option>
              <option value="TULHA">Lotes em Tulha</option>
            </select>
          </div>

          {/* Lotes */}
          <div className="card">
            <h3 className="font-semibold mb-4">
              {filtro === 'SECADOR' ? 'Lotes Prontos para Tulha' : 'Lotes em Tulha'}
            </h3>

            {lotesDisponiveis.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum lote disponível</p>
            ) : (
              <div className="space-y-3">
                {lotesDisponiveis.map((lote: any) => {
                  const podeAlocar = tulhas.some(
                    (t) =>
                      t.lotes.reduce((s: number, id: string) => {
                        const l = lotesDisponiveis.find((lo: any) => lo.id === id)
                        return s + (l?.quantidadeTotal || 0)
                      }, 0) +
                        lote.quantidadeTotal <=
                      t.capacidade
                  )

                  return (
                    <div key={lote.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                          </p>
                        </div>

                        {filtro === 'SECADOR' && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleRegistrarTulha(lote.id, parseInt(e.target.value))
                              }
                            }}
                            className="border rounded px-3 py-2 text-sm"
                          >
                            <option value="">Alocar em Tulha...</option>
                            {tulhas
                              .filter(
                                (t) =>
                                  t.lotes.reduce((s: number, id: string) => {
                                    const l = lotesDisponiveis.find((lo: any) => lo.id === id)
                                    return s + (l?.quantidadeTotal || 0)
                                  }, 0) +
                                    lote.quantidadeTotal <=
                                  t.capacidade
                              )
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nome}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                })}
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
              Fusionar Lotes em Tulha
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
                  {lotes
                    .filter((l: any) => l.statusAtual === 'TULHA')
                    .map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.identificador} ({l.quantidadeTotal.toFixed(0)} L)
                      </option>
                    ))}
                </select>
              </div>

              {loteSelecionado && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tulhas.map((tulha) => (
                    <button
                      key={tulha.id}
                      onClick={() => handleFusaoLotes(tulha.id)}
                      className="btn btn-primary py-3"
                    >
                      {tulha.nome}
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
        <h3 className="font-semibold text-primary mb-2">ℹ️ Tulha de Descanso</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Capacidade:</strong> 76.000 L por tulha (2 secadores)</li>
          <li>• <strong>Duração:</strong> 3-5 dias de descanso</li>
          <li>• <strong>Fusão:</strong> Combine 2 lotes na mesma tulha se necessário</li>
          <li>• <strong>Total de tulhas:</strong> 6 disponíveis</li>
          <li>• <strong>Próxima etapa:</strong> Benefício (máquina de benefício)</li>
        </ul>
      </div>
    </div>
  )
}
