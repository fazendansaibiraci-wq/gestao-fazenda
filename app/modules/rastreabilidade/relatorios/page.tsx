'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { BarChart3, TrendingUp, Calendar, PieChart } from 'lucide-react'

export default function RelatariosPage() {
  const { data: session, status } = useSession()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState('mes')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      // Buscar todos os lotes (todos os status)
      const res = await fetch('/api/lotes?status=COLHEITA')
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
    load()
  }, [status])

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  // Relatório 1: % colhida por talhão
  const colheitaPorTalhao: Record<string, { litros: number; sacas: number }> = {}
  lotes.forEach((lote: any) => {
    lote.chegadas?.forEach((chegada: any) => {
      const talhao = chegada.talhaoId
      if (!colheitaPorTalhao[talhao]) {
        colheitaPorTalhao[talhao] = { litros: 0, sacas: 0 }
      }
      colheitaPorTalhao[talhao].litros += chegada.quantidadeLitros
      colheitaPorTalhao[talhao].sacas += chegada.quantidadeLitros / 60
    })
  })

  const totalColhida = Object.values(colheitaPorTalhao).reduce((sum, v) => sum + v.litros, 0)

  // Relatório 2: Total colhido em litros, carretas, sacas
  const totalSacas = totalColhida / 60
  const totalCarretas = totalSacas / 4 // Assumindo carretas de 4 sacas

  // Relatório 3 & 4: Rastreamento e Rendimento (por lote)
  const lotesComClassificacao = lotes.filter((l: any) => l.etapaClassificacao)
  const rendimentoTotal = lotesComClassificacao.reduce((sum: number, l: any) => {
    const rendimento = l.etapaArmazem ? l.etapaArmazem.quantidadeSacas : 0
    return sum + rendimento
  }, 0)

  // Relatório 5: Peneiras entre safras (simulado)
  const peneirasComparadas = lotesComClassificacao.slice(0, 5).map((l: any) => ({
    lote: l.identificador,
    peneira17Plus: l.etapaClassificacao.peneira17Plus,
    peneira16: l.etapaClassificacao.peneira16,
    pontuacao: l.etapaClassificacao.pontuacaoBebida,
  }))

  // Relatório 6: Tempo de secagem
  const tempoSecagem = lotes
    .filter((l: any) => l.etapaSecador?.tempoSecagem)
    .map((l: any) => ({
      lote: l.identificador,
      secador: l.etapaSecador.secadorId,
      tempoHoras: l.etapaSecador.tempoSecagem,
    }))

  const tempoMedioSecagem = tempoSecagem.length > 0
    ? tempoSecagem.reduce((sum, t) => sum + t.tempoHoras, 0) / tempoSecagem.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Relatórios - M4 Rastreabilidade
        </h1>
        <p className="text-gray-600 mt-1">Análise completa de colheita, processamento e rendimento</p>
      </div>

      {/* Filtro de Data */}
      <div className="card">
        <label className="text-sm font-semibold mr-4">Período:</label>
        <select
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="dia">Hoje</option>
          <option value="semana">Esta Semana</option>
          <option value="mes">Este Mês</option>
          <option value="safra">Safra Completa</option>
        </select>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-green-500">
          <p className="text-xs text-gray-600">Total Colhido</p>
          <p className="text-3xl font-bold text-green-600">{totalColhida.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-gray-600 mt-1">litros</p>
        </div>
        <div className="card border-l-4 border-blue-500">
          <p className="text-xs text-gray-600">Equivalente em Sacas</p>
          <p className="text-3xl font-bold text-blue-600">{totalSacas.toFixed(0)}</p>
          <p className="text-xs text-gray-600 mt-1">60 kg cada</p>
        </div>
        <div className="card border-l-4 border-orange-500">
          <p className="text-xs text-gray-600">Lotes Processados</p>
          <p className="text-3xl font-bold text-orange-600">{lotesComClassificacao.length}</p>
          <p className="text-xs text-gray-600 mt-1">classificados</p>
        </div>
        <div className="card border-l-4 border-purple-500">
          <p className="text-xs text-gray-600">Rendimento Total</p>
          <p className="text-3xl font-bold text-purple-600">{rendimentoTotal.toFixed(0)}</p>
          <p className="text-xs text-gray-600 mt-1">sacas beneficiadas</p>
        </div>
      </div>

      {/* Relatório 1: Colheita por Talhão */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
          <PieChart className="w-6 h-6" />
          Relatório 1: Colheita por Talhão
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Talhão</th>
                <th className="px-4 py-2 text-right">Litros</th>
                <th className="px-4 py-2 text-right">Sacas</th>
                <th className="px-4 py-2 text-right">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(colheitaPorTalhao).map(([talhao, dados]) => (
                <tr key={talhao} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{talhao}</td>
                  <td className="px-4 py-2 text-right">{(dados.litros as number).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-2 text-right">{(dados.sacas as number).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right">
                    {totalColhida > 0 ? (((dados.litros as number) / totalColhida) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="bg-primary/5 font-bold">
                <td className="px-4 py-2">TOTAL</td>
                <td className="px-4 py-2 text-right">{totalColhida.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-2 text-right">{totalSacas.toFixed(1)}</td>
                <td className="px-4 py-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Relatório 2: Total Colhido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3">Total em Litros</h3>
          <p className="text-4xl font-bold text-primary">
            {totalColhida.toLocaleString('pt-BR')}
          </p>
          <p className="text-sm text-gray-600 mt-2">Unidade: Litros</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3">Total em Sacas</h3>
          <p className="text-4xl font-bold text-primary">
            {totalSacas.toFixed(0)}
          </p>
          <p className="text-sm text-gray-600 mt-2">Unidade: 60 kg cada</p>
        </div>
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3">Total em Carretas</h3>
          <p className="text-4xl font-bold text-primary">
            {totalCarretas.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600 mt-2">Unidade: 4 sacas cada</p>
        </div>
      </div>

      {/* Relatório 3: Rastreamento (primeiros 5 lotes) */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Relatório 3: Rastreamento de Lotes
        </h2>
        <div className="space-y-3">
          {lotes.slice(0, 5).map((lote: any) => (
            <div key={lote.id} className="border rounded p-3 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-primary">{lote.identificador}</p>
                  <p className="text-xs text-gray-600">
                    Criado: {new Date(lote.dataCriacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {lote.statusAtual}
                </span>
              </div>
              <p className="text-sm mt-2">
                {lote.quantidadeTotal.toFixed(0)} L ({(lote.quantidadeTotal / 60).toFixed(1)} sacas)
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Relatório 4: Rendimento */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Relatório 4: Rendimento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-light p-4 rounded">
            <p className="text-xs text-gray-600 mb-2">Lotes com Classificação</p>
            <p className="text-3xl font-bold text-primary">{lotesComClassificacao.length}</p>
          </div>
          <div className="bg-light p-4 rounded">
            <p className="text-xs text-gray-600 mb-2">Total Beneficiado</p>
            <p className="text-3xl font-bold text-primary">{rendimentoTotal.toFixed(0)} sacas</p>
          </div>
          {lotesComClassificacao.length > 0 && (
            <div className="bg-light p-4 rounded">
              <p className="text-xs text-gray-600 mb-2">Rendimento Médio</p>
              <p className="text-3xl font-bold text-primary">
                {(rendimentoTotal / lotesComClassificacao.length).toFixed(1)}
              </p>
              <p className="text-xs text-gray-600">sacas/lote</p>
            </div>
          )}
        </div>
      </div>

      {/* Relatório 5: Peneiras Comparadas */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4">Relatório 5: Comparação de Peneiras</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Lote</th>
                <th className="px-4 py-2 text-right">Peneira 17+</th>
                <th className="px-4 py-2 text-right">Peneira 16</th>
                <th className="px-4 py-2 text-right">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              {peneirasComparadas.map((item) => (
                <tr key={item.lote} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{item.lote}</td>
                  <td className="px-4 py-2 text-right">{item.peneira17Plus}%</td>
                  <td className="px-4 py-2 text-right">{item.peneira16}%</td>
                  <td className="px-4 py-2 text-right font-bold">{item.pontuacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Relatório 6: Tempo de Secagem */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4">Relatório 6: Controle de Tempo de Secagem</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-light p-4 rounded">
            <p className="text-xs text-gray-600 mb-2">Tempo Médio de Secagem</p>
            <p className="text-3xl font-bold text-primary">{tempoMedioSecagem.toFixed(1)}</p>
            <p className="text-xs text-gray-600">horas</p>
          </div>
          <div className="bg-light p-4 rounded">
            <p className="text-xs text-gray-600 mb-2">Lotes Secados</p>
            <p className="text-3xl font-bold text-primary">{tempoSecagem.length}</p>
          </div>
        </div>
        {tempoSecagem.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Lote</th>
                  <th className="px-4 py-2 text-right">Secador</th>
                  <th className="px-4 py-2 text-right">Tempo (horas)</th>
                </tr>
              </thead>
              <tbody>
                {tempoSecagem.slice(0, 5).map((item) => (
                  <tr key={item.lote} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{item.lote}</td>
                    <td className="px-4 py-2 text-right">#{item.secador}</td>
                    <td className="px-4 py-2 text-right font-bold">{item.tempoHoras.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Exportar */}
      <div className="flex gap-2">
        <button className="btn btn-primary">📥 Exportar PDF</button>
        <button className="btn btn-secondary">📊 Exportar Excel</button>
      </div>
    </div>
  )
}
