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
    tipoSalario: initialData?.tipoSalario || 'MENSAL',
    salarioEntressafra: initialData?.salarioEntressafra || '',
    salarioSafra: initialData?.salarioSafra || '',
    valorHoraExtraEntressafra: initialData?.valorHoraExtraEntressafra || '',
    valorHoraExtraSafra: initialData?.valorHoraExtraSafra || '',
    cargaHorariaSafra: initialData?.cargaHorariaSafra || '',
    cargaHorariaSegSex: initialData?.cargaHorariaSegSex || '',
    cargaHorariaSabado: initialData?.cargaHorariaSabado || '',
    cargaHorariaDomingo: initialData?.cargaHorariaDomingo || '',
    active: initialData?.active !== undefined ? initialData.active : true,
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
          <div className="form-group">
            <label htmlFor="tipoSalario">Tipo de Salário *</label>
            <select id="tipoSalario" name="tipoSalario" value={form.tipoSalario} onChange={handleChange} disabled={loading}>
              <option value="MENSAL">Mensal</option>
              <option value="DIARIO">Diário</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="salarioEntressafra">Salário Entressafra (R$)</label>
              <input type="number" id="salarioEntressafra" name="salarioEntressafra" value={form.salarioEntressafra} onChange={handleChange} disabled={loading} step="0.01" placeholder="0,00" />
            </div>
            <div className="form-group">
              <label htmlFor="salarioSafra">Salário Safra (R$)</label>
              <input type="number" id="salarioSafra" name="salarioSafra" value={form.salarioSafra} onChange={handleChange} disabled={loading} step="0.01" placeholder="0,00" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="valorHoraExtraEntressafra">Valor Hora Extra Entressafra (R$/h)</label>
              <input type="number" id="valorHoraExtraEntressafra" name="valorHoraExtraEntressafra" value={form.valorHoraExtraEntressafra} onChange={handleChange} disabled={loading} step="0.01" placeholder="0,00" />
            </div>
            <div className="form-group">
              <label htmlFor="valorHoraExtraSafra">Valor Hora Extra Safra (R$/h)</label>
              <input type="number" id="valorHoraExtraSafra" name="valorHoraExtraSafra" value={form.valorHoraExtraSafra} onChange={handleChange} disabled={loading} step="0.01" placeholder="0,00" />
            </div>
          </div>
        </div>
      </div>

      {/* Jornada */}
      <div className="card">
        <h3 className="text-lg font-semibold text-primary mb-4">Jornada de Trabalho</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="cargaHorariaSegSex">Segunda a Sexta (h/dia)</label>
              <input type="number" id="cargaHorariaSegSex" name="cargaHorariaSegSex" value={form.cargaHorariaSegSex} onChange={handleChange} disabled={loading} step="0.5" min="1" max="24" placeholder="Ex: 10" />
            </div>
            <div className="form-group">
              <label htmlFor="cargaHorariaSabado">Sábado (h/dia)</label>
              <input type="number" id="cargaHorariaSabado" name="cargaHorariaSabado" value={form.cargaHorariaSabado} onChange={handleChange} disabled={loading} step="0.5" min="0" max="24" placeholder="Ex: 8" />
            </div>
            <div className="form-group">
              <label htmlFor="cargaHorariaDomingo">Domingo (h/dia)</label>
              <input type="number" id="cargaHorariaDomingo" name="cargaHorariaDomingo" value={form.cargaHorariaDomingo} onChange={handleChange} disabled={loading} step="0.5" min="0" max="24" placeholder="Ex: 6" />
            </div>
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
