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
  Users,
  UserPlus,
  DollarSign,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [cadastrosAberto, setCadastrosAberto] = useState(false)
  const [combustivelAberto, setCombustivelAberto] = useState(false)
  const [resumoMensalAberto, setResumoMensalAberto] = useState(false)
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
    { label: 'Cadastro de Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO' },
    { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Tipos de Atividade', href: '/modules/tipos-atividade', icon: Tag, role: 'GESTOR|GERENTE' },
    { label: 'Implementos', href: '/modules/implementos', icon: Tractor, role: 'GESTOR|GERENTE' },
    { label: 'Turmas (Cadastro)', href: '/modules/turmas-cadastro', icon: Users, role: 'GESTOR|GERENTE' },
    { label: 'Funcionários', href: '/modules/funcionarios', icon: Users, role: 'GESTOR|GERENTE' },
    { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO' },
    { label: 'Cadastro Usuários', href: '/settings', icon: Settings, role: 'GESTOR|GERENTE' },
  ].filter(item => show(item.role, item.excludeRoles))

  const combustivelItems = ([
    { label: 'Abastecimento', href: '/modules/combustivel', icon: Fuel },
    { label: 'Histórico de Abastecimentos', href: '/modules/combustivel/historico', icon: Fuel },
  ] as { label: string; href: string; icon: typeof Fuel; role?: string; excludeRoles?: string }[]).filter(item => show(item.role, item.excludeRoles))

  const operacionalItems = [
    { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Registro de Atividades', href: '/modules/atividades', icon: ClipboardList, excludeRoles: 'AGRONOMO' },
    { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO' },
    { label: 'Estoque', href: '/modules/estoque', icon: Warehouse, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Turmas', href: '/modules/turmas', icon: UserPlus, role: 'GESTOR|GERENTE' },
  ].filter(item => show(item.role, item.excludeRoles))

  const relatorioItems = [
    { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
    { label: 'Meus Relatórios', href: '/modules/meus-relatorios', icon: BarChart3, role: 'FUNCIONARIO' },
  ].filter(item => show(item.role, item.excludeRoles))

  const resumoMensalItems = ([
    { label: 'Resumo Mensal', href: '/modules/resumo-mensal', icon: DollarSign, excludeRoles: 'AGRONOMO' },
    { label: 'Calendário', href: '/modules/resumo-mensal/calendario', icon: Calendar, role: 'GESTOR|GERENTE' },
  ] as { label: string; href: string; icon: typeof DollarSign; role?: string; excludeRoles?: string }[]).filter(item => show(item.role, item.excludeRoles))

  const cadastroAtivo = cadastroItems.some(i => isActive(i.href))
  const combustivelAtivo = combustivelItems.some(i => isActive(i.href))
  const resumoMensalAtivo = resumoMensalItems.some(i => isActive(i.href))

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

          {show('', 'FUNCIONARIO|AGRONOMO') && (
            <>
              <button
                onClick={() => setCombustivelAberto(o => !o)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${combustivelAtivo ? 'bg-secondary/30' : 'hover:bg-secondary/20'} text-light`}
              >
                <Fuel className="w-5 h-5 flex-shrink-0" />
                {isOpen && (
                  <>
                    <span className="flex-1 text-left truncate">Combustível</span>
                    {(combustivelAberto || combustivelAtivo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </>
                )}
              </button>
              {(combustivelAberto || combustivelAtivo) && isOpen && (
                <div className="ml-4 border-l border-white/20 pl-3 space-y-1">
                  {combustivelItems.map(({ label, href, icon: Icon }) => (
                    <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

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
          {(relatorioItems.length > 0 || resumoMensalItems.length > 0) && (
            <>
              {isOpen && <p className="text-xs text-white/40 uppercase font-semibold px-2 pt-4 pb-1">Financeiro</p>}
              {relatorioItems.map(({ label, href, icon: Icon }) => (
                <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && <span className="truncate">{label}</span>}
                </Link>
              ))}

              {resumoMensalItems.length > 0 && (
                <>
                  <button
                    onClick={() => setResumoMensalAberto(o => !o)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${resumoMensalAtivo ? 'bg-secondary/30' : 'hover:bg-secondary/20'} text-light`}
                  >
                    <DollarSign className="w-5 h-5 flex-shrink-0" />
                    {isOpen && (
                      <>
                        <span className="flex-1 text-left truncate">Resumo Mensal</span>
                        {(resumoMensalAberto || resumoMensalAtivo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                  {(resumoMensalAberto || resumoMensalAtivo) && isOpen && (
                    <div className="ml-4 border-l border-white/20 pl-3 space-y-1">
                      {resumoMensalItems.map(({ label, href, icon: Icon }) => (
                        <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${isActive(href) ? 'bg-secondary text-primary font-semibold' : 'text-light hover:bg-secondary/20'}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
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
