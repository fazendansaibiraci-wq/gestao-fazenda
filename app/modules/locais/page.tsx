'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

interface Local {
  id: string
  nome: string
  status: boolean
}

export default function LocaisPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [locais, setLocais] = useState<Local[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Local | null>(null)
  const [nomeForm, setNomeForm] = useState('')
  const [salvando, setSalvando] = useState(false)

  const userRole = (session?.user as any)?.role || ''
  const isGestor = ['GESTOR', 'GERENTE'].includes(userRole)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') redirect('/login')
    if (sessionStatus === 'authenticated') buscarLocais()
  }, [sessionStatus])

  async function buscarLocais() {
    try {
      setLoading(true)
      const res = await fetch('/api/locais')
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setLocais(data.data || [])
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  function abrirNovo() {
    setEditando(null)
    setNomeForm('')
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(local: Local) {
    setEditando(local)
    setNomeForm(local.nome)
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
    if (!nomeForm.trim()) { setErro('Nome é obrigatório'); return }
    setSalvando(true)
    setErro('')
    try {
      const url = editando ? `/api/locais/${editando.id}` : '/api/locais'
      const method = editando ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeForm }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      mostrarSucesso(editando ? 'Local atualizado!' : 'Local criado!')
      fecharModal()
      buscarLocais()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function toggleStatus(local: Local) {
    try {
      const res = await fetch(`/api/locais/${local.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: !local.status }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      mostrarSucesso(local.status ? 'Local desativado!' : 'Local reativado!')
      buscarLocais()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  if (sessionStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  }

  const locaisAtivos = locais.filter(l => l.status)
  const locaisInativos = locais.filter(l => !l.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Locais</h1>
          <p className="text-gray-600 mt-1">Locais de armazenamento de estoque (Fazenda, Bolsa, Coopercitrus, etc.)</p>
        </div>
        {isGestor && (
          <button onClick={abrirNovo} className="btn btn-primary">
            + Novo Local
          </button>
        )}
      </div>

      {sucesso && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">{sucesso}</div>}
      {erro && !modalAberto && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">{erro}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-left">Status</th>
              {isGestor && <th className="px-4 py-2 text-left">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {locaisAtivos.length === 0 && locaisInativos.length === 0 ? (
              <tr>
                <td colSpan={isGestor ? 3 : 2} className="px-4 py-8 text-center text-gray-500">
                  Nenhum local cadastrado
                </td>
              </tr>
            ) : (
              <>
                {locaisAtivos.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{l.nome}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-green-100 text-green-800">Ativo</span>
                    </td>
                    {isGestor && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <button onClick={() => abrirEditar(l)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Editar</button>
                          <button onClick={() => toggleStatus(l)} className="text-yellow-600 hover:text-yellow-800 text-sm font-medium">Desativar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {locaisInativos.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-gray-50 opacity-60">
                    <td className="px-4 py-2 font-medium line-through">{l.nome}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-gray-100 text-gray-800">Inativo</span>
                    </td>
                    {isGestor && (
                      <td className="px-4 py-2">
                        <button onClick={() => toggleStatus(l)} className="text-green-600 hover:text-green-800 text-sm font-medium">Reativar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">{editando ? 'Editar Local' : 'Novo Local'}</h2>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{erro}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={nomeForm}
                  onChange={e => setNomeForm(e.target.value)}
                  placeholder="Ex: Fazenda, Bolsa, Coopercitrus..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && salvar()}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={fecharModal} disabled={salvando} className="px-4 py-2 text-sm text-gray-600 font-medium rounded-lg hover:bg-gray-100">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50">
                {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar Local'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
