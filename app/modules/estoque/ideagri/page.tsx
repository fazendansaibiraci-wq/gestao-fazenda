'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { CheckCheck, Undo2, ArrowLeftRight, PackageMinus, PackagePlus, FileUp, ClipboardCheck } from 'lucide-react'

type Tipo = 'transferencia' | 'saida' | 'devolucao' | 'entrada' | 'ajuste'

const TIPOS: Record<Tipo, { nome: string; icon: any; cor: string }> = {
  transferencia: { nome: 'Transferência', icon: ArrowLeftRight, cor: 'text-sky-700 bg-sky-50' },
  saida: { nome: 'Saída', icon: PackageMinus, cor: 'text-red-700 bg-red-50' },
  devolucao: { nome: 'Devolução', icon: PackagePlus, cor: 'text-green-700 bg-green-50' },
  entrada: { nome: 'Entrada NF-e', icon: FileUp, cor: 'text-gray-700 bg-gray-100' },
  ajuste: { nome: 'Ajuste', icon: ClipboardCheck, cor: 'text-amber-700 bg-amber-50' },
}

const dataBR = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const dataHoraBR = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Avisa o menu pra atualizar o contador de pendências.
const avisarMenu = () => {
  try {
    window.dispatchEvent(new Event('pendencias-ideagri'))
  } catch {}
}

export default function PendenciasIdeagriPage() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role

  const [aba, setAba] = useState<'pendentes' | 'lancados'>('pendentes')
  const [itens, setItens] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<Tipo | ''>('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (role && !['GERENTE', 'GESTOR'].includes(role)) redirect('/dashboard')
  }, [status, role])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, aba])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pendencias-ideagri?status=${aba}`)
      const data = await res.json()
      setItens(data.data || [])
      setSelecionados(new Set())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const enviar = async (lista: any[], acao: 'marcar' | 'desmarcar') => {
    if (lista.length === 0) return
    setSalvando(true)
    try {
      const res = await fetch('/api/pendencias-ideagri', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, itens: lista.map((i) => ({ tipo: i.tipo, ids: i.ids })) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Erro ao salvar')
        return
      }
      avisarMenu()
      await load()
    } catch (err) {
      alert('Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (status === 'loading') {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }
  if (role && !['GERENTE', 'GESTOR'].includes(role)) return null

  const contagem = itens.reduce((acc: Record<string, number>, i) => {
    acc[i.tipo] = (acc[i.tipo] || 0) + 1
    return acc
  }, {})
  const visiveis = filtroTipo ? itens.filter((i) => i.tipo === filtroTipo) : itens
  const todosMarcados = visiveis.length > 0 && visiveis.every((i) => selecionados.has(i.chave))
  const escolhidos = visiveis.filter((i) => selecionados.has(i.chave))

  const alternar = (chave: string) =>
    setSelecionados((prev) => {
      const n = new Set(prev)
      if (n.has(chave)) n.delete(chave)
      else n.add(chave)
      return n
    })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Pendências no Ideagri</h1>
        <p className="text-sm text-gray-600 mt-1">
          Movimentações feitas no app que ainda precisam ser lançadas no Ideagri. Depois de lançar lá, marque como lançado.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E4DDD2]">
        {(['pendentes', 'lancados'] as const).map((a) => (
          <button
            key={a}
            onClick={() => {
              setAba(a)
              setFiltroTipo('')
            }}
            className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium ${aba === a ? 'border-[#C98B52] text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {a === 'pendentes' ? 'Pendentes' : 'Já lançados (60 dias)'}
          </button>
        ))}
      </div>

      {itens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroTipo('')}
            className={`px-3 py-1.5 rounded-full border text-sm ${filtroTipo === '' ? 'bg-primary text-white border-primary' : 'bg-white border-[#DDD5C8]'}`}
          >
            Todos ({itens.length})
          </button>
          {(Object.keys(TIPOS) as Tipo[])
            .filter((t) => contagem[t])
            .map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-full border text-sm ${filtroTipo === t ? 'bg-primary text-white border-primary' : 'bg-white border-[#DDD5C8]'}`}
              >
                {TIPOS[t].nome} ({contagem[t]})
              </button>
            ))}
        </div>
      )}

      {aba === 'pendentes' && visiveis.length > 0 && (
        <div className="card !p-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={() =>
                setSelecionados(todosMarcados ? new Set() : new Set(visiveis.map((i) => i.chave)))
              }
            />
            Selecionar todos ({visiveis.length})
          </label>
          <button
            onClick={() => enviar(escolhidos, 'marcar')}
            disabled={salvando || escolhidos.length === 0}
            className="btn btn-primary disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            {salvando ? 'Salvando...' : `Marcar ${escolhidos.length || ''} como lançado no Ideagri`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner"></div></div>
      ) : visiveis.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          {aba === 'pendentes' ? 'Nada pendente. Tudo que foi feito no app já está no Ideagri. ✔' : 'Nenhum lançamento marcado nos últimos 60 dias.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visiveis.map((i) => {
            const T = TIPOS[i.tipo as Tipo]
            const Icon = T.icon
            return (
              <div key={i.chave} className="card !p-3 flex items-start gap-3">
                {aba === 'pendentes' && (
                  <input
                    type="checkbox"
                    checked={selecionados.has(i.chave)}
                    onChange={() => alternar(i.chave)}
                    className="mt-3"
                    aria-label={`Selecionar ${i.titulo}`}
                  />
                )}
                <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${T.cor}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold uppercase text-gray-500">{T.nome}</span>
                    <span className="text-xs text-gray-500">{dataBR(i.data)}</span>
                  </div>
                  <p className="font-medium text-sm">{i.titulo}</p>
                  <p className="text-sm text-gray-600">{i.detalhe}</p>
                  {i.linhas.length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600 list-disc pl-4">
                      {i.linhas.map((l: string, k: number) => (
                        <li key={k}>{l}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Feito por <strong>{i.registradoPor || '—'}</strong> em {dataHoraBR(i.registradoEm)}
                    {aba === 'lancados' && i.lancadoEm && (
                      <> · lançado no Ideagri por <strong>{i.lancadoPor || '—'}</strong> em {dataHoraBR(i.lancadoEm)}</>
                    )}
                  </p>
                </div>
                {aba === 'pendentes' ? (
                  <button
                    onClick={() => enviar([i], 'marcar')}
                    disabled={salvando}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-[#DDD5C8] text-sm font-medium hover:bg-green-50 hover:border-green-300 disabled:opacity-50 flex items-center gap-1.5"
                    title="Marcar como lançado no Ideagri"
                  >
                    <CheckCheck className="w-4 h-4 text-green-700" />
                    <span className="hidden sm:inline">Lançado</span>
                  </button>
                ) : (
                  <button
                    onClick={() => enviar([i], 'desmarcar')}
                    disabled={salvando}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-[#DDD5C8] text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                    title="Voltar para pendentes"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Desfazer</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
