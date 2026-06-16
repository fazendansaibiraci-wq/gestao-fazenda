import { FuncionarioForm } from '@/components/forms/FuncionarioForm'

export default function NovoFuncionarioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Novo Funcionário</h1>
        <p className="text-gray-600 mt-1">Cadastrar um novo funcionário no sistema</p>
      </div>

      <FuncionarioForm />
    </div>
  )
}
