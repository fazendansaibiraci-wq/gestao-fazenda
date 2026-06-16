'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Leaf,
  Tractor,
  Package,
  Calendar,
  BarChart3,
  Settings,
} from 'lucide-react'

const menuItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Talhões', href: '/modules/talhoes', icon: Leaf },
  { label: 'Máquinas', href: '/modules/maquinas', icon: Tractor },
  { label: 'Produtos', href: '/modules/produtos', icon: Package },
  { label: 'Safras', href: '/modules/safras', icon: Calendar },
  { label: 'Relatórios', href: '/modules/relatorios', icon: BarChart3 },
  { label: 'Configurações', href: '/settings', icon: Settings },
]

export function MobileNavigation() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around">
        {menuItems.slice(0, 5).map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-2 py-3 transition-colors flex-1 ${
              isActive(href)
                ? 'text-primary'
                : 'text-gray-500'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs text-center truncate">{label}</span>
          </Link>
        ))}

        {/* More menu */}
        <div className="relative group flex flex-col items-center gap-1 px-2 py-3 flex-1">
          <span className="text-2xl">⋯</span>
          <span className="text-xs text-gray-500">Mais</span>

          {/* Dropdown */}
          <div className="hidden group-hover:block absolute bottom-full right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48">
            {menuItems.slice(5).map(({ label, href, icon: Icon }) => (
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
      </div>
    </nav>
  )
}
