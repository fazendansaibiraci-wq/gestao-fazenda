'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { PackagePlus, CheckCircle2, X } from 'lucide-react'

function fmt(n: number) {
  return (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dataBR = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

// Texto curto que identifica uma saída num select ou num título.
export function descricaoSaida(s: any) {
  const partes = [dataBR(s.data)]
  if (s.talhao?.nome) partes.push(`Talhão ${s.talhao.nome}`)
  if (s.tipoAtividade) partes.push(s.tipoAtividade)
  partes.push(`saiu ${fmt(s.quantidade)} ${s.produto?.unidadeMedida || ''} de ${s.local?.nome || '—'}`)
  return partes.join(' · ')
}

// Quadro verde de conferência mostrado depois de registrar a devolução.
export function ConferenciaDevolucao({ conferencia, onFechar }: { conferencia: any; onFechar: () => void }) {
  const u = conferencia.unidade
  return (
    <div className="border border-green-300 bg-green-50 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Devolução registrada
          </p>
          <p className="text-sm text-gray-700 mt-1">
            <span className="font-medium">{conferencia.produto}</span> · {fmt(conferencia.quantidade)} {u} voltaram para {conferencia.local}
            {conferencia.talhao ? ` · Talhão ${conferencia.talhao}` : ''}
          </p>
        </div>
        <button onClick={onFechar} className="text-green-700 hover:text-green-900" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1.5 px-3 text-gray-500">Saiu</td><td className="py-1.5 px-3 text-right">{fmt(conferencia.saiu)} {u}</td></tr>
              <tr className="border-b"><td className="py-1.5 px-3 text-gray-500">Devolvido</td><td className="py-1.5 px-3 text-right text-green-700">−{fmt(conferencia.devolvidoTotal)} {u}</td></tr>
              <tr><td className="py-1.5 px-3 font-medium">Usado</td><td className="py-1.5 px-3 text-right font-bold">{fmt(conferencia.usado)} {u}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1.5 px-3 text-gray-500" colSpan={2}>Estoque em <span className="font-medium text-gray-800">{conferencia.local}</span></td></tr>
              <tr className="border-b"><td className="py-1.5 px-3 text-gray-500">Antes</td><td className="py-1.5 px-3 text-right">{fmt(conferencia.saldoAntes)} {u}</td></tr>
              <tr><td className="py-1.5 px-3 font-medium">Agora</td><td className="py-1.5 px-3 text-right font-bold">{fmt(conferencia.saldoDepois)} {u}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Campos da devolução de UMA saída já escolhida.
export function FormDevolucao({
  saida,
  locais,
  onRegistrada,
  onCancelar,
}: {
  saida: any
  locais: any[]
  onRegistrada: (conferencia: any) => void
  onCancelar?: () => void
}) {
  const podeDevolver = saida.quantidade - (saida.devolvido || 0)
  // Devolução volta pra fazenda (FAZ); se a saída for antiga de outro
  // local, esse local também aparece.
  const locaisDevolucao = locais.filter((l) => l.nome === 'FAZ' || l.id === saida.localId)
  const localPadrao = () => saida.localId || locaisDevolucao.find((l) => l.nome === 'FAZ')?.id || ''
  const [form, setForm] = useState({ quantidade: '', data: hojeLocal(), localId: localPadrao(), observacao: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const u = saida.produto?.unidadeMedida || ''

  useEffect(() => {
    setForm({ quantidade: '', data: hojeLocal(), localId: localPadrao(), observacao: '' })
    setErro('')
  }, [saida.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const res = await fetch('/api/devolucoes-produto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saidaId: saida.id, ...form, quantidade: parseFloat(form.quantidade) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao registrar devolução')
        return
      }
      onRegistrada(data.conferencia)
    } catch (err) {
      setErro('Erro ao registrar devolução')
    } finally {
      setSalvando(false)
    }
  }

  const passou = form.quantidade !== '' && parseFloat(form.quantidade) > podeDevolver + 0.0001

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{erro}</div>}
      <p className="text-sm text-gray-600">
        Saíram {fmt(saida.quantidade)} {u}
        {saida.devolvido > 0 ? `, já voltaram ${fmt(saida.devolvido)} ${u}` : ''}. Dá pra devolver até <span className="font-semibold">{fmt(podeDevolver)} {u}</span>.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Quantidade que voltou ({u})</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Data da devolução</span>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Volta para o local</span>
          <select value={form.localId} onChange={(e) => setForm({ ...form, localId: e.target.value })} className="w-full border rounded-lg px-3 py-2" required>
            {locaisDevolucao.length !== 1 && <option value="">Selecionar local</option>}
            {locaisDevolucao.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}{l.id === saida.localId ? ' (de onde saiu)' : ''}</option>
            ))}
          </select>
        </label>
      </div>
      {passou && <p className="text-sm text-red-600">Maior que o que dá pra devolver ({fmt(podeDevolver)} {u})</p>}
      <input
        type="text"
        placeholder="Observação (opcional)"
        value={form.observacao}
        onChange={(e) => setForm({ ...form, observacao: e.target.value })}
        className="w-full border rounded-lg px-3 py-2"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="btn btn-primary disabled:opacity-50">
          {salvando ? 'Registrando...' : 'Confirmar Devolução'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

// Card da tela de Estoque: escolhe o produto, depois a saída, e devolve.
export function RegistrarDevolucaoProduto({ onAtualizado, naJanela }: { onAtualizado: () => void; naJanela?: boolean }) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const isGestor = role === 'GESTOR' || role === 'GERENTE'

  // Dentro da janela da tela de Estoque o formulário já vem aberto.
  const [aberto, setAberto] = useState(!!naJanela)
  const [saidas, setSaidas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [locais, setLocais] = useState<any[]>([])
  const [produtoId, setProdutoId] = useState('')
  const [saidaId, setSaidaId] = useState('')
  const [conferencia, setConferencia] = useState<any | null>(null)
  const conferenciaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isGestor) return
    fetch('/api/locais').then((r) => r.json()).then((d) => setLocais((d.data || []).filter((l: any) => l.status))).catch(() => {})
  }, [isGestor])

  const carregarSaidas = async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/saidas-produto?comSaldoParaDevolver=true')
      const data = await res.json()
      setSaidas(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (aberto) carregarSaidas()
  }, [aberto])

  if (!isGestor) return null

  // Produtos que têm alguma saída com quantidade para devolver.
  const produtosComSaida = Array.from(
    new Map(saidas.map((s) => [s.produtoId, { id: s.produtoId, nome: s.produto?.nomeComercial || '' }])).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome))
  const saidasDoProduto = saidas.filter((s) => s.produtoId === produtoId)
  const saidaEscolhida = saidas.find((s) => s.id === saidaId)

  return (
    <div className={naJanela ? 'space-y-4' : 'card space-y-4'}>
      {!naJanela && (
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-green-700" />
          Devolução ao Estoque (sobra de uma saída)
        </h2>
        <button onClick={() => setAberto(!aberto)} className="text-primary text-sm font-medium">
          {aberto ? 'Fechar' : 'Registrar Devolução'}
        </button>
      </div>
      )}

      {conferencia && (
        <div ref={conferenciaRef}>
          <ConferenciaDevolucao conferencia={conferencia} onFechar={() => setConferencia(null)} />
        </div>
      )}

      {aberto && (
        <div className="space-y-3 border-t pt-4">
          {carregando ? (
            <p className="text-sm text-gray-400">Carregando saídas...</p>
          ) : saidas.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma saída com produto para devolver.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Produto</span>
                <select
                  value={produtoId}
                  onChange={(e) => {
                    setProdutoId(e.target.value)
                    const daquele = saidas.filter((s) => s.produtoId === e.target.value)
                    setSaidaId(daquele.length === 1 ? daquele[0].id : '')
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Selecionar produto</option>
                  {produtosComSaida.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">De qual saída sobrou</span>
                <select
                  value={saidaId}
                  onChange={(e) => setSaidaId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={!produtoId}
                >
                  <option value="">{produtoId ? 'Selecionar saída' : 'Escolha o produto primeiro'}</option>
                  {saidasDoProduto.map((s) => (
                    <option key={s.id} value={s.id}>{descricaoSaida(s)}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {saidaEscolhida && (
            <FormDevolucao
              saida={saidaEscolhida}
              locais={locais}
              onRegistrada={(conf) => {
                setConferencia(conf)
                setTimeout(() => conferenciaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
                setProdutoId('')
                setSaidaId('')
                carregarSaidas()
                onAtualizado()
              }}
            />
          )}
        </div>
      )}

      <div className="border-t pt-3">
        <Link href="/modules/estoque/devolucoes" className="text-sm font-medium text-primary hover:underline">
          Ver histórico de devoluções →
        </Link>
      </div>
    </div>
  )
}
