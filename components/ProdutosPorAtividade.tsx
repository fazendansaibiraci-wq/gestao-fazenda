'use client'

import { useEffect, useMemo, useState } from 'react'

// Aba "Produtos por Atividade" da tela Aplicação de Insumos.
// Lança produtos usados numa atividade (Tipo de Atividade do cadastro, ex:
// PLATONA MAG) por talhão — dados separados da Aplicação de Insumos
// (tabela produtos_atividade), usados no Relatório por Atividade.

interface Talhao { id: string; nome: string; area: number | null }
interface Produto { id: string; nomeComercial: string; unidadeMedida: string; valorUnitario: number }
interface Safra { id: string; nome: string }
interface TipoAtividade { id: number; nome: string }
interface Lancamento {
  id: string
  tipoAtividade: string
  data: string
  quantidade: number
  unidadeSnapshot: string
  valorUnitarioSnapshot: number
  valorTotal: number
  talhao: { id: string; nome: string; area: number | null }
  produto: { id: string; nomeComercial: string; unidadeMedida: string }
  safra: { id: string; nome: string }
  registradoPor: { id: string; name: string }
}
interface Linha { talhaoId: string; produtoId: string; quantidade: string; data: string }

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const paraNumero = (v: string) => parseFloat(String(v).replace(',', '.'))
const linhaVazia = (data: string): Linha => ({ talhaoId: '', produtoId: '', quantidade: '', data })

export default function ProdutosPorAtividade({ talhoes, produtos, safras }: { talhoes: Talhao[]; produtos: Produto[]; safras: Safra[] }) {
  const [tipos, setTipos] = useState<TipoAtividade[]>([])

  // Formulário
  const [tipoAtividade, setTipoAtividade] = useState('')
  const [safraId, setSafraId] = useState(safras[0]?.id || '')
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia(hoje())])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Lista
  const [itens, setItens] = useState<Lancamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [fAtividade, setFAtividade] = useState('')
  const [fSafra, setFSafra] = useState('')
  const [fTalhao, setFTalhao] = useState('')

  useEffect(() => {
    fetch('/api/tipos-atividade?ativo=true')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setTipos(Array.isArray(d) ? d : []))
      .catch(() => setTipos([]))
  }, [])

  useEffect(() => { if (!safraId && safras.length) setSafraId(safras[0].id) }, [safras, safraId])

  useEffect(() => { carregar() }, [fAtividade, fSafra, fTalhao])

  async function carregar() {
    setCarregando(true)
    try {
      const params = new URLSearchParams()
      if (fAtividade) params.set('tipoAtividade', fAtividade)
      if (fSafra) params.set('safraId', fSafra)
      if (fTalhao) params.set('talhaoId', fTalhao)
      const r = await fetch('/api/produtos-atividade?' + params.toString())
      const d = await r.json()
      setItens(Array.isArray(d.data) ? d.data : [])
    } catch {
      setItens([])
    } finally {
      setCarregando(false)
    }
  }

  const produtoInfo = (id: string) => produtos.find(p => p.id === id)
  const talhaoArea = (id: string) => talhoes.find(t => t.id === id)?.area

  const atualizar = (i: number, campo: keyof Linha, v: string) =>
    setLinhas(p => { const u = [...p]; u[i] = { ...u[i], [campo]: v }; return u })
  const adicionar = () => setLinhas(p => [...p, linhaVazia(p[p.length - 1]?.data || hoje())])
  // Repete talhão e data da última linha (pra lançar outro produto no mesmo talhão)
  const repetirTalhao = () => setLinhas(p => {
    const ult = p[p.length - 1]
    return [...p, { talhaoId: ult?.talhaoId || '', produtoId: '', quantidade: '', data: ult?.data || hoje() }]
  })
  const remover = (i: number) => setLinhas(p => (p.length > 1 ? p.filter((_, j) => j !== i) : p))

  const previa = useMemo(() => {
    let total = 0
    const valores = linhas.map(l => {
      const prod = produtoInfo(l.produtoId)
      const q = paraNumero(l.quantidade)
      const v = prod && isFinite(q) && q > 0 ? q * prod.valorUnitario : 0
      total += v
      return v
    })
    return { valores, total }
  }, [linhas, produtos])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!tipoAtividade) { setErro('Escolha a atividade'); return }
    if (!safraId) { setErro('Escolha a safra'); return }
    const preenchidas = linhas.filter(l => l.talhaoId || l.produtoId || l.quantidade)
    if (!preenchidas.length) { setErro('Preencha pelo menos uma linha'); return }
    for (const [i, l] of preenchidas.entries()) {
      const q = paraNumero(l.quantidade)
      if (!l.talhaoId || !l.produtoId || !l.data || !isFinite(q) || q <= 0) {
        setErro(`Linha ${i + 1}: preencha talhão, produto, quantidade (maior que zero) e data`)
        return
      }
    }

    setSalvando(true)
    try {
      const r = await fetch('/api/produtos-atividade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: preenchidas.map(l => ({
            tipoAtividade, safraId, talhaoId: l.talhaoId, produtoId: l.produtoId,
            quantidade: paraNumero(l.quantidade), data: l.data,
          })),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar')
      setSucesso(`${preenchidas.length} lançamento(s) salvo(s) em ${tipoAtividade}.`)
      setLinhas([linhaVazia(preenchidas[preenchidas.length - 1].data)])
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    const r = await fetch('/api/produtos-atividade/' + id, { method: 'DELETE' })
    if (r.ok) setItens(p => p.filter(i => i.id !== id))
    else alert('Não foi possível excluir')
  }

  const totalLista = itens.reduce((s, i) => s + (i.valorTotal || 0), 0)

  return (
    <div className="space-y-6">
      <form onSubmit={salvar} className="space-y-4">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">{sucesso}</div>}

        <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Atividade *</label>
            <select value={tipoAtividade} onChange={e => setTipoAtividade(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecionar</option>
              {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Mesma lista de Tipos de Atividade do Registro de Atividades.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Safra *</label>
            <select value={safraId} onChange={e => setSafraId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">Selecionar</option>
              {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <label className="text-sm font-medium">Produtos usados *</label>
            <div className="flex gap-2">
              <button type="button" onClick={repetirTalhao} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">+ Outro produto no mesmo talhão</button>
              <button type="button" onClick={adicionar} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">+ Adicionar linha</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2">Talhão</th>
                  <th className="py-2 pr-2">Área (ha)</th>
                  <th className="py-2 pr-2">Produto</th>
                  <th className="py-2 pr-2">Quantidade</th>
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2 text-right">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2 min-w-[140px]">
                      <select value={l.talhaoId} onChange={e => atualizar(i, 'talhaoId', e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-gray-500">{talhaoArea(l.talhaoId) ?? '-'}</td>
                    <td className="py-2 pr-2 min-w-[180px]">
                      <select value={l.produtoId} onChange={e => atualizar(i, 'produtoId', e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                        <option value="">Selecionar</option>
                        {produtos.map(p => <option key={p.id} value={p.id}>{p.nomeComercial}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1">
                        <input type="number" step="0.001" min="0" value={l.quantidade} onChange={e => atualizar(i, 'quantidade', e.target.value)} className="w-28 border rounded-lg px-2 py-2 text-sm" />
                        <span className="text-xs text-gray-500">{produtoInfo(l.produtoId)?.unidadeMedida || ''}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <input type="date" value={l.data} onChange={e => atualizar(i, 'data', e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
                    </td>
                    <td className="py-2 pr-2 text-right text-gray-700 whitespace-nowrap">{previa.valores[i] ? `R$ ${brl(previa.valores[i])}` : '-'}</td>
                    <td className="py-2 text-right">
                      {linhas.length > 1 && <button type="button" onClick={() => remover(i)} className="text-red-400 px-1" title="Remover linha">×</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {previa.total > 0 && (
                <tfoot>
                  <tr className="font-semibold">
                    <td colSpan={5} className="py-2 pr-2 text-right">Total</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">R$ {brl(previa.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">O valor usa o preço atual do cadastro do produto e fica guardado no lançamento.</p>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={salvando} className="px-6 py-2 bg-primary hover:bg-[#2C373C] text-white rounded-lg font-medium text-sm disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Salvar lançamentos'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={fAtividade} onChange={e => setFAtividade(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todas as atividades</option>
            {tipos.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
          </select>
          <select value={fSafra} onChange={e => setFSafra(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todas as safras</option>
            {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <select value={fTalhao} onChange={e => setFTalhao(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos os talhões</option>
            {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>

        {carregando ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : itens.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhum produto lançado por atividade</div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E4DDD2] shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-grafite flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Produtos lançados</p>
              <p className="text-xs text-[#C9D2D6]">{itens.length} registro{itens.length === 1 ? '' : 's'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b border-[#E4DDD2]">
                    <th className="py-2 px-4 font-semibold">Data</th>
                    <th className="py-2 px-4 font-semibold">Atividade</th>
                    <th className="py-2 px-4 font-semibold">Safra</th>
                    <th className="py-2 px-4 font-semibold">Talhão</th>
                    <th className="py-2 px-4 font-semibold">Produto</th>
                    <th className="py-2 px-4 font-semibold text-right">Quantidade</th>
                    <th className="py-2 px-4 font-semibold text-right">Valor</th>
                    <th className="py-2 px-4 font-semibold">Registrado por</th>
                    <th className="py-2 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, i) => (
                    <tr key={it.id} className={'border-b border-gray-100 last:border-0 hover:bg-green-50 transition-colors ' + (i % 2 === 1 ? 'bg-gray-50' : '')}>
                      <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">{dataBR(it.data)}</td>
                      <td className="py-2.5 px-4"><span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">{it.tipoAtividade}</span></td>
                      <td className="py-2.5 px-4 text-gray-600">{it.safra?.nome}</td>
                      <td className="py-2.5 px-4 font-medium text-gray-800">{it.talhao?.nome}</td>
                      <td className="py-2.5 px-4 text-gray-700">{it.produto?.nomeComercial}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 whitespace-nowrap">{num(it.quantidade)} {it.unidadeSnapshot}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-green-800 whitespace-nowrap">R$ {brl(it.valorTotal)}</td>
                      <td className="py-2.5 px-4 text-gray-500">{it.registradoPor?.name}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button onClick={() => excluir(it.id)} className="text-xs text-red-600 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-50 transition-colors">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t">
                    <td colSpan={6} className="py-2.5 px-4 text-right">Total</td>
                    <td className="py-2.5 px-4 text-right text-green-800 whitespace-nowrap">R$ {brl(totalLista)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
