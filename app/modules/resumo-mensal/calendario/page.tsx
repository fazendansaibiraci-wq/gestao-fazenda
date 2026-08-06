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
  const [funcionarioSelecionadoId, setFuncionarioSelecionadoId] = useState('')

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

  // Seleciona automaticamente o primeiro funcionário assim que os dados
  // chegarem, se ainda não houver nenhum selecionado.
  useEffect(() => {
    if (!funcionarioSelecionadoId && resumo.length > 0) {
      setFuncionarioSelecionadoId(resumo[0].funcionario.id)
    }
  }, [resumo])

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

  const funcionarioAtual = resumo.find(r => r.funcionario.id === funcionarioSelecionadoId)
  const registrosDiarios = funcionarioAtual?.registrosDiarios || []

  const fmtHCompacto = (h: number) => {
    const horas = Math.floor(h)
    const minutos = Math.round((h - horas) * 60)
    return minutos > 0 ? `${horas}h${minutos.toString().padStart(2, '0')}` : `${horas}h`
  }

  // Chave "ano-mes-dia" baseada nos componentes locais da data — mesmo padrão
  // já usado no resto do app (ex: RegistroDiarioCard usa toLocaleDateString
  // direto em cima de new Date(dia.data)) pra evitar problemas de fuso.
  const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

  const registrosPorDia = new Map<string, RegistroDiario>()
  registrosDiarios.forEach((r) => {
    registrosPorDia.set(chaveDia(new Date(r.data)), r)
  })

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

  const textoDaCelula = (registro: RegistroDiario | undefined) => {
    if (!registro) return null
    if (registro.isFalta) return 'Falta'
    if (registro.isFolga) return 'Folga'
    if (registro.horasDevidas > 0) return `-${fmtHCompacto(registro.horasDevidas)} devendo`
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

      <div>
        <label className="text-sm font-medium block mb-1">Funcionário</label>
        <select
          value={funcionarioSelecionadoId}
          onChange={(e) => setFuncionarioSelecionadoId(e.target.value)}
          className="w-full sm:w-80 border rounded-lg px-3 py-2 text-sm"
        >
          {resumo.length === 0 && <option value="">Nenhum funcionário encontrado</option>}
          {resumo.map((r) => (
            <option key={r.funcionario.id} value={r.funcionario.id}>{r.funcionario.name}</option>
          ))}
        </select>
      </div>

      {resumo.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhum registro encontrado para este período
        </div>
      ) : (
        <div className="card">
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
              const texto = textoDaCelula(registro)
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t text-xs text-gray-600">
            <span className="flex items-center gap-1">🟩 Trabalhou normal</span>
            <span className="flex items-center gap-1">🟥 Falta</span>
            <span className="flex items-center gap-1">🟨 Devendo horas / período parcial</span>
            <span className="flex items-center gap-1">⬜ Sem expectativa (folga)</span>
          </div>
        </div>
      )}
    </div>
  )
}
