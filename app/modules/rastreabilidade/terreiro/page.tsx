'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ArrowRight, Calendar, Wind } from 'lucide-react'

export default function TerreirPage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('COLHEITA')

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

  const handleRegistrarTerreiro = async (loteId: string, loteData: any) => {
    const umidadeEntrada = prompt('Umidade de entrada (%):')
    if (!umidadeEntrada) return

    const dataEntrada = prompt('Data de entrada (YYYY-MM-DD):', new Date().toISOString().split('T')[0])
    if (!dataEntrada) return

    try {
      const res = await fetch('/api/etapas/terreiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          umidadeEntrada: parseFloat(umidadeEntrada),
          dataEntrada: new Date(dataEntrada),
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lote movido para Terreiro com sucesso')
        load()
      } else {
        alert('Erro ao registrar etapa')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const lotesDisponiveis = lotes.filter((l: any) => l.statusAtual === 'COLHEITA')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Wind className="w-8 h-8" />
          Etapa 2: Terreiro (Meia Seca)
        </h2>
        <p className="text-gray-600 mt-1">Registre a entrada de lotes no terreiro para meia seca</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filtros</h3>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="COLHEITA">Lotes em Colheita (prontos para Terreiro)</option>
          <option value="TERREIRO">Lotes em Terreiro</option>
        </select>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          {filtro === 'COLHEITA' ? 'Lotes Prontos para Terreiro' : 'Lotes em Terreiro'}
        </h3>

        {lotesDisponiveis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {filtro === 'COLHEITA'
              ? 'Nenhum lote em colheita disponível'
              : 'Nenhum lote em terreiro'}
          </p>
        ) : (
          <div className="space-y-3">
            {lotesDisponiveis.map((lote: any) => (
              <div
                key={lote.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                    </p>
                    <div className="mt-2 flex gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(lote.dataCriacao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {filtro === 'COLHEITA' && (
                    <button
                      onClick={() => handleRegistrarTerreiro(lote.id, lote)}
                      className="btn btn-primary text-sm flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Registrar no Terreiro
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Etapa do Terreiro</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Objetivo:</strong> Realizar meia seca do café ao ar livre</li>
          <li>• <strong>Umidade:</strong> De 50% até ~35% (pré-secagem)</li>
          <li>• <strong>Duração:</strong> 4-7 dias (depende do clima)</li>
          <li>• <strong>Próxima etapa:</strong> Secador estático (38.000 L cada)</li>
        </ul>
      </div>
    </div>
  )
}
