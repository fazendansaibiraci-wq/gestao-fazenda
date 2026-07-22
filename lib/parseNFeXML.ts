import { XMLParser } from 'fast-xml-parser'

export interface ItemNFe {
  nome: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

export interface ResultadoParseNFe {
  fornecedor: string
  numeroNota: string
  serieNota: string
  dataEmissao: string
  chaveAcesso: string
  itens: ItemNFe[]
}

export function parseNFeXML(xmlTexto: string): ResultadoParseNFe {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false })
  const obj = parser.parse(xmlTexto)

  // A NFe pode vir dentro de <nfeProc><NFe>...</NFe></nfeProc> (com
  // protocolo de autorização) ou como <NFe>...</NFe> sozinha na raiz,
  // dependendo de como foi exportada/baixada.
  const nfe = obj.nfeProc?.NFe || obj.NFe
  if (!nfe || !nfe.infNFe) {
    throw new Error('Não foi possível encontrar os dados da NF-e nesse arquivo.')
  }

  const infNFe = nfe.infNFe
  const emit = infNFe.emit
  const ide = infNFe.ide

  const chaveAcesso: string =
    obj.nfeProc?.protNFe?.infProt?.chNFe ||
    String(infNFe['@_Id'] || '').replace('NFe', '')

  // det pode ser um objeto único (nota com 1 item) ou um array (nota com
  // vários itens) — normaliza sempre pra array.
  const detsRaw = infNFe.det
  const dets = Array.isArray(detsRaw) ? detsRaw : detsRaw ? [detsRaw] : []

  const itens: ItemNFe[] = dets.map((det: any) => {
    const prod = det.prod
    return {
      nome: String(prod.xProd).trim(),
      unidade: String(prod.uCom).trim(),
      quantidade: parseFloat(prod.qCom),
      valorUnitario: parseFloat(prod.vUnCom),
      valorTotal: parseFloat(prod.vProd),
    }
  })

  return {
    fornecedor: emit?.xNome || '',
    numeroNota: String(ide?.nNF || ''),
    serieNota: String(ide?.serie || ''),
    dataEmissao: ide?.dhEmi || new Date().toISOString(),
    chaveAcesso,
    itens,
  }
}
