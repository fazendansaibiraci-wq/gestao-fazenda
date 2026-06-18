'use client'

import { useState, useEffect } from 'react'

interface TipoAtividade {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
}

export default function TiposAtividadePage() {
  const [tipos, setTipos] = useState<TipoAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<TipoAtividade | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '' })
  const [salvando, setSalvando] = useState(false)
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)

  useEffect(() => { buscarTipos() }, [])

  async function buscarTipos() {
    try {
      setLoading(true)
      const res = await fetch('/api/tipos-atividade')
      if (!res.ok) throw new Error('Erro ao carregar')
      setTipos(await res.json())
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', descricao: '' })
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(tipo: TipoAtividade) {
    setEditando(tipo)
    setForm({ nome: tipo.nome, descricao: tipo.descricao || '' })
    setErro('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setErro('')
  }

  function mostrarSucesso(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3000)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    setErro('')
    try {
      const url = editando ? `/api/tipos-atividade/${editando.id}` : '/api/tipos-atividade'
      const method = editando ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      mostrarSucesso(editando ? 'Tipo atualizado!' : 'Tipo criado!')
      fecharModal()
      buscarTipos()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: number) {
    try {
      const res = await fetch(`/api/tipos-atividade/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao excluir'); return }
      mostrarSucesso(data.message || 'Excluído!')
      setConfirmandoId(null)
      buscarTipos()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  async function toggleAtivo(tipo: TipoAtividade) {
    try {
      const res = await fetch(`/api/tipos-atividade/${tipo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: tipo.nome, descricao: tipo.descricao, ativo: !tipo.ativo }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      mostrarSucesso(tipo.ativo ? 'Tipo desativado!' : 'Tipo reativado!')
      buscarTipos()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  const tiposAtivos = tipos.filter(t => t.ativo)
  const tiposInativos = tipos.filter(t => !t.ativo)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tipos de Atividade</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os tipos disponíveis para registro de atividades</p>
        </div>
        <button onClick={abrirNovo} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          + Novo Tipo
        </button>
      </div>

      {sucesso && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">✅ {sucesso}</div>}
      {erro && !modalAberto && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">❌ {erro}</div>}
      {loading && <div className="text-center py-12 text-gray-500">Carregando...</div>}

      {!loading && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-700">Ativos <span className="text-green-600">({tiposAtivos.length})</span></h2>
            </div>
            {tiposAtivos.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-4xl mb-2">🌱</div>
                <p>Nenhum tipo cadastrado ainda.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tiposAtivos.map(tipo => (
                    <tr key={tipo.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{tipo.nome}</td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{tipo.descricao || <span className="italic text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => abrirEditar(tipo)} className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50">Editar</button>
                          <button onClick={() => toggleAtivo(tipo)} className="text-yellow-600 hover:text-yellow-800 text-sm font-medium px-2 py-1 rounded hover:bg-yellow-50">Desativar</button>
                          {confirmandoId === tipo.id ? (
                            <span className="flex items-center gap-1">
                              <span className="text-xs text-red-600">Confirmar?</span>
                              <button onClick={() => excluir(tipo.id)} className="text-red-600 text-sm font-medium px-2 py-1 rounded hover:bg-red-50">Sim</button>
                              <button onClick={() => setConfirmandoId(null)} className="text-gray-500 text-sm px-2 py-1 rounded hover:bg-gray-100">Não</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmandoId(tipo.id)} className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50">Excluir</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {tiposInativos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-70">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-500">Inativos ({tiposInativos.length})</h2>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  {tiposInativos.map(tipo => (
                    <tr key={tipo.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 line-through">{tipo.nome}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{tipo.descricao}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toggleAtivo(tipo)} className="text-green-600 hover:text-green-800 text-sm font-medium px-2 py-1 rounded hover:bg-green-50">Reativar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editando ? 'Editar Tipo' : 'Novo Tipo de Atividade'}</h2>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Colheita, Poda, Pulverização..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && salvar()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descreva quando este tipo é usado..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={fecharModal} disabled={salvando} className="px-4 py-2 text-sm text-gray-600 font-medium rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50">
                {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar Tipo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}