'use client'

import { useState } from 'react'
import { X, ClipboardPaste, AlertTriangle } from 'lucide-react'
import {
  lerReceita,
  converterUnidade,
  type AtividadeReceita,
  type ProdutoCadastro,
  type TalhaoCadastro,
} from '@/lib/receitaWhatsapp'

// "Colar receita do WhatsApp" (Aplicação de Insumos): lê a mensagem do
// agrônomo, sugere produtos/doses/talhões do cadastro e deixa o usuário
// conferir antes de levar para o formulário de lançamento.

const ROTULO_ATIVIDADE: Record<AtividadeReceita, string> = {
  HERBICIDA: 'Herbicida',
  PULVERIZACAO: 'Pulverização',
  DRENCH: 'Drench',
  ADUBACAO: 'Adubação',
  CORRECAO_SOLO: 'Correção de Solo',
}
const ATIVIDADES_BOMBA: AtividadeReceita[] = ['HERBICIDA', 'PULVERIZACAO', 'DRENCH']

interface LinhaProduto {
  textoOriginal: string
  quantidadeLida: number
  unidadeLida: string
  produtoId: string
  dose: string
}
interface LinhaTalhao {
  nomeLido: string
  talhaoId: string
}

export interface ReceitaAplicada {
  atividade: AtividadeReceita | null
  numAplicacao: string | null
  produtos: { produtoId: string; dose: string }[]
  talhoes: { talhaoId: string }[]
}

const fmtDose = (n: number) => String(Math.round(n * 1000) / 1000)

export function ColarReceitaModal({
  produtos,
  talhoes,
  onAplicar,
  onFechar,
}: {
  produtos: ProdutoCadastro[]
  talhoes: TalhaoCadastro[]
  onAplicar: (r: ReceitaAplicada) => void
  onFechar: () => void
}) {
  const [texto, setTexto] = useState('')
  const [lida, setLida] = useState(false)
  const [atividade, setAtividade] = useState<AtividadeReceita | null>(null)
  const [numAplicacao, setNumAplicacao] = useState<string | null>(null)
  const [linhasProduto, setLinhasProduto] = useState<LinhaProduto[]>([])
  const [linhasTalhao, setLinhasTalhao] = useState<LinhaTalhao[]>([])
  const [observacoes, setObservacoes] = useState<string[]>([])

  const unidadeDe = (id: string) => produtos.find((p) => p.id === id)?.unidadeMedida || ''

  const ler = () => {
    const r = lerReceita(texto, produtos, talhoes)
    setAtividade(r.atividade)
    setNumAplicacao(r.numAplicacao)
    setLinhasProduto(
      r.produtos.map((p) => ({
        textoOriginal: p.textoOriginal,
        quantidadeLida: p.quantidadeLida,
        unidadeLida: p.unidadeLida,
        produtoId: p.produtoId,
        dose: p.produtoId ? fmtDose(converterUnidade(p.quantidadeLida, p.unidadeLida, unidadeDe(p.produtoId))) : '',
      }))
    )
    setLinhasTalhao(r.talhoes.map((t) => ({ nomeLido: t.nomeLido, talhaoId: t.talhaoId })))
    setObservacoes(r.observacoes)
    setLida(true)
  }

  const trocarProduto = (i: number, produtoId: string) =>
    setLinhasProduto((ls) =>
      ls.map((l, j) =>
        j === i
          ? { ...l, produtoId, dose: produtoId ? fmtDose(converterUnidade(l.quantidadeLida, l.unidadeLida, unidadeDe(produtoId))) : '' }
          : l
      )
    )

  const semProduto = linhasProduto.filter((l) => !l.produtoId).length
  const semTalhao = linhasTalhao.filter((l) => !l.talhaoId).length
  const atividadeSemBomba = atividade && !ATIVIDADES_BOMBA.includes(atividade)

  const aplicar = () => {
    onAplicar({
      atividade,
      numAplicacao,
      produtos: linhasProduto.filter((l) => l.produtoId && l.dose).map((l) => ({ produtoId: l.produtoId, dose: l.dose })),
      talhoes: linhasTalhao.filter((l) => l.talhaoId).map((l) => ({ talhaoId: l.talhaoId })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-primary flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5" />
            Colar receita do WhatsApp
          </h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {!lida ? (
            <>
              <p className="text-sm text-gray-600">
                Cole abaixo a mensagem inteira da receita (título, talhões e produtos com as doses por bomba).
              </p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={14}
                placeholder={'1ª PULVERIZAÇÃO\n\nTalhões: Cedro, 2SL, ...\n\n• Li 700: 500 mL\n• Cuprozeb: 7,5 Kg\n...'}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                autoFocus
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Atividade: </span>
                  <strong>{atividade ? ROTULO_ATIVIDADE[atividade] : 'não identificada'}</strong>
                </div>
                <div>
                  <span className="text-gray-500">Nº da aplicação: </span>
                  <strong>{numAplicacao || 'não identificado'}</strong>
                </div>
              </div>

              {atividadeSemBomba && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  A receita por bomba vale para Herbicida, Pulverização e Drench. Para {ROTULO_ATIVIDADE[atividade!]}, lance
                  pela quantidade total de cada talhão.
                </div>
              )}

              <div>
                <p className="text-sm font-semibold mb-2">
                  Produtos ({linhasProduto.length}) · dose por bomba
                </p>
                {linhasProduto.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum produto encontrado na mensagem.</p>
                ) : (
                  <div className="space-y-2">
                    {linhasProduto.map((l, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.3fr_120px] gap-2 items-center">
                        <span className="text-xs text-gray-600 truncate" title={l.textoOriginal}>{l.textoOriginal}</span>
                        <select
                          value={l.produtoId}
                          onChange={(e) => trocarProduto(i, e.target.value)}
                          className={`border rounded-lg px-2 py-1.5 text-sm ${l.produtoId ? '' : 'border-amber-400 bg-amber-50'}`}
                        >
                          <option value="">— Escolher produto (não achei) —</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>{p.nomeComercial}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={l.dose}
                            onChange={(e) =>
                              setLinhasProduto((ls) => ls.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)))
                            }
                            className="w-full border rounded-lg px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-gray-500 w-8">{unidadeDe(l.produtoId)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Talhões ({linhasTalhao.length})</p>
                {linhasTalhao.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum talhão encontrado na mensagem. Você pode adicioná-los no formulário.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {linhasTalhao.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-28 truncate" title={l.nomeLido}>{l.nomeLido}</span>
                        <select
                          value={l.talhaoId}
                          onChange={(e) =>
                            setLinhasTalhao((ls) => ls.map((x, j) => (j === i ? { ...x, talhaoId: e.target.value } : x)))
                          }
                          className={`flex-1 border rounded-lg px-2 py-1.5 text-sm ${l.talhaoId ? '' : 'border-amber-400 bg-amber-50'}`}
                        >
                          <option value="">— Escolher (não achei) —</option>
                          {talhoes.map((t) => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {observacoes.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Observações da receita (confira antes de salvar)
                  </p>
                  {observacoes.map((o, i) => (
                    <p key={i}>{o}</p>
                  ))}
                </div>
              )}

              {(semProduto > 0 || semTalhao > 0) && (
                <p className="text-xs text-amber-700">
                  Os itens em amarelo não foram encontrados no cadastro. Escolha na lista ou eles serão deixados de fora.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center px-5 py-4 border-t">
          {lida ? (
            <button type="button" onClick={() => setLida(false)} className="btn btn-outline btn-sm">
              Voltar ao texto
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            {lida ? (
              <button
                type="button"
                onClick={aplicar}
                disabled={!!atividadeSemBomba || linhasProduto.every((l) => !l.produtoId)}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                Usar no lançamento
              </button>
            ) : (
              <button type="button" onClick={ler} disabled={!texto.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
                Ler mensagem
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
