// OCR via ML Kit nativo (Android) / Vision (iOS) + heurística pra extrair campos da comanda
// Funciona offline depois do prebuild + build nativo
// Calibrado pro layout Yooga / Sabores Salgados:
//   Pedido #23
//   Nome: Beatriz Santos
//   Telefone: (27) 99275-0760
//   Endereço: Rua Marataízes, 394
//   Complemento: Sem complemento
//   Bairro: Valparaíso, Serra - ES
//   CEP: 29162-738
//   P. Referência: Próximo ao Villagio Laranjeiras
//   Sub-total R$ 55,00
//   Taxa de entrega R$ 6,00
//   Cobrar do cliente R$ 61,00

// Import lazy + try/catch: expo-text-extractor é módulo nativo, não existe no Expo Go
// (só em development build / APK). Sem isso o app crasha ao carregar.
let TextExtractor: any;
let File: any;
let Paths: any;
try {
  TextExtractor = require('expo-text-extractor');
  const fileSystem = require('expo-file-system');
  File = fileSystem.File;
  Paths = fileSystem.Paths;
} catch (e) {
  TextExtractor = null;
}

export interface DadosComandaOCR {
  comandaNumero?: string;
  clienteNome?: string;
  clienteEndereco?: string;
  clienteBairro?: string;
  clienteCEP?: string;
  clienteReferencia?: string;
  clienteTelefone?: string;
  valorPedido?: string;    // sub-total (cobrado do cliente)
  taxaEntrega?: string;    // taxa do motoboy
  totalCobrar?: string;    // valor total (sub-total + taxa)
  textoCompleto: string;
}

// Detecta se o dispositivo suporta OCR nativo
export async function temSuporteOCR(): Promise<boolean> {
  if (!TextExtractor) return false;
  try {
    return TextExtractor.isSupported;
  } catch {
    return false;
  }
}

// Salva data URI num arquivo temporário e devolve URI file://
function dataUriToFile(dataUri: string): string {
  if (!dataUri.startsWith('data:')) return dataUri;
  const base64 = dataUri.split(',')[1];
  const mime = dataUri.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const filename = `ocr_${Date.now()}.${ext}`;
  const file = new File(Paths.cache, filename);
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

// Copia content URI (galeria Android) pra arquivo no cache
async function copyContentUri(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const filename = `ocr_${Date.now()}.jpg`;
  const file = new File(Paths.cache, filename);
  file.create();
  file.write(bytes);
  return file.uri;
}

// Executa OCR numa imagem. Aceita data URI, file URI ou content URI
export async function reconhecerTexto(uri: string): Promise<string[]> {
  if (!TextExtractor) {
    throw new Error('OCR não suportado no Expo Go. Instale o APK (development build) pra usar.');
  }
  if (!TextExtractor.isSupported) {
    throw new Error('OCR não suportado neste dispositivo. Rode o development build.');
  }

  let finalUri = uri;
  if (uri.startsWith('data:')) {
    finalUri = dataUriToFile(uri);
  } else if (uri.startsWith('content://')) {
    finalUri = await copyContentUri(uri);
  }

  console.log('[OCR] extractTextFromImage:', finalUri);

  try {
    const result = await TextExtractor.extractTextFromImage(finalUri);
    console.log('[OCR] resultado:', Array.isArray(result) ? `${result.length} linhas` : result);
    return result;
  } catch (e: any) {
    console.error('[OCR] erro:', e?.message || e);
    throw new Error(`OCR falhou: ${e?.message || 'erro desconhecido'}`);
  }
}

// Regex dos valores numéricos ficam inline em extrairCampos() —
// evita o bug de double-escape que fazia o regex voltar `\\s` literal.

// Aplica heurística pra extrair campos do texto OCR
export function extrairCampos(linhas: string[]): DadosComandaOCR {
  const textoCompleto = linhas.join('\n');
  const texto = textoCompleto;

  // 1. Número da comanda — prefere o número visível no cabeçalho ("Pedido #23")
  // antes do ID interno do sistema ("Pedido Yooga #129092124").
  let comandaNumero: string | undefined;
  const cmdMatch =
    texto.match(/pedido\s*#\s*(\d{2,5})/i) ||
    texto.match(/comanda[:\s]+n?[\.:]?\s*(\d{3,5})/i) ||
    texto.match(/pedido\s+yooga\s*#\s*(\d{3,})/i) ||
    texto.match(/#\s*(\d{3,5})\b/i);
  if (cmdMatch) {
    comandaNumero = cmdMatch[1];
  }

  // 2. Nome — "Nome: Beatriz Santos"
  let clienteNome: string | undefined;
  const nomeMatch =
    texto.match(/nome[:\s]+([^\n\r]+)/i) ||
    texto.match(/cliente[:\s]+([^\n\r]+)/i);
  if (nomeMatch) {
    clienteNome = nomeMatch[1].trim().split(/\s{2,}|\s+\|/)[0];
  }

  // 3. Telefone — "Telefone: (27) 99275-0760" ou solto
  const telMatch =
    texto.match(/telefone[:\s]+(\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4})/i) ||
    texto.match(/(\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4})/);
  const clienteTelefone = telMatch ? telMatch[1] : undefined;

  // 4. Endereço — "Endereço: Rua Marataízes, 394"
  let clienteEndereco: string | undefined;
  const endMatch = texto.match(/endere[çc]o[:\s]+([^\n\r]+)/i);
  if (endMatch) {
    clienteEndereco = normalizarEndereco(endMatch[1]);
  } else {
    // Fallback: genérico
    const gen = texto.match(
      /\b((?:rua|r\.|av\.?|avenida|travessa|tv\.?|alameda|al\.?|rodovia|rod\.?|estrada)\s+[^\n,]+,\s*\d+[^\n]*)/i,
    );
    if (gen) clienteEndereco = normalizarEndereco(gen[1]);
  }

  // 5. Complemento — "Complemento: Sem complemento"
  let complemento: string | undefined;
  const compMatch = texto.match(/complemento[:\s]+([^\n\r]+)/i);
  if (compMatch) {
    const c = compMatch[1].trim();
    if (c && !/^sem\s+complemento$/i.test(c)) {
      complemento = c;
    }
  }

  // 6. Bairro / Cidade — vem após o endereço. Tenta capturar linha com bairro + cidade
  let clienteBairro: string | undefined;
  const bairroMatch = texto.match(/bairro[:\s]+([^\n\r]+)/i);
  if (bairroMatch) {
    clienteBairro = bairroMatch[1].trim();
  } else {
    // Tenta cidade/UF (Ex: "Valparaíso, Serra - ES")
    const cidadeMatch = texto.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç\s]+),\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)\s*-\s*([A-Z]{2})/);
    if (cidadeMatch) {
      clienteBairro = `${cidadeMatch[1].trim()}, ${cidadeMatch[2].trim()} - ${cidadeMatch[3]}`;
    }
  }

  // 7. CEP — "CEP: 29162-738"
  let clienteCEP: string | undefined;
  const cepMatch = texto.match(/cep[:\s]+(\d{5}-?\d{3})/i);
  if (cepMatch) {
    clienteCEP = cepMatch[1].replace(/(\d{5})(\d{3})/, '$1-$2');
  }

  // 8. Ponto de referência — "P. Referência: Próximo ao Villagio Laranjeiras"
  // Aceita quebra de linha (pega até o próximo label conhecido: Itens, Sub-total, Taxa, Cobrar)
  let clienteReferencia: string | undefined;
  const refMatch = texto.match(/\bp\.?\s*refer[êe]ncia[:\s]+([^\n\r]+(?:\n[^\n\r]+(?![Ii]tens|[Ss]ub-?[Tt]otal|[Tt]axa|[Cc]obrar|[Pp]re[çc]o|CEP)[:\s])*)/i);
  if (refMatch) {
    // Junta as linhas com espaço e limpa
    clienteReferencia = refMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 9. Sub-total (valor do pedido) — "Sub-total R$ 55,00" / valor pode estar na próxima linha
  // Tolerante a OCR: aceita separadores " " "-", ":" "|" entre label e valor; aceita "R$", "Rs", "RS" sem cifrão; aceita "55,00" ou "55.00"
  // ML Kit pode quebrar a linha entre o rótulo e o valor (ex: "Sub-total\nR$ 55,00\nTaxa...")
  let valorPedido: string | undefined;
  const subMatch = texto.match(/sub[\s-]*total[:\s|]*(?:r?\$?\s*)?(\d{1,4}[.,]\d{2})?/i)
    || texto.match(/sub[\s-]*total[:\s|]*(?:rs?\s*)?(\d{1,4}[.,]\d{2})?/i);
  if (subMatch) {
    valorPedido = normalizarValor(subMatch[1]);
  }

  // 10. Taxa de entrega — "Taxa de entrega R$ 6,00"
  let taxaEntrega: string | undefined;
  const taxaMatch = texto.match(/taxa\s+de\s+entrega[:\s|]*(?:r?\$?\s*)?(\d{1,4}[.,]\d{2})?/i)
    || texto.match(/taxa\s+de\s+entrega[:\s|]*(?:rs?\s*)?(\d{1,4}[.,]\d{2})?/i)
    || texto.match(/(?<!sub[\s-]*)\btaxa[:\s|]*r?\$?\s*(\d{1,4}[.,]\d{2})/i);
  if (taxaMatch) {
    taxaEntrega = normalizarValor(taxaMatch[1]);
  }

  // 11. Total a cobrar — "Cobrar do cliente R$ 61,00"
  let totalCobrar: string | undefined;
  const totalMatch = texto.match(/cobrar\s+do\s+cliente[:\s|]*(?:r?\$?\s*)?(\d{1,4}[.,]\d{2})?/i)
    || texto.match(/cobrar\s+do\s+cliente[:\s|]*(?:rs?\s*)?(\d{1,4}[.,]\d{2})?/i)
    || texto.match(/\btotal[:\s|]*r?\$?\s*(\d{1,4}[.,]\d{2})/i);
  if (totalMatch) {
    totalCobrar = normalizarValor(totalMatch[1]);
  }

  // 12. Estratégia principal: ML Kit tipicamente quebra os labels (Sub-total /
  // Taxa de entrega / Cobrar do cliente) em linhas separadas e empurra os
  // valores (R$ 55,00 / R$ 6,00 / R$61,00) bem depois. Coletamos os 3 valores
  // monetários distintos que aparecem APÓS o último label e atribuímos na
  // ordem dos labels: sub-total → taxa → total.
  const linhasTexto = textoCompleto.split('\n').map(l => l.trim()).filter(Boolean);
  const idxSub = linhasTexto.findIndex(l => /sub[\s-]*total/i.test(l));
  const idxTaxa = linhasTexto.findIndex(l => /taxa\s+de\s+entrega/i.test(l));
  const idxTotal = linhasTexto.findIndex(l => /cobrar\s+do\s+cliente/i.test(l));

  // Se algum label foi encontrado, varre todas as linhas depois dele(s) coletando
  // valores monetários distintos. Pula linhas que sejam claramente outros
  // labels de bloco (evita R$ na linha do Preço de item antes do bloco).
  function valorNaProxLinha(idx: number): string | undefined {
    if (idx < 0) return undefined;
    for (let i = idx + 1; i < Math.min(idx + 4, linhasTexto.length); i++) {
      const ln = linhasTexto[i];
      // Ignora outras linhas-label
      if (/^(sub[\s-]*total|taxa|cobrar|forma|pagamento|endere|complemento|bairro|cep|telefone|nome|pedido|itens|preço|preco)/i.test(ln)) continue;
      const m = ln.match(/(?:r?\$|rs?)\s*(\d{1,4}[.,]\d{2})/i) || ln.match(/(\d{1,4}[.,]\d{2})/);
      if (m && m[1]) return m[1];
    }
    return undefined;
  }

  if (!valorPedido && idxSub >= 0) {
    const v = valorNaProxLinha(idxSub);
    if (v) valorPedido = normalizarValor(v);
  }
  if (!taxaEntrega && idxTaxa >= 0) {
    const v = valorNaProxLinha(idxTaxa);
    if (v) taxaEntrega = normalizarValor(v);
  }
  if (!totalCobrar && idxTotal >= 0) {
    const v = valorNaProxLinha(idxTotal);
    if (v) totalCobrar = normalizarValor(v);
  }

  // 13. Último recurso: se ainda faltam valores e os 3 labels existem, varre
  // todas as linhas após o ÚLTIMO label e coleta até 3 valores monetários
  // distintos na ordem em que aparecem.
  if ((!valorPedido || !taxaEntrega || !totalCobrar) && (idxSub >= 0 || idxTaxa >= 0 || idxTotal >= 0)) {
    const primeiroIdx = Math.max(idxSub, idxTaxa, idxTotal);
    if (primeiroIdx >= 0) {
      const valores: string[] = [];
      for (let i = primeiroIdx + 1; i < linhasTexto.length && valores.length < 3; i++) {
        const ms = linhasTexto[i].match(/(\d{1,4}[.,]\d{2})/g);
        if (ms) {
          for (const m of ms) {
            if (!valores.includes(m)) valores.push(m);
            if (valores.length >= 3) break;
          }
        }
      }
      // Atribui na ordem: sub, taxa, total
      if (!valorPedido && valores[0]) valorPedido = normalizarValor(valores[0]);
      if (!taxaEntrega && valores[1]) taxaEntrega = normalizarValor(valores[1]);
      if (!totalCobrar && valores[2]) totalCobrar = normalizarValor(valores[2]);
    }
  }

  // Fallback: se "valorPedido" não foi encontrado mas o "totalCobrar" sim,
  // e "taxaEntrega" também sim, subtrai pra descobrir o sub-total
  if (!valorPedido && totalCobrar && taxaEntrega) {
    const total = parseFloat(totalCobrar.replace(',', '.'));
    const taxa = parseFloat(taxaEntrega.replace(',', '.'));
    if (!isNaN(total) && !isNaN(taxa)) {
      const sub = total - taxa;
      valorPedido = sub.toFixed(2).replace('.', ',');
    }
  }

  console.log('[OCR] extraido:', JSON.stringify({
    comandaNumero, valorPedido, taxaEntrega, totalCobrar,
  }, null, 2));

  return {
    comandaNumero,
    clienteNome,
    clienteEndereco,
    clienteBairro,
    clienteCEP,
    clienteReferencia,
    clienteTelefone,
    valorPedido,
    taxaEntrega,
    totalCobrar,
    textoCompleto,
  };
}

function normalizarValor(v: string | undefined): string | undefined {
  // OCR pode devolver "55,00" ou "55.00" — normaliza pra formato BR "55,00"
  // Remove separador de milhar (.), troca decimal (.) por (,)
  if (!v) return undefined;
  return v.replace('.', ',').replace(/(\d),(\d{2})/, '$1,$2');
}

function normalizarEndereco(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

// Pipeline completo: extrai texto + aplica heurística
export async function lerComanda(uri: string): Promise<DadosComandaOCR> {
  const linhas = await reconhecerTexto(uri);
  const linhasLimpas = linhas.map(l => l?.trim()).filter(Boolean) as string[];
  console.log('[OCR] linhas extraídas:', linhasLimpas.length);
  return extrairCampos(linhasLimpas);
}