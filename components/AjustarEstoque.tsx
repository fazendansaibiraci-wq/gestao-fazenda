'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'

export function AjustarEstoque({ produtos, onAtualizado }: { produtos: any[]; onAtualizado: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [ajustes, setAjustes] = useState<any[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    produtoId: '',
    quantidadeNova: '',
    data: new Date().toISOString().slice(0, 10),
    observacao: '',
  })

  useEffect(() => {
    carregarHistorico()
  }, [])

  const carregarHistorico = async () => {
    setCarregandoHistorico(true)
    try {
      const res = await fetch('/api/ajustes-estoque')
      const data = await res.json()
      setAjustes(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const produtoSelecionado = produtos.find((p) => p.id === form.produtoId)
  const diferencaPreview =
    produtoSelecionado && form.quantidadeNova !== ''
      ? parseFloat(form.quantidadeNova) - (produtoSelecionado.quantidadeEstoque || 0)
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch('/api/ajustes-estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: form.produtoId,
          quantidadeNova: parseFloat(form.quantidadeNova),
          data: form.data,
          observacao: form.observacao,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar ajuste')
        return
      }
      setForm({ produtoId: '', quantidadeNova: '', data: new Date().toISOString().slice(0, 10), observacao: '' })
      await carregarHistorico()
      onAtualizado()
    } catch (err) {
      setErro('Erro ao registrar ajuste')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-600" />
          Ajuste de Estoque (contagem física)
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
              value={form.produtoId}
              onChange={(e) => setForm({ ...form, produtoId: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Selecionar produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeComercial} (sistema mostra {(p.quantidadeEstoque || 0).toLocaleString('pt-BR')} {p.unidadeMedida})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={`Quantidade contada${produtoSelecionado ? ` (${produtoSelecionado.unidadeMedida})` : ''}`}
              value={form.quantidadeNova}
              onChange={(e) => setForm({ ...form, quantidadeNova: e.target.value })}
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
          {diferencaPreview !== null && !isNaN(diferencaPreview) && (
            <p className={`text-sm ${diferencaPreview === 0 ? 'text-gray-500' : diferencaPreview > 0 ? 'text-green-600' : 'text-red-600'}`}>
              Diferença: {diferencaPreview > 0 ? '+' : ''}{diferencaPreview.toLocaleString('pt-BR')} {produtoSelecionado?.unidadeMedida}
            </p>
          )}
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
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-left py-2 px-2">Antes</th>
                  <th className="text-left py-2 px-2">Depois</th>
                  <th className="text-left py-2 px-2">Diferença</th>
                  <th className="text-left py-2 px-2">Motivo</th>
                  <th className="text-left py-2 px-2">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {ajustes.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-2 font-medium">{a.produto?.nomeComercial}</td>
                    <td className="py-2 px-2">{a.quantidadeAnterior.toLocaleString('pt-BR')} {a.produto?.unidadeMedida}</td>
                    <td className="py-2 px-2">{a.quantidadeNova.toLocaleString('pt-BR')} {a.produto?.unidadeMedida}</td>
                    <td className={`py-2 px-2 ${a.diferenca > 0 ? 'text-green-600' : a.diferenca < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {a.diferenca > 0 ? '+' : ''}{a.diferenca.toLocaleString('pt-BR')}
                    </td>
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
