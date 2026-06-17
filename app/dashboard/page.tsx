'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Leaf, Tractor, Package, Calendar, BarChart3, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '@/lib/db'

interface DashboardStats {
  totalTalhoes: number
  totalSafras: number
  totalMaquinas: number
  atividadesPendentes: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    totalTalhoes: 0,
    totalSafras: 0,
    totalMaquinas: 0,
    atividadesPendentes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login')
    }

    if (status === 'authenticated') {
      const userRole = (session?.user as any)?.role
      if (userRole === 'FUNCIONARIO') {
        redirect('/modules/atividades')
      }
      loadStats()
    }
  }, [status, session])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [talhoes, safras, maquinas, atividades] = await Promise.all([
        db.talhoes.toArray(),
        db.safras.toArray(),
        db.maquinas.toArray(),
        db.atividades.where('status').equals('pendente').toArray(),
      ])

      setStats({
        totalTalhoes: talhoes.length,
        totalSafras: safras.length,
        totalMaquinas: maquinas.length,
        atividadesPendentes: atividades.length,
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Bem-vindo, {session.user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Sistema de Gestão Agrícola - Gestão Fazenda
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Talhões */}
        <Link href="/modules/talhoes">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Talhões</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalTalhoes}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        {/* Safras */}
        <Link href="/modules/safras">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Safras</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalSafras}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        {/* Máquinas */}
        <Link href="/modules/maquinas">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Máquinas</p>
                <p className="text-3xl font-bold text-primary mt-2">
                  {loading ? '-' : stats.totalMaquinas}
                </p>
              </div>
              <div className="p-3 bg-light rounded-lg">
                <Tractor className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </Link>

        {/* Atividades Pendentes */}
        <Link href="/modules/atividades">
          <div className="card cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold">
                  Atividades Pendentes
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {loading ? '-' : stats.atividadesPendentes}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/modules/talhoes/novo" className="block">
            <button className="w-full btn btn-secondary">
              <Leaf className="w-5 h-5" />
              Novo Talhão
            </button>
          </Link>

          <Link href="/modules/safras/novo" className="block">
            <button className="w-full btn btn-secondary">
              <Calendar className="w-5 h-5" />
              Nova Safra
            </button>
          </Link>

          <Link href="/modules/relatorios" className="block">
            <button className="w-full btn btn-secondary">
              <BarChart3 className="w-5 h-5" />
              Relatórios
            </button>
          </Link>
        </div>
      </div>

      {/* Info Box */}
      <div className="card bg-light border-l-4 border-primary">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-primary">Dica:</p>
            <p className="text-sm text-gray-700 mt-1">
              O sistema funciona offline. Suas alterações serão sincronizadas automaticamente quando
              estiver conectado à internet. Verifique o menu de configurações para gerenciar a sincronização.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
