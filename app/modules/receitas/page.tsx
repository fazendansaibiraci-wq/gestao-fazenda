'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Plus, BookOpen, PlusCircle } from 'lucide-react'

export default function ReceitasPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState('receitas')
  const [receitas, setReceitas] = useState([])
  const [safras, setSafras] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const [receitasRes, safrasRes] = await Promise.all([
        fetch('/api/receitas-base'),
        fetch('/api/safras'),
      ])
      if (receitasRes.ok) setReceitas((await receitasRes.json()).data)
      if (safrasRes.ok) setSafras((await safrasRes.json()).data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  const isAgronomo = session?.user?.role === 'AGRONOMO'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Receitas e Insumos</h1>
          <p className="text-gray-600 mt-1">Gestão de receitas agrícolas e aplicações</p>
        </div>
        {isAgronomo && (
          <button onClick={() => setActiveTab('nova')} className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Nova Receita
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('receitas')}
          className={`px-4 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'receitas'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen className="inline w-4 h-4 mr-2" />
          Receitas Base
        </button>
        <button
          onClick={() => setActiveTab('aplicacoes')}
          className={`px-4 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'aplicacoes'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <PlusCircle className="inline w-4 h-4 mr-2" />
          Aplicações
        </button>
        {isAgronomo && (
          <button
            onClick={() => setActiveTab('nova')}
            className={`px-4 py-3 font-medium whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'nova'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="inline w-4 h-4 mr-2" />
            Nova
          </button>
        )}
      </div>

      {/* Content */}
      <div className="card">
        {activeTab === 'receitas' && <AbaReceitas receitas={receitas} isAgronomo={isAgronomo} />}
        {activeTab === 'aplicacoes' && <AbaAplicacoes />}
        {activeTab === 'nova' && isAgronomo && <AbaNovaReceita onSave={load} />}
      </div>
    </div>
  )
}

// Aba 1: Receitas Base
function AbaReceitas({ receitas, isAgronomo }: { receitas: any[]; isAgronomo: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-primary">Receitas Cadastradas</h3>
      {receitas.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhuma receita cadastrada</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {receitas.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-primary">{r.nome}</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {r.atividade.replace(/_/g, ' ')} - {r.perfilTalhao.replace(/_/g, ' ')}
                  </p>
                </div>
                {isAgronomo && (
                  <button className="text-blue-600 text-sm hover:text-blue-800">Editar</button>
                )}
              </div>
              <div className="text-sm">
                <p><strong>Unidade Base:</strong> {r.unidadeBase}</p>
                <p><strong>Safra:</strong> {r.safra?.nome}</p>
                <p className="mt-2"><strong>Produtos:</strong> {r.produtosReceita?.length || 0}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Aba 2: Aplicações
function AbaAplicacoes() {
  const [aplicacoes, setAplicacoes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/aplicacoes-insumo')
      const data = await res.json()
      setAplicacoes(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><div className="spinner"></div></div>

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-primary">Histórico de Aplicações</h3>
      {aplicacoes.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Nenhuma aplicação registrada</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Receita</th>
                <th className="px-4 py-2 text-left">Talhão</th>
                <th className="px-4 py-2 text-left">Quantidade</th>
                <th className="px-4 py-2 text-left">Custo/ha</th>
              </tr>
            </thead>
            <tbody>
              {aplicacoes.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2 font-medium">{a.receita?.nome}</td>
                  <td className="px-4 py-2">{a.talhao?.nome}</td>
                  <td className="px-4 py-2">{a.quantidade.toFixed(1)}</td>
                  <td className="px-4 py-2">R$ {a.custoPorHectare?.toFixed(2) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Aba 3: Nova Receita (Agrônomo)
function AbaNovaReceita({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({
    nome: '',
    atividade: 'PULVERIZACAO',
    sequencia: 'PRIMEIRA',
    perfilTalhao: 'RECÉM_PLANTADO',
    safraId: '',
    unidadeBase: 'bomba 1.000L',
  })
  const [safras, setSafras] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await fetch('/api/safras')
      const data = await res.json()
      setSafras(data.data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/receitas-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erro')
      alert('Receita criada com sucesso')
      setForm({
        nome: '',
        atividade: 'PULVERIZACAO',
        sequencia: 'PRIMEIRA',
        perfilTalhao: 'RECÉM_PLANTADO',
        safraId: '',
        unidadeBase: 'bomba 1.000L',
      })
      onSave()
    } catch (err) {
      alert('Erro ao salvar receita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h3 className="font-semibold text-primary text-lg">Criar Nova Receita</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-group">
          <label htmlFor="nome">Nome da Receita *</label>
          <input
            type="text"
            id="nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
            placeholder="Ex: Pulverização Preventiva 1ª"
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        <div className="form-group">
          <label htmlFor="safraId">Safra *</label>
          <select
            id="safraId"
            value={form.safraId}
            onChange={(e) => setForm({ ...form, safraId: e.target.value })}
            required
            className="border rounded px-3 py-2 w-full"
          >
            <option value="">Selecionar safra</option>
            {safras.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="atividade">Tipo de Atividade *</label>
          <select
            id="atividade"
            value={form.atividade}
            onChange={(e) => setForm({ ...form, atividade: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="PULVERIZACAO">Pulverização</option>
            <option value="HERBICIDA">Herbicida</option>
            <option value="ADUBACAO">Adubação</option>
            <option value="INSETICIDA_SOLO">Inseticida Solo</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="sequencia">Sequência *</label>
          <select
            id="sequencia"
            value={form.sequencia}
            onChange={(e) => setForm({ ...form, sequencia: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="PRIMEIRA">1ª Aplicação</option>
            <option value="SEGUNDA">2ª Aplicação</option>
            <option value="TERCEIRA">3ª Aplicação</option>
            <option value="QUARTA">4ª Aplicação</option>
            <option value="QUINTA">5ª Aplicação</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="perfilTalhao">Perfil do Talhão *</label>
          <select
            id="perfilTalhao"
            value={form.perfilTalhao}
            onChange={(e) => setForm({ ...form, perfilTalhao: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="RECÉM_PLANTADO">Recém Plantado</option>
            <option value="ESQUELETADO">Esqueletado</option>
            <option value="PLENA_PRODUCAO">Plena Produção</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="unidadeBase">Unidade Base *</label>
          <select
            id="unidadeBase"
            value={form.unidadeBase}
            onChange={(e) => setForm({ ...form, unidadeBase: e.target.value })}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="bomba 1.000L">Bomba 1.000L</option>
            <option value="bag">Bag</option>
            <option value="tanque">Tanque</option>
            <option value="litro">Litro</option>
            <option value="kg">Kg</option>
          </select>
        </div>
      </div>

      <div className="alert alert-info">
        <p className="text-sm">Após criar a receita base, você poderá adicionar produtos e suas dosagens.</p>
      </div>

      <div className="flex gap-4">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'Criando...' : 'Criar Receita'}
        </button>
      </div>
    </form>
  )
}
