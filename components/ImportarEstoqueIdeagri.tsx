'use client'

import { useState } from 'react'
import { Upload, X, Check, AlertTriangle } from 'lucide-react'

interface ItemPreview {
  nome: string
  categoriaSugerida?: string
  quantidadeTotal: number
  estoqueMinimoTotal: number
  unidade: string
  valorUnitarioMedio: number
  locais: string[]
  existe: boolean
  produtoId: string | null
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

export function ImportarEstoqueIdeagri({ onImportado }: { onImportado: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [itens, setItens] = useState<ItemPreview[]>([])
  const [linhasNaoReconhecidas, setLinhasNaoReconhecidas] = useState<string[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState<{ criados: number; atualizados: number } | null>(null)

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCarregando(true)
    setErro('')
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/produtos/importar-estoque', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao processar o PDF')
        return
      }

      setItens(data.data.produtos.map((p: ItemPreview) => ({ ...p, categoria: p.categoriaSugerida || 'outro', incluir: true })))
      setLinhasNaoReconhecidas(data.data.linhasNaoReconhecidas)
    } catch (err) {
      setErro('Erro ao enviar o arquivo')
    } finally {
      setCarregando(false)
      e.target.value = ''
    }
  }

  const atualizarItem = (index: number, campo: string, valor: any) => {
    setItens((prev) => prev.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)))
  }

  const handleConfirmar = async () => {
    setConfirmando(true)
    setErro('')

    try {
      const itensIncluidos = itens.filter((i) => i.incluir !== false)
      const res = await fetch('/api/produtos/importar-estoque/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: itensIncluidos }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao gravar')
        return
      }

      setResultado(data.data)
      setItens([])
      onImportado()
    } catch (err) {
      setErro('Erro ao gravar os produtos')
    } finally {
      setConfirmando(false)
    }
  }

  const fechar = () => {
    setAberto(false)
    setItens([])
    setErro('')
    setResultado(null)
    setLinhasNaoReconhecidas([])
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary/5"
      >
        <Upload className="w-4 h-4" />
        Importar Estoque (CSV Ideagri)
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Importar Estoque do Ideagri</h2>
        <button onClick={fechar} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {itens.length === 0 && !resultado && (
        <div>
          <input type="file" accept=".csv,text/csv" onChange={handleArquivo} disabled={carregando} />
          {carregando && <p className="text-sm text-gray-500 mt-2">Lendo o CSV...</p>}
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {resultado && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">
          <Check className="w-4 h-4 shrink-0" />
          Importação concluída: {resultado.criados} produto(s) criado(s), {resultado.atualizados} atualizado(s).
        </div>
      )}

      {itens.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            {itens.filter((i) => i.existe).length} produto(s) vão ATUALIZAR o cadastro existente, {itens.filter((i) => !i.existe).length} são NOVOS. Confira antes de confirmar.
          </p>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Incluir</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Qtd. Total</th>
                  <th className="px-3 py-2 text-left">Unid.</th>
                  <th className="px-3 py-2 text-left">Valor Médio</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Categoria (se novo)</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={i} className={`border-t ${item.incluir === false ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.incluir !== false}
                        onChange={(e) => atualizarItem(i, 'incluir', e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{item.nome}</td>
                    <td className="px-3 py-2">{item.quantidadeTotal.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">{item.unidade}</td>
                    <td className="px-3 py-2">R$ {item.valorUnitarioMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      {item.existe ? (
                        <span className="text-blue-600">Atualiza existente</span>
                      ) : (
                        <span className="text-green-600">Novo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!item.existe && (
                        <select
                          value={item.categoria}
                          onChange={(e) => atualizarItem(i, 'categoria', e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {linhasNaoReconhecidas.length > 0 && (
            <details className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
              <summary className="cursor-pointer font-medium">
                {linhasNaoReconhecidas.length} linha(s) do PDF não foram reconhecidas (clique pra ver)
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {linhasNaoReconhecidas.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </details>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={fechar} className="px-4 py-2 rounded-lg border">Cancelar</button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {confirmando ? 'Gravando...' : `Confirmar importação (${itens.filter(i => i.incluir !== false).length} produtos)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
