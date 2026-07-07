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
  Fuel,
  ClipboardList,
  Tag,
  Beaker,
  Users,
  UserPlus,
  DollarSign,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [cadastrosAberto, setCadastrosAberto] = useState(false)
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || ''

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const show = (role?: string, excludeRoles?: string) => {
    if (!role && !excludeRoles) return true
    if (role) {
      const allowed = role.split('|')
      if (!userRole || !allowed.includes(userRole)) return false
    }
    if (excludeRoles) {
      const excluded = excludeRoles.split('|')
      if (userRole && excluded.includes(userRole)) return false
    }
    return true
  }

  const cadastroItems = [
    { label: 'Cadastro de Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO|GERENTE' },
    { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Receitas', href: '/modules/receitas', icon: Beaker, role: 'GESTOR|AGRONOMO' },
    { label: 'Tipos de Atividade', href: '/modules/tipos-atividade', icon: Tag, role: 'GESTOR' },
    { label: 'Implementos', href: '/modules/implementos', icon: Tractor, role: 'GESTOR' },
    { label: 'Funcionários', href: '/modules/funcionarios', icon: Users, role: 'GESTOR' },
    { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO|GERENTE' },
    { label: 'Cadastro Usuários', href: '/settings', icon: Settings, role: 'GESTOR' },
  ].filter(item => show(item.role, item.excludeRoles))

  const operacionalItems = [
    { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Registro de Atividades', href: '/modules/atividades', icon: ClipboardList, excludeRoles: 'AGRONOMO' },
    { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO|GERENTE' },
    { label: 'Combustível', href: '/modules/combustivel', icon: Fuel, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Turmas', href: '/modules/turmas', icon: UserPlus, role: 'GESTOR|GERENTE' },
  ].filter(item => show(item.role, item.excludeRoles))

  const relatorioItems = [
    { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO|AGRONOMO|GERENTE' },
    { label: 'Resumo Mensal', href: '/modules/resumo-mensal', icon: DollarSign, excludeRoles: 'AGRONOMO|GERENTE' },
  ].filter(item => show(item.role, item.excludeRoles))

  const cadastroAtivo = cadastroItems.some(i => isActive(i.href))

  return (
    <>
      <aside className={`hidden lg:flex flex-col bg-primary text-white transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold">Gestão</h1>
            </div>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-secondary/20 rounded-lg transition-colors">
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">

          {/* Operacional */}
          {isOpen && <p className="text-xs text-white/40 uppercase font-semibold px-2 pt-2 pb-1">Operacional</p>}
          {operacionalItems.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </Link>
          ))}

          {/* Cadastros — sub-menu */}
          {cadastroItems.length > 0 && (
            <>
              {isOpen && <p className="text-xs text-white/40 uppercase font-semibold px-2 pt-4 pb-1">Cadastros</p>}
              <button
                onClick={() => setCadastrosAberto(o => !o)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${cadastroAtivo ? 'bg-secondary/30' : 'hover:bg-secondary/20'} text-light`}
              >
                <FolderOpen className="w-5 h-5 flex-shrink-0" />
                {isOpen && (
                  <>
                    <span className="flex-1 text-left truncate">Cadastros</span>
                    {(cadastrosAberto || cadastroAtivo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </>
                )}
              </button>
              {(cadastrosAberto || cadastroAtivo) && isOpen && (
                <div className="ml-4 border-l border-white/20 pl-3 space-y-1">
                  {cadastroItems.map(({ label, href, icon: Icon }) => (
                    <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Financeiro */}
          {relatorioItems.length > 0 && (
            <>
              {isOpen && <p className="text-xs text-white/40 uppercase font-semibold px-2 pt-4 pb-1">Financeiro</p>}
              {relatorioItems.map(({ label, href, icon: Icon }) => (
                <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && <span className="truncate">{label}</span>}
                </Link>
              ))}
            </>
          )}

        </nav>

        <div className="border-t border-secondary p-4">
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-light hover:bg-secondary/20 transition-colors">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
