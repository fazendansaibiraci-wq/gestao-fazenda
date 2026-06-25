'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Home,
  Leaf,
  Tractor,
  Package,
  Calendar,
  BarChart3,
  Settings,
  ClipboardList,
  Fuel,
  Tag,
  Beaker,
  Users,
  DollarSign,
} from 'lucide-react'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Atividades', href: '/modules/atividades', icon: ClipboardList, excludeRoles: 'AGRONOMO' },
  { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO' },
  { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Cadastro de Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO' },
  { label: 'Receitas', href: '/modules/receitas', icon: Beaker, role: 'GESTOR|GERENTE|AGRONOMO' },
  { label: 'Tipos', href: '/modules/tipos-atividade', icon: Tag, role: 'GESTOR' },
  { label: 'Implementos', href: '/modules/implementos', icon: Tractor, role: 'GESTOR|GERENTE' },
  { label: 'Funcionários', href: '/modules/funcionarios', icon: Users, role: 'GESTOR' },
  { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO' },
  { label: 'Combustível', href: '/modules/combustivel', icon: Fuel, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Resumo Mensal', href: '/modules/resumo-mensal', icon: DollarSign, excludeRoles: 'AGRONOMO' },
  { label: 'Cadastro Usuários', href: '/settings', icon: Settings, role: 'GESTOR|GERENTE' },
]

export function MobileNavigation() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || ''

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const itensFiltrados = menuItems.filter((item) => {
    if (!item.role && !item.excludeRoles) return true

    if (item.role) {
      const allowedRoles = item.role.split('|')
      if (!userRole || !allowedRoles.includes(userRole)) return false
    }

    if (item.excludeRoles) {
      const excludedRoles = item.excludeRoles.split('|')
      if (userRole && excludedRoles.includes(userRole)) return false
    }

    return true
  })

  const itensPrincipais = itensFiltrados.slice(0, 4)
  const itensMais = itensFiltrados.slice(4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around">
        {itensPrincipais.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-2 py-3 transition-colors flex-1 ${
              isActive(href) ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs text-center truncate">{label}</span>
          </Link>
        ))}

        {itensMais.length > 0 && (
          <div className="relative group flex flex-col items-center gap-1 px-2 py-3 flex-1">
            <span className="text-2xl text-gray-500">⋯</span>
            <span className="text-xs text-gray-500">Mais</span>

            <div className="hidden group-hover:block absolute bottom-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48">
              {itensMais.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive(href)
                      ? 'bg-light text-primary font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
