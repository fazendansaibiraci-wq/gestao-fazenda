import { DiariaTurmaForm } from '@/components/forms/DiariaTurmaForm'

export default function NovaDiariaTurmaPage() {
    return (
          <div className="space-y-6">
                <div>
                        <h1 className="text-3xl font-bold text-primary">Registrar Diaria de Turma</h1>
                        <p className="text-gray-600 mt-1">Preencha os dados da turma de diaristas</p>
                </div>
                <DiariaTurmaForm />
          </div>
        )
}
