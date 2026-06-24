'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DollarSign, Clock, AlertCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react'

interface ResumoFuncionario {
  funcionario: { id: string; name: string; role: string }
  estaНаSafra: boolean
  salarioBase: number
  diasTrabalhados: number
  totalFaltas: number
  totalHorasTrabalhadas: number
  totalHorasExtras: number
  totalHorasDevidas: number
  valorHorasExtras: number
  descontoHorasDevidas: number
  descontoFaltas: number
  totalAPagar: number
}

export default function ResumoMensalPage() {
  const { data: session, status } = useSession()
  const [resumo, setResumo] = useState<ResumoFuncionario[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'GESTOR') {
      redirect('/dashboard')
    }
    if (status === 'authenticated') load()
  }, [status, mes, ano])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/resumo-mensal?mes=${mes}&ano=${ano}`)
      const data = await res.json()
      setResumo(data.data?.resumo || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const totalGeral = resumo.reduce((acc, r) => acc + r.totalAPagar, 0)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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
          <p className="text-gray-600 mt-1">Salários, horas extras e descontos por funcionário</p>
        </div>

        {/* Filtro mês/ano */}
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

      {/* Total geral */}
      <div className="card bg-primary text-white">
        <p className="text-sm opacity-80">Total a pagar em {meses[mes - 1]}/{ano}</p>
        <p className="text-4xl font-bold mt-1">{fmt(totalGeral)}</p>
        <p className="text-sm opacity-80 mt-1">{resumo.length} funcionários</p>
      </div>

      {/* Cards por funcionário */}
      {resumo.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhum registro encontrado para este período
        </div>
      ) : (
        <div className="space-y-4">
          {resumo.map((r) => (
            <div key={r.funcionario.id} className="card">
              {/* Nome e badge safra */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-primary">{r.funcionario.name}</h3>
                  <span className="text-xs text-gray-500">{r.funcionario.role}</span>
                </div>
                <div className="flex items-center gap-2">
                  {r.estaНаSafra ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                      Período Safra
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                      Entressafra
                    </span>
                  )}
                </div>
              </div>

              {/* Grid de informações */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Dias trabalhados</p>
                  <p className="text-xl font-bold text-gray-800">{r.diasTrabalhados}</p>
                </div>
                <div className={`rounded-lg p-3 ${r.totalFaltas > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500">Faltas</p>
                  <p className={`text-xl font-bold ${r.totalFaltas > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {r.totalFaltas}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Horas trabalhadas</p>
                  <p className="text-xl font-bold text-gray-800">{r.totalHorasTrabalhadas}h</p>
                </div>
                <div className={`rounded-lg p-3 ${r.totalHorasExtras > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500">Horas extras</p>
                  <p className={`text-xl font-bold ${r.totalHorasExtras > 0 ? 'text-green-600' : 'text-gray-800'}`}>
                    {r.totalHorasExtras}h
                  </p>
                </div>
              </div>

              {/* Cálculo financeiro */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Salário base</span>
                  <span className="font-medium">{fmt(r.salarioBase)}</span>
                </div>
                {r.valorHorasExtras > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Horas extras ({r.totalHorasExtras}h)
                    </span>
                    <span className="font-medium text-green-600">+ {fmt(r.valorHorasExtras)}</span>
                  </div>
                )}
                {r.descontoHorasDevidas > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600 flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      Horas a menos ({r.totalHorasDevidas}h)
                    </span>
                    <span className="font-medium text-orange-600">- {fmt(r.descontoHorasDevidas)}</span>
                  </div>
                )}
                {r.descontoFaltas > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Desconto faltas ({r.totalFaltas} dia(s))
                    </span>
                    <span className="font-medium text-red-600">- {fmt(r.descontoFaltas)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Total a pagar</span>
                  <span className="text-primary text-lg">{fmt(r.totalAPagar)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
