'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

// Seleção de várias opções num filtro (lista com quadradinhos e busca).
// O valor é uma string com as opções separadas por "|" — assim o filtro
// continua cabendo no mesmo campo de texto dos outros filtros. String
// vazia = "Todos".
export const SEPARADOR_MULTIPLO = '|'

export function valoresSelecionados(valor: string): string[] {
  return valor ? valor.split(SEPARADOR_MULTIPLO).filter(Boolean) : []
}

export function SelecaoMultiplaFiltro({
  opcoes,
  valor,
  onChange,
  rotuloTodos = 'Todos',
  rotuloPlural = 'selecionados',
}: {
  opcoes: string[]
  valor: string
  onChange: (novoValor: string) => void
  rotuloTodos?: string
  rotuloPlural?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selecionados = valoresSelecionados(valor)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [aberto])

  const alternar = (opcao: string) => {
    const nova = selecionados.includes(opcao)
      ? selecionados.filter((s) => s !== opcao)
      : [...selecionados, opcao]
    onChange(nova.join(SEPARADOR_MULTIPLO))
  }

  const filtradas = opcoes.filter((o) => o.toLowerCase().includes(busca.toLowerCase()))

  const texto =
    selecionados.length === 0
      ? rotuloTodos
      : selecionados.length === 1
      ? selecionados[0]
      : `${selecionados.length} ${rotuloPlural}`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border border-[#DDD5C8] rounded-lg px-3 py-2 bg-white text-left text-sm"
      >
        <span className="truncate">{texto}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500" />
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="w-full py-1.5 text-sm border-0 focus:outline-none focus:ring-0 shadow-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtradas.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">Nada encontrado</p>
            ) : (
              filtradas.map((o) => (
                <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer font-normal">
                  <input
                    type="checkbox"
                    checked={selecionados.includes(o)}
                    onChange={() => alternar(o)}
                    className="rounded border-gray-300 w-4 h-4"
                  />
                  <span>{o}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-between items-center px-3 py-2 border-t border-gray-100 text-sm">
            <button type="button" onClick={() => onChange('')} className="text-gray-500 hover:text-gray-700">
              Limpar
            </button>
            <button type="button" onClick={() => setAberto(false)} className="font-semibold text-primary">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
