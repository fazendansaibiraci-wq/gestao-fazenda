'use client'

import { Fragment, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  DollarSign, Clock, TrendingUp, TrendingDown,
  Calendar, ChevronDown, ChevronUp, Coffee
} from 'lucide-react'

interface RegistroDiario {
  data: string
  horaEntrada: string | null
  horaSaida: string | null
  horasBrutas: number
  descontoAlmoco: number
  horasTrabalhadas: number
  cargaContratual: number
  horasExtras: number
  horasDevidas: number
  isFalta: boolean
  motivoFalta: string | null
  passouDiretoAlmoco: boolean
}

interface ResumoFuncionario {
  funcionario: { id: string; name: string; role: string }
  estaNaSafra: boolean
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

export default function ResumoMensalPage() {
  const { data: session, status } = useSession()
  const [resumo, setResumo] = useState<ResumoFuncionario[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [expandidos, setExpandidos] = useState<string[]>([])
  const [buscaFuncionario, setBuscaFuncionario] = useState('')

  const userRole = (session?.user as any)?.role
  const isFuncionario = userRole === 'FUNCIONARIO'

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status, mes, ano])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/resumo-mensal?mes=${mes}&ano=${ano}`)
      const data = await res.json()
      setResumo(data.data?.resumo || [])
      if (isFuncionario && data.data?.resumo?.length > 0) {
        setExpandidos([data.data.resumo[0].funcionario.id])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
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
        </div>
      </div>

      {/* Total geral acumulado — só para gestor */}
      {!isFuncionario && (
        <div className="card bg-primary text-white">
          <p className="text-sm opacity-80">Total acumulado em {meses[mes - 1]}/{ano}</p>
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

      {/* Busca por funcionário — só para gestor */}
      {!isFuncionario && (
        <div>
          <input
            type="text"
            value={buscaFuncionario}
            onChange={(e) => setBuscaFuncionario(e.target.value)}
            placeholder="Buscar funcionário..."
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-80"
          />
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
                      {r.estaNaSafra ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Safra</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Entressafra</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visão simplificada do funcionário: salário fixo + horas extras + horas devidas */}
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">
                      {r.estaNaSafra ? 'Salário Safra' : 'Salário Entressafra'}
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
                </div>

                {/* Botão expandir */}
                <button
                  onClick={() => toggleExpandir(r.funcionario.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                >
                  <Clock className="w-4 h-4" />
                  {expandidos.includes(r.funcionario.id) ? 'Ocultar' : 'Ver'} registros diários
                  {expandidos.includes(r.funcionario.id)
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />
                  }
                </button>

                {/* Registros diários */}
                {expandidos.includes(r.funcionario.id) && (
                  <div className="mt-4 space-y-2">
                    {r.registrosDiarios.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-4">Nenhum registro neste período</p>
                    ) : (
                      r.registrosDiarios.map((dia, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-3 text-sm ${
                            dia.isFalta
                              ? 'bg-red-50 border border-red-100'
                              : dia.horasExtras > 0
                              ? 'bg-green-50 border border-green-100'
                              : dia.horasDevidas > 0
                              ? 'bg-orange-50 border border-orange-100'
                              : 'bg-gray-50 border border-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">
                              {new Date(dia.data).toLocaleDateString('pt-BR', {
                                weekday: 'short', day: '2-digit', month: '2-digit'
                              })}
                            </span>
                            {dia.isFalta ? (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                Falta {dia.motivoFalta ? `— ${dia.motivoFalta}` : ''}
                              </span>
                            ) : dia.horasExtras > 0 ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                +{fmtH(dia.horasExtras)} extras
                              </span>
                            ) : dia.horasDevidas > 0 ? (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                -{fmtH(dia.horasDevidas)} devidas
                              </span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                Normal
                              </span>
                            )}
                          </div>

                          {!dia.isFalta && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-gray-600">
                              <div>
                                <span className="block text-gray-400">Entrada</span>
                                <span className="font-medium">{dia.horaEntrada || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Saída</span>
                                <span className="font-medium">{dia.horaSaida || '—'}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Tempo bruto</span>
                                <span className="font-medium">{fmtH(dia.horasBrutas)}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400 flex items-center gap-1">
                                  <Coffee className="w-3 h-3" /> Almoço
                                </span>
                                <span className={`font-medium ${dia.passouDiretoAlmoco ? 'text-green-600' : 'text-gray-600'}`}>
                                  {dia.passouDiretoAlmoco ? '+ 1h extra' : '- 1h'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-gray-400">Carga contratual</span>
                                <span className="font-medium">{fmtH(dia.cargaContratual)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
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
                  <th className="px-4 py-3 text-left font-semibold">Total acumulado</th>
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
                            {r.estaNaSafra ? (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Safra</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Entressafra</span>
                            )}
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
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpandir(r.funcionario.id) }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary transition-colors"
                              title={expandido ? 'Ocultar registros diários' : 'Ver registros diários'}
                            >
                              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
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
                                    <div
                                      key={idx}
                                      className={`rounded-lg p-3 text-sm ${
                                        dia.isFalta
                                          ? 'bg-red-50 border border-red-100'
                                          : dia.horasExtras > 0
                                          ? 'bg-green-50 border border-green-100'
                                          : dia.horasDevidas > 0
                                          ? 'bg-orange-50 border border-orange-100'
                                          : 'bg-gray-50 border border-gray-100'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium">
                                          {new Date(dia.data).toLocaleDateString('pt-BR', {
                                            weekday: 'short', day: '2-digit', month: '2-digit'
                                          })}
                                        </span>
                                        {dia.isFalta ? (
                                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                            Falta {dia.motivoFalta ? `— ${dia.motivoFalta}` : ''}
                                          </span>
                                        ) : dia.horasExtras > 0 ? (
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                            +{fmtH(dia.horasExtras)} extras
                                          </span>
                                        ) : dia.horasDevidas > 0 ? (
                                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                            -{fmtH(dia.horasDevidas)} devidas
                                          </span>
                                        ) : (
                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                            Normal
                                          </span>
                                        )}
                                      </div>

                                      {!dia.isFalta && (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-gray-600">
                                          <div>
                                            <span className="block text-gray-400">Entrada</span>
                                            <span className="font-medium">{dia.horaEntrada || '—'}</span>
                                          </div>
                                          <div>
                                            <span className="block text-gray-400">Saída</span>
                                            <span className="font-medium">{dia.horaSaida || '—'}</span>
                                          </div>
                                          <div>
                                            <span className="block text-gray-400">Tempo bruto</span>
                                            <span className="font-medium">{fmtH(dia.horasBrutas)}</span>
                                          </div>
                                          <div>
                                            <span className="block text-gray-400 flex items-center gap-1">
                                              <Coffee className="w-3 h-3" /> Almoço
                                            </span>
                                            <span className={`font-medium ${dia.passouDiretoAlmoco ? 'text-green-600' : 'text-gray-600'}`}>
                                              {dia.passouDiretoAlmoco ? '+ 1h extra' : '- 1h'}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="block text-gray-400">Carga contratual</span>
                                            <span className="font-medium">{fmtH(dia.cargaContratual)}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
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
