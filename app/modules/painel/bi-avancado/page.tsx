'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { BarChart3, TrendingDown, AlertCircle } from 'lucide-react'

export default function BIAvancadoPage() {
  const { data: session, status } = useSession()
  const [safras, setSafras] = useState<any[]>([])
  const [safraAtiva, setSafraAtiva] = useState<string>('')
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'GERENTE') {
      redirect('/modules')
    }
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const [safrasRes, dataRes] = await Promise.all([
        fetch('/api/safras'),
        safraAtiva ? fetch(`/api/painel/bi-avancado?safraId=${safraAtiva}`) : Promise.resolve(null),
      ])

      if (safrasRes.ok) {
        const safrasData = await safrasRes.json()
        setSafras(safrasData.data || [])

        // Definir safra ativa por padrão
        const ativa = safrasData.data?.find((s: any) => s.status === 'ATIVA')
        if (ativa && !safraAtiva) {
          setSafraAtiva(ativa.id)
        }
      }

      if (dataRes && dataRes.ok) {
        const biData = await dataRes.json()
        setDados(biData.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (safraAtiva) {
      load()
    }
  }, [safraAtiva])

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (!dados) {
    return (
      <div className="card bg-yellow-50 border-l-4 border-yellow-500">
        <p className="text-yellow-800 font-medium">Carregando dados de BI...</p>
      </div>
    )
  }

  const custoTotalMes = dados.custosPorTalhao?.reduce(
    (sum: number, t: any) => sum + t.custoTotal,
    0
  ) || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          BI Avançado - Análise Consolidada
        </h1>
        <p className="text-gray-600 mt-1">Integração de dados M1, M2, M3, M4 - Análise de custos e rendimento</p>
      </div>

      {/* Filtro de Safra */}
      <div className="card">
        <label className="text-sm font-semibold">Safra Ativa:</label>
        <select
          value={safraAtiva}
          onChange={(e) => setSafraAtiva(e.target.value)}
          className="border rounded px-3 py-2 w-full md:w-64 mt-1"
        >
          <option value="">Selecionar safra</option>
          {safras.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} {s.status === 'ATIVA' ? '(Ativa)' : '(Encerrada)'}
            </option>
          ))}
        </select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-l-4 border-green-500">
          <p className="text-xs text-gray-600">Custo Total (Mês)</p>
          <p className="text-3xl font-bold text-green-600">
            R$ {custoTotalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-600 mt-1">M1 + M2 + M3</p>
        </div>

        <div className="card border-l-4 border-blue-500">
          <p className="text-xs text-gray-600">Total Colhido</p>
          <p className="text-3xl font-bold text-blue-600">{(dados.totalColhido || 0).toFixed(0)}</p>
          <p className="text-xs text-gray-600 mt-1">litros</p>
        </div>

        <div className="card border-l-4 border-orange-500">
          <p className="text-xs text-gray-600">Rendimento Médio</p>
          <p className="text-3xl font-bold text-orange-600">
            {dados.rendimentoMedio ? (dados.rendimentoMedio * 100).toFixed(1) : 0}%
          </p>
          <p className="text-xs text-gray-600 mt-1">processado vs colhido</p>
        </div>

        <div className="card border-l-4 border-purple-500">
          <p className="text-xs text-gray-600">Custo por Litro</p>
          <p className="text-3xl font-bold text-purple-600">
            R$ {dados.custoPorLitro ? dados.custoPorLitro.toFixed(2) : 0}
          </p>
          <p className="text-xs text-gray-600 mt-1">cru</p>
        </div>
      </div>

      {/* Custos por Talhão */}
      <div className="card">
        <h2 className="text-2xl font-bold text-primary mb-4 flex items-center gap-2">
          <TrendingDown className="w-6 h-6" />
          Custos Consolidados por Talhão
        </h2>

        {dados.custosPorTalhao && dados.custosPorTalhao.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Talhão</th>
                  <th className="px-4 py-3 text-right font-semibold">Mão de Obra (M1)</th>
                  <th className="px-4 py-3 text-right font-semibold">Combustível (M2)</th>
                  <th className="px-4 py-3 text-right font-semibold">Insumos (M3)</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo/Hectare</th>
                  <th className="px-4 py-3 text-right font-semibold">Colhido (L)</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo/L</th>
                </tr>
              </thead>
              <tbody>
                {dados.custosPorTalhao.map((talhao: any) => (
                  <tr key={talhao.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{talhao.nome}</td>
                    <td className="px-4 py-3 text-right">
                      R$ {talhao.custo_m1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      R$ {talhao.custo_m2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      R$ {talhao.custo_m3.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      R$ {talhao.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      R$ {talhao.custoPorHectare.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">{talhao.colhido.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right text-orange-600 font-semibold">
                      R$ {talhao.custoPerLitro.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Nenhum dado de custos disponível para esta safra</p>
        )}
      </div>

      {/* Comparativo entre Safras */}
      {dados.comparativoSafras && dados.comparativoSafras.length > 1 && (
        <div className="card">
          <h2 className="text-2xl font-bold text-primary mb-4">Comparativo Entre Safras</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Safra</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Colhido (L)</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Custo/L</th>
                  <th className="px-4 py-3 text-right font-semibold">Rendimento</th>
                  <th className="px-4 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {dados.comparativoSafras.map((safra: any) => (
                  <tr key={safra.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{safra.nome}</td>
                    <td className="px-4 py-3 text-right">{safra.totalColhido.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right">
                      R$ {safra.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      R$ {safra.custoPerLitro.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(safra.rendimento * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        safra.status === 'ATIVA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {safra.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Insights & Recomendações
        </h3>
        <ul className="text-sm space-y-2 text-gray-700">
          {dados.insights && dados.insights.length > 0 ? (
            dados.insights.map((insight: string, idx: number) => (
              <li key={idx}>• {insight}</li>
            ))
          ) : (
            <li>• Análise de dados em progresso</li>
          )}
        </ul>
      </div>
    </div>
  )
}
