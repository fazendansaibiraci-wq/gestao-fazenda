'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const CORES = ['#2d6a4f', '#52b788', '#95d5b2', '#74c69d', '#40916c', '#1b4332', '#b7e4c7']

export default function MeusRelatoriosPage() {
  const { data: session, status } = useSession()
  const [dados, setDados] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login')
    if (status === 'authenticated') load()
  }, [status])

  const load = async () => {
    try {
      const res = await fetch('/api/relatorio-funcionario')
      const data = await res.json()
      setDados(data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || status === 'loading') {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
  }

  if (!dados) {
    return <div className="text-gray-500">Não foi possível carregar seus relatórios.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Meus Relatórios</h1>
        <p className="text-gray-600 mt-1">Seu desempenho nos últimos 12 meses</p>
      </div>

      <div className="card">
        <h3 className="font-semibold text-primary mb-4">Horas Trabalhadas por Mês</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dados.historicoMensal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="horasTrabalhadas" name="Horas trabalhadas" stroke="#2d6a4f" strokeWidth={2} />
            <Line type="monotone" dataKey="horasExtras" name="Horas extras" stroke="#e63946" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="font-semibold text-primary mb-4">Dias Trabalhados vs Faltas por Mês</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados.historicoMensal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="diasTrabalhados" name="Dias trabalhados" fill="#52b788" />
            <Bar dataKey="faltas" name="Faltas" fill="#e63946" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-primary mb-4">Horas por Tipo de Atividade</h3>
          {dados.porAtividade.length === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={dados.porAtividade}
                  dataKey="horas"
                  nameKey="tipoAtividade"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => entry.tipoAtividade}
                >
                  {dados.porAtividade.map((_: any, i: number) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-primary mb-4">Horas por Talhão</h3>
          {dados.porTalhao.length === 0 ? (
            <p className="text-gray-400 text-sm">Sem dados suficientes ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dados.porTalhao} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="talhao" width={90} />
                <Tooltip />
                <Bar dataKey="horas" name="Horas" fill="#2d6a4f" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
