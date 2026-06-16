'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Truck, ArrowRight } from 'lucide-react'

export default function ArmazemPage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('SILO')

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

  const handleSaidaArmazem = async (loteId: string) => {
    const pesoKg = prompt('Peso total (kg):')
    if (!pesoKg) return

    const nfTransporte = prompt('NF de transporte:')
    const armazem = prompt('Armazém destino:')
    const numerosPesagem = prompt('Números de pesagem:')

    try {
      const res = await fetch('/api/etapas/armazem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loteId,
          pesoKg: parseFloat(pesoKg),
          nfTransporte: nfTransporte || undefined,
          armazemDestino: armazem || undefined,
          numerosPesagem: numerosPesagem || undefined,
          responsavelId: session?.user?.id,
        }),
      })

      if (res.ok) {
        alert('Saída registrada com sucesso')
        load()
      } else {
        alert('Erro ao registrar saída')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const lotesDisponiveis = lotes.filter((l: any) =>
    filtro === 'SILO' ? l.statusAtual === 'SILO' : l.statusAtual === 'ARMAZEM'
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Truck className="w-8 h-8" />
          Etapa 7: Armazém
        </h2>
        <p className="text-gray-600 mt-1">Registro de saída de café para armazenagem/venda</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="font-semibold mb-3">Filtros</h3>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="SILO">Lotes em Silo (prontos para Armazém)</option>
          <option value="ARMAZEM">Lotes em Armazém</option>
        </select>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          {filtro === 'SILO' ? 'Lotes Prontos para Armazém' : 'Lotes em Armazém'}
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
                    {lote.etapaClassificacao && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <p>
                          <strong>Pontuação:</strong> {lote.etapaClassificacao.pontuacaoBebida}
                        </p>
                        <p>
                          <strong>Peneira 17+:</strong> {lote.etapaClassificacao.peneira17Plus}%
                        </p>
                      </div>
                    )}
                  </div>

                  {filtro === 'SILO' && (
                    <button
                      onClick={() => handleSaidaArmazem(lote.id)}
                      className="btn btn-primary text-sm flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Registrar Saída
                    </button>
                  )}
                </div>

                {lote.etapaArmazem && (
                  <div className="mt-3 pt-3 border-t text-xs text-gray-600 space-y-1">
                    <p>
                      <strong>Peso:</strong> {lote.etapaArmazem.pesoKg.toLocaleString('pt-BR')} kg (
                      {(lote.etapaArmazem.pesoKg / 60).toFixed(1)} sacas)
                    </p>
                    {lote.etapaArmazem.nfTransporte && (
                      <p>
                        <strong>NF:</strong> {lote.etapaArmazem.nfTransporte}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Saída para Armazém</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Última etapa:</strong> Saída de café processado</li>
          <li>• <strong>Pesagem:</strong> Conversão automática (kg → sacas de 60 kg)</li>
          <li>• <strong>Documentação:</strong> NF de transporte, armazém destino, números de pesagem</li>
          <li>• <strong>Rastreabilidade completa:</strong> Toda a jornada do lote registrada</li>
          <li>• <strong>Próxima etapa:</strong> Venda/Distribuição</li>
        </ul>
      </div>

      {/* Resumo de Processamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-gray-600">Lotes em Silo</p>
          <p className="text-2xl font-bold text-primary">
            {lotes.filter((l: any) => l.statusAtual === 'SILO').length}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-600">Lotes em Armazém</p>
          <p className="text-2xl font-bold text-primary">
            {lotes.filter((l: any) => l.statusAtual === 'ARMAZEM').length}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-600">Total em Processamento</p>
          <p className="text-2xl font-bold text-primary">
            {lotes.filter((l: any) => ['SILO', 'ARMAZEM'].includes(l.statusAtual)).length}
          </p>
        </div>
      </div>
    </div>
  )
}
