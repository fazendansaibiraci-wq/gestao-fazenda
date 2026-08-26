'use client'

import { Fragment, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  DollarSign, Clock, TrendingUp, TrendingDown,
  Calendar, ChevronDown, ChevronUp, FileDown
} from 'lucide-react'
import RegistroDiarioCard, { RegistroDiario } from '@/components/RegistroDiarioCard'
import { exportarRegistroDiarioPdf, exportarTodosRegistrosDiariosPdf } from '@/lib/exportarRegistroDiarioPdf'

interface ResumoFuncionario {
  funcionario: { id: string; name: string; role: string; pagamentoProporcionalDiario?: boolean }
  regimeSalario: 'safra' | 'entressafra' | 'misto'
  salarioBase: number
  valorDia: number
  valorHoraNormal: number
  valorHoraExtra: number
  diasTrabalhados: number
  totalFaltas: number
  totalHorasTrabalhadas: number
  totalHorasExtras: number
  totalHorasDevidas: number
  valorHorasExtras: number
  descontoHorasDevidas: number
  descontoFaltas: number
  totalAcumulado: number
  registrosDiarios: RegistroDiario[]
}

function BadgeRegime({ regime }: { regime: 'safra' | 'entressafra' | 'misto' }) {
  if (regime === 'safra') {
    return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Safra</span>
  }
  if (regime === 'entressafra') {
    return <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Entressafra</span>
  }
  return <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Misto</span>
}

export default function ResumoMensalPage() {
  const { data: session, status } = useSession()
  const [resumo, setResumo] = useState<ResumoFuncionario[]>([])
  const [diasSemPeriodo, setDiasSemPeriodo] = useState<string[]>([])
  const [funcionariosSemSalario, setFuncionariosSemSalario] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [expandidos, setExpandidos] = useState<string[]>([])
  const [buscaFuncionario, setBuscaFuncionario] = useState('')

  // Período customizado (ex: "de ontem até dia 15") — alternativa ao
  // seletor de mês/ano. Só é aplicado quando o usuário clica em "Aplicar",
  // pra não disparar buscas com datas incompletas enquanto ele digita.
  const [modoPeriodo, setModoPeriodo] = useState<'mes' | 'customizado'>('mes')
  const [dataInicioCustom, setDataInicioCustom] = useState('')
  const [dataFimCustom, setDataFimCustom] = useState('')
  const [periodoAplicado, setPeriodoAplicado] = useState<{ inicio: string; fim: string } | null>(null)
  const periodoCustomizadoAtivo = modoPeriodo === 'customizado' && !!periodoAplicado

  const userRole = (session?.user as any)?.role
  const isFuncionario = userRole === 'FUNCIONARIO'

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') {
      if (modoPeriodo === 'mes') load()
      else if (periodoAplicado) load()
    }
  }, [status, mes, ano, modoPeriodo, periodoAplicado])

  const load = async () => {
    try {
      setLoading(true)
      const query = periodoCustomizadoAtivo
        ? `dataInicio=${periodoAplicado!.inicio}&dataFim=${periodoAplicado!.fim}`
        : `mes=${mes}&ano=${ano}`
      const res = await fetch(`/api/resumo-mensal?${query}`)
      const data = await res.json()
      setResumo(data.data?.resumo || [])
      setDiasSemPeriodo(data.data?.diasSemPeriodo || [])
      setFuncionariosSemSalario(data.data?.funcionariosSemSalario || [])
      if (isFuncionario && data.data?.resumo?.length > 0) {
        setExpandidos([data.data.resumo[0].funcionario.id])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const aplicarPeriodoCustomizado = () => {
    if (!dataInicioCustom || !dataFimCustom) return
    if (dataInicioCustom > dataFimCustom) return
    setPeriodoAplicado({ inicio: dataInicioCustom, fim: dataFimCustom })
  }

  const toggleExpandir = (id: string) => {
    setExpandidos(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  // Rótulo do período pro cabeçalho do PDF: "Agosto/2026" no modo normal,
  // ou "05/08/2026 a 12/08/2026" no período customizado.
  const periodoLabel = periodoCustomizadoAtivo
    ? `${new Date(periodoAplicado!.inicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(periodoAplicado!.fim + 'T12:00:00').toLocaleDateString('pt-BR')}`
    : `${meses[mes - 1]}/${ano}`

  const handleExportarPdf = (r: ResumoFuncionario) => {
    exportarRegistroDiarioPdf({
      nomeFuncionario: r.funcionario.name,
      mesLabel: periodoLabel,
      ano: periodoCustomizadoAtivo ? undefined as any : ano,
      registrosDiarios: r.registrosDiarios,
    })
  }

  const handleExportarTodosPdf = () => {
    // Exporta a lista já filtrada pela busca (se o gestor tiver buscado um
    // nome, "todos" aqui significa "todos os que estão aparecendo").
    exportarTodosRegistrosDiariosPdf({
      mesLabel: periodoLabel,
      ano: periodoCustomizadoAtivo ? undefined as any : ano,
      funcionarios: resumoFiltrado.map((r) => ({
        nomeFuncionario: r.funcionario.name,
        registrosDiarios: r.registrosDiarios,
      })),
    })
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtH = (h: number) => {
    const horas = Math.floor(h)
    const minutos = Math.round((h - horas) * 60)
    return `${horas}h ${minutos.toString().padStart(2, '0')}min`
  }

  // Lista filtrada por nome do funcionário (busca client-side, "contém", case-insensitive).
  // Para o funcionário comum, buscaFuncionario permanece vazio (campo não é exibido para ele),
  // então o filtro não altera o resultado da sua própria visão.
  const resumoFiltrado = resumo.filter((r) =>
    r.funcionario.name.toLowerCase().includes(buscaFuncionario.toLowerCase())
  )

  const totalAcumuladoGeral = resumoFiltrado.reduce((acc, r) => acc + r.totalAcumulado, 0)
  const totalHorasExtrasGeral = resumoFiltrado.reduce((acc, r) => acc + r.totalHorasExtras, 0)
  const totalHorasDevidasGeral = resumoFiltrado.reduce((acc, r) => acc + r.totalHorasDevidas, 0)

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <DollarSign className="w-8 h-8" />
            Resumo Mensal
          </h1>
          <p className="text-gray-600 mt-1">
            {isFuncionario ? 'Seu resumo acumulado do mês' : 'Acompanhe o acumulado de cada funcionário'}
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <div className="flex items-center border rounded-lg text-sm">
              <button
                onClick={() => setModoPeriodo('mes')}
                className={`px-3 py-2 rounded-l-lg flex-shrink-0 whitespace-nowrap transition-colors ${modoPeriodo === 'mes' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Mês
              </button>
              <button
                onClick={() => setModoPeriodo('customizado')}
                className={`px-3 py-2 rounded-r-lg flex-shrink-0 whitespace-nowrap border-l transition-colors ${modoPeriodo === 'customizado' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Período
              </button>
            </div>
            {modoPeriodo === 'mes' ? (
              <>
                <select
                  value={mes}
                  onChange={(e) => setMes(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {meses.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select
                  value={ano}
                  onChange={(e) => setAno(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {[2024, 2025, 2026].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-auto flex-shrink-0"
                />
                <span className="text-gray-400 text-sm flex-shrink-0">até</span>
                <input
                  type="date"
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm w-auto flex-shrink-0"
                />
                <button
                  onClick={aplicarPeriodoCustomizado}
                  disabled={!dataInicioCustom || !dataFimCustom || dataInicioCustom > dataFimCustom}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Aplicar
                </button>
              </>
            )}
          </div>
          {periodoCustomizadoAtivo && (
            <p className="text-xs text-amber-700 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              Valores em R$ são uma estimativa aproximada nesse modo — a folha oficial usa o mês inteiro.
            </p>
          )}
        </div>
      </div>

      {/* Total geral acumulado — só para gestor */}
      {!isFuncionario && (
        <div className="card bg-primary text-white">
          <p className="text-sm opacity-80">
            Total acumulado em {periodoCustomizadoAtivo ? periodoLabel : `${meses[mes - 1]}/${ano}`}
            {periodoCustomizadoAtivo && <span className="ml-1 opacity-70">(estimado)</span>}
          </p>
          <p className="text-4xl font-bold mt-1">{fmt(totalAcumuladoGeral)}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 text-sm opacity-90">
            <p className="opacity-80">{resumoFiltrado.length} funcionário(s)</p>
            <p className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {fmtH(totalHorasExtrasGeral)} extras
            </p>
            <p className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              {fmtH(totalHorasDevidasGeral)} devidas
            </p>
          </div>
        </div>
      )}

      {/* Busca por funcionário + exportar todos — só para gestor */}
      {!isFuncionario && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="text"
            value={buscaFuncionario}
            onChange={(e) => setBuscaFuncionario(e.target.value)}
            placeholder="Buscar funcionário..."
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-80"
          />
          <button
            onClick={handleExportarTodosPdf}
            disabled={resumoFiltrado.length === 0}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg text-gray-600 hover:text-primary hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:ml-auto"
            title="Exportar PDF de todos os funcionários listados (um por página)"
          >
            <FileDown className="w-4 h-4" />
            Exportar todos ({resumoFiltrado.length})
          </button>
        </div>
      )}

      {diasSemPeriodo.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          ⚠️ {diasSemPeriodo.length === 1
            ? `O dia ${new Date(diasSemPeriodo[0] + 'T12:00:00').toLocaleDateString('pt-BR')} deste período não tem Safra nem Entressafra cadastrada.`
            : `${diasSemPeriodo.length} dias deste período não têm Safra nem Entressafra cadastrada.`} Cadastre o período em Configurações → Safra/Entressafra pra completar o cálculo desses dias.
        </div>
      )}

      {funcionariosSemSalario.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          ⚠️ Sem salário/jornada cadastrado: {funcionariosSemSalario.join(', ')}. Cadastre em Funcionários → Salário
          Safra/Entressafra pra completar o cálculo desses dias.
        </div>
      )}

      {isFuncionario ? (
        /* Visão do funcionário — inalterada */
        resumo.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            Nenhum registro encontrado para este período
          </div>
        ) : (
          <div className="space-y-4">
            {resumo.map((r) => (
              <div key={r.funcionario.id} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-primary">{r.funcionario.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{r.funcionario.role}</span>
                      <BadgeRegime regime={r.regimeSalario} />
                    </div>
                  </div>
                </div>

                {/* Visão simplificada do funcionário: salário fixo + horas extras + horas devidas */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">
                      {r.regimeSalario === 'safra' ? 'Salário Safra' : r.regimeSalario === 'entressafra' ? 'Salário Entressafra' : 'Salário (rateado Safra/Entressafra)'}
                    </span>
                    <span className="font-bold text-lg text-primary">{fmt(r.salarioBase)}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-green-600 flex items-center gap-1 text-sm">
                      <TrendingUp className="w-4 h-4" />
                      Horas extras ({fmtH(r.totalHorasExtras)})
                    </span>
                    <span className="font-bold text-green-600">
                      {r.valorHorasExtras > 0 ? `+ ${fmt(r.valorHorasExtras)}` : fmt(0)}
                    </span>
                  </div>

                  {r.totalHorasDevidas > 0 && (
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-orange-600 flex items-center gap-1 text-sm">
                        <TrendingDown className="w-4 h-4" />
                        Horas devidas
                      </span>
                      <span className="font-bold text-orange-600">
                        {fmtH(r.totalHorasDevidas)}
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 pt-3 flex justify-between items-center">
                    <span className="text-gray-700 font-semibold text-sm">
                      Total
                    </span>
                    <span className="font-bold text-xl text-primary">
                      {fmt(r.totalAcumulado)}
                    </span>
                  </div>
                </div>

                {/* Botão expandir + exportar PDF */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleExpandir(r.funcionario.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                  >
                    <Clock className="w-4 h-4" />
                    {expandidos.includes(r.funcionario.id) ? 'Ocultar' : 'Ver'} registros diários
                    {expandidos.includes(r.funcionario.id)
                      ? <ChevronUp className="w-4 h-4" />
                      : <ChevronDown className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => handleExportarPdf(r)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                    title="Exportar registro diário em PDF"
                  >
                    <FileDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Registros diários */}
                {expandidos.includes(r.funcionario.id) && (
                  <div className="mt-4 space-y-2">
                    {r.registrosDiarios.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-4">Nenhum registro neste período</p>
                    ) : (
                      r.registrosDiarios.map((dia, idx) => (
                        <RegistroDiarioCard
                          key={idx}
                          dia={dia}
                          pagamentoProporcionalDiario={r.funcionario.pagamentoProporcionalDiario}
                        />
                      ))
                    )}
                    <div className="flex justify-center pt-3">
                      <button
                        onClick={() => toggleExpandir(r.funcionario.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ocultar registros diários"
                      >
                        <ChevronUp className="w-4 h-4" />
                        Fechar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Visão do gestor/gerente — tabela compacta com expansão de registros diários */
        resumo.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            Nenhum registro encontrado para este período
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold">Funcionário</th>
                  <th className="px-4 py-3 text-left font-semibold">Regime</th>
                  <th className="px-4 py-3 text-left font-semibold">Dias trabalhados</th>
                  <th className="px-4 py-3 text-left font-semibold">Horas extras</th>
                  <th className="px-4 py-3 text-left font-semibold">Horas devidas</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Total acumulado{periodoCustomizadoAtivo && <span className="font-normal text-gray-400"> (estimado)</span>}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {resumoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Nenhum funcionário encontrado
                    </td>
                  </tr>
                ) : (
                  resumoFiltrado.map((r) => {
                    const expandido = expandidos.includes(r.funcionario.id)
                    return (
                      <Fragment key={r.funcionario.id}>
                        <tr
                          onClick={() => toggleExpandir(r.funcionario.id)}
                          className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">{r.funcionario.name}</td>
                          <td className="px-4 py-3">
                            <BadgeRegime regime={r.regimeSalario} />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.diasTrabalhados}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 font-medium text-green-600">
                              {r.totalHorasExtras > 0 && <TrendingUp className="w-4 h-4" />}
                              {fmtH(r.totalHorasExtras)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 font-medium text-orange-600">
                              {r.totalHorasDevidas > 0 && <TrendingDown className="w-4 h-4" />}
                              {fmtH(r.totalHorasDevidas)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-lg text-primary">{fmt(r.totalAcumulado)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleExportarPdf(r) }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary transition-colors"
                                title="Exportar registro diário em PDF"
                              >
                                <FileDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpandir(r.funcionario.id) }}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary transition-colors"
                                title={expandido ? 'Ocultar registros diários' : 'Ver registros diários'}
                              >
                                {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Registros diários — reaproveitado exatamente como na visão anterior */}
                        {expandido && (
                          <tr className="border-b bg-gray-50/50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="space-y-2">
                                {r.registrosDiarios.length === 0 ? (
                                  <p className="text-center text-gray-400 text-sm py-4">Nenhum registro neste período</p>
                                ) : (
                                  r.registrosDiarios.map((dia, idx) => (
                                    <RegistroDiarioCard
                                      key={idx}
                                      dia={dia}
                                      pagamentoProporcionalDiario={r.funcionario.pagamentoProporcionalDiario}
                                    />
                                  ))
                                )}
                              </div>
                              <div className="flex justify-center pt-3">
                                <button
                                  onClick={() => toggleExpandir(r.funcionario.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Ocultar registros diários"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                  Fechar
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
