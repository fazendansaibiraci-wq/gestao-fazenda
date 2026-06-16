'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { usePathname } from 'next/navigation'

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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0">
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
