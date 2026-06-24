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
  ClipboardList,
  Tag,
  Beaker,
  Users,
} from 'lucide-react'
import { useState } from 'react'


const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Registro de Atividades', href: '/modules/atividades', icon: ClipboardList, excludeRoles: 'AGRONOMO' },
  { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO' },
  { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO' },
  { label: 'Receitas', href: '/modules/receitas', icon: Beaker, role: 'GESTOR|GERENTE|AGRONOMO' },
  { label: 'Tipos de Atividade', href: '/modules/tipos-atividade', icon: Tag, role: 'GESTOR' },
  { label: 'Implementos', href: '/modules/implementos', icon: Tractor, role: 'GESTOR|GERENTE' },
  { label: 'Funcionários', href: '/modules/funcionarios', icon: Users, role: 'GESTOR' },
  { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO' },
  { label: 'Combustível', href: '/modules/combustivel', icon: Fuel, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Assistente IA', href: '/modules/assistente', icon: Bot, role: 'GESTOR' },
  { label: 'Configurações', href: '/settings', icon: Settings, role: 'GESTOR|GERENTE' },
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
      <aside
        className={`hidden lg:flex flex-col bg-primary text-white transition-all duration-300 ${
          isOpen ? 'w-64' : 'w-20'
        }`}
      >
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

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems
            .filter((item) => {
              const userRole = (session?.user as any)?.role || ''

              if (!item.role && !item.excludeRoles) {
                return true
              }

              if (item.role) {
                const allowedRoles = item.role.split('|')
                if (userRole && !allowedRoles.includes(userRole)) {
                  return false
                }
                if (!userRole) {
                  return false
                }
              }

              if (item.excludeRoles) {
                const excludedRoles = item.excludeRoles.split('|')
                if (userRole && excludedRoles.includes(userRole)) {
                  return false
                }
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
