import Dexie, { Table } from 'dexie'

export interface ITalhao {
  id?: string
  nome: string
  area: number
  localizacao?: string
  status: string
  tipoSolo?: string
  ph?: number
  dataCriacao?: Date
  ultimaAtualizacao?: Date
  responsavelId?: string
}

export interface ISafra {
  id?: string
  nome: string
  ano: number
  status: string
  dataInicio: Date
  dataFimEstimada?: Date
  dataFimReal?: Date
  estimadoProduzir?: number
  produzido?: number
  talhaoId: string
  dataCriacao?: Date
  ultimaAtualizacao?: Date
}

export interface IMaquina {
  id?: string
  nome: string
  tipo: string
  marca?: string
  modelo?: string
  placa?: string
  status: string
  horasUso: number
  dataAquisicao?: Date
  proximaManutencao?: Date
  dataCriacao?: Date
  ultimaAtualizacao?: Date
}

export interface IProduto {
  id?: string
  nome: string
  tipo: string
  descricao?: string
  unidade: string
  quantidade: number
  preco?: number
  dataCriacao?: Date
  ultimaAtualizacao?: Date
}

export interface IAtividade {
  id?: string
  titulo: string
  descricao?: string
  tipo: string
  status: string
  dataPrevista: Date
  dataExecucao?: Date
  resultado?: string
  safraId?: string
  talhaoId?: string
  responsavelId?: string
  dataCriacao?: Date
  ultimaAtualizacao?: Date
}

export interface IUser {
  id?: string
  email: string
  name: string
  role: string
  phone?: string
  active: boolean
}

export interface ISyncLog {
  id?: string
  entidade: string
  entidadeId: string
  operacao: string
  dados?: any
  sincronizado: boolean
  dataCriacao?: Date
  dataSincronizacao?: Date
}

export class GestaoFazendaDB extends Dexie {
  talhoes!: Table<ITalhao>
  safras!: Table<ISafra>
  maquinas!: Table<IMaquina>
  produtos!: Table<IProduto>
  atividades!: Table<IAtividade>
  usuarios!: Table<IUser>
  syncLogs!: Table<ISyncLog>

  constructor() {
    super('GestaoFazendaDB')
    this.version(1).stores({
      talhoes: '++id, status, dataCriacao',
      safras: '++id, talhaoId, status, ano',
      maquinas: '++id, status, dataCriacao',
      produtos: '++id, tipo, dataCriacao',
      atividades: '++id, safraId, talhaoId, status, dataPrevista',
      usuarios: '++id, email',
      syncLogs: '++id, entidade, sincronizado, dataCriacao',
    })
  }
}

export const db = new GestaoFazendaDB()

// Funções auxiliares para sincronização
export async function addToSyncLog(
  entidade: string,
  entidadeId: string,
  operacao: 'create' | 'update' | 'delete',
  dados?: any
) {
  return db.syncLogs.add({
    entidade,
    entidadeId,
    operacao,
    dados,
    sincronizado: false,
    dataCriacao: new Date(),
  })
}

export async function getPendingSyncLogs() {
  return db.syncLogs.where('sincronizado').equals(false).toArray()
}

export async function markSyncLogAsSynced(id: string) {
  return db.syncLogs.update(id, {
    sincronizado: true,
    dataSincronizacao: new Date(),
  })
}

export async function clearSyncLog() {
  return db.syncLogs.where('sincronizado').equals(true).delete()
}
