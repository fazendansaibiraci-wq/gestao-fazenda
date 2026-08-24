'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeftRight } from 'lucide-react'

export function TransferirEstoque({ produtos, onAtualizado }: { produtos: any[]; onAtualizado: () => void }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [aberto, setAberto] = useState(false)
  const [transferencias, setTransferencias] = useState<any[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [locais, setLocais] = useState<any[]>([])
  const [form, setForm] = useState({
    produtoId: '',
    localOrigemId: '',
    localDestinoId: '',
    quantidade: '',
    data: new Date().toISOString().slice(0, 10),
    observacao: '',
  })

  useEffect(() => {
    carregarHistorico()
    fetch('/api/locais')
      .then((r) => r.json())
      .then((d) => setLocais((d.data || []).filter((l: any) => l.status)))
      .catch(() => {})
  }, [])

  const carregarHistorico = async () => {
    setCarregandoHistorico(true)
    try {
      const res = await fetch('/api/transferencias-estoque')
      const data = await res.json()
      setTransferencias(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const produtoSelecionado = produtos.find((p) => p.id === form.produtoId)
  const saldoNaOrigem = form.localOrigemId
    ? produtoSelecionado?.estoqueLocais?.find((e: any) => e.localId === form.localOrigemId)?.quantidade ?? 0
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch('/api/transferencias-estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produtoId: form.produtoId,
          localOrigemId: form.localOrigemId,
          localDestinoId: form.localDestinoId,
          quantidade: parseFloat(form.quantidade),
          data: form.data,
          observacao: form.observacao,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar transferência')
        return
      }
      setForm({ produtoId: '', localOrigemId: '', localDestinoId: '', quantidade: '', data: new Date().toISOString().slice(0, 10), observacao: '' })
      await carregarHistorico()
      onAtualizado()
    } catch (err) {
      setErro('Erro ao registrar transferência')
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
          <ArrowLeftRight className="w-5 h-5 text-sky-600" />
          Transferência de Estoque (entre locais)
        </h2>
        <button onClick={() => setAberto(!aberto)} className="text-primary text-sm font-medium">
          {aberto ? 'Fechar' : 'Registrar Transferência'}
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
              className="border rounded-lg px-3 py-2 md:col-span-2"
              required
            >
              <option value="">Selecionar produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeComercial} (total do sistema: {(p.quantidadeEstoque || 0).toLocaleString('pt-BR')} {p.unidadeMedida})
                </option>
              ))}
            </select>
            <select
              value={form.localOrigemId}
              onChange={(e) => setForm({ ...form, localOrigemId: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Local de origem (de onde sai)</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
            <select
              value={form.localDestinoId}
              onChange={(e) => setForm({ ...form, localDestinoId: e.target.value })}
              className="border rounded-lg px-3 py-2"
              required
            >
              <option value="">Local de destino (pra onde vai)</option>
              {locais
                .filter((l) => l.id !== form.localOrigemId)
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={
                produtoSelecionado && form.localOrigemId
                  ? `Quantidade a transferir (${produtoSelecionado.unidadeMedida}) — disponível ${saldoNaOrigem?.toLocaleString('pt-BR') ?? 0} na origem`
                  : 'Quantidade a transferir'
              }
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
            <input
              type="text"
              placeholder="Observação (opcional)"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="border rounded-lg px-3 py-2 md:col-span-2"
            />
          </div>
          {saldoNaOrigem !== null && form.quantidade !== '' && parseFloat(form.quantidade) > saldoNaOrigem && (
            <p className="text-sm text-red-600">
              Quantidade maior que o disponível na origem ({saldoNaOrigem.toLocaleString('pt-BR')} {produtoSelecionado?.unidadeMedida})
            </p>
          )}
          <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? 'Transferindo...' : 'Confirmar Transferência'}
          </button>
        </form>
      )}

      {aberto && (
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-600 mb-2">Histórico de transferências</p>
        {carregandoHistorico ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : transferencias.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma transferência registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Produto</th>
                  <th className="text-left py-2 px-2">De</th>
                  <th className="text-left py-2 px-2">Para</th>
                  <th className="text-left py-2 px-2">Quantidade</th>
                  <th className="text-left py-2 px-2">Observação</th>
                  <th className="text-left py-2 px-2">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-2 font-medium">{t.produto?.nomeComercial}</td>
                    <td className="py-2 px-2">{t.localOrigem?.nome || '—'}</td>
                    <td className="py-2 px-2">{t.localDestino?.nome || '—'}</td>
                    <td className="py-2 px-2">{t.quantidade.toLocaleString('pt-BR')} {t.produto?.unidadeMedida}</td>
                    <td className="py-2 px-2">{t.observacao || '—'}</td>
                    <td className="py-2 px-2">{t.registradoPor?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
