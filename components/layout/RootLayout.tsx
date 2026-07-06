'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export function RootLayout({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    setIsMounted(true)

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.log('ServiceWorker registration failed: ', error)
      })
    }

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Check if we're on login page or other pages that shouldn't have layout
  const isAuthPage = pathname === '/login' || pathname === '/register'

  if (!isMounted) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>
  }

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      {isDesktop && <Sidebar />}

      {/* Mobile Top Bar */}
      {!isDesktop && (
        <div className="fixed top-0 left-0 right-0 lg:hidden bg-primary text-white z-50 flex items-center justify-between px-4 py-3 shadow-sm">
          <span className="font-semibold text-sm truncate">Gestão Fazenda</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors rounded-lg px-3 py-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0 pt-14 lg:pt-0">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Navigation */}
      {!isDesktop && <MobileNavigation />}
    </div>
  )
}
