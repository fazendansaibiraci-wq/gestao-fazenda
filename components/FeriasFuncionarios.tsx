'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Cadastro de férias por funcionário (Funcionários → aba Férias). Regra de
// 23/09/2026: nos dias de férias não há falta automática; no Resumo Mensal
// os dias aparecem como "Férias", sem desconto (mensalista recebe o
// salário normal) e o 1/3 de férias aparece só como informação.

interface Funcionario {
  id: string
  name: string
  active?: boolean
}

interface Ferias {
  id: string
  funcionarioId: string
  dataInicio: string
  dataFim: string
  observacao: string | null
  funcionario: { id: string; name: string }
}

const fmtData = (iso: string) => iso.split('T')[0].split('-').reverse().join('/')

const diasEntre = (inicio: string, fim: string) => {
  const a = new Date(inicio.split('T')[0] + 'T00:00:00Z').getTime()
  const b = new Date(fim.split('T')[0] + 'T00:00:00Z').getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1
}

export function FeriasFuncionarios({ funcionarios }: { funcionarios: Funcionario[] }) {
  const [ferias, setFerias] = useState<Ferias[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ funcionarioId: '', dataInicio: '', dataFim: '', observacao: '' })

  const carregar = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/ferias')
      const data = await res.json()
      setFerias(data.data || [])
    } catch {
      setErro('Erro ao carregar férias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const salvar = async () => {
    setErro('')
    if (!form.funcionarioId || !form.dataInicio || !form.dataFim) {
      setErro('Preencha funcionário, início e fim')
      return
    }
    try {
      setSalvando(true)
      const res = await fetch('/api/ferias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao salvar')
        return
      }
      setForm({ funcionarioId: '', dataInicio: '', dataFim: '', observacao: '' })
      carregar()
    } catch {
      setErro('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (f: Ferias) => {
    if (!confirm(`Excluir as férias de ${f.funcionario.name} (${fmtData(f.dataInicio)} a ${fmtData(f.dataFim)})?`)) return
    const res = await fetch(`/api/ferias/${f.id}`, { method: 'DELETE' })
    if (res.ok) carregar()
    else setErro('Erro ao excluir')
  }

  const ativos = funcionarios.filter((f) => f.active !== false)

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-800">Cadastrar férias</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={form.funcionarioId}
            onChange={(e) => setForm({ ...form, funcionarioId: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecionar funcionário</option>
            {ativos.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início</label>
            <input
              type="date"
              value={form.dataInicio}
              onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim (último dia de férias)</label>
            <input
              type="date"
              value={form.dataFim}
              min={form.dataInicio || undefined}
              onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Observação (opcional)"
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            Nos dias de férias não é gerada falta e o Resumo Mensal mostra &quot;Férias&quot; sem desconto. O 1/3 de férias aparece só como informação.
          </p>
          <button onClick={salvar} disabled={salvando} className="btn btn-primary text-sm disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-3">Férias cadastradas</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : ferias.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma férias cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {ferias.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-gray-800">{f.funcionario.name}</p>
                  <p className="text-sm text-gray-600">
                    {fmtData(f.dataInicio)} a {fmtData(f.dataFim)} · {diasEntre(f.dataInicio, f.dataFim)} dias
                    {f.observacao ? ` · ${f.observacao}` : ''}
                  </p>
                </div>
                <button onClick={() => excluir(f)} className="p-2 hover:bg-red-50 rounded" title="Excluir">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
