import { WebView } from 'react-native-webview';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

interface MapaArrastavelProps {
  clienteLat: number;
  clienteLon: number;
  lojaLat?: number;
  lojaLon?: number;
  distancia?: number | null;
  duracaoMin?: number | null;
  clienteLabel?: string;
  height?: number;
  onClienteChange?: (lat: number, lon: number) => void;
  rotaCoords?: [number, number][] | null; // polyline [lon, lat]
}

const LOJA_PADRAO = { lat: -20.1974779, lon: -40.2591266 };

export function MapaMoto({
  clienteLat,
  clienteLon,
  lojaLat = LOJA_PADRAO.lat,
  lojaLon = LOJA_PADRAO.lon,
  distancia,
  duracaoMin,
  clienteLabel = 'Cliente',
  height = 320,
  onClienteChange,
  rotaCoords,
}: MapaArrastavelProps) {
  const centerLat = (clienteLat + lojaLat) / 2;
  const centerLon = (clienteLon + lojaLon) / 2;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; font-family: -apple-system, Roboto, "Segoe UI", sans-serif; }
  #map { margin: 0; padding: 0; height: 100%; width: 100%; touch-action: none; background: #e8eef3; }

  /* Custom zoom control */
  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
    border-radius: 12px !important;
    overflow: hidden;
    margin: 12px !important;
  }
  .leaflet-control-zoom a {
    background: white !important;
    color: #1a1a1a !important;
    border: none !important;
    width: 40px !important;
    height: 40px !important;
    line-height: 40px !important;
    font-size: 20px !important;
    font-weight: 300 !important;
    transition: background 0.2s;
  }
  .leaflet-control-zoom a:hover { background: #f5f5f5 !important; }
  .leaflet-control-zoom a:first-child { border-bottom: 1px solid #eee !important; }

  /* Marker customizado */
  .marker-pin {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 3px solid white;
  }
  .marker-pin > * { transform: rotate(45deg); }
  .marker-loja {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #43A047, #2E7D32);
  }
  .marker-cliente {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #FF6B00, #E65100);
    cursor: grab;
  }
  .marker-cliente:active { cursor: grabbing; }

  /* Pulse effect no pino do cliente */
  .pulse {
    position: absolute;
    width: 60px; height: 60px;
    background: rgba(255, 107, 0, 0.3);
    border-radius: 50%;
    animation: pulse 2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes pulse {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(2); opacity: 0; }
  }

  /* Badge flutuante inferior */
  .info-card {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    background: white;
    border-radius: 16px;
    padding: 14px 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .info-card-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #FF6B00, #E65100);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .info-card-text { flex: 1; min-width: 0; }
  .info-card-label { font-size: 11px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-card-value { font-size: 18px; color: #1a1a1a; font-weight: 700; margin-top: 2px; }
  .info-card-value small { font-size: 13px; color: #999; font-weight: 500; }

  /* Hint superior */
  .hint-card {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 1000;
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
</head>
<body>
<div id="map"></div>
<div class="hint-card">✋ Arraste o pino laranja</div>
<div class="info-card">
  <div class="info-card-icon">📍</div>
  <div class="info-card-text">
    <div class="info-card-label">Distância da loja</div>
    <div class="info-card-value" id="dist-value">${distancia != null ? distancia.toFixed(1).replace('.', ',') + ' <small>km</small>' : '—'}</div>
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(lat, lon) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lon: lon }));
    }
  }

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    tap: true,
    bounceAtZoomLimits: false,
    inertia: false,
    zoomAnimation: true,
    fadeAnimation: false,
    markerZoomAnimation: true,
  }).setView([${centerLat}, ${centerLon}], 13);

  // Tile mais bonito (CartoDB Positron)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // Ícone da loja
  var lojaHtml = '<div class="marker-pin marker-loja"><span style="font-size:20px">🏪</span></div>';
  var lojaIcon = L.divIcon({
    html: lojaHtml,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    className: '',
  });
  L.marker([${lojaLat}, ${lojaLon}], { icon: lojaIcon })
    .addTo(map)
    .bindPopup('<div style="font-family:-apple-system,sans-serif;font-size:13px"><b>Loja</b><br><span style="color:#666">Sabores Salgados</span></div>');

  // Ícone do cliente (arrastável, com pulse)
  var clienteHtml = '<div class="pulse"></div><div class="marker-pin marker-cliente"><span style="font-size:24px">🏍️</span></div>';
  var clienteIcon = L.divIcon({
    html: clienteHtml,
    iconSize: [52, 52],
    iconAnchor: [26, 52],
    className: '',
  });
  var clienteMarker = L.marker([${clienteLat}, ${clienteLon}], {
    icon: clienteIcon,
    draggable: true,
    autoPan: true,
  }).addTo(map);

  clienteMarker.on('dragstart', function() {
    document.querySelector('.marker-cliente').style.cursor = 'grabbing';
  });
  clienteMarker.on('dragend', function(e) {
    document.querySelector('.marker-cliente').style.cursor = 'grab';
    var pos = e.target.getLatLng();
    send(pos.lat, pos.lng);
  });
  clienteMarker.on('drag', function(e) {
    var pos = e.target.getLatLng();
    // Não redesenha polyline (vai ficar estranha durante drag)
  });

  // Linha entre os pontos (sólida bonita)
  // Se temos polyline real da OSRM, usa ela; senão, linha reta
  var rotaCoordsJS = ${rotaCoords && rotaCoords.length > 0 ? JSON.stringify(rotaCoords.map(([lon, lat]) => [lat, lon])) : 'null'};
  var polylineCoords;
  if (rotaCoordsJS && rotaCoordsJS.length > 0) {
    polylineCoords = rotaCoordsJS; // polyline real (ruas)
  } else {
    polylineCoords = [[${lojaLat}, ${lojaLon}], [${clienteLat}, ${clienteLon}]]; // linha reta fallback
  }
  var polyline = L.polyline(polylineCoords, {
    color: '#FF6B00',
    weight: 6,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  // Contorno branco pra polyline ficar destacada
  var polylineOutline = null;
  if (rotaCoordsJS && rotaCoordsJS.length > 0) {
    polylineOutline = L.polyline(polylineCoords, {
      color: '#ffffff',
      weight: 10,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    polylineOutline.bringToBack();
    polyline.bringToFront();
  }

  // NÃO enviar coordenadas na carga — só quando o pino for arrastado de verdade.
  // Isso evita que o fallback (centro Serra) sobrescreva coords já geocodadas.

  // Ajustar bounds pra mostrar toda a rota
  var allPoints = polylineCoords.slice();
  allPoints.push([${lojaLat}, ${lojaLon}]);
  allPoints.push([${clienteLat}, ${clienteLon}]);
  var bounds = L.latLngBounds(allPoints);
  map.fitBounds(bounds, { padding: [60, 60] });

  // API pública pra atualizar
  window.atualizarDistancia = function(dist, dur) {
    var el = document.getElementById('dist-value');
    if (el && dist != null) {
      var html = dist.toFixed(1).replace('.', ',') + ' <small>km</small>';
      if (dur != null) {
        var min = Math.round(dur);
        html += ' <span style="color:#999;font-weight:500;font-size:12px;margin-left:6px">' + min + ' min</span>';
      }
      el.innerHTML = html;
    }
  };
</script>
</body>
</html>`;

  return (
    <View style={[styles.container, height ? { height } : { flex: 1 }]}>
      <WebView
        key={`${clienteLat}-${clienteLon}-${(rotaCoords?.length ?? 0)}`}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        bounces={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={() => true}
        mixedContentMode="always"
        allowFileAccess
        onMessage={(e) => {
          try {
            const { lat, lon } = JSON.parse(e.nativeEvent.data);
            console.log('📍 Pino cliente movido:', lat, lon);
            onClienteChange?.(lat, lon);
          } catch {}
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#FF6B00" />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e8eef3',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  webview: { flex: 1 },
  loading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: '#e8eef3',
  },
  loadingText: { fontSize: 13, color: '#666', fontWeight: '500' },
});
