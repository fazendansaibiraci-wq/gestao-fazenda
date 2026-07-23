'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Gauge } from 'lucide-react'

export function AjustarHorimetro({ maquinas }: { maquinas: any[] }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR'

  const [aberto, setAberto] = useState(false)
  const [ajustes, setAjustes] = useState<any[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    maquinaId: '',
    horimetroNovo: '',
    data: new Date().toISOString().slice(0, 10),
    observacao: '',
  })

  useEffect(() => {
    carregarHistorico()
  }, [])

  const carregarHistorico = async () => {
    setCarregandoHistorico(true)
    try {
      const res = await fetch('/api/ajustes-horimetro')
      const data = await res.json()
      setAjustes(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const maquinaSelecionada = maquinas.find((m) => m.id === form.maquinaId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch('/api/ajustes-horimetro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquinaId: form.maquinaId,
          horimetroNovo: parseFloat(form.horimetroNovo),
          data: form.data,
          observacao: form.observacao,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar ajuste')
        return
      }
      setForm({ maquinaId: '', horimetroNovo: '', data: new Date().toISOString().slice(0, 10), observacao: '' })
      await carregarHistorico()
    } catch (err) {
      setErro('Erro ao registrar ajuste')
    } finally {
      setSalvando(false)
    }
  }

  if (!isGestor) {
    return null
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Gauge className="w-5 h-5 text-amber-600" />
          Ajuste de Horímetro
        </h2>
        <button onClick={() => setAberto(!aberto)} className="text-primary text-sm font-medium">
          {aberto ? 'Fechar' : 'Registrar Ajuste'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
          {erro && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{erro}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.maquinaId}
              onChange={(e) => setForm({ ...form, maquinaId: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Selecionar máquina</option>
              {maquinas.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nome} (sistema mostra {(m.ultimoHorimetro || 0).toLocaleString('pt-BR')}h)
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="Horímetro correto (lido no painel da máquina)"
              value={form.horimetroNovo}
              onChange={(e) => setForm({ ...form, horimetroNovo: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            />
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Motivo do ajuste (obrigatório)"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            />
          </div>
          <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? 'Registrando...' : 'Confirmar Ajuste'}
          </button>
        </form>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-600 mb-2">Histórico de ajustes</p>
        {carregandoHistorico ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : ajustes.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum ajuste registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Máquina</th>
                  <th className="text-left py-2 px-2">Antes</th>
                  <th className="text-left py-2 px-2">Depois</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                  <th className="text-left py-2 px-2">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {ajustes.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-2 font-medium">{a.maquina?.nome}</td>
                    <td className="py-2 px-2">{a.horimetroAnterior.toLocaleString('pt-BR')}h</td>
                    <td className="py-2 px-2">{a.horimetroNovo.toLocaleString('pt-BR')}h</td>
                    <td className="py-2 px-2">{a.observacao}</td>
                    <td className="py-2 px-2">{a.registradoPor?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
