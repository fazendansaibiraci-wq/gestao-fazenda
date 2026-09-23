'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
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
  Users,
  DollarSign,
  LogOut,
  UserPlus,
  Warehouse,
  Droplet,
  MapPin,
  ArrowLeft,
  CalendarDays,
  MoreHorizontal,
} from 'lucide-react'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Atividades', href: '/modules/atividades', icon: ClipboardList, excludeRoles: 'AGRONOMO' },
  { label: 'Combustível', href: '/modules/combustivel', icon: Fuel, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Histórico Combustível', curto: 'Histórico', href: '/modules/combustivel/historico', icon: Fuel, role: 'GESTOR|GERENTE' },
  { label: 'Estoque', href: '/modules/estoque', icon: Warehouse, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Turmas', href: '/modules/turmas', icon: UserPlus, role: 'GESTOR|GERENTE' },
  { label: 'Aplicação de Insumos', href: '/modules/aplicacao-insumos', icon: Droplet, role: 'GESTOR|GERENTE' },
  { label: 'Talhões', href: '/modules/talhoes', icon: Leaf, excludeRoles: 'FUNCIONARIO' },
  { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Cadastro de Produtos', href: '/modules/produtos', icon: Package, excludeRoles: 'FUNCIONARIO' },
  { label: 'Tipos', href: '/modules/tipos-atividade', icon: Tag, role: 'GESTOR|GERENTE' },
  { label: 'Implementos', href: '/modules/implementos', icon: Tractor, role: 'GESTOR|GERENTE' },
  { label: 'Turmas (Cadastro)', href: '/modules/turmas-cadastro', icon: Users, role: 'GESTOR|GERENTE' },
  { label: 'Funcionários', href: '/modules/funcionarios', icon: Users, role: 'GESTOR|GERENTE' },
  { label: 'Safras', href: '/modules/safras', icon: Calendar, excludeRoles: 'FUNCIONARIO' },
  { label: 'Locais', href: '/modules/locais', icon: MapPin, excludeRoles: 'FUNCIONARIO' },
  { label: 'Feriados', href: '/modules/feriados', icon: CalendarDays, role: 'GESTOR|GERENTE' },
  { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3, excludeRoles: 'FUNCIONARIO|AGRONOMO' },
  { label: 'Meus Relatórios', href: '/modules/meus-relatorios', icon: BarChart3, role: 'FUNCIONARIO' },
  { label: 'Resumo Mensal', href: '/modules/resumo-mensal', icon: DollarSign, excludeRoles: 'AGRONOMO' },
  { label: 'Usuários', href: '/settings', icon: Settings, role: 'GESTOR|GERENTE' },
]

export function MobileNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || ''
  // Menu "Mais" abre/fecha no toque (antes dependia de "hover", que no
  // celular é imprevisível) e fecha sozinho ao trocar de tela.
  const [maisAberto, setMaisAberto] = useState(false)
  useEffect(() => {
    setMaisAberto(false)
  }, [pathname])

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
      <div className="flex">
        {itensPrincipais.map(({ label, curto, href, icon: Icon }: any) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-1 py-3 transition-colors flex-1 min-w-0 ${
              isActive(href) ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Icon className="w-6 h-6 flex-shrink-0" />
            <span className="text-xs text-center truncate w-full">{curto || label}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setMaisAberto((v) => !v)}
          aria-expanded={maisAberto}
          className={`flex flex-col items-center gap-1 px-1 py-3 flex-1 min-w-0 transition-colors ${
            maisAberto || itensMais.some((i) => isActive(i.href)) ? 'text-primary' : 'text-gray-500'
          }`}
        >
          <MoreHorizontal className="w-6 h-6 flex-shrink-0" />
          <span className="text-xs">Mais</span>
        </button>
      </div>

      {maisAberto && (
        <>
          {/* Toque fora fecha o menu */}
          <div className="fixed inset-0 bg-black/20 -z-10" onClick={() => setMaisAberto(false)} />
          <div className="absolute bottom-full right-2 mb-2 w-64 max-h-[70vh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2">
            {itensMais.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMaisAberto(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive(href)
                    ? 'bg-[#EFE9DF] text-primary font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            ))}

            {itensMais.length > 0 && (
              <div className="border-t border-gray-100 my-1"></div>
            )}

            <button
              onClick={() => { setMaisAberto(false); router.back() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-gray-600 hover:bg-gray-50"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Voltar</span>
            </button>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Sair</span>
            </button>
          </div>
        </>
      )}
    </nav>
  )
}
