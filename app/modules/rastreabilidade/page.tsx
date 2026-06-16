'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Package, Leaf, Wind, Archive, Zap, CheckCircle, Truck, Search } from 'lucide-react'

export default function RastreabilidadePage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('COLHEITA')
  const [searchLote, setSearchLote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const url = `/api/lotes?status=${filtroStatus}`
      const res = await fetch(url)
      const data = await res.json()
      setLotes(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [filtroStatus])

  const filteredLotes = lotes.filter((l: any) =>
    l.identificador.toLowerCase().includes(searchLote.toLowerCase())
  )

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const statusStages = [
    { key: 'COLHEITA', label: 'Colheita', icon: Leaf, color: 'bg-green-100 text-green-800' },
    { key: 'TERREIRO', label: 'Terreiro', icon: Wind, color: 'bg-yellow-100 text-yellow-800' },
    { key: 'SECADOR', label: 'Secador', icon: Zap, color: 'bg-orange-100 text-orange-800' },
    { key: 'TULHA', label: 'Tulha', icon: Archive, color: 'bg-blue-100 text-blue-800' },
    { key: 'BENEFICIO', label: 'Benefício', icon: Zap, color: 'bg-purple-100 text-purple-800' },
    { key: 'CLASSIFICACAO', label: 'Classificação', icon: CheckCircle, color: 'bg-indigo-100 text-indigo-800' },
    { key: 'SILO', label: 'Silo', icon: Package, color: 'bg-cyan-100 text-cyan-800' },
    { key: 'ARMAZEM', label: 'Armazém', icon: Truck, color: 'bg-slate-100 text-slate-800' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Rastreabilidade do Café</h1>
        <p className="text-gray-600 mt-1">Acompanhe cada lote desde a colheita até o armazém</p>
      </div>

      {/* Filtros */}
      <div className="card space-y-4">
        <h3 className="font-semibold">Filtros</h3>
        <div className="space-y-3">
          {/* Busca por lote */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar lote (ex: L2526-001)..."
              value={searchLote}
              onChange={(e) => setSearchLote(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          {/* Status */}
          <div>
            <p className="text-sm font-medium mb-2">Status Atual</p>
            <div className="flex flex-wrap gap-2">
              {statusStages.map((stage) => (
                <button
                  key={stage.key}
                  onClick={() => setFiltroStatus(stage.key)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                    filtroStatus === stage.key
                      ? `${stage.color} scale-105`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline de Etapas */}
      <div className="card">
        <h3 className="font-semibold mb-4">Etapas de Processamento</h3>
        <div className="space-y-3">
          {statusStages.map((stage, idx) => {
            const Icon = stage.icon
            return (
              <div key={stage.key} className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stage.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{stage.label}</p>
                  <p className="text-xs text-gray-500">
                    {idx === 0 && 'Chegada do café no terreiro'}
                    {idx === 1 && 'Meia seca em terreiro'}
                    {idx === 2 && 'Secagem estática - 38.000 L por secador'}
                    {idx === 3 && 'Descanso - 6 tulhas de 76.000 L cada'}
                    {idx === 4 && 'Máquina de benefício'}
                    {idx === 5 && 'Análise de peneiras e pontuação'}
                    {idx === 6 && 'Armazenamento em silos'}
                    {idx === 7 && 'Preparação para venda'}
                  </p>
                </div>
                {idx < statusStages.length - 1 && (
                  <div className="w-0.5 h-8 bg-gray-200 ml-5"></div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lotes */}
      <div className="card">
        <h3 className="font-semibold mb-4">
          Lotes em {statusStages.find((s) => s.key === filtroStatus)?.label}
        </h3>

        {filteredLotes.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum lote neste status</p>
        ) : (
          <div className="space-y-3">
            {filteredLotes.map((lote: any) => (
              <div
                key={lote.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-lg text-primary">{lote.identificador}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    statusStages.find((s) => s.key === lote.statusAtual)?.color
                  }`}>
                    {statusStages.find((s) => s.key === lote.statusAtual)?.label}
                  </span>
                </div>

                {/* Timeline Compacta do Lote */}
                <div className="mt-3 flex gap-1">
                  {statusStages.map((stage) => {
                    const isCompleted = statusStages
                      .map((s) => s.key)
                      .indexOf(lote.statusAtual) >= statusStages.map((s) => s.key).indexOf(stage.key)

                    return (
                      <div
                        key={stage.key}
                        className={`h-2 flex-1 rounded-full transition-all ${
                          isCompleted ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    )
                  })}
                </div>

                {/* Info Rápida */}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Criado</p>
                    <p className="font-medium">
                      {new Date(lote.dataCriacao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {lote.etapaClassificacao && (
                    <div>
                      <p className="text-gray-500">Peneira 17+</p>
                      <p className="font-medium">{lote.etapaClassificacao.peneira17Plus.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ações Rápidas - Novo Lote e Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <a href="/modules/rastreabilidade/novo-lote" className="btn btn-primary text-center">
          ✚ Novo Lote
        </a>
        <a href="/modules/rastreabilidade/relatorios" className="btn btn-outline text-center">
          📊 Relatórios
        </a>
      </div>

      {/* Navegação por Etapa */}
      <div className="card">
        <h3 className="font-semibold mb-4">Navegar por Etapa</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <a href="/modules/rastreabilidade/novo-lote" className="btn btn-sm btn-outline text-center text-xs">
            1️⃣ Colheita
          </a>
          <a href="/modules/rastreabilidade/terreiro" className="btn btn-sm btn-outline text-center text-xs">
            2️⃣ Terreiro
          </a>
          <a href="/modules/rastreabilidade/secador" className="btn btn-sm btn-outline text-center text-xs">
            3️⃣ Secador
          </a>
          <a href="/modules/rastreabilidade/tulha" className="btn btn-sm btn-outline text-center text-xs">
            4️⃣ Tulha
          </a>
          <a href="/modules/rastreabilidade/beneficio" className="btn btn-sm btn-outline text-center text-xs">
            5️⃣ Benefício
          </a>
          <a href="/modules/rastreabilidade/classificacao" className="btn btn-sm btn-outline text-center text-xs">
            5️⃣b Classif.
          </a>
          <a href="/modules/rastreabilidade/silo" className="btn btn-sm btn-outline text-center text-xs">
            6️⃣ Silo
          </a>
          <a href="/modules/rastreabilidade/armazem" className="btn btn-sm btn-outline text-center text-xs">
            7️⃣ Armazém
          </a>
        </div>
      </div>
    </div>
  )
}
