'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PackageMinus, Plus, Trash2, CheckCircle2, X } from 'lucide-react'
import { safraDaData } from '@/lib/safraPorData'

export const TIPOS_SAIDA = ['Consumo', 'Perda / descarte', 'Outros']

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

// Data de hoje no fuso do aparelho (toISOString usaria UTC).
function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Item = { produtoId: string; quantidade: string }

const formVazio = () => ({
  data: hojeLocal(),
  tipo: 'Consumo',
  localId: '',
  talhaoId: '',
  tipoAtividade: '',
  safraId: '',
  observacao: '',
})

export function RegistrarSaidaProduto({ produtos, onAtualizado }: { produtos: any[]; onAtualizado: () => void }) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const isGestor = role === 'GESTOR' || role === 'GERENTE'

  const [aberto, setAberto] = useState(false)
  const [locais, setLocais] = useState<any[]>([])
  const [talhoes, setTalhoes] = useState<any[]>([])
  const [safras, setSafras] = useState<any[]>([])
  const [atividades, setAtividades] = useState<any[]>([])
  const [form, setForm] = useState(formVazio())
  const [itens, setItens] = useState<Item[]>([{ produtoId: '', quantidade: '' }])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [conferencia, setConferencia] = useState<any | null>(null)
  const conferenciaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isGestor) return
    // Saída só sai da fazenda (local FAZ, o mesmo do abastecimento de diesel).
    fetch('/api/locais')
      .then((r) => r.json())
      .then((d) => {
        const faz = (d.data || []).filter((l: any) => l.status && l.nome === 'FAZ')
        setLocais(faz)
        if (faz.length === 1) setForm((f) => ({ ...f, localId: f.localId || faz[0].id }))
      })
      .catch(() => {})
    fetch('/api/talhoes').then((r) => r.json()).then((d) => setTalhoes((d.data || []).filter((t: any) => t.status !== 'INATIVO'))).catch(() => {})
    fetch('/api/safras').then((r) => r.json()).then((d) => setSafras(d.data || [])).catch(() => {})
    fetch('/api/tipos-atividade?ativo=true').then((r) => r.json()).then((d) => setAtividades(Array.isArray(d) ? d : d.data || [])).catch(() => {})
  }, [isGestor])

  if (!isGestor) return null

  const saldoNoLocal = (produtoId: string) => {
    const p = produtos.find((x) => x.id === produtoId)
    return p?.estoqueLocais?.find((e: any) => e.localId === form.localId)?.quantidade ?? 0
  }

  // Só produtos com saldo no local escolhido.
  const produtosDoLocal = form.localId
    ? produtos
        .filter((p) => saldoNoLocal(p.id) > 0)
        .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial))
    : []

  const safraAutomatica = form.data ? safraDaData(safras, form.data) : null

  const atualizarItem = (i: number, campo: keyof Item, valor: string) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setConferencia(null)
    const itensValidos = itens.filter((i) => i.produtoId)
    if (itensValidos.length === 0) {
      setErro('Escolha pelo menos um produto')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/saidas-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          itens: itensValidos.map((i) => ({ produtoId: i.produtoId, quantidade: parseFloat(i.quantidade) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar saída')
        return
      }
      const talhao = talhoes.find((t) => t.id === form.talhaoId)?.nome
      setConferencia({ ...data.conferencia, data: form.data, talhao, tipoAtividade: form.tipoAtividade, tipo: form.tipo })
      setTimeout(() => conferenciaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      // Mantém data, local, talhão e atividade (útil pra lançar outra saída
      // parecida); limpa só os produtos e a observação.
      setItens([{ produtoId: '', quantidade: '' }])
      setForm((f) => ({ ...f, observacao: '' }))
      onAtualizado()
    } catch (err) {
      setErro('Erro ao registrar saída')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <PackageMinus className="w-5 h-5 text-red-600" />
          Saída de Estoque
        </h2>
        <button onClick={() => setAberto(!aberto)} className="text-primary text-sm font-medium">
          {aberto ? 'Fechar' : 'Registrar Saída'}
        </button>
      </div>

      {conferencia && (
        <div ref={conferenciaRef} className="border border-green-300 bg-green-50 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Saída registrada
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {new Date(`${conferencia.data}T12:00:00`).toLocaleDateString('pt-BR')} · {conferencia.tipo} · de {conferencia.local}
                {conferencia.talhao ? ` · Talhão ${conferencia.talhao}` : ''}
                {conferencia.tipoAtividade ? ` · ${conferencia.tipoAtividade}` : ''}
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
                  <th className="text-left py-2 px-3 font-medium">Produto ({conferencia.local})</th>
                  <th className="text-right py-2 px-3 font-medium">Antes</th>
                  <th className="text-right py-2 px-3 font-medium">Saída</th>
                  <th className="text-right py-2 px-3 font-medium">Agora</th>
                </tr>
              </thead>
              <tbody>
                {conferencia.itens.map((it: any) => (
                  <tr key={it.produto} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">{it.produto}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{fmt(it.antes)}</td>
                    <td className="py-2 px-3 text-right text-red-600">−{fmt(it.quantidade)}</td>
                    <td className="py-2 px-3 text-right font-bold">{fmt(it.depois)} {it.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aberto && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
          {erro && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{erro}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Data da saída</span>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tipo de saída</span>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                {TIPOS_SAIDA.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Local (de onde sai)</span>
              <select
                value={form.localId}
                onChange={(e) => {
                  setForm({ ...form, localId: e.target.value })
                  setItens([{ produtoId: '', quantidade: '' }])
                }}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                {locais.length !== 1 && <option value="">{locais.length === 0 ? 'Local FAZ não cadastrado' : 'Selecionar local'}</option>}
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Talhão (opcional)</span>
              <select value={form.talhaoId} onChange={(e) => setForm({ ...form, talhaoId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Sem talhão</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Atividade (opcional)</span>
              <select value={form.tipoAtividade} onChange={(e) => setForm({ ...form, tipoAtividade: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                <option value="">Sem atividade</option>
                {atividades.map((a) => (
                  <option key={a.id} value={a.nome}>{a.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Safra</span>
              {/* Fixa: a safra que cobre a data da saída (o servidor grava a mesma). */}
              <input
                type="text"
                value={safraAutomatica ? safraAutomatica.nome : 'Nenhuma safra nessa data'}
                readOnly
                className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">Produtos</p>
            {!form.localId && <p className="text-sm text-gray-400">Escolha o local para ver os produtos com saldo.</p>}
            {form.localId &&
              itens.map((item, i) => {
                const produto = produtos.find((p) => p.id === item.produtoId)
                const saldo = item.produtoId ? saldoNoLocal(item.produtoId) : null
                const passou = saldo !== null && item.quantidade !== '' && parseFloat(item.quantidade) > saldo
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-2">
                      <select
                        value={item.produtoId}
                        onChange={(e) => atualizarItem(i, 'produtoId', e.target.value)}
                        className="flex-1 min-w-0 border rounded-lg px-3 py-2"
                        required={i === 0}
                      >
                        <option value="">Selecionar produto</option>
                        {produtosDoLocal.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nomeComercial} (tem {fmt(saldoNoLocal(p.id))} {p.unidadeMedida})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={produto ? `Qtde (${produto.unidadeMedida})` : 'Qtde'}
                        value={item.quantidade}
                        onChange={(e) => atualizarItem(i, 'quantidade', e.target.value)}
                        className="w-28 sm:w-40 border rounded-lg px-3 py-2"
                        required={!!item.produtoId}
                      />
                      {itens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItens((prev) => prev.filter((_, idx) => idx !== i))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Remover produto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {passou && (
                      <p className="text-sm text-red-600">
                        Maior que o disponível no local ({fmt(saldo!)} {produto?.unidadeMedida})
                      </p>
                    )}
                  </div>
                )
              })}
            {form.localId && (
              <button
                type="button"
                onClick={() => setItens((prev) => [...prev, { produtoId: '', quantidade: '' }])}
                className="text-sm text-primary font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar produto
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Observação (opcional)"
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />

          <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
            {salvando ? 'Registrando...' : 'Confirmar Saída'}
          </button>
        </form>
      )}

      <div className="border-t pt-3">
        <Link href="/modules/estoque/saidas" className="text-sm font-medium text-primary hover:underline">
          Ver histórico de saídas →
        </Link>
      </div>
    </div>
  )
}
