'use client'

import { useEffect, useMemo, useState } from 'react'

// Aba "Atividades e Produtos" da tela Aplicação de Insumos.
// Parte das atividades que os funcionários registraram (Registro de
// Atividades): a gestora escolhe uma atividade, APROVA os registros (só os
// aprovados entram no Relatório por Atividade) e lança os produtos usados.
// Safra e talhões vêm dos próprios registros — não há como lançar produto
// numa safra/talhão diferente do trabalho feito.

interface Talhao { id: string; nome: string; area: number | null }
interface Produto { id: string; nomeComercial: string; unidadeMedida: string; valorUnitario: number }
interface Safra { id: string; nome: string; status?: string }
interface Grupo { nome: string; registros: number; aprovados: number; horasHH: number; horasHM: number; talhoes: number; inicio: string; fim: string; valorProdutos: number }
interface RegistroDet {
  id: string; data: string; horaEntrada: string; horaSaida: string | null
  funcionario: string; talhao: string | null; horasHH: number; horasHM: number; maquinas: string[]; aprovado: boolean
}
interface ProdutoLanc { id: string; data: string; talhao: string; produto: string; quantidade: number; unidade: string; valorTotal: number; registradoPor: string }
interface Detalhe { registros: RegistroDet[]; talhoes: { id: string; nome: string; area: number | null; ultimaData: string }[]; produtos: ProdutoLanc[] }
interface Linha { talhaoId: string; produtoId: string; quantidade: string; data: string }

const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number, c = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: c })
const dataBR = (s: string) => s.split('-').reverse().join('/')
const paraNumero = (v: string) => parseFloat(String(v).replace(',', '.'))
const safraPadrao = (safras: Safra[]) => (safras.find(s => s.status === 'ATIVA') || safras[0])?.id || ''

export default function ProdutosPorAtividade({ talhoes, produtos, safras }: { talhoes: Talhao[]; produtos: Produto[]; safras: Safra[] }) {
  const [safraId, setSafraId] = useState(safraPadrao(safras))
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  const [atividade, setAtividade] = useState<string | null>(null)
  const [det, setDet] = useState<Detalhe | null>(null)
  const [carregandoDet, setCarregandoDet] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [aprovando, setAprovando] = useState(false)

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [salvando, setSalvando] = useState(false)
  const [msgProd, setMsgProd] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)

  useEffect(() => { if (!safraId && safras.length) setSafraId(safraPadrao(safras)) }, [safras, safraId])
  useEffect(() => { setAtividade(null); carregarGrupos() }, [safraId])
  useEffect(() => { if (atividade) carregarDetalhe(atividade, true) }, [atividade])

  async function carregarGrupos() {
    if (!safraId) return
    setCarregando(true); setErro('')
    try {
      const r = await fetch('/api/atividades-registradas?safraId=' + encodeURIComponent(safraId))
      const d = await r.json().catch(() => ({}))
      if (r.status === 401) throw new Error('Somente Gestor e Gerente podem usar esta aba.')
      if (!r.ok) throw new Error(d.error || 'Erro ao carregar')
      setGrupos(Array.isArray(d.data) ? d.data : [])
    } catch (e: unknown) {
      setGrupos([]); setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarDetalhe(nome: string, resetarForm = false) {
    setCarregandoDet(true)
    try {
      const params = new URLSearchParams({ safraId, tipoAtividade: nome })
      const r = await fetch('/api/atividades-registradas?' + params.toString())
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Erro ao carregar')
      const detalhe: Detalhe = d.data
      setDet(detalhe)
      setSelecionados(new Set())
      if (resetarForm) {
        const t = detalhe.talhoes.length === 1 ? detalhe.talhoes[0] : null
        setLinhas([{ talhaoId: t?.id || '', produtoId: '', quantidade: '', data: t?.ultimaData || '' }])
        setMsgProd(null)
      }
    } catch (e: unknown) {
      setDet(null); setErro(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setCarregandoDet(false)
    }
  }

  function voltar() {
    setAtividade(null); setDet(null)
    carregarGrupos()
  }

  // ─── Aprovação ───────────────────────────────────────────────────────────
  async function aprovar(ids: string[], aprovarFlag: boolean) {
    if (!ids.length || !atividade) return
    setAprovando(true)
    try {
      const r = await fetch('/api/atividades-registradas/aprovar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, aprovar: aprovarFlag }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Erro ao salvar a aprovação')
      }
      await carregarDetalhe(atividade)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao salvar a aprovação')
    } finally {
      setAprovando(false)
    }
  }
  const alternar = (id: string) => setSelecionados(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todosMarcados = !!det && det.registros.length > 0 && det.registros.every(r => selecionados.has(r.id))
  const marcarTodos = () => setSelecionados(todosMarcados ? new Set() : new Set(det?.registros.map(r => r.id)))
  const pendentes = det ? det.registros.filter(r => !r.aprovado) : []

  // ─── Produtos ────────────────────────────────────────────────────────────
  // Talhões oferecidos: os dos registros da atividade (se nenhum registro tem talhão, todos).
  const talhoesOpcoes = det && det.talhoes.length > 0 ? det.talhoes : talhoes.map(t => ({ id: t.id, nome: t.nome, area: t.area, ultimaData: '' }))
  const produtoInfo = (id: string) => produtos.find(p => p.id === id)
  const ultimaDataTalhao = (id: string) => det?.talhoes.find(t => t.id === id)?.ultimaData || ''
  const atualizar = (i: number, campo: keyof Linha, v: string) => setLinhas(p => {
    const u = [...p]
    u[i] = { ...u[i], [campo]: v }
    if (campo === 'talhaoId' && !u[i].data) u[i].data = ultimaDataTalhao(v)
    return u
  })
  const adicionarLinha = () => setLinhas(p => {
    const ult = p[p.length - 1]
    return [...p, { talhaoId: ult?.talhaoId || '', produtoId: '', quantidade: '', data: ult?.data || '' }]
  })
  const removerLinha = (i: number) => setLinhas(p => (p.length > 1 ? p.filter((_, j) => j !== i) : p))
  const previa = useMemo(() => linhas.map(l => {
    const p = produtoInfo(l.produtoId); const q = paraNumero(l.quantidade)
    return p && isFinite(q) && q > 0 ? q * p.valorUnitario : 0
  }), [linhas, produtos])

  async function salvarProdutos() {
    if (!atividade) return
    setMsgProd(null)
    const preenchidas = linhas.filter(l => l.talhaoId || l.produtoId || l.quantidade)
    if (!preenchidas.length) { setMsgProd({ tipo: 'erro', texto: 'Preencha pelo menos uma linha' }); return }
    for (const [i, l] of preenchidas.entries()) {
      const q = paraNumero(l.quantidade)
      if (!l.talhaoId || !l.produtoId || !l.data || !isFinite(q) || q <= 0) {
        setMsgProd({ tipo: 'erro', texto: `Linha ${i + 1}: preencha talhão, produto, quantidade (maior que zero) e data` }); return
      }
    }
    setSalvando(true)
    try {
      const r = await fetch('/api/produtos-atividade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: preenchidas.map(l => ({ tipoAtividade: atividade, safraId, talhaoId: l.talhaoId, produtoId: l.produtoId, quantidade: paraNumero(l.quantidade), data: l.data })) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar')
      setMsgProd({ tipo: 'ok', texto: `${preenchidas.length} produto(s) lançado(s).` })
      const ult = preenchidas[preenchidas.length - 1]
      setLinhas([{ talhaoId: ult.talhaoId, produtoId: '', quantidade: '', data: ult.data }])
      await carregarDetalhe(atividade)
    } catch (e: unknown) {
      setMsgProd({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar' })
    } finally {
      setSalvando(false)
    }
  }

  async function excluirProduto(id: string) {
    if (!confirm('Excluir este produto lançado?') || !atividade) return
    const r = await fetch('/api/produtos-atividade/' + id, { method: 'DELETE' })
    if (!r.ok) alert('Não foi possível excluir')
    await carregarDetalhe(atividade)
  }

  const gruposFiltrados = grupos.filter(g => !busca || g.nome.toLowerCase().includes(busca.toLowerCase()))
  const totalProdutos = det ? det.produtos.reduce((s, p) => s + p.valorTotal, 0) : 0
  const th = 'py-2 px-3 font-semibold'
  const cabecalho = 'text-left text-xs text-[#4E5A60] bg-[#EFE9DF] border-b'

  // ─── Lista de atividades ─────────────────────────────────────────────────
  if (!atividade) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Safra</label>
            <select value={safraId} onChange={e => setSafraId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {safras.map(s => <option key={s.id} value={s.id}>{s.nome}{s.status === 'ATIVA' ? ' (ativa)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Buscar atividade</label>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex: PLATONA" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="text-sm text-gray-500">Atividades registradas pelos funcionários nesta safra. Abra uma para aprovar os registros e lançar os produtos usados.</p>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{erro}</div>}
        {carregando ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhuma atividade registrada nesta safra</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cabecalho}>
                  <th className={th}>Atividade</th>
                  <th className={th}>Período</th>
                  <th className={th + ' text-right'}>Talhões</th>
                  <th className={th + ' text-right'}>H. homem</th>
                  <th className={th + ' text-right'}>H. máquina</th>
                  <th className={th}>Aprovação</th>
                  <th className={th + ' text-right'}>Produtos</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {gruposFiltrados.map(g => (
                  <tr key={g.nome} className="border-b last:border-0 hover:bg-green-50 cursor-pointer" onClick={() => setAtividade(g.nome)}>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{g.nome}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-gray-600">{dataBR(g.inicio)}{g.fim !== g.inicio ? ` a ${dataBR(g.fim)}` : ''}</td>
                    <td className="py-2.5 px-3 text-right">{g.talhoes}</td>
                    <td className="py-2.5 px-3 text-right">{num(g.horasHH)}</td>
                    <td className="py-2.5 px-3 text-right">{num(g.horasHM)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {g.aprovados === g.registros
                        ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">{g.registros} aprovados</span>
                        : <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">{g.registros - g.aprovados} pendente{g.registros - g.aprovados === 1 ? '' : 's'} de {g.registros}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">{g.valorProdutos > 0 ? brl(g.valorProdutos) : <span className="text-gray-400">nenhum</span>}</td>
                    <td className="py-2.5 px-3 text-right"><span className="text-xs text-green-700 border border-green-300 rounded-full px-2.5 py-1">Abrir</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ─── Detalhe da atividade ────────────────────────────────────────────────
  const safraNome = safras.find(s => s.id === safraId)?.nome || ''
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={voltar} className="text-sm text-gray-600 border rounded-lg px-3 py-1.5 hover:bg-gray-50">← Atividades</button>
        <h2 className="text-lg font-semibold text-gray-800">{atividade}</h2>
        <span className="text-sm text-gray-500">Safra {safraNome}</span>
      </div>

      {carregandoDet && !det ? <div className="text-center py-8 text-gray-400">Carregando...</div> : det && (
        <>
          {/* Registros para aprovar */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-grafite flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">Registros dos funcionários <span className="font-normal text-[#C9D2D6]">({det.registros.length - pendentes.length} de {det.registros.length} aprovados)</span></p>
              <div className="flex flex-wrap gap-2">
                {pendentes.length > 0 && (
                  <button onClick={() => aprovar(pendentes.map(r => r.id), true)} disabled={aprovando} className="text-xs bg-green-600 text-white rounded-full px-3 py-1 hover:bg-green-700 disabled:opacity-50">Aprovar todos pendentes ({pendentes.length})</button>
                )}
                {selecionados.size > 0 && (<>
                  <button onClick={() => aprovar(Array.from(selecionados), true)} disabled={aprovando} className="text-xs bg-white/10 text-white border border-white/30 rounded-full px-3 py-1 hover:bg-white/20 disabled:opacity-50">Aprovar selecionados ({selecionados.size})</button>
                  <button onClick={() => aprovar(Array.from(selecionados), false)} disabled={aprovando} className="text-xs bg-white/10 text-white border border-white/30 rounded-full px-3 py-1 hover:bg-white/20 disabled:opacity-50">Desaprovar selecionados</button>
                </>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cabecalho}>
                    <th className={th}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} aria-label="Marcar todos" /></th>
                    <th className={th}>Data</th>
                    <th className={th}>Funcionário</th>
                    <th className={th}>Talhão</th>
                    <th className={th}>Horário</th>
                    <th className={th + ' text-right'}>H. homem</th>
                    <th className={th}>Máquina</th>
                    <th className={th + ' text-right'}>H. máquina</th>
                    <th className={th}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {det.registros.map(r => (
                    <tr key={r.id} className={'border-b last:border-0 ' + (selecionados.has(r.id) ? 'bg-green-50' : '')}>
                      <td className="py-2 px-3"><input type="checkbox" checked={selecionados.has(r.id)} onChange={() => alternar(r.id)} /></td>
                      <td className="py-2 px-3 whitespace-nowrap">{dataBR(r.data)}</td>
                      <td className="py-2 px-3 font-medium text-gray-800">{r.funcionario}</td>
                      <td className="py-2 px-3">{r.talhao || <span className="text-gray-400">sem talhão</span>}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-gray-600">{r.horaEntrada}{r.horaSaida ? ` - ${r.horaSaida}` : ''}</td>
                      <td className="py-2 px-3 text-right">{num(r.horasHH)}</td>
                      <td className="py-2 px-3 text-gray-600">{r.maquinas.join(', ') || '-'}</td>
                      <td className="py-2 px-3 text-right">{r.horasHM ? num(r.horasHM) : '-'}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.aprovado
                          ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">Aprovado</span>
                          : <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Pendente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 px-4 py-2 border-t">Só os registros aprovados entram no Relatório por Atividade. Se um registro for editado depois, ele volta para pendente.</p>
          </div>

          {/* Produtos usados */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">Produtos usados nesta atividade</p>
              <button type="button" onClick={adicionarLinha} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">+ Adicionar produto</button>
            </div>
            {msgProd && <div className={`px-4 py-2 rounded text-sm border ${msgProd.tipo === 'erro' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{msgProd.texto}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-2 pr-2">Talhão</th>
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
                          {talhoesOpcoes.map(t => <option key={t.id} value={t.id}>{t.nome}{t.area ? ` (${num(t.area, 2)} ha)` : ''}</option>)}
                        </select>
                      </td>
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
                      <td className="py-2 pr-2"><input type="date" value={l.data} onChange={e => atualizar(i, 'data', e.target.value)} className="border rounded-lg px-2 py-2 text-sm" /></td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap text-gray-700">{previa[i] ? brl(previa[i]) : '-'}</td>
                      <td className="py-2 text-right">{linhas.length > 1 && <button type="button" onClick={() => removerLinha(i)} className="text-red-400 px-1" title="Remover linha">×</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500">Talhões da lista = os que aparecem nos registros desta atividade. O valor usa o preço atual do cadastro do produto.</p>
              <button onClick={salvarProdutos} disabled={salvando} className="px-5 py-2 bg-primary hover:bg-[#2C373C] text-white rounded-lg font-medium text-sm disabled:opacity-60">{salvando ? 'Salvando...' : 'Salvar produtos'}</button>
            </div>

            {det.produtos.length > 0 && (
              <div className="overflow-x-auto border-t pt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cabecalho}>
                      <th className={th}>Data</th>
                      <th className={th}>Talhão</th>
                      <th className={th}>Produto</th>
                      <th className={th + ' text-right'}>Quantidade</th>
                      <th className={th + ' text-right'}>Valor</th>
                      <th className={th}>Lançado por</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {det.produtos.map(p => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 px-3 whitespace-nowrap">{dataBR(p.data)}</td>
                        <td className="py-2 px-3 font-medium text-gray-800">{p.talhao}</td>
                        <td className="py-2 px-3">{p.produto}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">{num(p.quantidade, 3)} {p.unidade}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-green-800">{brl(p.valorTotal)}</td>
                        <td className="py-2 px-3 text-gray-500">{p.registradoPor}</td>
                        <td className="py-2 px-3 text-right"><button onClick={() => excluirProduto(p.id)} className="text-xs text-red-600 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-50">Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t">
                      <td colSpan={4} className="py-2 px-3 text-right">Total</td>
                      <td className="py-2 px-3 text-right text-green-800 whitespace-nowrap">{brl(totalProdutos)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
