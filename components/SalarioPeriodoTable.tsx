'use client'

import { useEffect, useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'

interface Periodo {
  id: string
  tipo: 'SAFRA' | 'ENTRESSAFRA'
  dataInicio: string
  dataFim: string
}

interface FuncionarioSalario {
  id: string
  name: string
  tipoSalario: 'MENSAL' | 'DIARIO' | null
  salario: {
    id: string
    salarioMensal: number | null
    salarioDiaria: number | null
    valorHoraExtra: number | null
  } | null
}

interface LinhaEdicao {
  salarioMensal: string
  salarioDiaria: string
  valorHoraExtra: string
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function SalarioPeriodoTable({ tipo }: { tipo: 'SAFRA' | 'ENTRESSAFRA' }) {
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState('')
  const [loadingPeriodos, setLoadingPeriodos] = useState(true)
  const [funcionarios, setFuncionarios] = useState<FuncionarioSalario[]>([])
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(false)
  const [edicoes, setEdicoes] = useState<Record<string, LinhaEdicao>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [sucessoId, setSucessoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    loadPeriodos()
  }, [])

  useEffect(() => {
    if (periodoSelecionadoId) loadFuncionarios(periodoSelecionadoId)
  }, [periodoSelecionadoId])

  const loadPeriodos = async () => {
    try {
      setLoadingPeriodos(true)
      const res = await fetch('/api/periodos-regime-salarial')
      const data = await res.json()
      const todos: Periodo[] = data.data || []
      const doTipo = todos.filter((p) => p.tipo === tipo).sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
      setPeriodos(doTipo)

      if (doTipo.length > 0) {
        const hoje = new Date().toISOString().split('T')[0]
        const vigente = doTipo.find((p) => p.dataInicio.split('T')[0] <= hoje && p.dataFim.split('T')[0] >= hoje)
        setPeriodoSelecionadoId((vigente || doTipo[0]).id)
      }
    } catch {
      setErro('Erro ao carregar períodos')
    } finally {
      setLoadingPeriodos(false)
    }
  }

  const loadFuncionarios = async (periodoId: string) => {
    try {
      setLoadingFuncionarios(true)
      setErro('')
      const res = await fetch(`/api/salarios-periodo?periodoId=${periodoId}`)
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao carregar funcionários')
        return
      }
      const lista: FuncionarioSalario[] = data.data || []
      setFuncionarios(lista)
      const novasEdicoes: Record<string, LinhaEdicao> = {}
      for (const f of lista) {
        novasEdicoes[f.id] = {
          salarioMensal: f.salario?.salarioMensal != null ? String(f.salario.salarioMensal) : '',
          salarioDiaria: f.salario?.salarioDiaria != null ? String(f.salario.salarioDiaria) : '',
          valorHoraExtra: f.salario?.valorHoraExtra != null ? String(f.salario.valorHoraExtra) : '',
        }
      }
      setEdicoes(novasEdicoes)
    } catch {
      setErro('Erro ao carregar funcionários')
    } finally {
      setLoadingFuncionarios(false)
    }
  }

  const handleCampoChange = (funcionarioId: string, campo: keyof LinhaEdicao, valor: string) => {
    setEdicoes((prev) => ({ ...prev, [funcionarioId]: { ...prev[funcionarioId], [campo]: valor } }))
  }

  const handleSalvar = async (funcionarioId: string) => {
    const edicao = edicoes[funcionarioId]
    setSalvandoId(funcionarioId)
    setSucessoId(null)
    setErro('')
    try {
      const res = await fetch('/api/salarios-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funcionarioId,
          periodoRegimeSalarialId: periodoSelecionadoId,
          salarioMensal: edicao.salarioMensal,
          salarioDiaria: edicao.salarioDiaria,
          valorHoraExtra: edicao.valorHoraExtra,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao salvar')
        return
      }
      setSucessoId(funcionarioId)
      setTimeout(() => setSucessoId((id) => (id === funcionarioId ? null : id)), 2000)
    } catch {
      setErro('Erro ao salvar')
    } finally {
      setSalvandoId(null)
    }
  }

  if (loadingPeriodos) {
    return <div className="card text-center py-8 text-gray-500">Carregando períodos...</div>
  }

  if (periodos.length === 0) {
    return (
      <div className="card p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        Nenhum período de {tipo === 'SAFRA' ? 'Safra' : 'Entressafra'} cadastrado ainda. Cadastre em Configurações →
        Safra/Entressafra antes de lançar os salários.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <label className="block text-sm font-medium mb-2">Período</label>
        <select
          value={periodoSelecionadoId}
          onChange={(e) => setPeriodoSelecionadoId(e.target.value)}
          className="w-full sm:w-96 border rounded-lg px-3 py-2"
        >
          {periodos.map((p) => (
            <option key={p.id} value={p.id}>
              {formatarData(p.dataInicio)} a {formatarData(p.dataFim)}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{erro}</div>
      )}

      <div className="card overflow-x-auto">
        {loadingFuncionarios ? (
          <div className="text-center py-8 text-gray-500">Carregando funcionários...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Funcionário</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Salário (R$)</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Valor Hora Extra (R$/h)</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700">Ação</th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => {
                const edicao = edicoes[f.id]
                if (!edicao) return null
                const semTipoSalario = !f.tipoSalario
                const semCadastro = !f.salario
                return (
                  <tr key={f.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{f.name}</span>
                        {semCadastro && !semTipoSalario && (
                          <span title="Sem salário cadastrado neste período">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </span>
                        )}
                      </div>
                      {semTipoSalario && (
                        <span className="text-xs text-gray-400">Sem tipo de salário definido no cadastro</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {semTipoSalario ? (
                        <span className="text-gray-400">—</span>
                      ) : f.tipoSalario === 'MENSAL' ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edicao.salarioMensal}
                          onChange={(e) => handleCampoChange(f.id, 'salarioMensal', e.target.value)}
                          placeholder="0,00"
                          className="w-32 border rounded-lg px-2 py-1"
                        />
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edicao.salarioDiaria}
                          onChange={(e) => handleCampoChange(f.id, 'salarioDiaria', e.target.value)}
                          placeholder="0,00"
                          className="w-32 border rounded-lg px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {semTipoSalario ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edicao.valorHoraExtra}
                          onChange={(e) => handleCampoChange(f.id, 'valorHoraExtra', e.target.value)}
                          placeholder="0,00"
                          className="w-32 border rounded-lg px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!semTipoSalario && (
                        <button
                          onClick={() => handleSalvar(f.id)}
                          disabled={salvandoId === f.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {salvandoId === f.id ? 'Salvando...' : sucessoId === f.id ? 'Salvo!' : 'Salvar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
