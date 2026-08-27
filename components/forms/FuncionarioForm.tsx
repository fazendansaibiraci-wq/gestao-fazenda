'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRole } from '@prisma/client'

interface FuncionarioFormProps {
  id?: string
  initialData?: any
}

export function FuncionarioForm({ id, initialData }: FuncionarioFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    password: '',
    confirmPassword: '',
    phone: initialData?.phone || '',
    role: initialData?.role || UserRole.FUNCIONARIO,
    perfilExibicao: initialData?.perfilExibicao || '',
    cargaHorariaSafra: initialData?.cargaHorariaSafra || '',
    active: initialData?.active !== undefined ? initialData.active : true,
    pagamentoProporcionalDiario: initialData?.pagamentoProporcionalDiario || false,
    ocultarRegistroAtividades: initialData?.ocultarRegistroAtividades || false,
    participaFolhaPagamento: initialData?.participaFolhaPagamento !== undefined ? initialData.participaFolhaPagamento : true,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!id && form.password !== form.confirmPassword) {
        setError('As senhas não correspondem')
        setLoading(false)
        return
      }

      if (!id && !form.password) {
        setError('Senha é obrigatória para novo funcionário')
        setLoading(false)
        return
      }

      const payload = id
        ? { ...form, confirmPassword: undefined }
        : form

      const method = id ? 'PUT' : 'POST'
      const url = id ? `/api/funcionarios/${id}` : '/api/funcionarios'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar funcionário')
      }

      router.push('/modules/funcionarios')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Dados Pessoais */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Dados Pessoais</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="name">Nome Completo *</label>
              <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required disabled={loading} placeholder="João da Silva" />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required disabled={loading} placeholder="joao@fazenda.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="password">{id ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}</label>
              <input type="password" id="password" name="password" value={form.password} onChange={handleChange} required={!id} disabled={loading} placeholder="••••••••" />
            </div>
            {!id && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Senha *</label>
                <input type="password" id="confirmPassword" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required={!id} disabled={loading} placeholder="••••••••" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="phone">Telefone</label>
              <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} disabled={loading} placeholder="11 99999-9999" />
            </div>
            <div className="form-group">
              <label htmlFor="role">Perfil *</label>
              <select id="role" name="role" value={form.role} onChange={handleChange} disabled={loading}>
                <option value={UserRole.FUNCIONARIO}>Funcionário</option>
                <option value={UserRole.GERENTE}>Gerente</option>
                <option value={UserRole.AGRONOMO}>Agrônomo</option>
                <option value={UserRole.GESTOR}>Gestor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="perfilExibicao">Rótulo mostrado nas telas (opcional)</label>
              <input
                type="text"
                id="perfilExibicao"
                name="perfilExibicao"
                value={form.perfilExibicao}
                onChange={handleChange}
                disabled={loading}
                placeholder="Ex: Consultor"
              />
              <p style={{fontSize:'12px', color:'#6b7280', marginTop:'4px'}}>
                Deixe em branco pra mostrar o nome padrão do Perfil acima. Não muda nenhuma permissão — só o texto
                exibido (ex: alguém cadastrado como Gerente mas que é, na prática, um consultor externo).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <input type="checkbox" id="active" name="active" checked={form.active} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
              <label htmlFor="active" style={{fontSize:'14px', fontWeight:500, cursor:'pointer', margin:0}}>Ativo</label>
            </div>
          </div>
        </div>
      </div>

      {/* Salário */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Remuneração</h3>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            Tipo de salário, salário, hora extra e jornada de trabalho agora são cadastrados por período, em
            Funcionários → abas "Salário Safra" / "Salário Entressafra".
          </div>

          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <input type="checkbox" id="pagamentoProporcionalDiario" name="pagamentoProporcionalDiario" checked={form.pagamentoProporcionalDiario} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
            <label htmlFor="pagamentoProporcionalDiario" style={{fontSize:'14px', fontWeight:500, cursor:'pointer', margin:0}}>Pagamento proporcional por hora (desconta/paga exatamente pelas horas trabalhadas no dia, sem regra de falta de horas)</label>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <input type="checkbox" id="ocultarRegistroAtividades" name="ocultarRegistroAtividades" checked={form.ocultarRegistroAtividades} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
            <label htmlFor="ocultarRegistroAtividades" style={{fontSize:'14px', fontWeight:500, cursor:'pointer', margin:0}}>Ocultar aba "Registro de Atividades" pra esse usuário</label>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <input type="checkbox" id="participaFolhaPagamento" name="participaFolhaPagamento" checked={form.participaFolhaPagamento} onChange={handleChange} disabled={loading} style={{width:'16px', height:'16px', flexShrink:0, margin:0}} />
            <label htmlFor="participaFolhaPagamento" style={{fontSize:'14px', fontWeight:500, cursor:'pointer', margin:0}}>Participa da folha de pagamento (aparece nas abas Salário Safra/Entressafra, Resumo Mensal e Painel Financeiro — desmarque pra consultores externos)</label>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-4">
        <button type="submit" disabled={loading} className="btn btn-primary flex-1">
          {loading ? 'Salvando...' : id ? 'Atualizar' : 'Criar Funcionário'}
        </button>
        <button type="button" onClick={() => router.back()} disabled={loading} className="btn btn-outline flex-1">
          Cancelar
        </button>
      </div>
    </form>
  )
}
