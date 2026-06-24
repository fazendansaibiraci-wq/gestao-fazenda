'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type TipoReceita = 'PULVERIZACAO' | 'HERBICIDA' | 'CORRETIVOS' | 'ADUBACAO' | 'INSETICIDA'
interface Produto { id: string; nomeComercial: string; unidadeMedida: string }
interface ProdutoAplicacao { id?: string; produtoId: string; dosagem: number | string; unidade: string; produto?: Produto }
interface Receita { id: string; nome: string; tipo: TipoReceita; observacoes?: string; ativo: boolean; produtosAplicacao: ProdutoAplicacao[]; dataCriacao: string }
interface FormData { nome: string; tipo: TipoReceita; observacoes: string; ativo: boolean; produtos: ProdutoAplicacao[] }

const TIPO_LABELS: Record<TipoReceita, string> = { PULVERIZACAO: 'Pulverização', HERBICIDA: 'Herbicida', CORRETIVOS: 'Corretivos', ADUBACAO: 'Adubação', INSETICIDA: 'Inseticida' }
const TIPO_COLORS: Record<TipoReceita, string> = { PULVERIZACAO: 'bg-blue-100 text-blue-800', HERBICIDA: 'bg-yellow-100 text-yellow-800', CORRETIVOS: 'bg-gray-100 text-gray-800', ADUBACAO: 'bg-green-100 text-green-800', INSETICIDA: 'bg-red-100 text-red-800' }
const EMPTY: FormData = { nome: '', tipo: 'PULVERIZACAO', observacoes: '', ativo: true, produtos: [{ produtoId: '', dosagem: '', unidade: 'L/ha' }] }

export default function ReceitasPage() {
  const { status } = useSession()
  const router = useRouter()
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [prods, setProds] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterTipo, setFilterTipo] = useState<TipoReceita | 'TODOS'>('TODOS')
  const [search, setSearch] = useState('')

  // Mini modal de novo produto
  const [showNovoProduto, setShowNovoProduto] = useState(false)
  const [novoProduto, setNovoProduto] = useState({ nomeComercial: '', categoria: '', unidadeMedida: 'L', valorUnitario: '' })
  const [savingProduto, setSavingProduto] = useState(false)
  const [erroProduto, setErroProduto] = useState('')

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])
  useEffect(() => { if (status === 'authenticated') { load(); loadProds() } }, [status])

  async function load() {
    try { const r = await fetch('/api/receitas'); const d = await r.json(); setReceitas(d.data || []) }
    catch { setError('Erro ao carregar') } finally { setLoading(false) }
  }

  async function loadProds() {
    try { const r = await fetch('/api/produtos'); const d = await r.json(); setProds(d.data || []) } catch {}
  }

  function openNew() { setEditingId(null); setForm(EMPTY); setError(''); setShowModal(true) }

  function openEdit(rec: Receita) {
    setEditingId(rec.id)
    setForm({ nome: rec.nome, tipo: rec.tipo, observacoes: rec.observacoes || '', ativo: rec.ativo, produtos: rec.produtosAplicacao.length > 0 ? rec.produtosAplicacao.map(p => ({ produtoId: p.produtoId, dosagem: p.dosagem, unidade: p.unidade })) : [{ produtoId: '', dosagem: '', unidade: 'L/ha' }] })
    setError(''); setShowModal(true)
  }

  async function del(id: string) {
    if (!confirm('Excluir?')) return
    await fetch('/api/receitas?id=' + id, { method: 'DELETE' })
    setReceitas(p => p.filter(r => r.id !== id))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const pv = form.produtos.filter(p => p.produtoId && p.dosagem)
    if (!pv.length) { setError('Adicione pelo menos um produto'); setSaving(false); return }
    try {
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? { id: editingId, ...form, produtos: pv } : { ...form, produtos: pv }
      const r = await fetch('/api/receitas', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erro') }
      await load(); setShowModal(false)
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erro') } finally { setSaving(false) }
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
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Erro ao cadastrar produto')
      }
      await loadProds()
      setShowNovoProduto(false)
      setNovoProduto({ nomeComercial: '', categoria: '', unidadeMedida: 'L', valorUnitario: '' })
    } catch (err: unknown) {
      setErroProduto(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSavingProduto(false)
    }
  }

  const addP = () => setForm(p => ({ ...p, produtos: [...p.produtos, { produtoId: '', dosagem: '', unidade: 'L/ha' }] }))
  const remP = (i: number) => setForm(p => ({ ...p, produtos: p.produtos.filter((_, j) => j !== i) }))
  const updP = (i: number, f: keyof ProdutoAplicacao, v: string) => setForm(p => { const u = [...p.produtos]; u[i] = { ...u[i], [f]: v }; return { ...p, produtos: u } })
  const filtered = receitas.filter(r => (filterTipo === 'TODOS' || r.tipo === filterTipo) && r.nome.toLowerCase().includes(search.toLowerCase()))

  if (status === 'loading' || loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Receitas de Aplicação</h1><p className="text-sm text-gray-500">Cadastre receitas para uso nas atividades</p></div>
        <button onClick={openNew} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">+ Nova Receita</button>
      </div>

      <div className="flex gap-3 mb-6">
        <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value as TipoReceita | 'TODOS')} className="border rounded-lg px-3 py-2 text-sm">
          <option value="TODOS">Todos os tipos</option>
          {Object.entries(TIPO_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        {Object.entries(TIPO_LABELS).map(([t, l]) => <div key={t} className="bg-white rounded-lg border p-3 text-center"><div className="text-xl font-bold">{receitas.filter(r => r.tipo === t).length}</div><div className="text-xs text-gray-500">{l}</div></div>)}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><p>Nenhuma receita encontrada</p><button onClick={openNew} className="mt-3 text-green-600 underline text-sm">Criar primeira receita</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(rec => (
            <div key={rec.id} className="bg-white rounded-xl border p-4 hover:shadow-md">
              <div className="flex justify-between mb-2">
                <div><h3 className="font-semibold">{rec.nome}</h3><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLORS[rec.tipo]}`}>{TIPO_LABELS[rec.tipo]}</span>{!rec.ativo && <span className="ml-2 text-xs text-red-500">(Inativa)</span>}</div>
                <div className="flex gap-2"><button onClick={() => openEdit(rec)} className="text-blue-600 text-sm">Editar</button><button onClick={() => del(rec.id)} className="text-red-500 text-sm">Excluir</button></div>
              </div>
              {rec.observacoes && <p className="text-sm text-gray-600 mb-2">{rec.observacoes}</p>}
              {rec.produtosAplicacao.length > 0 && <div className="border-t pt-2"><p className="text-xs font-medium text-gray-500 mb-1">Produtos ({rec.produtosAplicacao.length})</p><ul>{rec.produtosAplicacao.slice(0, 3).map((p, i) => <li key={i} className="text-xs flex justify-between"><span>{p.produto?.nomeComercial}</span><span className="text-gray-500">{p.dosagem} {p.unidade}</span></li>)}</ul></div>}
            </div>
          ))}
        </div>
      )}

      {/* Modal Receita */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between">
              <h2 className="font-semibold">{editingId ? 'Editar Receita' : 'Nova Receita'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}
              <div><label className="block text-sm font-medium mb-1">Nome *</label><input type="text" required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Tipo *</label><select required value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoReceita }))} className="w-full border rounded-lg px-3 py-2 text-sm">{Object.entries(TIPO_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                <div className="flex items-center gap-2 pt-6"><input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /><label htmlFor="ativo" className="text-sm">Receita ativa</label></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Observações</label><textarea rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>

              {/* Produtos */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Produtos *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowNovoProduto(true); setErroProduto('') }} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">
                      + Cadastrar produto
                    </button>
                    <button type="button" onClick={addP} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50">
                      + Adicionar linha
                    </button>
                  </div>
                </div>
                {form.produtos.map((p, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select value={p.produtoId} onChange={e => updP(i, 'produtoId', e.target.value)} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                      <option value="">Selecionar produto</option>
                      {prods.map(pr => <option key={pr.id} value={pr.id}>{pr.nomeComercial}</option>)}
                    </select>
                    <input type="text" placeholder="Dose" value={String(p.dosagem)} onChange={e => updP(i, 'dosagem', e.target.value)} className="w-20 border rounded-lg px-2 py-2 text-sm" />
                    <select value={p.unidade} onChange={e => updP(i, 'unidade', e.target.value)} className="w-24 border rounded-lg px-2 py-2 text-sm">
                      <option>L/ha</option><option>mL/ha</option><option>kg/ha</option><option>g/ha</option><option>L/100L</option>
                    </select>
                    {form.produtos.length > 1 && <button type="button" onClick={() => remP(i)} className="text-red-400 px-1">×</button>}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
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
