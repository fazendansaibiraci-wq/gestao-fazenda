'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Usuario {
  id: string
  name: string
  email: string
}

export default function LoginPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/users/public')
      .then(r => r.json())
      .then(d => setUsuarios(d.data || []))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Nome ou senha incorretos')
      } else if (result?.ok) {
        try {
          const sessionRes = await fetch('/api/auth/session')
          const sessionData = await sessionRes.json()
          const userRole = sessionData?.user?.role
          if (userRole === 'FUNCIONARIO') {
            router.push('/modules/atividades')
          } else {
            router.push('/dashboard')
          }
        } catch {
          router.push('/dashboard')
        }
      }
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-creme">
      {/* Painel da marca — só em telas grandes */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-grafite text-white flex-col items-center justify-center p-12">
        <div className="relative flex flex-col items-center -mt-16">
          {/* Logo em SVG (vetor): fica nítido em qualquer tamanho. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-nsa-claro-sem-cafe.svg" alt="NSA Café" className="h-56 w-auto" />
          {/* "Café" no mesmo estilo de "Gestão Fazenda" */}
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.45em] text-[#93A3A9]">Café</p>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.45em] text-[#93A3A9]">Gestão Fazenda</p>
        </div>

        {/* Colinas com fileiras de café */}
        <svg
          className="absolute left-0 right-0 bottom-0 w-full h-40 pointer-events-none"
          viewBox="0 0 800 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 90 C160 50 320 60 470 85 S700 55 800 70 V160 H0Z" fill="#3E4D54" />
          <path d="M0 120 C200 95 380 102 560 118 S740 100 800 108 V160 H0Z" fill="#35444B" />
          <g stroke="#C98B52" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round">
            <path d="M60 150 l14 -18" /><path d="M100 150 l14 -18" /><path d="M140 150 l14 -18" />
            <path d="M180 150 l14 -18" /><path d="M220 150 l14 -18" /><path d="M260 150 l14 -18" />
            <path d="M300 150 l14 -18" /><path d="M340 150 l14 -18" />
          </g>
        </svg>

      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-nsa-sem-cafe.svg" alt="NSA Café" className="h-20 w-auto" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#7A868C]">Café</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#7A868C]">Gestão Fazenda</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E4DDD2] shadow-sm p-8">
            <h1 className="text-2xl font-bold text-primary">Bem-vindo</h1>
            <p className="text-gray-500 mt-1 mb-6">Escolha seu usuário e digite a senha.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label htmlFor="usuario">Usuário</label>
              <select
                id="usuario"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Selecionar usuário</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full btn btn-primary mt-6 justify-center py-3 text-base"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          </div>

          <p className="text-center text-gray-500 text-xs mt-6">
            Acesso restrito a usuários autorizados
          </p>
        </div>
      </div>
    </div>
  )
}
