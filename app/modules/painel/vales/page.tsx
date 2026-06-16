'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DollarSign, Plus, X } from 'lucide-react'

export default function ValesPage() {
  const { data: session, status } = useSession()
  const [vales, setVales] = useState<any[]>([])
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    usuarioId: '',
    valor: '',
    motivo: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'GERENTE' && session?.user?.role !== 'GESTOR') {
      redirect('/modules')
    }
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const [valesRes, funRes] = await Promise.all([
        fetch(`/api/painel/vales?mes=${filtroMes}`),
        fetch('/api/users?role=FUNCIONARIO'),
      ])

      if (valesRes.ok) {
        const data = await valesRes.json()
        setVales(data.data || [])
      }
      if (funRes.ok) {
        const data = await funRes.json()
        setFuncionarios(data.data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
  }, [filtroMes, status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.usuarioId || !form.valor) {
      alert('Preencha os campos obrigatórios')
      return
    }

    try {
      const res = await fetch('/api/painel/vales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: form.usuarioId,
          valor: parseFloat(form.valor),
          motivo: form.motivo || undefined,
          dataLancamento: new Date(),
        }),
      })

      if (res.ok) {
        alert('Vale lançado com sucesso')
        setForm({ usuarioId: '', valor: '', motivo: '' })
        setShowForm(false)
        load()
      } else {
        alert('Erro ao lançar vale')
      }
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const totalVales = vales.reduce((sum, v) => sum + v.valor, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <DollarSign className="w-8 h-8" />
          Lançamento de Vales
        </h1>
        <p className="text-gray-600 mt-1">Registre adiantamentos para funcionários</p>
      </div>

      {/* Filtro e Botão */}
      <div className="card flex items-center justify-between flex-wrap gap-4">
        <div>
          <label className="text-sm font-semibold">Mês:</label>
          <input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="border rounded px-3 py-2 mt-1"
          />
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Vale
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card bg-light">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Lançar Novo Vale</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Funcionário *</label>
              <select
                value={form.usuarioId}
                onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                className="border rounded px-3 py-2 w-full mt-1"
                required
              >
                <option value="">Selecionar funcionário</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Valor (R$) *</label>
                <input
                  type="number"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  step="0.01"
                  min="0"
                  className="border rounded px-3 py-2 w-full mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold">Motivo</label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="ex: Necessidade pessoal"
                  className="border rounded px-3 py-2 w-full mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1">
                Confirmar Vale
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-outline flex-1"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resumo */}
      <div className="card">
        <h3 className="font-semibold text-lg text-primary mb-3">Resumo do Mês</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-light p-3 rounded">
            <p className="text-xs text-gray-600">Total de Vales</p>
            <p className="text-2xl font-bold text-primary">
              R$ {totalVales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-light p-3 rounded">
            <p className="text-xs text-gray-600">Quantidade de Vales</p>
            <p className="text-2xl font-bold text-primary">{vales.length}</p>
          </div>
        </div>
      </div>

      {/* Tabela de Vales */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold text-lg mb-4">Vales Lançados</h3>
        {vales.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum vale lançado neste mês</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Funcionário</th>
                <th className="px-4 py-3 text-right font-semibold">Valor</th>
                <th className="px-4 py-3 text-left font-semibold">Motivo</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {vales.map((vale) => (
                <tr key={vale.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{vale.funcionario}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    R$ {vale.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">{vale.motivo || '-'}</td>
                  <td className="px-4 py-3">
                    {new Date(vale.dataLancamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                      vale.status === 'DESCONTADO'
                        ? 'bg-green-100 text-green-800'
                        : vale.status === 'CANCELADO'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {vale.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {vale.status === 'PENDENTE' && (
                      <button
                        onClick={() => {
                          // TODO: Implementar cancelamento
                        }}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info */}
      <div className="card bg-light border-l-4 border-primary">
        <h3 className="font-semibold text-primary mb-2">ℹ️ Sobre Vales</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Vales são descontados automaticamente na folha do mês em que foram lançados</li>
          <li>• Funcionários veem apenas o total descontado no próprio resumo</li>
          <li>• O desconto é abatido do salário líquido (após cálculo de extras)</li>
          <li>• Histórico de vales por funcionário é mantido para auditoria</li>
          <li>• Vales cancelados revertem o desconto na folha de pagamento</li>
        </ul>
      </div>
    </div>
  )
}
