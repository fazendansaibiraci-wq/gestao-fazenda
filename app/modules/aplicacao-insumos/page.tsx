'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Atividade = 'HERBICIDA' | 'PULVERIZACAO' | 'DRENCH' | 'ADUBACAO' | 'CORRECAO_SOLO'

interface Talhao { id: string; nome: string; area: number | null }
interface Produto { id: string; nomeComercial: string; unidadeMedida: string; valorUnitario: number }
interface Safra { id: string; nome: string }
interface Item {
  id: string
  talhaoId: string
  talhao: { id: string; nome: string; area: number | null }
  produtoId: string
  produto: { id: string; nomeComercial: string; unidadeMedida: string }
  safraId: string
  safra: { id: string; nome: string }
  atividade: Atividade
  qtd: number | null
  numBombas: number | null
  totalQtd: number
  valorTotal: number
  data: string
  numAplicacao: string
  registradoPor: { id: string; name: string }
}

const ATIVIDADE_LABELS: Record<Atividade, string> = {
  HERBICIDA: 'Herbicida',
  PULVERIZACAO: 'Pulverização',
  DRENCH: 'Drench',
  ADUBACAO: 'Adubação',
  CORRECAO_SOLO: 'Correção de Solo',
}
const ATIVIDADES_BOMBA: Atividade[] = ['HERBICIDA', 'PULVERIZACAO', 'DRENCH']
const ATIVIDADES_DIRETO: Atividade[] = ['ADUBACAO', 'CORRECAO_SOLO']

const hoje = () => new Date().toISOString().split('T')[0]

export default function AplicacaoInsumosPage() {
  const { status } = useSession()
  const router = useRouter()

  const [aba, setAba] = useState<'novo' | 'historico'>('novo')

  const [talhoes, setTalhoes] = useState<Talhao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [safras, setSafras] = useState<Safra[]>([])
  const [carregando, setCarregando] = useState(true)

  const [safraId, setSafraId] = useState('')
  const [atividade, setAtividade] = useState<Atividade>('HERBICIDA')
  const [numAplicacao, setNumAplicacao] = useState('1')

  // Modo por bomba
  const [produtosBomba, setProdutosBomba] = useState([{ produtoId: '', dose: '' }])
  const [talhoesBomba, setTalhoesBomba] = useState([{ talhaoId: '', numBombas: '', data: hoje() }])

  // Modo direto
  const [lancamentos, setLancamentos] = useState([{ talhaoId: '', produtoId: '', quantidade: '', data: hoje() }])

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [showNovoProduto, setShowNovoProduto] = useState(false)
  const [novoProduto, setNovoProduto] = useState({ nomeComercial: '', categoria: '', unidadeMedida: 'L', valorUnitario: '' })
  const [savingProduto, setSavingProduto] = useState(false)
  const [erroProduto, setErroProduto] = useState('')

  const modoBomba = ATIVIDADES_BOMBA.includes(atividade)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { if (status === 'authenticated') carregarBase() }, [status])

  async function carregarBase() {
    try {
      const [rt, rp, rs] = await Promise.all([
        fetch('/api/talhoes'),
        fetch('/api/produtos'),
        fetch('/api/safras'),
      ])
      const [dt, dp, ds] = await Promise.all([rt.json(), rp.json(), rs.json()])
      setTalhoes(dt.data || [])
      setProdutos(dp.data || [])
      setSafras(ds.data || [])
      if (ds.data?.length) setSafraId(ds.data[0].id)
    } catch {
      setErro('Erro ao carregar dados base')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarProdutos() {
    try { const r = await fetch('/api/produtos'); const d = await r.json(); setProdutos(d.data || []) } catch {}
  }

  async function salvarNovoProduto(e: React.FormEvent) {
    e.preventDefault()
    setErroProduto('')
    if (!novoProduto.nomeComercial || !novoProduto.categoria || !novoProduto.unidadeMedida) {
      setErroProduto('Preencha nome, categoria e unidade')
      return
    }
    setSavingProduto(true)
    try {
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeComercial: novoProduto.nomeComercial,
          categoria: novoProduto.categoria,
          unidadeMedida: novoProduto.unidadeMedida,
          valorUnitario: novoProduto.valorUnitario ? parseFloat(novoProduto.valorUnitario) : 0,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao cadastrar produto') }
      await carregarProdutos()
      setShowNovoProduto(false)
      setNovoProduto({ nomeComercial: '', categoria: '', unidadeMedida: 'L', valorUnitario: '' })
    } catch (err: unknown) {
      setErroProduto(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSavingProduto(false)
    }
  }

  // --- Produtos (modo bomba) ---
  const addProdutoBomba = () => setProdutosBomba(p => [...p, { produtoId: '', dose: '' }])
  const remProdutoBomba = (i: number) => setProdutosBomba(p => p.filter((_, j) => j !== i))
  const updProdutoBomba = (i: number, field: 'produtoId' | 'dose', v: string) =>
    setProdutosBomba(p => { const u = [...p]; u[i] = { ...u[i], [field]: v }; return u })

  // --- Talhões (modo bomba) ---
  const addTalhaoBomba = () => setTalhoesBomba(p => [...p, { talhaoId: '', numBombas: '', data: hoje() }])
  const remTalhaoBomba = (i: number) => setTalhoesBomba(p => p.filter((_, j) => j !== i))
  const updTalhaoBomba = (i: number, field: 'talhaoId' | 'numBombas' | 'data', v: string) =>
    setTalhoesBomba(p => { const u = [...p]; u[i] = { ...u[i], [field]: v }; return u })

  // --- Lançamentos (modo direto) ---
  const addLancamento = () => setLancamentos(p => [...p, { talhaoId: '', produtoId: '', quantidade: '', data: hoje() }])
  const remLancamento = (i: number) => setLancamentos(p => p.filter((_, j) => j !== i))
  const updLancamento = (i: number, field: 'talhaoId' | 'produtoId' | 'quantidade' | 'data', v: string) =>
    setLancamentos(p => { const u = [...p]; u[i] = { ...u[i], [field]: v }; return u })

  function talhaoNome(id: string) { return talhoes.find(t => t.id === id)?.nome || '' }
  function talhaoArea(id: string) { return talhoes.find(t => t.id === id)?.area }
  function produtoInfo(id: string) { return produtos.find(p => p.id === id) }

  // Prévia (modo bomba): Talhão x Produto
  const previaBomba = useMemo(() => {
    const linhasTalhao = talhoesBomba.filter(t => t.talhaoId && t.numBombas)
    const linhasProduto = produtosBomba.filter(p => p.produtoId && p.dose)
    const linhas: { talhaoId: string; produtoId: string; totalQtd: number; valorTotal: number }[] = []
    for (const t of linhasTalhao) {
      for (const p of linhasProduto) {
        const prod = produtoInfo(p.produtoId)
        if (!prod) continue
        const totalQtd = parseFloat(p.dose) * parseFloat(t.numBombas)
        const valorTotal = totalQtd * prod.valorUnitario
        linhas.push({ talhaoId: t.talhaoId, produtoId: p.produtoId, totalQtd, valorTotal })
      }
    }
    const totalGeral = linhas.reduce((s, l) => s + l.valorTotal, 0)
    return { linhas, totalGeral }
  }, [talhoesBomba, produtosBomba, produtos])

  const previaDireto = useMemo(() => {
    const linhas = lancamentos
      .filter(l => l.talhaoId && l.produtoId && l.quantidade)
      .map(l => {
        const prod = produtoInfo(l.produtoId)
        const totalQtd = parseFloat(l.quantidade)
        const valorTotal = prod ? totalQtd * prod.valorUnitario : 0
        return { ...l, totalQtd, valorTotal }
      })
    const totalGeral = linhas.reduce((s, l) => s + l.valorTotal, 0)
    return { linhas, totalGeral }
  }, [lancamentos, produtos])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!safraId) { setErro('Selecione a safra'); return }

    let itens: any[] = []

    if (modoBomba) {
      const linhasTalhao = talhoesBomba.filter(t => t.talhaoId && t.numBombas && t.data)
      const linhasProduto = produtosBomba.filter(p => p.produtoId && p.dose)
      if (!linhasTalhao.length) { setErro('Adicione pelo menos um talhão com nº de bombas e data'); return }
      if (!linhasProduto.length) { setErro('Adicione pelo menos um produto com dose'); return }
      for (const t of linhasTalhao) {
        for (const p of linhasProduto) {
          const totalQtd = parseFloat(p.dose) * parseFloat(t.numBombas)
          itens.push({
            talhaoId: t.talhaoId,
            produtoId: p.produtoId,
            safraId,
            atividade,
            qtd: parseFloat(p.dose),
            numBombas: parseFloat(t.numBombas),
            totalQtd,
            data: t.data,
            numAplicacao: String(numAplicacao || '1').trim(),
          })
        }
      }
    } else {
      const validos = lancamentos.filter(l => l.talhaoId && l.produtoId && l.quantidade && l.data)
      if (!validos.length) { setErro('Adicione pelo menos um lançamento válido'); return }
      itens = validos.map(l => ({
        talhaoId: l.talhaoId,
        produtoId: l.produtoId,
        safraId,
        atividade,
        qtd: null,
        numBombas: null,
        totalQtd: parseFloat(l.quantidade),
        data: l.data,
        numAplicacao: String(numAplicacao || '1').trim(),
      }))
    }

    setSalvando(true)
    try {
      const r = await fetch('/api/aplicacao-insumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro ao salvar') }
      setSucesso(`${itens.length} lançamento(s) registrado(s) com sucesso.`)
      setProdutosBomba([{ produtoId: '', dose: '' }])
      setTalhoesBomba([{ talhaoId: '', numBombas: '', data: hoje() }])
      setLancamentos([{ talhaoId: '', produtoId: '', quantidade: '', data: hoje() }])
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (status === 'loading' || carregando) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aplicação de Insumos</h1>
          <p className="text-sm text-gray-500">Registre aplicações de herbicida, pulverização, drench, adubação e correção de solo</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        <button onClick={() => setAba('novo')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === 'novo' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>Novo Lançamento</button>
        <button onClick={() => setAba('historico')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === 'historico' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}>Histórico</button>
      </div>

      {aba === 'novo' ? (
        <form onSubmit={salvar} className="space-y-6">
          {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
          {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">{sucesso}</div>}

          <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Safra *</label>
              <select required value={safraId} onChange={e => setSafraId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecionar</option>
                {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Atividade *</label>
              <select required value={atividade} onChange={e => setAtividade(e.target.value as Atividade)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {Object.entries(ATIVIDADE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nº da Aplicação</label>
              <input type="text" value={numAplicacao} onChange={e => setNumAplicacao(e.target.value)} placeholder="Ex: 1, 2ª, reforço..." className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {modoBomba ? (
            <>
              {/* Produtos */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-start gap-2 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs text-blue-700">
                    <strong>Atenção:</strong> As doses são baseadas em <strong>bomba de 1000L</strong>. Se usar bomba de 2000L, multiplique o número de bombas por 2. <strong>Ex:</strong> 2 bombas de 2000L = anotar 4 bombas de 1000L.
                  </p>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Produtos *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowNovoProduto(true); setErroProduto('') }} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">+ Cadastrar produto</button>
                    <button type="button" onClick={addProdutoBomba} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">+ Adicionar produto</button>
                  </div>
                </div>
                {produtosBomba.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select value={p.produtoId} onChange={e => updProdutoBomba(i, 'produtoId', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                      <option value="">Selecionar produto</option>
                      {produtos.map(pr => <option key={pr.id} value={pr.id}>{pr.nomeComercial}</option>)}
                    </select>
                    <input type="number" placeholder="Dose por bomba" step="0.001" min="0" value={p.dose} onChange={e => updProdutoBomba(i, 'dose', e.target.value)} className="w-40 border rounded-lg px-2 py-2 text-sm" />
                    <span className="text-xs text-gray-500 self-center w-16">{produtoInfo(p.produtoId)?.unidadeMedida || ''}</span>
                    {produtosBomba.length > 1 && <button type="button" onClick={() => remProdutoBomba(i)} className="text-red-400 px-1">×</button>}
                  </div>
                ))}
              </div>

              {/* Talhões */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Talhões *</label>
                  <button type="button" onClick={addTalhaoBomba} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">+ Adicionar talhão</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-2">Talhão</th>
                        <th className="py-2 pr-2">Área (ha)</th>
                        <th className="py-2 pr-2">Nº de Bombas</th>
                        <th className="py-2 pr-2">Data</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {talhoesBomba.map((t, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <select value={t.talhaoId} onChange={e => updTalhaoBomba(i, 'talhaoId', e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                              <option value="">Selecionar</option>
                              {talhoes.map(tl => <option key={tl.id} value={tl.id}>{tl.nome}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-2 text-gray-500">{talhaoArea(t.talhaoId) ?? '-'}</td>
                          <td className="py-2 pr-2">
                            <input type="number" step="0.5" min="0" value={t.numBombas} onChange={e => updTalhaoBomba(i, 'numBombas', e.target.value)} className="w-24 border rounded-lg px-2 py-2 text-sm" />
                          </td>
                          <td className="py-2 pr-2">
                            <input type="date" value={t.data} onChange={e => updTalhaoBomba(i, 'data', e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
                          </td>
                          <td className="py-2">
                            {talhoesBomba.length > 1 && <button type="button" onClick={() => remTalhaoBomba(i)} className="text-red-400 px-1">×</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Prévia */}
              {previaBomba.linhas.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">Prévia</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="py-2 pr-2">Talhão</th>
                          <th className="py-2 pr-2">Produto</th>
                          <th className="py-2 pr-2">Total</th>
                          <th className="py-2 pr-2">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previaBomba.linhas.map((l, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-2">{talhaoNome(l.talhaoId)}</td>
                            <td className="py-2 pr-2">{produtoInfo(l.produtoId)?.nomeComercial}</td>
                            <td className="py-2 pr-2">{l.totalQtd.toFixed(2)} {produtoInfo(l.produtoId)?.unidadeMedida}</td>
                            <td className="py-2 pr-2">R$ {l.valorTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold">
                          <td colSpan={3} className="py-2 pr-2 text-right">Total geral</td>
                          <td className="py-2 pr-2">R$ {previaBomba.totalGeral.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Lançamentos diretos */}
              <div className="bg-white rounded-xl border p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Lançamentos *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowNovoProduto(true); setErroProduto('') }} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">+ Cadastrar produto</button>
                    <button type="button" onClick={addLancamento} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">+ Adicionar linha</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-2">Talhão</th>
                        <th className="py-2 pr-2">Produto</th>
                        <th className="py-2 pr-2">Quantidade Total</th>
                        <th className="py-2 pr-2">Data</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <select value={l.talhaoId} onChange={e => updLancamento(i, 'talhaoId', e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                              <option value="">Selecionar</option>
                              {talhoes.map(tl => <option key={tl.id} value={tl.id}>{tl.nome}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <select value={l.produtoId} onChange={e => updLancamento(i, 'produtoId', e.target.value)} className="w-full border rounded-lg px-2 py-2 text-sm">
                              <option value="">Selecionar</option>
                              {produtos.map(pr => <option key={pr.id} value={pr.id}>{pr.nomeComercial}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-1">
                              <input type="number" step="0.01" min="0" value={l.quantidade} onChange={e => updLancamento(i, 'quantidade', e.target.value)} className="w-28 border rounded-lg px-2 py-2 text-sm" />
                              <span className="text-xs text-gray-500">{produtoInfo(l.produtoId)?.unidadeMedida || ''}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <input type="date" value={l.data} onChange={e => updLancamento(i, 'data', e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
                          </td>
                          <td className="py-2">
                            {lancamentos.length > 1 && <button type="button" onClick={() => remLancamento(i)} className="text-red-400 px-1">×</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Prévia */}
              {previaDireto.linhas.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-sm font-medium mb-2">Prévia</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="py-2 pr-2">Talhão</th>
                          <th className="py-2 pr-2">Produto</th>
                          <th className="py-2 pr-2">Total</th>
                          <th className="py-2 pr-2">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previaDireto.linhas.map((l, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-2">{talhaoNome(l.talhaoId)}</td>
                            <td className="py-2 pr-2">{produtoInfo(l.produtoId)?.nomeComercial}</td>
                            <td className="py-2 pr-2">{l.totalQtd.toFixed(2)} {produtoInfo(l.produtoId)?.unidadeMedida}</td>
                            <td className="py-2 pr-2">R$ {l.valorTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold">
                          <td colSpan={3} className="py-2 pr-2 text-right">Total geral</td>
                          <td className="py-2 pr-2">R$ {previaDireto.totalGeral.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-3">
            <button type="submit" disabled={salvando} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm">{salvando ? 'Salvando...' : 'Salvar lançamentos'}</button>
          </div>
        </form>
      ) : (
        <Historico talhoes={talhoes} produtos={produtos} safras={safras} />
      )}

      {/* Mini Modal Novo Produto */}
      {showNovoProduto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex justify-between">
              <h2 className="font-semibold">Cadastrar Produto</h2>
              <button onClick={() => setShowNovoProduto(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={salvarNovoProduto} className="p-6 space-y-4">
              {erroProduto && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erroProduto}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Nome Comercial *</label>
                <input type="text" required value={novoProduto.nomeComercial} onChange={e => setNovoProduto(p => ({ ...p, nomeComercial: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: Roundup" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <select required value={novoProduto.categoria} onChange={e => setNovoProduto(p => ({ ...p, categoria: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecionar</option>
                  <option value="Herbicida">Herbicida</option>
                  <option value="Fungicida">Fungicida</option>
                  <option value="Inseticida">Inseticida</option>
                  <option value="Fertilizante">Fertilizante</option>
                  <option value="Corretivo">Corretivo</option>
                  <option value="Adjuvante">Adjuvante</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Unidade *</label>
                  <select required value={novoProduto.unidadeMedida} onChange={e => setNovoProduto(p => ({ ...p, unidadeMedida: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="L">Litro (L)</option>
                    <option value="mL">Mililitro (mL)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="ton">Tonelada (ton)</option>
                    <option value="sc">Saca</option>
                    <option value="un">Unidade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Unitário (R$)</label>
                  <input type="number" step="0.01" value={novoProduto.valorUnitario} onChange={e => setNovoProduto(p => ({ ...p, valorUnitario: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0,00" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNovoProduto(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={savingProduto} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">{savingProduto ? 'Salvando...' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Historico({ talhoes, produtos, safras }: { talhoes: Talhao[]; produtos: Produto[]; safras: Safra[] }) {
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroSafra, setFiltroSafra] = useState('')
  const [filtroTalhao, setFiltroTalhao] = useState('')
  const [filtroAtividade, setFiltroAtividade] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [exportando, setExportando] = useState(false)

  useEffect(() => { carregar() }, [filtroSafra, filtroTalhao, filtroAtividade, dataInicio, dataFim])

  async function carregar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroSafra) params.set('safraId', filtroSafra)
      if (filtroTalhao) params.set('talhaoId', filtroTalhao)
      if (filtroAtividade) params.set('atividade', filtroAtividade)
      if (dataInicio) params.set('dataInicio', dataInicio)
      if (dataFim) params.set('dataFim', dataFim)
      const r = await fetch('/api/aplicacao-insumo?' + params.toString())
      const d = await r.json()
      setItens(d.data || [])
    } catch {
      setItens([])
    } finally {
      setLoading(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await fetch('/api/aplicacao-insumo/' + id, { method: 'DELETE' })
    setItens(p => p.filter(i => i.id !== id))
  }

  const subtotaisPorTalhao = useMemo(() => {
    const map = new Map<string, { nome: string; area: number | null; totalValor: number; qtdItens: number }>()
    for (const it of itens) {
      const atual = map.get(it.talhaoId) || { nome: it.talhao?.nome || '-', area: it.talhao?.area ?? null, totalValor: 0, qtdItens: 0 }
      atual.totalValor += it.valorTotal
      atual.qtdItens += 1
      map.set(it.talhaoId, atual)
    }
    return Array.from(map.values())
  }, [itens])

  const totalGeral = itens.reduce((s, i) => s + i.valorTotal, 0)

  async function exportarExcel() {
    setExportando(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Gestão Fazenda'
      wb.created = new Date()

      const ws = wb.addWorksheet('Aplicação de Insumos')
      const colunas = ['Data', 'Safra', 'Talhão', 'Área (ha)', 'Atividade', 'Produto', 'Unidade', 'Qtd/Bomba', 'Nº Bombas', 'Total', 'Valor Unit.', 'Valor Total', 'Nº Aplicação', 'Registrado por']
      const headerRow = ws.addRow(colunas)
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2d6a4f' } }
        cell.alignment = { horizontal: 'center' }
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } }
      })

      itens.forEach((it, idx) => {
        const row = ws.addRow([
          new Date(it.data).toLocaleDateString('pt-BR'),
          it.safra?.nome,
          it.talhao?.nome,
          it.talhao?.area ?? '',
          ATIVIDADE_LABELS[it.atividade],
          it.produto?.nomeComercial,
          it.produto?.unidadeMedida,
          it.qtd ?? '',
          it.numBombas ?? '',
          it.totalQtd,
          it.totalQtd ? (it.valorTotal / it.totalQtd) : '',
          it.valorTotal,
          it.numAplicacao,
          it.registradoPor?.name,
        ])
        if (idx % 2 === 1) {
          row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F4' } } })
        }
      })

      ws.columns.forEach(col => {
        let max = 12
        col.eachCell?.({ includeEmpty: false }, cell => {
          const len = cell.value ? String(cell.value).length : 0
          if (len > max) max = len
        })
        col.width = Math.min(max + 4, 40)
      })

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aplicacao_insumos_${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Erro ao exportar Excel')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <select value={filtroSafra} onChange={e => setFiltroSafra(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todas as safras</option>
          {safras.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filtroTalhao} onChange={e => setFiltroTalhao(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos os talhões</option>
          {talhoes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={filtroAtividade} onChange={e => setFiltroAtividade(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todas as atividades</option>
          {Object.entries(ATIVIDADE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="flex justify-end">
        <button onClick={exportarExcel} disabled={exportando || itens.length === 0} className="text-sm px-4 py-2 border border-green-200 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50">
          {exportando ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum lançamento encontrado</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3">Safra</th>
                  <th className="py-2 px-3">Talhão</th>
                  <th className="py-2 px-3">Atividade</th>
                  <th className="py-2 px-3">Produto</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Valor Total</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {itens.map(it => (
                  <tr key={it.id} className="border-b last:border-0">
                    <td className="py-2 px-3">{new Date(it.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 px-3">{it.safra?.nome}</td>
                    <td className="py-2 px-3">{it.talhao?.nome}</td>
                    <td className="py-2 px-3">{ATIVIDADE_LABELS[it.atividade]}</td>
                    <td className="py-2 px-3">{it.produto?.nomeComercial}</td>
                    <td className="py-2 px-3">{it.totalQtd.toFixed(2)} {it.produto?.unidadeMedida}</td>
                    <td className="py-2 px-3">R$ {it.valorTotal.toFixed(2)}</td>
                    <td className="py-2 px-3"><button onClick={() => excluir(it.id)} className="text-red-500 text-xs">Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Subtotal por talhão</p>
              <ul className="text-sm space-y-1">
                {subtotaisPorTalhao.map((s, i) => (
                  <li key={i} className="flex justify-between items-baseline">
                    <span>{s.nome} ({s.qtdItens})</span>
                    <span className="text-right">
                      R$ {s.totalValor.toFixed(2)}
                      {s.area && s.area > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                          (R$ {(s.totalValor / s.area).toFixed(2)}/ha)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-end justify-end">
              <p className="text-xs text-gray-500">Total geral</p>
              <p className="text-xl font-bold">R$ {totalGeral.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
