'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

// Quantas movimentações do app ainda não foram lançadas no Ideagri (pro
// aviso no menu). Atualiza ao trocar de tela, a cada 2 minutos e quando a
// tela de pendências avisa que algo foi marcado.
export function usePendenciasIdeagri(ativo: boolean) {
  const pathname = usePathname()
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    const carregar = () =>
      fetch('/api/pendencias-ideagri?contar=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelado && d) setTotal(d.total || 0)
        })
        .catch(() => {})
    carregar()
    const intervalo = setInterval(carregar, 120000)
    window.addEventListener('pendencias-ideagri', carregar)
    return () => {
      cancelado = true
      clearInterval(intervalo)
      window.removeEventListener('pendencias-ideagri', carregar)
    }
  }, [ativo, pathname])

  return total
}
