// Sync server — Node puro, zero deps. http://localhost:7777
// Persiste em db.json (mesma pasta). CORS aberto pra qualquer origem.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 7777;
const DB_FILE = path.join(__dirname, 'db.json');

// Coordenadas da loja (Sabores Salgados - Laranjeiras, Serra ES)
const LOJA_COORDS = { lat: -20.1974779, lon: -40.2591266 };

// Fórmula de Haversine
function haversineDistance(c1, c2) {
  const R = 6371;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lon - c1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(c1.lat*Math.PI/180)*Math.cos(c2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ============ ENDEREÇOS PRÉ-CADASTRADOS ============
// Coordenadas de bairros/endereços conhecidos na região Serra/Vitória ES
const ENDERECOS_CONHECIDOS = {
  // Laranjeiras e arredores
  'rua perola': { lat: -20.1883497, lon: -40.2742154 },
  'residencial vista do mestre': { lat: -20.1883497, lon: -40.2742154 },
  'vista do mestre': { lat: -20.1883497, lon: -40.2742154 },
  'laranjeiras': { lat: -20.1970, lon: -40.2540 },
  'parque residencial laranjeiras': { lat: -20.1970, lon: -40.2540 },

  // Bairros de Serra
  'jardim america': { lat: -20.2080, lon: -40.2400 },
  'mata da serra': { lat: -20.1850, lon: -40.2650 },
  'civit': { lat: -20.2150, lon: -40.2350 },
  'nova valencia': { lat: -20.1950, lon: -40.2450 },
  'morada de laranjeiras': { lat: -20.1900, lon: -40.2550 },
  'portal deohama': { lat: -20.1750, lon: -40.2800 },
  'helena': { lat: -20.2050, lon: -40.2700 },
  'barro vermelho': { lat: -20.2100, lon: -40.2650 },
  'carapina': { lat: -20.2100, lon: -40.2500 },
  'joaquim beiro': { lat: -20.1950, lon: -40.2350 },
  'eldorado': { lat: -20.2250, lon: -40.2350 },

  // Vitória
  'vitoria': { lat: -20.2720, lon: -40.3100 },
  'praia do canto': { lat: -20.2850, lon: -40.2950 },
  'jatai': { lat: -20.2650, lon: -40.3250 },
  'enseada do sua': { lat: -20.2700, lon: -40.2900 },
  'santa lucia': { lat: -20.2750, lon: -40.3050 },
  'mata da praia': { lat: -20.2800, lon: -40.3000 },
  'goiabeiras': { lat: -20.2650, lon: -40.2850 },
  'ariovaldo': { lat: -20.2550, lon: -40.2750 },
};

// Normaliza texto (remove acentos)
function normalizar(str) {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Busca em endereços conhecidos primeiro
function buscarEnderecoConhecido(endereco) {
  const normalized = normalizar(endereco);
  for (const [chave, coords] of Object.entries(ENDERECOS_CONHECIDOS)) {
    if (normalized.includes(chave)) {
      console.log(`[geocode] endereço conhecido: ${chave}`);
      return coords;
    }
  }
  return null;
}

// ============ GEOCODING CACHE ============
// Cache em memória para evitar rate limit
const geocodeCache = new Map();
const PHOTON_DELAY = 500; // 0.5s entre requests (Photon é mais tolerante)
let lastGeocodeTime = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Geocoding via Google Maps (sem API key - scraping)
// Google retorna HTML com coords embutidas em padrões como "20.17888415, 40.2784256"
// Fazemos scraping com User-Agent de desktop pra evitar bloqueio
async function geocodeGoogle(endereco) {
  const key = 'g:' + normalizar(endereco);
  if (geocodeCache.has(key)) {
    console.log(`[geocode] google cache hit: ${endereco}`);
    return geocodeCache.get(key);
  }

  const url = `https://www.google.com/maps/search/${encodeURIComponent(endereco + ', Serra ES Brasil')}`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.google.com',
      path: `/maps/search/${encodeURIComponent(endereco + ', Serra ES Brasil')}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Procura todos os floats de 6+ casas decimais
          const regex = /(\d{2}\.\d{6,})/g;
          const matches = [...data.matchAll(regex)];
          const floats = matches.map(m => parseFloat(m[1]));

          // Filtra pares válidos na região de Serra/ES e pega o que tem mais casas decimais
          // (coords mais precisas vêm com mais casas)
          let bestCoords = null;
          let bestPrecisao = 0;
          for (let i = 0; i < floats.length - 1; i++) {
            let lat = floats[i];
            let lon = floats[i + 1];
            if (lat > 0) lat = -lat;
            if (lon > 0) lon = -lon;
            if (lat < -19 && lat > -21.5 && lon < -39.5 && lon > -41.5) {
              // Precisão = soma das casas decimais (mais = melhor)
              const precisao = (floats[i].toString().split('.')[1] || '').length +
                               (floats[i+1].toString().split('.')[1] || '').length;
              if (precisao > bestPrecisao) {
                bestPrecisao = precisao;
                bestCoords = { lat, lon };
              }
            }
          }
          if (bestCoords) {
            geocodeCache.set(key, bestCoords);
            console.log(`[geocode] google found: ${endereco} → ${bestCoords.lat.toFixed(6)},${bestCoords.lon.toFixed(6)} (prec=${bestPrecisao})`);
            resolve(bestCoords);
            return;
          }
          geocodeCache.set(key, null);
          console.log(`[geocode] google not found: ${endereco}`);
          resolve(null);
        } catch (e) {
          geocodeCache.set(key, null);
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      geocodeCache.set(key, null);
      resolve(null);
    });
    req.setTimeout(12000, () => { req.destroy(); geocodeCache.set(key, null); resolve(null); });
    req.end();
  });
}

// Geocoding via Photon (mais rápido e melhor para Brasil que Nominatim)
async function geocodePhoton(endereco) {
  const key = normalizar(endereco);

  // Check cache primeiro
  if (geocodeCache.has(key)) {
    console.log(`[geocode] cache hit: ${endereco}`);
    return geocodeCache.get(key);
  }

  // Extrai número do endereço (ex: "Rua Marataízes, 394" → 394)
  const numMatch = endereco.match(/[,\s]+(\d{1,5})(?:\s|$|,)/);
  const numero = numMatch ? parseInt(numMatch[1], 10) : 0;

  // Rate limit
  const now = Date.now();
  const elapsed = now - lastGeocodeTime;
  if (elapsed < PHOTON_DELAY) {
    await sleep(PHOTON_DELAY - elapsed);
  }
  lastGeocodeTime = Date.now();

  // Faz request pro Photon (gratuito, baseado em OSM)
  // Adiciona "Serra ES" ao endereço para melhorar precisão
  const encoded = encodeURIComponent(key + ', Serra ES Brasil');
  // Serra/ES bounding box: roughly -40.35 a -40.20 lon, -20.25 a -20.15 lat
  const searchPath = `/api/?q=${encoded}&limit=1&bbox=-40.35,-20.25,-40.20,-20.15`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'photon.komoot.io',
      path: searchPath,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.features?.length > 0) {
            const feat = json.features[0];
            if (feat?.geometry?.coordinates) {
              let coords = {
                lat: feat.geometry.coordinates[1],
                lon: feat.geometry.coordinates[0]
              };

              // Se Photon mandou extent e tem número, interpola a posição
              // Extent: [minLon, minLat, maxLon, maxLat]
              if (numero > 0 && feat.properties?.extent) {
                const [minLon, minLat, maxLon, maxLat] = feat.properties.extent;
                // Heurística: Photon retorna a rua com extent pequeno (~100-200m).
                // A rua tem tipicamente números de 1 até ~500 (ou 1000 em Serra).
                // Rua curta: posição proporcional. Rua longa: usa só os últimos dígitos.
                // Rua Marataízes tem extent pequeno (~140m), então a posição do n=394
                // deve estar perto do final (ratio ~0.9)
                let ratio;
                if (numero < 50) ratio = numero / 100;
                else if (numero < 200) ratio = 0.3 + (numero - 50) / 500;  // 50→0.3, 200→0.6
                else if (numero < 500) ratio = 0.6 + (numero - 200) / 750; // 200→0.6, 500→0.93
                else ratio = 0.85 + Math.min((numero % 100) / 500, 0.1);
                ratio = Math.min(Math.max(ratio, 0.1), 0.95);
                // Interpolação linear no extent
                const latInterp = minLat + (maxLat - minLat) * ratio;
                const lonInterp = minLon + (maxLon - minLon) * ratio;
                coords = { lat: latInterp, lon: lonInterp };
                console.log(`[geocode] photon interpolated: ${endereco} (núm ${numero}, ratio ${ratio.toFixed(2)}) → ${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`);
              } else {
                console.log(`[geocode] photon found: ${endereco} → ${coords.lat},${coords.lon}`);
              }

              geocodeCache.set(key, coords);
              resolve(coords);
              return;
            }
          }
          geocodeCache.set(key, null);
          console.log(`[geocode] photon not found: ${endereco}`);
          resolve(null);
        } catch {
          geocodeCache.set(key, null);
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      geocodeCache.set(key, null);
      resolve(null);
    });
    req.setTimeout(10000, () => { req.destroy(); geocodeCache.set(key, null); resolve(null); });
    req.end();
  });
}

// Calcula distância REAL por estrada usando OSRM (Open Source Routing Machine)
async function calcularDistanciaReal(lojaCoords, clienteCoords) {
  // OSRM usa formato lon,lat
  const url = `/route/v1/driving/${lojaCoords.lon},${lojaCoords.lat};${clienteCoords.lon},${clienteCoords.lat}?overview=false`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'router.project-osrm.org',
      path: url,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.code === 'Ok' && json?.routes?.length > 0) {
            const distanciaMetros = json.routes[0].distance;
            const distanciaKm = Math.round(distanciaMetros / 100) / 10; // Arredonda para 1 casa decimal
            console.log(`[osrm] distância real: ${distanciaKm}km`);
            resolve(distanciaKm);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ============ DB ============

let db = { usuarios: [], pedidos: [], lojas: [] };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
      if (!db.usuarios) db.usuarios = [];
      if (!db.pedidos) db.pedidos = [];
      if (!db.lojas) db.lojas = [];
      // Migração: donoId → motoboyId
      db.lojas = db.lojas.map(l => ({ ...l, motoboyId: l.motoboyId || l.donoId }));
    }
  } catch (e) {
    console.error('[sync] erro lendo db.json:', e.message);
  }
}

let saveTimer = null;
function saveDb() {
  // Debounce pra não martelar o disco
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    saveTimer = null;
  }, 100);
}

loadDb();
console.log(`[sync] DB carregado: ${db.usuarios.length} usuários, ${db.pedidos.length} pedidos`);

// ============ Helpers ============

function id(prefix) {
  return prefix + '_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
}

function publicUser(u) {
  return { id: u.id, nome: u.nome, email: u.email, tipo: u.tipo };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024 * 8) { req.destroy(); reject(new Error('body too big')); } });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, extraHeaders = {}) {
  const isJson = typeof body !== 'string';
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json' : 'text/plain',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    ...extraHeaders,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function authedUserId(req) {
  return req.headers['x-user-id'] || null;
}

// ViaCEP/BrasilAPI - consulta CEP brasileiro
async function consultarCEP(cep) {
  // Remove máscara
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  return new Promise((resolve) => {
    const options = {
      hostname: 'brasilapi.com.br',
      path: `/api/cep/v1/${cleanCep}`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.cep) {
            resolve({
              cep: json.cep,
              rua: json.street || '',
              bairro: json.neighborhood || '',
              cidade: json.city || '',
              estado: json.state || '',
              // Constrói endereço completo no formato Photon
              enderecoCompleto: `${json.street || ''}, ${json.neighborhood || ''}, ${json.city} ${json.state}`.trim(),
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Reverse geocoding via Nominatim (lat/lon → endereço)
async function reverseGeocode(lat, lon) {
  // Adiciona delay pra respeitar rate limit do Nominatim (1 req/s)
  await sleep(1100);
  const url = `/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=pt-BR&zoom=18`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'nominatim.openstreetmap.org',
      path: url,
      method: 'GET',
      headers: { 'User-Agent': 'MotoBoyApp/1.0 (entregas)' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.address) return resolve(null);

          const a = json.address;
          // Pega o máximo de campos úteis
          const rua = a.road || a.pedestrian || a.street || a.path || '';
          const numero = a.house_number || '';
          const bairro = a.suburb || a.neighbourhood || a.city_district || a.village || '';
          const cidade = a.city || a.town || a.municipality || a.county || '';
          const estado = a.state || '';
          const cep = a.postcode || '';
          const complemento = a.amenity || a.shop || a.building || a.industrial || a.office || '';
          const ruaCompleta = numero ? `${rua}, ${numero}` : rua;

          // Constrói endereço rico (cada parte que tiver)
          const partes = [];
          if (ruaCompleta) partes.push(ruaCompleta);
          if (complemento) partes.push(complemento);
          if (bairro) partes.push(bairro);
          if (cidade) partes.push(estado ? `${cidade} - ${estado}` : cidade);
          if (cep) partes.push(`CEP ${cep}`);

          resolve({
            rua: ruaCompleta,
            numero,
            bairro,
            cidade,
            estado,
            cep,
            complemento,
            enderecoCompleto: partes.join(', '),
            // Display completo do OSM como fallback se algo faltar
            displayName: json.display_name || partes.join(', '),
          });
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Autocomplete via Nominatim (typed search → lista de endereços)
async function searchEnderecos(query) {
  if (!query || query.length < 4) return [];
  await sleep(1100); // rate limit
  // viewbox Serra/ES + bounded=1 limita os resultados à região
  // Serra/ES: lat -20.25 a -20.15, lon -40.35 a -40.20
  const url = `/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&accept-language=pt-BR&countrycodes=br&viewbox=-40.35,-20.15,-40.20,-20.25&bounded=1`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'nominatim.openstreetmap.org',
      path: url,
      method: 'GET',
      headers: { 'User-Agent': 'MotoBoyApp/1.0 (entregas)' },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const resultados = json.map(item => {
            const a = item.address || {};
            const rua = a.road || a.pedestrian || a.street || '';
            const numero = a.house_number || '';
            const bairro = a.suburb || a.neighbourhood || a.city_district || a.village || '';
            const cidade = a.city || a.town || a.municipality || '';
            const estado = a.state || '';
            const ruaCompleta = numero ? `${rua}, ${numero}` : rua;
            const partes = [ruaCompleta, bairro, cidade].filter(Boolean);
            return {
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
              rua: ruaCompleta,
              bairro,
              cidade,
              estado,
              enderecoCompleto: partes.join(', '),
              displayName: item.display_name,
            };
          });
          resolve(resultados);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(10000, () => { req.destroy(); resolve([]); });
    req.end();
  });
}

// Retorna geometria da rota (polyline decoded) entre 2 pontos
async function buscarRota(lojaCoords, clienteCoords) {
  const url = `/route/v1/driving/${lojaCoords.lon},${lojaCoords.lat};${clienteCoords.lon},${clienteCoords.lat}?overview=full&geometries=geojson`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'router.project-osrm.org',
      path: url,
      method: 'GET',
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.code === 'Ok' && json?.routes?.length > 0) {
            const rota = json.routes[0];
            resolve({
              distanciaKm: Math.round(rota.distance / 100) / 10,
              duracaoSeg: rota.duration,
              // GeoJSON: array de [lon, lat]
              coords: rota.geometry?.coordinates || [],
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ============ HTTP ============

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // Preflight CORS
  if (method === 'OPTIONS') {
    return send(res, 204, '');
  }

  // Log curto
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[sync] ${method} ${url.pathname} → ${res.statusCode} (${Date.now() - start}ms)`);
  });

  try {
    // GET /health
    if (method === 'GET' && url.pathname === '/health') {
      return send(res, 200, 'ok');
    }

    // GET /geocode?endereco=X  (cascata Photon → local → Google scraping → fallback)
    if (method === 'GET' && url.pathname === '/geocode') {
      const endereco = url.searchParams.get('endereco') || '';
      if (endereco.length < 3) return send(res, 400, { error: 'endereço vazio' });

      // 1. Banco local de endereços conhecidos (mais rápido e exato)
      let coords = buscarEnderecoConhecido(endereco);

      // 2. Photon (OSM) - PRINCIPAL pra endereços não cadastrados
      if (!coords) coords = await geocodePhoton(endereco);

      // 3. Google Maps scraping - só se Photon falhou
      if (!coords) coords = await geocodeGoogle(endereco);

      // 4. Fallback centro de Serra
      if (!coords) coords = { lat: -20.22, lon: -40.27 };

      let distKm = await calcularDistanciaReal(LOJA_COORDS, coords);
      if (!distKm || distKm < 0.3) {
        const distHav = haversineDistance(LOJA_COORDS, coords);
        const mult = distHav < 0.2 ? 5.0 : distHav < 0.5 ? 4.0 : 3.5;
        distKm = Math.round(distHav * mult * 10) / 10;
      }
      return send(res, 200, { distancia: distKm, coords });
    }

    // GET /distancia?lat=X&lon=Y (calcula distância a partir de coords)
    if (method === 'GET' && url.pathname === '/distancia') {
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      if (isNaN(lat) || isNaN(lon)) return send(res, 400, { error: 'lat/lon inválidos' });

      let distKm = await calcularDistanciaReal(LOJA_COORDS, { lat, lon });
      if (!distKm || distKm < 0.3) {
        const distHav = haversineDistance(LOJA_COORDS, { lat, lon });
        const mult = distHav < 0.2 ? 5.0 : distHav < 0.5 ? 4.0 : 3.5;
        distKm = Math.round(distHav * mult * 10) / 10;
      }
      return send(res, 200, { distancia: distKm, coords: { lat, lon } });
    }

    // GET /search?q=xxx (autocomplete de endereço)
    if (method === 'GET' && url.pathname === '/search') {
      const q = url.searchParams.get('q');
      if (!q || q.length < 4) return send(res, 200, []);
      const resultados = await searchEnderecos(q);
      return send(res, 200, resultados);
    }

    // GET /rota?lat=X&lon=Y (rota real com geometria)
    if (method === 'GET' && url.pathname === '/rota') {
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      if (isNaN(lat) || isNaN(lon)) return send(res, 400, { error: 'lat/lon inválidos' });

      const rota = await buscarRota(LOJA_COORDS, { lat, lon });
      if (!rota) return send(res, 404, { error: 'rota não encontrada' });
      return send(res, 200, rota);
    }

    // GET /reverse?lat=X&lon=Y (lat/lon → endereço)
    if (method === 'GET' && url.pathname === '/reverse') {
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      if (isNaN(lat) || isNaN(lon)) return send(res, 400, { error: 'lat/lon inválidos' });

      const resultado = await reverseGeocode(lat, lon);
      if (!resultado) return send(res, 404, { error: 'endereço não encontrado' });
      return send(res, 200, resultado);
    }

    // GET /cep?numero=xxx (consulta CEP via BrasilAPI)
    if (method === 'GET' && url.pathname === '/cep') {
      const cep = url.searchParams.get('numero');
      if (!cep) return send(res, 400, { error: 'numero é obrigatório' });

      const resultado = await consultarCEP(cep);
      if (!resultado) return send(res, 404, { error: 'CEP não encontrado' });

      return send(res, 200, resultado);
    }

    // GET /geocode?endereco=xxx (calcula distância REAL por estrada)
    if (method === 'GET' && url.pathname === '/geocode') {
      const endereco = url.searchParams.get('endereco');
      if (!endereco) return send(res, 400, { error: 'endereco é obrigatório' });

      try {
        // Primeiro tenta endereço conhecido
        let coords = buscarEnderecoConhecido(endereco);

        // Se não encontrou, tenta Photon
        if (!coords) {
          coords = await geocodePhoton(endereco);
        }

        if (!coords) return send(res, 404, { error: 'endereço não encontrado' });

        // Calcula distância REAL por estrada usando OSRM
        let distKm = await calcularDistanciaReal(LOJA_COORDS, coords);

        // Fallback: se OSRM der muito baixo (<300m), usa Haversine com multiplicador
        if (!distKm || distKm < 0.3) {
          const distHaversine = haversineDistance(LOJA_COORDS, coords);
          // Multiplicador para curtas distâncias
          const mult = distHaversine < 0.2 ? 5.0 :
                       distHaversine < 0.5 ? 4.0 : 3.5;
          distKm = Math.round(distHaversine * mult * 10) / 10;
          console.log(`[geocode] OSRM falhou, usando Haversine: ${distKm}km`);
        }

        console.log(`[geocode] ${endereco} → ${distKm}km (rota real)`);
        return send(res, 200, { distancia: distKm, coords });
      } catch (e) {
        console.error('[geocode] erro:', e.message);
        return send(res, 500, { error: 'erro no geocoding' });
      }
    }

    // GET /usuarios (lojista quer lista de motoboys)
    if (method === 'GET' && url.pathname === '/usuarios') {
      return send(res, 200, db.usuarios.map(publicUser));
    }

    // POST /usuarios (cadastro)
    if (method === 'POST' && url.pathname === '/usuarios') {
      const { nome, email, senha, tipo } = await readBody(req);
      if (!nome || !email || !senha || !tipo) return send(res, 400, { error: 'campos obrigatórios' });
      if (db.usuarios.find(u => u.email === email)) return send(res, 409, { error: 'email já cadastrado' });
      const novo = { id: id('u'), nome, email, senha, tipo };
      db.usuarios.push(novo);
      saveDb();
      return send(res, 201, publicUser(novo));
    }

    // POST /session (login)
    if (method === 'POST' && url.pathname === '/session') {
      const { email, senha } = await readBody(req);
      const u = db.usuarios.find(x => x.email === email && x.senha === senha);
      if (!u) return send(res, 401, { error: 'credenciais inválidas' });
      return send(res, 200, { userId: u.id });
    }

    // DELETE /session (logout)
    if (method === 'DELETE' && url.pathname === '/session') {
      return send(res, 204, '');
    }

    // GET /lojas (lista lojas do motoboy logado)
    if (method === 'GET' && url.pathname === '/lojas') {
      const userId = authedUserId(req);
      if (!userId) return send(res, 401, { error: 'não autenticado' });
      const minhas = db.lojas.filter(l => l.motoboyId === userId);
      return send(res, 200, minhas);
    }

    // GET /loja?code=X ( público — lookup por código da loja, sem auth )
    if (method === 'GET' && url.pathname === '/loja') {
      const code = url.searchParams.get('code');
      if (!code) return send(res, 400, { error: 'code obrigatório' });
      const loja = db.lojas.find(l => l.code === code);
      if (!loja) return send(res, 404, { error: 'loja não encontrada' });
      return send(res, 200, { id: loja.id, nome: loja.nome, code: loja.code, motoboyNome: db.usuarios.find(u => u.id === loja.motoboyId)?.nome || '' });
    }

    // POST /lojas (criar loja — motoboy cria painel pro lojista)
    if (method === 'POST' && url.pathname === '/lojas') {
      const userId = authedUserId(req);
      if (!userId) return send(res, 401, { error: 'não autenticado' });
      const u = db.usuarios.find(x => x.id === userId);
      if (!u || u.tipo !== 'motoboy') return send(res, 403, { error: 'acesso negado' });
      const { nome } = await readBody(req);
      if (!nome || !nome.trim()) return send(res, 400, { error: 'nome obrigatório' });
      const slug = nome.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const code = slug + '-' + Date.now().toString(36);
      const nova = { id: id('l'), motoboyId: userId, nome: nome.trim(), code };
      db.lojas.push(nova);
      saveDb();
      return send(res, 201, nova);
    }

    // GET /lojas/pedidos (público — lojista acessa via código sem login)
    if (method === 'GET' && url.pathname === '/lojas/pedidos') {
      const code = url.searchParams.get('code');
      if (!code) return send(res, 400, { error: 'code obrigatório' });
      const loja = db.lojas.find(l => l.code === code);
      if (!loja) return send(res, 404, { error: 'loja não encontrada' });
      const pedidos = db.pedidos.filter(p => p.lojaCode === code);
      return send(res, 200, pedidos);
    }

    // GET /pedidos
    if (method === 'GET' && url.pathname === '/pedidos') {
      const motoboyId = url.searchParams.get('motoboyId');
      const out = motoboyId ? db.pedidos.filter(p => p.motoboyId === motoboyId) : db.pedidos;
      return send(res, 200, out);
    }

    // DELETE /pedidos/:id
    const deleteMatch = url.pathname.match(/^\/pedidos\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const userId = authedUserId(req);
      if (!userId) return send(res, 401, { error: 'não autenticado' });
      const pid = deleteMatch[1];
      const idx = db.pedidos.findIndex(p => p.id === pid);
      if (idx === -1) return send(res, 404, { error: 'pedido não existe' });
      db.pedidos.splice(idx, 1);
      saveDb();
      return send(res, 204, '');
    }

    // DELETE /pedidos (limpar todos — só pra dev/MVP)
    if (method === 'DELETE' && url.pathname === '/pedidos') {
      db.pedidos = [];
      saveDb();
      return send(res, 204, '');
    }

    // POST /pedidos
    if (method === 'POST' && url.pathname === '/pedidos') {
      const userId = authedUserId(req);
      if (!userId) return send(res, 401, { error: 'não autenticado' });
      const u = db.usuarios.find(x => x.id === userId);
      if (!u) return send(res, 401, { error: 'usuário não existe' });

      const body = await readBody(req);
      const now = new Date().toISOString();
      const novo = {
        id: id('p'),
        motoboyId: u.id,
        motoboyNome: u.nome,
        lojaCode: body.lojaCode || null,
        comandaNumero: String(body.comandaNumero || ''),
        clienteNome: String(body.clienteNome || ''),
        clienteEndereco: String(body.clienteEndereco || ''),
        clienteTelefone: String(body.clienteTelefone || ''),
        clienteReferencia: String(body.clienteReferencia || ''),
        valorTotal: Number(body.valorTotal) || 0,
        valorPedido: Number(body.valorPedido) || 0,
        formasPagamento: Array.isArray(body.formasPagamento) ? body.formasPagamento : [],
        fotoComanda: body.fotoComanda || null,
        distancia: Number(body.distancia) || null,
        clienteLat: Number(body.clienteLat) || null,
        clienteLon: Number(body.clienteLon) || null,
        status: 'pendente',
        createdAt: now,
        updatedAt: now,
        historico: [{ status: 'pendente', timestamp: now }],
      };
      db.pedidos.unshift(novo); // mais novo primeiro
      saveDb();
      return send(res, 201, { id: novo.id });
    }

    // PATCH /pedidos/:id (mudar status e/ou registrar pagamento na entrega)
    const patchMatch = url.pathname.match(/^\/pedidos\/([^/]+)$/);
    if (method === 'PATCH' && patchMatch) {
      const userId = authedUserId(req);
      if (!userId) return send(res, 401, { error: 'não autenticado' });
      const pid = patchMatch[1];
      const idx = db.pedidos.findIndex(p => p.id === pid);
      if (idx === -1) return send(res, 404, { error: 'pedido não existe' });
      const body = await readBody(req);
      const status = body.status;
      const validStatuses = ['pendente', 'saiu', 'a_caminho', 'cheguei', 'entregue', 'cancelado'];
      const validSubStatuses = ['contatando', 'contato_ok', 'cobrando'];
      if (!validStatuses.includes(status)) return send(res, 400, { error: 'status inválido' });
      const now = new Date().toISOString();
      db.pedidos[idx].status = status;
      // subStatus é independente — persiste enquanto não for entregue/cancelado
      if (validSubStatuses.includes(body.subStatus)) {
        db.pedidos[idx].subStatus = body.subStatus;
      } else if (body.subStatus === null || status === 'entregue' || status === 'cancelado') {
        delete db.pedidos[idx].subStatus;
      }
      db.pedidos[idx].updatedAt = now;
      db.pedidos[idx].historico.push({ status, timestamp: now });
      // Registrar formas de pagamento no momento da entrega (cobrado do cliente)
      if (status === 'entregue' && Array.isArray(body.formasPagamento)) {
        db.pedidos[idx].formasPagamento = body.formasPagamento;
      }
      saveDb();
      return send(res, 204, '');
    }

    return send(res, 404, { error: 'rota não encontrada' });
  } catch (e) {
    console.error('[sync] erro:', e.message);
    return send(res, 500, { error: 'erro interno' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sync] escutando em http://localhost:${PORT}`);
  console.log(`[sync] adb reverse tcp:${PORT} tcp:${PORT} pra celular alcançar`);
});
