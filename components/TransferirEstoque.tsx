'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeftRight, CheckCircle2, X } from 'lucide-react'

// Data de hoje no fuso do aparelho (toISOString usaria UTC e, depois das
// 21h em Brasília, já mostraria o dia seguinte).
function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export function TransferirEstoque({ produtos, onAtualizado }: { produtos: any[]; onAtualizado: () => void }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conferencia, setConferencia] = useState<any | null>(null)
  const conferenciaRef = useRef<HTMLDivElement>(null)
  const [locais, setLocais] = useState<any[]>([])
  const [form, setForm] = useState({
    produtoId: '',
    localOrigemId: '',
    localDestinoId: '',
    quantidade: '',
    data: hojeLocal(),
    observacao: '',
  })

  useEffect(() => {
    fetch('/api/locais')
      .then((r) => r.json())
      .then((d) => setLocais((d.data || []).filter((l: any) => l.status)))
      .catch(() => {})
  }, [])

  const produtoSelecionado = produtos.find((p) => p.id === form.produtoId)
  const saldoNaOrigem = form.localOrigemId
    ? produtoSelecionado?.estoqueLocais?.find((e: any) => e.localId === form.localOrigemId)?.quantidade ?? 0
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setConferencia(null)
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
      setConferencia(data.conferencia || null)
      // No celular o quadro de conferência pode ficar fora da tela.
      setTimeout(() => conferenciaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      setForm({ produtoId: '', localOrigemId: '', localDestinoId: '', quantidade: '', data: hojeLocal(), observacao: '' })
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

      {conferencia && (
        <div ref={conferenciaRef} className="border border-green-300 bg-green-50 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Transferência registrada
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium">{conferencia.produto}</span> · {fmt(conferencia.quantidade)} {conferencia.unidade} ·{' '}
                {conferencia.localOrigem} → {conferencia.localDestino}
              </p>
            </div>
            <button onClick={() => setConferencia(null)} className="text-green-700 hover:text-green-900" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-3 font-medium">Local</th>
                  <th className="text-right py-2 px-3 font-medium">Antes</th>
                  <th className="text-right py-2 px-3 font-medium">Movimento</th>
                  <th className="text-right py-2 px-3 font-medium">Agora</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium">{conferencia.localOrigem}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{fmt(conferencia.saldoOrigemAntes)}</td>
                  <td className="py-2 px-3 text-right text-red-600">−{fmt(conferencia.quantidade)}</td>
                  <td className="py-2 px-3 text-right font-bold">{fmt(conferencia.saldoOrigemDepois)} {conferencia.unidade}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium">{conferencia.localDestino}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{fmt(conferencia.saldoDestinoAntes)}</td>
                  <td className="py-2 px-3 text-right text-green-700">+{fmt(conferencia.quantidade)}</td>
                  <td className="py-2 px-3 text-right font-bold">{fmt(conferencia.saldoDestinoDepois)} {conferencia.unidade}</td>
                </tr>
                <tr className="bg-gray-50 text-gray-600">
                  <td className="py-2 px-3">Total (todos os locais)</td>
                  <td className="py-2 px-3 text-right">{fmt(conferencia.totalProduto)}</td>
                  <td className="py-2 px-3 text-right">sem alteração</td>
                  <td className="py-2 px-3 text-right font-medium">{fmt(conferencia.totalProduto)} {conferencia.unidade}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      <div className="border-t pt-3">
        <Link href="/modules/estoque/transferencias" className="text-sm font-medium text-primary hover:underline">
          Ver histórico de transferências →
        </Link>
      </div>
    </div>
  )
}
