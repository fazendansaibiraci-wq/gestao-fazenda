import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RootLayout } from '@/components/layout/RootLayout'

const APP_NAME = 'Gestão Fazenda'
const APP_DEFAULT_TITLE = 'Gestão Fazenda - Sistema de Gestão Agrícola'
const APP_DESCRIPTION = 'Sistema PWA para gestão agrícola de fazendas de café'

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: '%s | ' + APP_NAME,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2d6a4f' },
    { media: '(prefers-color-scheme: dark)', color: '#2d6a4f' },
  ],
}

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <meta name="theme-color" content="#2d6a4f" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        <RootLayout>{children}</RootLayout>
      </body>
    </html>
  )
}
