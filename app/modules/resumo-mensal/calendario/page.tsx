'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Calendar as CalendarIcon } from 'lucide-react'
import { RegistroDiario } from '@/components/RegistroDiarioCard'

interface ResumoFuncionario {
  funcionario: { id: string; name: string; role: string; pagamentoProporcionalDiario?: boolean }
  registrosDiarios: RegistroDiario[]
}

export default function CalendarioResumoMensalPage() {
  const { data: session, status } = useSession()
  const [resumo, setResumo] = useState<ResumoFuncionario[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [funcionarioExpandidoId, setFuncionarioExpandidoId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
      redirect('/dashboard')
    }
    if (status === 'authenticated') load()
  }, [status, session, mes, ano])

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

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role && !['GERENTE', 'GESTOR'].includes(session.user.role)) {
    return null
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const fmtHCompacto = (h: number) => {
    const horas = Math.floor(h)
    const minutos = Math.round((h - horas) * 60)
    return minutos > 0 ? `${horas}h${minutos.toString().padStart(2, '0')}` : `${horas}h`
  }

  // Chave "ano-mes-dia" baseada nos componentes locais da data — mesmo padrão
  // já usado no resto do app (ex: RegistroDiarioCard usa toLocaleDateString
  // direto em cima de new Date(dia.data)) pra evitar problemas de fuso.
  const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

  // Agrupa os registros de um funcionário por dia, somando horasTrabalhadas
  // entre múltiplos turnos do mesmo dia (em vez de o último turno
  // sobrescrever o anterior). isFalta/isFolga usam OR (basta um turno ser
  // falta/folga pro dia inteiro contar como tal), e horasDevidas/horasExtras
  // usam o maior valor entre os turnos — como só o "último registro do dia"
  // (conforme a API) carrega o valor agregado correto desses dois campos,
  // os demais turnos do mesmo dia vêm com 0 neles, então Math.max já pega
  // o valor certo sem precisar saber qual registro é o "último" de verdade.
  const agruparRegistrosPorDia = (registros: RegistroDiario[]) => {
    const mapa = new Map<string, RegistroDiario>()
    registros.forEach((reg) => {
      const chave = chaveDia(new Date(reg.data))
      const existente = mapa.get(chave)
      if (!existente) {
        mapa.set(chave, { ...reg })
      } else {
        mapa.set(chave, {
          ...existente,
          horasTrabalhadas: existente.horasTrabalhadas + reg.horasTrabalhadas,
          horasExtras: Math.max(existente.horasExtras, reg.horasExtras),
          horasDevidas: Math.max(existente.horasDevidas, reg.horasDevidas),
          isFalta: existente.isFalta || reg.isFalta,
          isFolga: existente.isFolga || reg.isFolga,
        })
      }
    })
    return mapa
  }

  const diasNoMes = new Date(ano, mes, 0).getDate()
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay()
  const celulasVazias = Array.from({ length: primeiroDiaSemana })
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1)

  const corDaCelula = (registro: RegistroDiario | undefined) => {
    if (!registro) return 'bg-white border-gray-200'
    if (registro.isFalta) return 'bg-red-100 border-red-400'
    if (registro.isFolga) return 'bg-gray-200 border-gray-400'
    if (registro.horasDevidas > 0) return 'bg-yellow-100 border-yellow-400'
    return 'bg-green-100 border-green-400'
  }

  const textoDaCelula = (registro: RegistroDiario | undefined, pagamentoProporcionalDiario?: boolean) => {
    if (!registro) return null
    if (registro.isFalta) return 'Falta'
    if (registro.isFolga) return 'Folga'
    if (registro.horasDevidas > 0 && !pagamentoProporcionalDiario) return `-${fmtHCompacto(registro.horasDevidas)} devendo`
    if (registro.horasTrabalhadas > 0) return fmtHCompacto(registro.horasTrabalhadas)
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <CalendarIcon className="w-8 h-8" />
            Calendário — Resumo Mensal
          </h1>
          <p className="text-gray-600 mt-1">Acompanhe visualmente a frequência de cada funcionário</p>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        <span className="flex items-center gap-1">🟩 Trabalhou normal</span>
        <span className="flex items-center gap-1">🟥 Falta</span>
        <span className="flex items-center gap-1">🟨 Devendo horas / período parcial</span>
        <span className="flex items-center gap-1">⬜ Sem expectativa (folga)</span>
      </div>

      {resumo.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhum registro encontrado para este período
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {resumo.map((r) => {
            const registrosPorDia = agruparRegistrosPorDia(r.registrosDiarios)
            return (
              <div
                key={r.funcionario.id}
                onClick={() => setFuncionarioExpandidoId(r.funcionario.id)}
                className="card cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
              >
                <h3 className="font-semibold text-sm text-primary mb-2 truncate" title={r.funcionario.name}>
                  {r.funcionario.name}
                </h3>
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {diasSemana.map((d) => (
                    <div key={d} className="text-center text-[9px] font-semibold text-gray-400">{d[0]}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {celulasVazias.map((_, i) => (
                    <div key={`vazio-${i}`} />
                  ))}
                  {dias.map((dia) => {
                    const chave = `${ano}-${mes}-${dia}`
                    const registro = registrosPorDia.get(chave)
                    return (
                      <div
                        key={dia}
                        title={textoDaCelula(registro, r.funcionario.pagamentoProporcionalDiario) || undefined}
                        className={`aspect-square rounded border flex items-center justify-center text-[9px] font-medium text-gray-600 ${corDaCelula(registro)}`}
                      >
                        {dia}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {funcionarioExpandidoId && (() => {
        const r = resumo.find(x => x.funcionario.id === funcionarioExpandidoId)
        if (!r) return null
        const registrosPorDia = agruparRegistrosPorDia(r.registrosDiarios)
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setFuncionarioExpandidoId(null)}
          >
            <div
              className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-primary">{r.funcionario.name}</h2>
                <button
                  onClick={() => setFuncionarioExpandidoId(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {diasSemana.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {celulasVazias.map((_, i) => (
                  <div key={`vazio-${i}`} />
                ))}
                {dias.map((dia) => {
                  const chave = `${ano}-${mes}-${dia}`
                  const registro = registrosPorDia.get(chave)
                  const texto = textoDaCelula(registro, r.funcionario.pagamentoProporcionalDiario)
                  return (
                    <div
                      key={dia}
                      className={`aspect-square rounded-lg border p-1.5 flex flex-col items-center justify-center ${corDaCelula(registro)}`}
                    >
                      <span className="text-sm font-medium text-gray-700">{dia}</span>
                      {texto && <span className="text-[10px] text-gray-600 mt-0.5 text-center leading-tight">{texto}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
