'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { ArrowRight, Zap } from 'lucide-react'

export default function BeneficioPage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('TULHA')

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

  const handleRegistrarBeneficio = async (loteId: string) => {
    const horaInicio = prompt('Hora de início (HH:MM):', '08:00')
    if (!horaInicio) return

    const umidadeEntrada = prompt('Umidade de entrada (%):', '12')
    if (!umidadeEntrada) return

    try {
      const res = await fetch('/api/etapas/beneficio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          horaInicio,
          umidadeEntrada: parseFloat(umidadeEntrada),
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Lote movido para Benefício com sucesso')
        load()
      } else {
        alert('Erro ao registrar etapa')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  const handleFinalizarBeneficio = async (loteId: string) => {
    const horaFim = prompt('Hora de término (HH:MM):')
    if (!horaFim) return

    const umidadeSaida = prompt('Umidade de saída (%):', '11')
    if (!umidadeSaida) return

    try {
      const etapa = lotes
        .find((l: any) => l.id === loteId)
        ?.etapaBeneficio
      if (!etapa) return

      const res = await fetch(`/api/etapas/beneficio?id=${etapa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horaFim,
          umidadeSaida: parseFloat(umidadeSaida),
        }),
      })

      if (res.ok) {
        alert('Benefício finalizado e lote movido para Classificação')
        load()
      } else {
        alert('Erro ao finalizar benefício')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const lotesDisponiveis = lotes.filter((l: any) =>
    filtro === 'TULHA' ? l.statusAtual === 'TULHA' : l.statusAtual === 'BENEFICIO'
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Zap className="w-8 h-8" />
          Etapa 5a: Benefício
        </h2>
        <p className="text-gray-600 mt-1">Máquina de benefício do café (descascamento e padronização)</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filtros</h3>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="TULHA">Lotes em Tulha (prontos para Benefício)</option>
          <option value="BENEFICIO">Lotes em Benefício</option>
        </select>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          {filtro === 'TULHA' ? 'Lotes Prontos para Benefício' : 'Lotes em Benefício'}
        </h3>

        {lotesDisponiveis.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum lote disponível</p>
        ) : (
          <div className="space-y-3">
            {lotesDisponiveis.map((lote: any) => (
              <div key={lote.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                    </p>
                    {lote.etapaBeneficio && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <p>
                          <strong>Início:</strong> {lote.etapaBeneficio.horaInicio}
                        </p>
                        <p>
                          <strong>Umidade entrada:</strong> {lote.etapaBeneficio.umidadeEntrada}%
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {filtro === 'TULHA' ? (
                      <button
                        onClick={() => handleRegistrarBeneficio(lote.id)}
                        className="btn btn-primary text-sm flex items-center gap-2"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Iniciar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFinalizarBeneficio(lote.id)}
                        className="btn btn-primary text-sm"
                      >
                        Finalizar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Máquina de Benefício</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Processo:</strong> Descascamento, separação de silverskin, padronização</li>
          <li>• <strong>Duração:</strong> Varia conforme volume (tipicamente 2-4 horas por lote)</li>
          <li>• <strong>Umidade:</strong> Entrada ~12%, saída ~11% (redução mínima)</li>
          <li>• <strong>Tempo de processamento:</strong> Calculado automaticamente</li>
          <li>• <strong>Próxima etapa:</strong> Classificação física (peneiramento)</li>
        </ul>
      </div>
    </div>
  )
}
