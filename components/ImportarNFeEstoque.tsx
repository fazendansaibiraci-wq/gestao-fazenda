'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FileUp, X, Check, AlertTriangle } from 'lucide-react'

interface ItemPreview {
  nome: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
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

export function ImportarNFeEstoque({ onImportado }: { onImportado: () => void }) {
  const { data: session } = useSession()
  const isGestor = session?.user?.role === 'GESTOR'
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [nota, setNota] = useState<{ fornecedor: string; numeroNota: string; serieNota: string; dataEmissao: string; chaveAcesso: string } | null>(null)
  const [itens, setItens] = useState<ItemPreview[]>([])
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

      const res = await fetch('/api/produtos/importar-nfe', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao processar a NF-e')
        return
      }

      setNota({
        fornecedor: data.data.fornecedor,
        numeroNota: data.data.numeroNota,
        serieNota: data.data.serieNota,
        dataEmissao: data.data.dataEmissao,
        chaveAcesso: data.data.chaveAcesso,
      })
      setItens(data.data.itens.map((it: ItemPreview) => ({ ...it, categoria: 'outro', incluir: true })))
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
    if (!nota) return

    setConfirmando(true)
    setErro('')

    try {
      const itensIncluidos = itens.filter((i) => i.incluir !== false)
      const res = await fetch('/api/produtos/importar-nfe/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nota, itens: itensIncluidos }),
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

  const fechar = () => {
    setAberto(false)
    setItens([])
    setNota(null)
    setErro('')
    setResultado(null)
  }

  if (!isGestor) {
    return null
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 border border-primary text-primary px-4 py-2 rounded-lg hover:bg-primary/5"
      >
        <FileUp className="w-4 h-4" />
        Entrada de Produtos (NF-e)
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Entrada de Produtos via NF-e</h2>
        <button onClick={fechar} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {itens.length === 0 && !resultado && (
        <div>
          <input type="file" accept=".xml,text/xml,application/xml" onChange={handleArquivo} disabled={carregando} />
          {carregando && <p className="text-sm text-gray-500 mt-2">Lendo a NF-e...</p>}
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
          Entrada registrada: {resultado.criados} produto(s) criado(s), {resultado.atualizados} atualizado(s).
        </div>
      )}

      {nota && itens.length > 0 && (
        <>
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <p><strong>Fornecedor:</strong> {nota.fornecedor}</p>
            <p><strong>Nota:</strong> {nota.numeroNota} — Série {nota.serieNota}</p>
            <p><strong>Emissão:</strong> {new Date(nota.dataEmissao).toLocaleDateString('pt-BR')}</p>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Incluir</th>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-left">Qtd.</th>
                  <th className="px-3 py-2 text-left">Unid.</th>
                  <th className="px-3 py-2 text-left">Vl. Unitário</th>
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
                    <td className="px-3 py-2">{item.quantidade.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">{item.unidade}</td>
                    <td className="px-3 py-2">R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      {item.existe ? (
                        <span className="text-blue-600">Soma no estoque</span>
                      ) : (
                        <span className="text-green-600">Novo produto</span>
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

          <div className="flex justify-end gap-2">
            <button onClick={fechar} className="px-4 py-2 rounded-lg border">Cancelar</button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {confirmando ? 'Gravando...' : `Confirmar entrada (${itens.filter(i => i.incluir !== false).length} produtos)`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
