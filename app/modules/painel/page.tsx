'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { BarChart3, Users, Clock, Fuel, AlertCircle, Coffee, TrendingUp, FileText } from 'lucide-react'

export default function PainelPage() {
  const { data: session, status } = useSession()
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'GERENTE') {
      redirect('/modules')
    }
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/painel/dashboard')
      if (res.ok) {
        const data = await res.json()
        setDados(data.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status])

  if (status === 'loading' || loading) {
    return <div className="flex justify-center py-12"><div className="spinner"></div></div>
  }

  if (session?.user?.role !== 'GESTOR' && session?.user?.role !== 'GERENTE') {
    return (
      <div className="card bg-red-50 border-l-4 border-red-500">
        <p className="text-red-800 font-medium">
          ❌ Acesso Restrito: Apenas Gestores e Gerentes podem acessar o Painel
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-primary flex items-center gap-3">
          <BarChart3 className="w-10 h-10" />
          Painel do Gestor
        </h1>
        <p className="text-gray-600 mt-2">Visão geral de todas as operações da fazenda</p>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Atividades do Período */}
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-600">Atividades</p>
              <p className="text-3xl font-bold text-blue-600">{dados?.atividadesHoje || 0}</p>
              <p className="text-xs text-gray-600 mt-1">hoje</p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Horas Trabalhadas */}
        <div className="card border-l-4 border-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-600">Horas Totais</p>
              <p className="text-3xl font-bold text-green-600">{(dados?.horasTotais || 0).toFixed(1)}h</p>
              <p className="text-xs text-gray-600 mt-1">semana atual</p>
            </div>
            <Clock className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* Horas Extras Pendentes */}
        <div className="card border-l-4 border-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-600">Horas Extras</p>
              <p className="text-3xl font-bold text-orange-600">{(dados?.horasExtrasPendentes || 0).toFixed(1)}h</p>
              <p className="text-xs text-gray-600 mt-1">pendentes aprovação</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        {/* Diesel */}
        <div className="card border-l-4 border-red-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-600">Diesel</p>
              <p className="text-3xl font-bold text-red-600">{(dados?.dieselAtual || 0).toFixed(0)}L</p>
              <p className="text-xs text-gray-600 mt-1">estoque atual</p>
            </div>
            <Fuel className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Segunda Fileira de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Banco de Horas */}
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Banco de Horas
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Positivo:</span>
              <span className="font-bold text-green-600">{(dados?.bancoHorasPositivo || 0).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Negativo:</span>
              <span className="font-bold text-red-600">{(dados?.bancoHorasNegativo || 0).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-gray-600">Líquido:</span>
              <span className="font-bold">{(dados?.bancoHorasLiquido || 0).toFixed(1)}h</span>
            </div>
          </div>
        </div>

        {/* Horas de Máquina */}
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Horas de Máquina
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Este mês:</span>
              <span className="font-bold">{(dados?.horasMaquinaEstesMes || 0).toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mês anterior:</span>
              <span className="font-bold">{(dados?.horasMaquinaAnterior || 0).toFixed(1)}h</span>
            </div>
          </div>
        </div>

        {/* Último Abastecimento */}
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Último Abastecimento
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Data:</p>
              <p className="font-bold">
                {dados?.ultimoAbastecimento?.data
                  ? new Date(dados.ultimoAbastecimento.data).toLocaleDateString('pt-BR')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Quantidade:</p>
              <p className="font-bold">{(dados?.ultimoAbastecimento?.quantidade || 0).toFixed(0)} L</p>
            </div>
          </div>
        </div>
      </div>

      {/* Terceira Fileira */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lotes Aguardando Classificação */}
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
            <Coffee className="w-5 h-5" />
            Lotes Aguardando Classificação
          </h3>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-orange-600">{dados?.lotesAguardandoClassificacao || 0}</p>
            <p className="text-xs text-gray-600">lotes em Benefício</p>
            <a href="/modules/rastreabilidade/classificacao" className="text-sm text-primary hover:underline">
              Ver classificação →
            </a>
          </div>
        </div>

        {/* Aplicações de Insumos Recentes */}
        <div className="card">
          <h3 className="font-semibold text-lg text-primary mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Aplicações de Insumos
          </h3>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-blue-600">{dados?.aplicacoesRecentesMes || 0}</p>
            <p className="text-xs text-gray-600">este mês</p>
            <a href="/modules/receitas?tab=aplicacoes" className="text-sm text-primary hover:underline">
              Ver aplicações →
            </a>
          </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="card bg-light">
        <h3 className="font-semibold text-lg text-primary mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <a href="/modules/painel/folha-pagamento" className="btn btn-primary text-center">
            📄 Folha de Pagamento
          </a>
          <a href="/modules/painel/vales" className="btn btn-secondary text-center">
            💰 Lançar Vale
          </a>
          <a href="/modules/painel/relatorios" className="btn btn-outline text-center">
            📊 Relatórios
          </a>
          <a href="/modules/assistente" className="btn btn-primary text-center">
            🤖 Assistente IA
          </a>
        </div>
      </div>

      {/* Últimas Atividades */}
      <div className="card">
        <h3 className="font-semibold text-lg text-primary mb-4">Últimas Atividades</h3>
        <div className="space-y-3">
          {dados?.ultimasAtividades && dados.ultimasAtividades.length > 0 ? (
            dados.ultimasAtividades.slice(0, 5).map((atividade: any) => (
              <div key={atividade.id} className="border-b pb-3 last:border-b-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{atividade.tipo}</p>
                    <p className="text-xs text-gray-600">{atividade.funcionario}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(atividade.data).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-sm">Nenhuma atividade recente</p>
          )}
        </div>
      </div>
    </div>
  )
}
