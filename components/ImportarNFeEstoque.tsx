'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { FileUp, X, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface ItemPreview {
  codigo: string
  nome: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  produtoId: string | null
  fatorConversao: number | string
  origem: 'lembrado' | 'nome' | 'sugestao' | null
  // Só pra produto novo
  nomeEstoque?: string
  unidadeEstoque?: string
  categoria?: string
  incluir?: boolean
}

const CATEGORIAS = [
  { value: 'fertilizante', label: 'Fertilizante' },
  { value: 'fungicida', label: 'Fungicida' },
  { value: 'herbicida', label: 'Herbicida' },
  { value: 'inseticida', label: 'Inseticida' },
  { value: 'adjuvante', label: 'Adjuvante' },
  { value: 'corretivo', label: 'Corretivo' },
  { value: 'outro', label: 'Outro / A Classificar' },
]

const fmt = (n: number) => (n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const moeda = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function ImportarNFeEstoque({ onImportado, naJanela, onFechar }: { onImportado: () => void; naJanela?: boolean; onFechar?: () => void }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR' || session?.user?.role === 'GERENTE'
  // Dentro da janela da tela de Estoque o importador já vem aberto.
  const [aberto, setAberto] = useState(!!naJanela)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [nota, setNota] = useState<any | null>(null)
  const [itens, setItens] = useState<ItemPreview[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<any | null>(null)
  const [produtos, setProdutos] = useState<{ id: string; nomeComercial: string; unidadeMedida: string }[]>([])
  const [locais, setLocais] = useState<{ id: string; nome: string }[]>([])
  const [localId, setLocalId] = useState('')

  useEffect(() => {
    if (!aberto) return
    fetch('/api/produtos')
      .then((r) => r.json())
      .then((d) =>
        setProdutos(
          (d.data || [])
            .map((p: any) => ({ id: p.id, nomeComercial: p.nomeComercial, unidadeMedida: p.unidadeMedida }))
            .sort((a: any, b: any) => a.nomeComercial.localeCompare(b.nomeComercial))
        )
      )
      .catch(() => {})
    fetch('/api/locais')
      .then((r) => r.json())
      .then((d) => {
        const ativos = (d.data || []).filter((l: any) => l.status)
        setLocais(ativos)
        // A maioria das notas entra na fazenda.
        const faz = ativos.find((l: any) => l.nome === 'FAZ')
        if (faz) setLocalId((atual) => atual || faz.id)
      })
      .catch(() => {})
  }, [aberto])

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCarregando(true)
    setErro('')
    setResultado(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/produtos/importar-nfe', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao processar a NF-e')
        return
      }
      const { itens: itensNota, ...cabecalho } = data.data
      setNota(cabecalho)
      setItens(
        itensNota.map((it: ItemPreview) => ({
          ...it,
          nomeEstoque: it.nome,
          unidadeEstoque: String(it.unidade || '').toLowerCase(),
          categoria: 'outro',
          incluir: true,
        }))
      )
    } catch (err) {
      setErro('Erro ao enviar o arquivo')
    } finally {
      setCarregando(false)
      e.target.value = ''
    }
  }

  const atualizarItem = (index: number, campo: keyof ItemPreview, valor: any) => {
    setItens((prev) => prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)))
  }

  const fechar = () => {
    if (naJanela) {
      onFechar?.()
      return
    }
    setAberto(false)
    setItens([])
    setNota(null)
    setErro('')
    setResultado(null)
  }

  const novaNota = () => {
    setItens([])
    setNota(null)
    setErro('')
    setResultado(null)
  }

  const itensIncluidos = itens.filter((i) => i.incluir !== false)
  const fatorInvalido = itensIncluidos.some((i) => !(Number(i.fatorConversao) > 0))

  const handleConfirmar = async () => {
    if (!nota) return
    if (!localId) {
      setErro('Selecione o local dessa entrada')
      return
    }
    if (fatorInvalido) {
      setErro('Confira a conversão de unidade: precisa ser maior que zero')
      return
    }
    setConfirmando(true)
    setErro('')
    try {
      const res = await fetch('/api/produtos/importar-nfe/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...nota,
          localId,
          itens: itensIncluidos.map((i) => ({ ...i, fatorConversao: Number(i.fatorConversao) })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao gravar')
        return
      }
      setResultado(data.data)
      setItens([])
      setNota(null)
      onImportado()
    } catch (err) {
      setErro('Erro ao gravar os produtos')
    } finally {
      setConfirmando(false)
    }
  }

  if (!isGestor) return null

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary/5"
      >
        <FileUp className="w-4 h-4" />
        Entrada de NF-e
      </button>
    )
  }

  return (
    <div className={naJanela ? 'space-y-4' : 'card space-y-4'}>
      {!naJanela && (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Entrada de NF-e</h2>
          <button onClick={fechar} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {resultado && (
        <div className="border border-green-300 bg-green-50 rounded-lg p-4 space-y-3">
          <p className="font-semibold text-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Entrada registrada em {resultado.local}
            {resultado.criados > 0 ? ` · ${resultado.criados} produto(s) novo(s)` : ''}
          </p>
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm !mt-0">
              <thead>
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Produto ({resultado.local})</th>
                  <th className="py-2 px-3 text-right font-medium">Antes</th>
                  <th className="py-2 px-3 text-right font-medium">Entrou</th>
                  <th className="py-2 px-3 text-right font-medium">Agora</th>
                </tr>
              </thead>
              <tbody>
                {resultado.conferencia.map((c: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 px-3 font-medium">
                      {c.produto}
                      {c.novo && <span className="ml-2 text-xs font-normal text-green-700">novo</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-500 tabular-nums">{fmt(c.antes)}</td>
                    <td className="py-2 px-3 text-right text-green-700 tabular-nums">+{fmt(c.entrou)}</td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums whitespace-nowrap">{fmt(c.depois)} {c.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={novaNota} className="btn btn-primary">Dar entrada em outra nota</button>
            <Link href="/modules/estoque/entradas" className="text-sm font-medium text-primary hover:underline">
              Ver entradas de NF-e →
            </Link>
          </div>
        </div>
      )}

      {!nota && !resultado && (
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">Escolha o arquivo XML da nota (não o PDF/DANFE)</label>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={handleArquivo}
            disabled={carregando}
            className="block w-full text-sm"
          />
          {carregando && <p className="text-sm text-gray-500">Lendo a NF-e...</p>}
          <Link href="/modules/estoque/entradas" className="inline-block text-sm font-medium text-primary hover:underline pt-2">
            Ver entradas de NF-e →
          </Link>
        </div>
      )}

      {nota && itens.length > 0 && (
        <>
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-1">
            <p><span className="text-gray-500">Fornecedor:</span> <strong>{nota.fornecedor}</strong></p>
            <p><span className="text-gray-500">Nota:</span> <strong>{nota.numeroNota}</strong> · série {nota.serieNota}</p>
            <p><span className="text-gray-500">Emissão:</span> {new Date(nota.dataEmissao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
          </div>

          {nota.jaLancada && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Essa nota já teve entrada em {new Date(nota.jaLancada.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                {nota.jaLancada.registradoPor ? ` por ${nota.jaLancada.registradoPor}` : ''}. Pra lançar de novo, exclua a entrada anterior em{' '}
                <Link href="/modules/estoque/entradas" className="underline font-medium">Entradas de NF-e</Link>.
              </span>
            </div>
          )}

          <label className="block text-sm max-w-xs">
            <span className="block font-medium mb-1">Local onde os produtos entram</span>
            <select value={localId} onChange={(e) => setLocalId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-full">
              <option value="">Selecionar local</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </label>

          <div className="space-y-3">
            {itens.map((item, i) => {
              const produto = produtos.find((p) => p.id === item.produtoId)
              const fator = Number(item.fatorConversao)
              const unidadeDestino = produto ? produto.unidadeMedida.toLowerCase() : String(item.unidadeEstoque || '').toLowerCase()
              const entra = item.quantidade * (fator > 0 ? fator : 0)
              const incluido = item.incluir !== false
              return (
                <div key={i} className={`border rounded-lg p-3 space-y-3 ${incluido ? '' : 'opacity-50 bg-gray-50'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={incluido}
                      onChange={(e) => atualizarItem(i, 'incluir', e.target.checked)}
                      aria-label={`Dar entrada em ${item.nome}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.nome}</p>
                      <p className="text-xs text-gray-500">
                        {item.codigo ? `cód. ${item.codigo} · ` : ''}
                        {fmt(item.quantidade)} {item.unidade} × {moeda(item.valorUnitario)} = {moeda(item.valorTotal)}
                      </p>
                    </div>
                  </div>

                  {incluido && (
                    <div className="pl-7 space-y-2">
                      <label className="block text-sm">
                        <span className="flex items-center gap-2 text-gray-600 mb-1">
                          Produto no estoque
                          {item.origem === 'lembrado' && item.produtoId && (
                            <span className="text-xs rounded bg-blue-50 text-blue-700 px-1.5 py-0.5">ligado pela última nota</span>
                          )}
                          {item.origem === 'nome' && item.produtoId && (
                            <span className="text-xs rounded bg-gray-100 text-gray-600 px-1.5 py-0.5">mesmo nome</span>
                          )}
                          {item.origem === 'sugestao' && item.produtoId && (
                            <span className="text-xs rounded bg-amber-50 text-amber-800 px-1.5 py-0.5">sugestão: confira</span>
                          )}
                        </span>
                        <select
                          value={item.produtoId || ''}
                          onChange={(e) => {
                            atualizarItem(i, 'produtoId', e.target.value || null)
                            atualizarItem(i, 'origem', null)
                          }}
                          className="border rounded-lg px-3 py-2 text-sm w-full"
                        >
                          <option value="">— Criar produto novo —</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>{p.nomeComercial} ({p.unidadeMedida.toLowerCase()})</option>
                          ))}
                        </select>
                      </label>

                      {!item.produtoId && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="text-sm sm:col-span-1">
                            <span className="block text-gray-600 mb-1">Nome do produto novo</span>
                            <input
                              type="text"
                              value={item.nomeEstoque || ''}
                              onChange={(e) => atualizarItem(i, 'nomeEstoque', e.target.value)}
                              className="border rounded-lg px-3 py-2 text-sm w-full"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="block text-gray-600 mb-1">Unidade no estoque</span>
                            <input
                              type="text"
                              value={item.unidadeEstoque || ''}
                              onChange={(e) => atualizarItem(i, 'unidadeEstoque', e.target.value)}
                              placeholder="l, kg, un..."
                              className="border rounded-lg px-3 py-2 text-sm w-full"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="block text-gray-600 mb-1">Categoria</span>
                            <select
                              value={item.categoria}
                              onChange={(e) => atualizarItem(i, 'categoria', e.target.value)}
                              className="border rounded-lg px-3 py-2 text-sm w-full"
                            >
                              {CATEGORIAS.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-600">Conversão: 1 {item.unidade} =</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.fatorConversao}
                          onChange={(e) => atualizarItem(i, 'fatorConversao', e.target.value)}
                          className="w-24 border rounded-lg px-2 py-1.5 text-sm"
                          aria-label={`Quantos ${unidadeDestino || 'unidades'} vale 1 ${item.unidade}`}
                        />
                        <span className="text-gray-600">{unidadeDestino || '—'}</span>
                        <span className="sm:ml-auto font-medium">
                          Entra no estoque: <span className="text-green-700">{fmt(entra)} {unidadeDestino}</span>
                          {fator > 0 && fator !== 1 && (
                            <span className="text-gray-500 font-normal"> ({moeda(item.valorUnitario / fator)}/{unidadeDestino})</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={novaNota} className="px-4 py-2 rounded-lg border">Cancelar</button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando || !localId || itensIncluidos.length === 0 || !!nota.jaLancada || fatorInvalido}
              className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {confirmando ? 'Gravando...' : `Confirmar entrada (${itensIncluidos.length} produto${itensIncluidos.length === 1 ? '' : 's'})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
