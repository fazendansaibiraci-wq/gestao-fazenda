'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search, AlertTriangle } from 'lucide-react'
import { RegistrarSaidaProduto } from '@/components/RegistrarSaidaProduto'

export default function EstoquePage() {
  const { status } = useSession()
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/produtos')
      const data = await res.json()
      setProdutos((data.data || []).filter((p: any) => p.status))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const produtosFiltrados = produtos.filter((p) =>
    p.nomeComercial.toLowerCase().includes(busca.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busca.toLowerCase())
  )

  const valorTotalEstoque = produtosFiltrados.reduce(
    (acc, p) => acc + (p.quantidadeEstoque || 0) * (p.valorUnitario || 0),
    0
  )

  const estoqueAbaixoMinimo = (p: any) => p.estoqueMinimo > 0 && p.quantidadeEstoque <= p.estoqueMinimo

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Estoque</h1>
      <p className="text-gray-500">Quantidade atual de cada produto, atualizada manualmente ou por importação do Ideagri.</p>

      <div className="card">
        <p className="text-sm text-gray-500">Valor total em estoque</p>
        <p className="text-2xl font-bold text-primary">
          R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <RegistrarSaidaProduto produtos={produtos} onAtualizado={load} />

      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar produto por nome ou categoria..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full border rounded-lg pl-10 pr-4 py-2"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">{produtosFiltrados.length} produto(s)</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left">Nome</th>
              <th className="px-4 py-3 text-left">Categoria</th>
              <th className="px-4 py-3 text-left">Quantidade</th>
              <th className="px-4 py-3 text-left">Valor Unitário</th>
              <th className="px-4 py-3 text-left">Valor em Estoque</th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum produto encontrado</td>
              </tr>
            ) : (
              produtosFiltrados
                .sort((a, b) => a.nomeComercial.localeCompare(b.nomeComercial))
                .map((p) => (
                  <tr key={p.id} className={`border-b hover:bg-gray-50 ${estoqueAbaixoMinimo(p) ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {p.nomeComercial}
                      {estoqueAbaixoMinimo(p) && (
                        <span title="Estoque no mínimo ou abaixo">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.categoria}</td>
                    <td className="px-4 py-3">{(p.quantidadeEstoque || 0).toLocaleString('pt-BR')} {p.unidadeMedida}</td>
                    <td className="px-4 py-3">R$ {(p.valorUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      R$ {((p.quantidadeEstoque || 0) * (p.valorUnitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
