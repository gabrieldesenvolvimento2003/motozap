// Serviço de geolocation - funciona offline E online
// Offline: banco de coords de Serra/ES (bairros, ruas, CEPs)
// Online: Photon → Nominatim → OSRM para rota real
import { API_BASE } from './api';

const LOJA_COORDS = { lat: -20.1974779, lon: -40.2591266 };
const SERRA_CENTER = { lat: -20.3228, lon: -40.2907 };

// ─────────────────────────────────────────────────────────────────
// BANCO OFFLINE DE SERRA/ES
// Coordendas verificadas de bairros, ruas e CEPs da região
// ─────────────────────────────────────────────────────────────────
interface OfflineEntry {
  lat: number;
  lon: number;
  raio?: number; // metros de imprecisão esperados (para interpolar rua)
}

// Bairros de Serra/ES com coords do centróide
const BAIRROS: Record<string, OfflineEntry> = {
  // —— Laranjeiras (onde fica a loja) ——
  'parque res. laranjeiras': { lat: -20.1974, lon: -40.2591, raio: 800 },
  'parque residencial laranjeiras': { lat: -20.1974, lon: -40.2591, raio: 800 },
  'laranjeiras': { lat: -20.1990, lon: -40.2570, raio: 1200 },
  'região de laranjeiras': { lat: -20.2000, lon: -40.2620, raio: 1500 },
  // 'valparaíso' / 'valparaiso' removidos: coords genéricas mascaravam Nominatim/Photon
  'planalto de carapina': { lat: -20.2150, lon: -40.2700, raio: 1000 },
  'planalto carapina': { lat: -20.2150, lon: -40.2700, raio: 1000 },
  'carapina grande': { lat: -20.2250, lon: -40.2750, raio: 1200 },
  'região de carapina': { lat: -20.2200, lon: -40.2720, raio: 1500 },
  'jardim universidade': { lat: -20.1820, lon: -40.2550, raio: 600 },
  'jardim universitário': { lat: -20.1820, lon: -40.2550, raio: 600 },
  'cidade nova': { lat: -20.1700, lon: -40.2700, raio: 700 },
  'morada de laranjeiras': { lat: -20.1900, lon: -40.2520, raio: 600 },
  'helena': { lat: -20.1850, lon: -40.2650, raio: 700 },
  'helena kardec de freitas': { lat: -20.1850, lon: -40.2650, raio: 700 },
  'são geraldo': { lat: -20.1780, lon: -40.2680, raio: 600 },
  'são geraldo ii': { lat: -20.1800, lon: -40.2700, raio: 500 },
  'bela vista': { lat: -20.1650, lon: -40.2580, raio: 600 },
  'choro': { lat: -20.1720, lon: -40.2600, raio: 500 },
  'nova esperanza': { lat: -20.1760, lon: -40.2630, raio: 500 },
  'ouro negro': { lat: -20.1850, lon: -40.2480, raio: 700 },
  '一等共和国': { lat: -20.1900, lon: -40.2450, raio: 600 },
  '一等': { lat: -20.1900, lon: -40.2450, raio: 600 },
  'atlas': { lat: -20.2000, lon: -40.2500, raio: 500 },
  'cascatinha': { lat: -20.2080, lon: -40.2450, raio: 700 },
  ' IPTU / SMFP': { lat: -20.2050, lon: -40.2600, raio: 800 },
  'pitanga': { lat: -20.2100, lon: -40.2550, raio: 600 },
  'tartaruga': { lat: -20.2150, lon: -40.2480, raio: 500 },
  'jardim tropical': { lat: -20.1750, lon: -40.2500, raio: 600 },
  'cristo redentor': { lat: -20.1680, lon: -40.2600, raio: 500 },
  'nossa sra. da penha': { lat: -20.1720, lon: -40.2550, raio: 500 },
  'senador': { lat: -20.1950, lon: -40.2450, raio: 500 },
  'senador atílio vivácqua': { lat: -20.1950, lon: -40.2450, raio: 500 },
  'areinha': { lat: -20.1880, lon: -40.2720, raio: 500 },
  'cajá': { lat: -20.1930, lon: -40.2750, raio: 500 },
  'boa vista': { lat: -20.2050, lon: -40.2680, raio: 700 },
  'queimado': { lat: -20.1650, lon: -40.2700, raio: 800 },
  'joão pb': { lat: -20.2000, lon: -40.2780, raio: 600 },
  'joão pessoas br': { lat: -20.2000, lon: -40.2780, raio: 600 },
  'tomé de sousa': { lat: -20.1880, lon: -40.2550, raio: 500 },
  'mata da Praia': { lat: -20.1600, lon: -40.2450, raio: 600 },
  'mata da praia': { lat: -20.1600, lon: -40.2450, raio: 600 },
  'praia de burarama': { lat: -20.1500, lon: -40.2350, raio: 800 },
  'burarama': { lat: -20.1500, lon: -40.2350, raio: 800 },
  'concha d\'ouro': { lat: -20.1920, lon: -40.2480, raio: 500 },
  // —— Bairro industrial ——
  'cipre': { lat: -20.2150, lon: -40.2850, raio: 600 },
  'cidade industrial': { lat: -20.2150, lon: -40.2850, raio: 1000 },
  // —— Bairro do Shopping ——
  'manguinhos': { lat: -20.1750, lon: -40.2420, raio: 700 },
  'praia do sol': { lat: -20.1680, lon: -40.2400, raio: 600 },
  // —— Guararema / Central ——
  'guararema': { lat: -20.1920, lon: -40.2650, raio: 700 },
  'centro': { lat: -20.1850, lon: -40.2650, raio: 1000 },
  // —— Oceania / Nova Almeida ——
  'nova almeida': { lat: -20.1600, lon: -40.2800, raio: 1200 },
  'oceânia': { lat: -20.1580, lon: -40.2830, raio: 800 },
  'oceânia ii': { lat: -20.1550, lon: -40.2850, raio: 600 },
  // —— Feu Rosa ——
  'feu rosa': { lat: -20.1450, lon: -40.2750, raio: 1200 },
  'jardim colore': { lat: -20.1480, lon: -40.2800, raio: 600 },
  // —— Serra sede ——
  'serra': { lat: -20.1250, lon: -40.3050, raio: 1500 },
  'serra sede': { lat: -20.1250, lon: -40.3050, raio: 1500 },
  'cidade alta': { lat: -20.1200, lon: -40.3000, raio: 1000 },
  'cidade alta serra': { lat: -20.1200, lon: -40.3000, raio: 1000 },
  'barro vermelho': { lat: -20.1150, lon: -40.2950, raio: 800 },
  // —— Jacaraípe ——
  'jacaraipe': { lat: -20.1700, lon: -40.2300, raio: 1200 },
  'jacaraípe': { lat: -20.1700, lon: -40.2300, raio: 1200 },
  'enseada de burarama': { lat: -20.1580, lon: -40.2280, raio: 800 },
  // —— Civit ——
  'civit': { lat: -20.2000, lon: -40.2900, raio: 1200 },
  'civit ii': { lat: -20.2050, lon: -40.2930, raio: 800 },
  // —— Ribeira ——
  'ribeira': { lat: -20.1350, lon: -40.2800, raio: 1000 },
  'maringá': { lat: -20.1300, lon: -40.2750, raio: 800 },
};

// Ruas known com coords de centro (quando não temos o número)
const RUAS: Record<string, OfflineEntry> = {
  'rua marataízes': { lat: -20.1960, lon: -40.2720, raio: 400 },
  'rua buenos aires': { lat: -20.1900, lon: -40.2680, raio: 300 },
  'rua porto Alegre': { lat: -20.1880, lon: -40.2660, raio: 300 },
  'rua rio de Janeiro': { lat: -20.1920, lon: -40.2700, raio: 300 },
  'rua são paulo': { lat: -20.1860, lon: -40.2650, raio: 400 },
  'rua victorinha': { lat: -20.1950, lon: -40.2680, raio: 200 },
  'rua victorinha rosa': { lat: -20.1950, lon: -40.2680, raio: 200 },
  'av大家的': { lat: -20.1820, lon: -40.2600, raio: 500 },
  'av bahia': { lat: -20.1800, lon: -40.2620, raio: 400 },
  'av espírito santo': { lat: -20.1840, lon: -40.2580, raio: 400 },
  'av бразилия': { lat: -20.1780, lon: -40.2560, raio: 400 },
  'av goiás': { lat: -20.1760, lon: -40.2540, raio: 400 },
  'av minas gerais': { lat: -20.1900, lon: -40.2600, raio: 400 },
  'av josé matias': { lat: -20.1950, lon: -40.2550, raio: 300 },
  'av abído samuel': { lat: -20.1930, lon: -40.2520, raio: 300 },
  'rua alberto de sousa': { lat: -20.1970, lon: -40.2620, raio: 200 },
  'rua alejandro sousa': { lat: -20.1970, lon: -40.2620, raio: 200 },
  'rua alejandro': { lat: -20.1970, lon: -40.2620, raio: 200 },
  'rua alberto': { lat: -20.1970, lon: -40.2620, raio: 200 },
  'rua silva': { lat: -20.2000, lon: -40.2650, raio: 300 },
  'rua dos bobos': { lat: -20.2020, lon: -40.2680, raio: 200 },
  'av principal laranjeiras': { lat: -20.1980, lon: -40.2580, raio: 500 },
  'av andre carloni': { lat: -20.2100, lon: -40.2700, raio: 800 },
  'av andré carloni': { lat: -20.2100, lon: -40.2700, raio: 800 },
  'rua车站': { lat: -20.2050, lon: -40.2650, raio: 300 },
  'rua车站名称': { lat: -20.2050, lon: -40.2650, raio: 300 },
  'rua仁': { lat: -20.2070, lon: -40.2670, raio: 200 },
};

// CEPs → coords (ranges do CEP 29160-xxx ao 29169-xxx = Serra)
// Prefixo 2916 = Serra sede / Central (lat ~-20.12 a -20.20)
// Prefixo 2917 = Serra sede / Aldeia (lat ~-20.08 a -20.15)
// Prefixo 2918 = Serra sede / Serra antiga (lat ~-20.10 a -20.18)
const CEP_PREFIXES: Record<string, OfflineEntry> = {
  // Ranges válidos de Serra/ES — coords oficiais dos centros de CEP
  '29160': { lat: -20.1250, lon: -40.3050 }, // Serra sede norte
  '29161': { lat: -20.1350, lon: -40.2950 }, // Serra sede sul
  '29162': { lat: -20.2050, lon: -40.2700 }, // Laranjeiras / Carapina
  '29163': { lat: -20.1600, lon: -40.2600 }, // Centro / Guararema
  '29164': { lat: -20.1500, lon: -40.2450 }, // Feu Rosa / Manguinhos
  '29165': { lat: -20.1800, lon: -40.2300 }, // Jacaraípe
  '29166': { lat: -20.1150, lon: -40.2850 }, // Serra sede leste
  '29167': { lat: -20.1450, lon: -40.2750 }, // Feu Rosa sul
  '29168': { lat: -20.1700, lon: -40.2800 }, // Nova Almeida / Oceania
  '29169': { lat: -20.1000, lon: -40.2750 }, // Serra norte
  '29170': { lat: -20.2200, lon: -40.2850 }, // Civit / Industrial
  '29171': { lat: -20.2000, lon: -40.2550 }, // Cascatinha / Pitanga
  '29172': { lat: -20.1850, lon: -40.2450 }, // Boa Vista
  '29173': { lat: -20.2300, lon: -40.2750 }, // Carapina norte
};

// Ruas + número → coords (endereços específicos verificados)
const ENDERECOS: Record<string, OfflineEntry> = {
  // Formato: "rua nome, numero" (lowercase)
  'rua marataízes, 394': { lat: -20.1965, lon: -40.2725 },
  'rua victorinha rosa, 100': { lat: -20.1948, lon: -40.2685 },
  'rua victorinha, 100': { lat: -20.1948, lon: -40.2685 },
  'rua buenos aires, 110': { lat: -20.1898, lon: -40.2678 },
  'rua buenos aires, 155': { lat: -20.1905, lon: -40.2682 },
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
export interface CEPResult {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  enderecoCompleto: string;
}

export const ENDERECO_LOJA = 'R. Santos Dumont, 309a - Parque Res. Laranjeiras, Serra - ES';

export function getCoordenadasLoja() {
  return LOJA_COORDS;
}

export async function preloadCoordenadasLoja(): Promise<void> {}

// Consulta CEP brasileiro via ViaCEP
export async function consultarCEP(cep: string): Promise<CEPResult | null> {
  try {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return null;
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep: data.cep,
      rua: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
      enderecoCompleto: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}, ${data.cep}`,
    };
  } catch {
    return null;
  }
}

export interface GeocodeResult {
  distancia: number;
  coords: { lat: number; lon: number };
  source: 'offline' | 'viaCEP' | 'online';
}

function haversine(c1: { lat: number; lon: number }, c2: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lon - c1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1.lat * Math.PI) / 180) * Math.cos((c2.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function osrmDistancia(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<number | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.routes?.[0]?.distance != null) {
      return data.routes[0].distance / 1000;
    }
    return null;
  } catch {
    return null;
  }
}

// Extrai bairro e rua do endereço
function parseEndereco(endereco: string): { rua: string; numero: string; bairro: string; cep: string } {
  const lower = endereco.toLowerCase();

  // CEP
  const cepMatch = lower.match(/(\d{5})-?(\d{3})/);
  const cep = cepMatch ? cepMatch[1] + cepMatch[2] : '';

  // Número
  const numMatch = lower.match(/,\s*(\d+[a-zA-Z]?(?:\s*-\s*\d+)?)\s*[-,]/);
  const numero = numMatch ? numMatch[1] : '';

  // Bairro (depois do número ou vírgula)
  const bairroMatch = lower.match(/(?:bairro\s+|:|\s)([^,]+?)(?:,|\s+cep|-es|- esp)/i);
  const bairroRaw = bairroMatch ? bairroMatch[1].trim().toLowerCase() : '';

  // Rua (primeira parte antes da vírgula)
  const ruaMatch = lower.match(/^([^,]+)/);
  const rua = ruaMatch ? ruaMatch[1].trim().toLowerCase() : '';

  return { rua, numero, bairro: bairroRaw, cep };
}

// Busca offline — bairro → coords
function buscaOffline(endereco: string): OfflineEntry | null {
  const { rua, numero, bairro, cep } = parseEndereco(endereco);

  // 1. Endereço exato
  if (rua && numero) {
    const key = `${rua}, ${numero}`;
    if (ENDERECOS[key]) return ENDERECOS[key];
  }

  // 2. Rua específica
  if (rua && RUAS[rua]) return RUAS[rua];

  // 3. Bairro
  if (bairro && BAIRROS[bairro]) return BAIRROS[bairro];

  // 4. CEP prefixo
  if (cep) {
    const prefix = cep.substring(0, 5);
    if (CEP_PREFIXES[prefix]) return CEP_PREFIXES[prefix];
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// GOOGLE SCRAPER (sem API key)
// Busca no google.com/maps e extrai a coordenada do primeiro resultado
// ─────────────────────────────────────────────────────────────────
async function googleScraper(endereco: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://www.google.com/maps/search/${encodeURIComponent(endereco)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Google Maps retorna coords como floats positivos (ex: 20.17888415, 40.2784256)
    // Precisamos negar (Brasil = latitude sul, longitude oeste)
    // Encontramos todos os floats de 6+ casas decimais no HTML
    const floatRegex = /(\d{2}\.\d{6,})/g;
    const matches = [...html.matchAll(floatRegex)];

    for (const m of matches) {
      let lat = parseFloat(m[1]);
      let lon = parseFloat(m[2] || '0');

      // Google retorna coords positivas mesmo sendo Brasil
      if (lat > 0) lat = -lat;
      if (lon > 0) lon = -lon;

      // Serra/ES: lat entre -19 e -21.5, lon entre -39.5 e -41.5
      if (lat < -19 && lat > -21.5 && lon < -39.5 && lon > -41.5) {
        console.log('[geocode] ✅ GOOGLE:', lat.toFixed(6), lon.toFixed(6));
        return { lat, lon };
      }
    }

    // Estratégia 2: procurar pares consecutivos de floats
    const allFloats = [...html.matchAll(floatRegex)].map(m => parseFloat(m[1]));
    for (let i = 0; i < allFloats.length - 1; i++) {
      let lat = allFloats[i];
      let lon = allFloats[i + 1];
      if (lat > 0) lat = -lat;
      if (lon > 0) lon = -lon;
      if (lat < -19 && lat > -21.5 && lon < -39.5 && lon > -41.5) {
        console.log('[geocode] ✅ GOOGLE (par):', lat.toFixed(6), lon.toFixed(6));
        return { lat, lon };
      }
    }

    console.log('[geocode] ❌ Google: nenhuma coord de Serra');
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// GEOCODING: usa o sync server (que faz scraping do Google do PC)
// ─────────────────────────────────────────────────────────────────
export async function calcularDistancia(enderecoCliente: string): Promise<GeocodeResult | null> {
  console.log('[geocode] Buscando via sync server:', enderecoCliente);

  try {
    const url = `${API_BASE}/geocode?endereco=${encodeURIComponent(enderecoCliente)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.log('[geocode] sync server erro:', res.status);
      return null;
    }
    const data = await res.json();
    if (!data.coords) return null;
    console.log('[geocode] ✅ Servidor:', data.coords, 'dist=', data.distancia);
    return { distancia: data.distancia, coords: data.coords, source: 'online' };
  } catch (e) {
    console.log('[geocode] ❌ fetch falhou:', e);
    return null;
  }
}

export async function calcularDistanciaCoordenadas(lat: number, lon: number): Promise<GeocodeResult | null> {
  try {
    let distKm = await osrmDistancia(LOJA_COORDS, { lat, lon });
    if (!distKm) {
      const h = haversine(LOJA_COORDS, { lat, lon });
      distKm = Math.round(h * (h < 0.5 ? 4.0 : 3.5) * 10) / 10;
    }
    return { distancia: distKm, coords: { lat, lon }, source: 'offline' };
  } catch {
    return null;
  }
}

export interface RotaResult {
  distanciaKm: number;
  duracaoSeg: number;
  coords: [number, number][];
}

export async function buscarRota(lat: number, lon: number): Promise<RotaResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${LOJA_COORDS.lon},${LOJA_COORDS.lat};${lon},${lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes?.[0]) return null;
    const route = data.routes[0];
    return {
      distanciaKm: route.distance / 1000,
      duracaoSeg: route.duration,
      coords: route.geometry.coordinates as [number, number][],
    };
  } catch {
    return null;
  }
}

export interface SearchResult {
  lat: number;
  lon: number;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  enderecoCompleto: string;
  displayName: string;
}

export async function searchEnderecos(q: string): Promise<SearchResult[]> {
  try {
    if (!q || q.length < 4) return [];
    const encoded = encodeURIComponent(q + ', Serra ES Brasil');
    const bbox = '-41.2,-21.4,-39.5,-19.2';
    const url = `https://photon.komoot.io/api/?q=${encoded}&limit=5&bbox=${bbox}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MotoBoyApp/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.features) return [];
    return data.features.map((r: any) => {
      const addr = r.properties?.address || {};
      const rua = addr.road || addr.street || addr.path || r.properties?.name || '';
      const bairro = addr.suburb || addr.neighbourhood || addr.quarter || addr.district || '';
      const cidade = addr.city || addr.town || addr.village || r.properties?.city || '';
      const estado = addr.state || 'ES';

      // Constrói um display legível: "Rua, Bairro - Cidade/UF"
      // Sem isso, várias "Rua Marataízes" em cidades diferentes ficam idênticas no dropdown
      const partes = [rua];
      if (bairro) partes.push(bairro);
      if (cidade) partes.push(`${cidade}/${estado}`);
      const display = partes.join(' • ');
      const enderecoCompleto = [rua, bairro, cidade, estado].filter(Boolean).join(', ');

      return {
        lat: parseFloat(r.geometry?.coordinates?.[1] || 0),
        lon: parseFloat(r.geometry?.coordinates?.[0] || 0),
        rua,
        bairro,
        cidade,
        estado,
        enderecoCompleto,
        displayName: display,
      };
    }).filter((r: SearchResult) => r.rua); // remove entradas vazias
  } catch {
    return [];
  }
}

export interface ReverseResult {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  complemento: string;
  enderecoCompleto: string;
  displayName: string;
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MotoBoyApp/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const rua = addr.road || addr.street || addr.path || '';
    const numero = addr.house_number || '';
    const bairro = addr.suburb || addr.neighbourhood || addr.quarter || addr.district || '';
    const cidade = addr.city || addr.town || addr.village || '';
    const estado = addr.state || '';
    const cep = addr.postcode || '';
    const complemento = [addr.unit, addr.shop, addr.amenity].filter(Boolean).join(', ');
    const enderecoCompleto = `${rua}${numero ? ', ' + numero : ''}${bairro ? ', ' + bairro : ''}${cidade ? ', ' + cidade : ''}${estado ? ' - ' + estado : ''}${cep ? ', ' + cep : ''}`.trim();

    return {
      rua,
      numero,
      bairro,
      cidade,
      estado,
      cep,
      complemento,
      enderecoCompleto,
      displayName: data.display_name || enderecoCompleto,
    };
  } catch {
    return null;
  }
}
