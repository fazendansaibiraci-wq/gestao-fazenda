'use client'

import { useEffect, useState } from 'react'
import { MinusCircle, X, Trash2 } from 'lucide-react'

export function RegistrarSaidaProduto({ produtos, onAtualizado }: { produtos: any[]; onAtualizado: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [safras, setSafras] = useState<any[]>([])
  const [saidas, setSaidas] = useState<any[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    produtoId: '',
    quantidade: '',
    data: new Date().toISOString().slice(0, 10),
    talhaoId: '',
    safraId: '',
    observacao: '',
  })

  useEffect(() => {
    carregarHistorico()
    fetch('/api/talhoes').then((r) => r.json()).then((d) => setTalhoes(d.data || []))
    fetch('/api/safras').then((r) => r.json()).then((d) => setSafras(d.data || []))
  }, [])

  const carregarHistorico = async () => {
    setCarregandoHistorico(true)
    try {
      const res = await fetch('/api/saidas-produto')
      const data = await res.json()
      setSaidas(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const produtoSelecionado = produtos.find((p) => p.id === form.produtoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch('/api/saidas-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: form.produtoId,
          quantidade: parseFloat(form.quantidade),
          data: form.data,
          talhaoId: form.talhaoId || null,
          safraId: form.safraId || null,
          observacao: form.observacao || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar saída')
        return
      }
      setForm({ produtoId: '', quantidade: '', data: new Date().toISOString().slice(0, 10), talhaoId: '', safraId: '', observacao: '' })
      await carregarHistorico()
      onAtualizado()
    } catch (err) {
      setErro('Erro ao registrar saída')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id: string) => {
    if (!confirm('Desfazer essa saída? A quantidade volta pro estoque.')) return
    try {
      const res = await fetch(`/api/saidas-produto/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await carregarHistorico()
        onAtualizado()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <MinusCircle className="w-5 h-5 text-red-600" />
          Saída de Produtos
        </h2>
        <button onClick={() => setAberto(!aberto)} className="text-primary text-sm font-medium">
          {aberto ? 'Fechar' : 'Registrar Saída'}
        </button>
      </div>

      {aberto && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
          {erro && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{erro}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.produtoId}
              onChange={(e) => setForm({ ...form, produtoId: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Selecionar produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeComercial} ({(p.quantidadeEstoque || 0).toLocaleString('pt-BR')} {p.unidadeMedida} disponível)
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder={`Quantidade${produtoSelecionado ? ` (${produtoSelecionado.unidadeMedida})` : ''}`}
              value={form.quantidade}
              onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
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
            <select
              value={form.talhaoId}
              onChange={(e) => setForm({ ...form, talhaoId: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Talhão (opcional)</option>
              {talhoes.map((t: any) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
            <select
              value={form.safraId}
              onChange={(e) => setForm({ ...form, safraId: e.target.value })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Safra (opcional)</option>
              {safras.map((s: any) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Observação (opcional)"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? 'Registrando...' : 'Registrar Saída'}
          </button>
        </form>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-600 mb-2">Histórico de saídas</p>
        {carregandoHistorico ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : saidas.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma saída registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-left py-2 px-2">Quantidade</th>
                  <th className="text-left py-2 px-2">Talhão</th>
                  <th className="text-left py-2 px-2">Safra</th>
                  <th className="text-left py-2 px-2">Registrado por</th>
                  <th className="text-left py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{new Date(s.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-2 font-medium">{s.produto?.nomeComercial}</td>
                    <td className="py-2 px-2">{s.quantidade.toLocaleString('pt-BR')} {s.produto?.unidadeMedida}</td>
                    <td className="py-2 px-2">{s.talhao?.nome || '—'}</td>
                    <td className="py-2 px-2">{s.safra?.nome || '—'}</td>
                    <td className="py-2 px-2">{s.registradoPor?.name || '—'}</td>
                    <td className="py-2 px-2">
                      <button onClick={() => handleExcluir(s.id)} title="Desfazer (credita de volta)">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
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
