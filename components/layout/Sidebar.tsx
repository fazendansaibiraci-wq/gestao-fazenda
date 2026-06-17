'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Home,
  Leaf,
  Tractor,
  Package,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bot,
  Fuel,
  CheckSquare,
} from 'lucide-react'
import { useState } from 'react'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO' },
  { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO' },
  { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO' },
  { label: 'Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO' },
  { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO' },
  { label: 'Combustível', href: '/modules/combustivel', icon: Fuel, excludeRoles: 'FUNCIONARIO' },
  { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO' },
  { label: 'Assistente IA', href: '/modules/assistente', icon: Bot, role: 'GESTOR' },
  { label: 'Configurações', href: '/settings', icon: Settings, role: 'GESTOR|GERENTE' },
  { label: 'Lançamento de Atividades', href: '/modules/atividades', icon: CheckSquare, role: 'FUNCIONARIO' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const { data: session } = useSession()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-primary text-white transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">Gestão</h1>
            </div>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-secondary/20 rounded-lg transition-colors"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems
            .filter((item) => {
              const userRole = (session?.user as any)?.role

              // Se tem role, o usuário deve estar nele
              if (item.role) {
                const allowedRoles = item.role.split('|')
                if (!allowedRoles.includes(userRole)) return false
              }

              // Se tem excludeRoles, o usuário não deve estar nele
              if (item.excludeRoles) {
                const excludedRoles = item.excludeRoles.split('|')
                if (excludedRoles.includes(userRole)) return false
              }

              return true
            })
            .map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(href)
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-light hover:bg-secondary/20'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="truncate">{label}</span>}
              </Link>
            ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-secondary p-4">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-light hover:bg-secondary/20 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
