import { RegistroAtividadeForm } from '@/components/forms/RegistroAtividadeForm'

export default function NovaAtividadePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Registrar Nova Atividade</h1>
        <p className="text-gray-600 mt-1">Preencha os dados da atividade realizada</p>
      </div>
      <RegistroAtividadeForm />
    </div>
  )
}
