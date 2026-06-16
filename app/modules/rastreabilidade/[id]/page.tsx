'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { redirect } from 'next/navigation'
import { ArrowRight, Calendar, User, Package } from 'lucide-react'

export default function LoteDetalhesPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const loteId = params.id as string
  const [lote, setLote] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch(`/api/lotes/${loteId}`)
      if (res.ok) {
        const data = await res.json()
        setLote(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [loteId])

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (!lote) {
    return (
      <div className="card bg-red-50 border-l-4 border-red-500">
        <p className="text-red-800 font-medium">Lote não encontrado</p>
      </div>
    )
  }

  const etapas = [
    {
      numero: 1,
      nome: 'Colheita',
      data: lote.dataCriacao,
      dados: lote.chegadas?.length > 0 ? `${lote.chegadas.length} chegadas` : null,
      status: lote.statusAtual === 'COLHEITA' ? 'ativo' : 'completo',
    },
    {
      numero: 2,
      nome: 'Terreiro',
      data: lote.etapaTerreiro?.dataEntrada,
      dados: lote.etapaTerreiro ? `${lote.etapaTerreiro.umidadeEntrada}% umidade` : null,
      status: lote.statusAtual === 'TERREIRO' ? 'ativo' : lote.etapaTerreiro ? 'completo' : 'pendente',
    },
    {
      numero: 3,
      nome: 'Secador',
      data: lote.etapaSecador?.horaEntrada,
      dados: lote.etapaSecador ? `Secador ${lote.etapaSecador.secadorId}` : null,
      status: lote.statusAtual === 'SECADOR' ? 'ativo' : lote.etapaSecador ? 'completo' : 'pendente',
    },
    {
      numero: 4,
      nome: 'Tulha',
      data: lote.etapaTulha?.dataEntrada,
      dados: lote.etapaTulha ? `Tulha ${lote.etapaTulha.tulhaId}` : null,
      status: lote.statusAtual === 'TULHA' ? 'ativo' : lote.etapaTulha ? 'completo' : 'pendente',
    },
    {
      numero: 5,
      nome: 'Benefício',
      data: lote.etapaBeneficio?.horaInicio,
      dados: lote.etapaBeneficio ? `${lote.etapaBeneficio.tempoProcessamento?.toFixed(1) || 0}h processamento` : null,
      status: lote.statusAtual === 'BENEFICIO' ? 'ativo' : lote.etapaBeneficio ? 'completo' : 'pendente',
    },
    {
      numero: '5b',
      nome: 'Classificação',
      data: lote.etapaClassificacao?.dataClassificacao,
      dados: lote.etapaClassificacao ? `Peneira 17+: ${lote.etapaClassificacao.peneira17Plus}%` : null,
      status: lote.statusAtual === 'CLASSIFICACAO' ? 'ativo' : lote.etapaClassificacao ? 'completo' : 'pendente',
    },
    {
      numero: 6,
      nome: 'Silo',
      data: lote.etapaSilo?.dataEntrada,
      dados: lote.etapaSilo ? `Silo ${lote.etapaSilo.siloId}` : null,
      status: lote.statusAtual === 'SILO' ? 'ativo' : lote.etapaSilo ? 'completo' : 'pendente',
    },
    {
      numero: 7,
      nome: 'Armazém',
      data: lote.etapaArmazem?.dataSaida,
      dados: lote.etapaArmazem ? `${lote.etapaArmazem.pesoKg.toLocaleString('pt-BR')} kg` : null,
      status: lote.statusAtual === 'ARMAZEM' ? 'ativo' : lote.etapaArmazem ? 'completo' : 'pendente',
    },
  ]

  const statusColors: Record<string, string> = {
    completo: 'bg-green-100 text-green-800',
    ativo: 'bg-blue-100 text-blue-800',
    pendente: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-primary">{lote.identificador}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            statusColors[lote.statusAtual === 'ARMAZEM' ? 'completo' : lote.statusAtual ? 'ativo' : 'pendente']
          }`}>
            {lote.statusAtual}
          </span>
        </div>
        <p className="text-gray-600">Rastreabilidade completa desde a colheita</p>
      </div>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-600">Volume Total</p>
          <p className="text-2xl font-bold text-primary">{lote.quantidadeTotal.toFixed(0)}</p>
          <p className="text-xs text-gray-600">litros</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-600">Equivalente</p>
          <p className="text-2xl font-bold text-primary">{(lote.quantidadeTotal / 60).toFixed(1)}</p>
          <p className="text-xs text-gray-600">sacas</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-600">Criado em</p>
          <p className="text-sm font-bold">
            {new Date(lote.dataCriacao).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-600">Última Atualização</p>
          <p className="text-sm font-bold">
            {new Date(lote.ultimaAtualizacao).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Timeline de Etapas */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-6">Jornada do Lote</h2>

        <div className="space-y-4">
          {etapas.map((etapa, idx) => (
            <div key={etapa.numero}>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                        etapa.status === 'completo'
                          ? 'bg-green-500'
                          : etapa.status === 'ativo'
                          ? 'bg-blue-500'
                          : 'bg-gray-400'
                      }`}
                    >
                      {etapa.numero}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{etapa.nome}</h3>
                      {etapa.data && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(etapa.data).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  {etapa.dados && <p className="text-sm text-gray-600 ml-14 mb-2">{etapa.dados}</p>}
                  <span
                    className={`inline-block ml-14 px-2 py-1 rounded text-xs font-semibold ${
                      statusColors[etapa.status]
                    }`}
                  >
                    {etapa.status === 'completo' && '✓ Completo'}
                    {etapa.status === 'ativo' && '● Em andamento'}
                    {etapa.status === 'pendente' && '○ Pendente'}
                  </span>
                </div>
              </div>

              {idx < etapas.length - 1 && (
                <div className="ml-5 h-8 border-l-2 border-gray-300"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detalhes por Etapa */}
      <div className="space-y-4">
        {lote.chegadas?.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-lg text-primary mb-3">Chegadas (Etapa 1)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Talhão</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-right">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.chegadas.map((c: any) => (
                    <tr key={c.id} className="border-b">
                      <td className="px-4 py-2">{c.talhaoId}</td>
                      <td className="px-4 py-2">{c.tipoColheita}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {c.quantidadeLitros.toFixed(0)} L
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lote.etapaClassificacao && (
          <div className="card">
            <h3 className="font-bold text-lg text-primary mb-3">Classificação (Etapa 5b)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600">Peneira 17+</p>
                <p className="text-xl font-bold">{lote.etapaClassificacao.peneira17Plus}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Peneira 16</p>
                <p className="text-xl font-bold">{lote.etapaClassificacao.peneira16}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Peneira 15</p>
                <p className="text-xl font-bold">{lote.etapaClassificacao.peneira15}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Pontuação</p>
                <p className="text-xl font-bold">{lote.etapaClassificacao.pontuacaoBebida}</p>
              </div>
            </div>
          </div>
        )}

        {lote.etapaArmazem && (
          <div className="card">
            <h3 className="font-bold text-lg text-primary mb-3">Saída para Armazém (Etapa 7)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600">Peso Total</p>
                <p className="text-xl font-bold">{lote.etapaArmazem.pesoKg.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-600">kg</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Sacas (60kg)</p>
                <p className="text-xl font-bold">{lote.etapaArmazem.quantidadeSacas.toFixed(1)}</p>
              </div>
              {lote.etapaArmazem.nfTransporte && (
                <div>
                  <p className="text-xs text-gray-600">NF Transporte</p>
                  <p className="font-bold">{lote.etapaArmazem.nfTransporte}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Linhagem */}
      {(lote.lotesOrigem?.length > 0 || lote.lotesDestino?.length > 0) && (
        <div className="card bg-light border-l-4 border-primary">
          <h3 className="font-bold text-lg text-primary mb-3">Linhagem</h3>
          {lote.lotesOrigem?.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Lotes de Origem (Fusões):</p>
              <div className="flex flex-wrap gap-2">
                {lote.lotesOrigem.map((id: string) => (
                  <span key={id} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}
          {lote.lotesDestino?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Lotes Destino (Divisões):</p>
              <div className="flex flex-wrap gap-2">
                {lote.lotesDestino.map((id: string) => (
                  <span key={id} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                    {id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão de Voltar */}
      <div>
        <button onClick={() => window.history.back()} className="btn btn-outline">
          ← Voltar
        </button>
      </div>
    </div>
  )
}
