import { TalhaoForm } from '@/components/forms/TalhaoForm'

export default function NovoTalhaoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Novo Talhão</h1>
        <p className="text-gray-600 mt-1">Cadastrar um novo talhão</p>
      </div>
      <TalhaoForm />
    </div>
  )
}
