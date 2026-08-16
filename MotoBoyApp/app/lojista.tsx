import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Card, Text, Chip, Searchbar, IconButton } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { Pedido, Usuario } from '../src/types';
import { criarPedido } from '../src/services/pedidos';
import { useTheme } from '../src/contexts/ThemeContext';
import { API_BASE } from '../src/services/api';
import Overlay from '../src/components/Overlay';

const STATUS_COLORS: Record<string, string> = {
  pendente: '#FFA000',
  saiu: '#1976D2',
  a_caminho: '#7B1FA2',
  cheguei: '#00838F',
  contatando: '#1976D2',
  contato_ok: '#00838F',
  cobrando: '#7B1FA2',
  entregue: '#43A047',
  cancelado: '#E53935',
};

const STATUS_ICONS: Record<string, string> = {
  pendente: '⏳',
  saiu: '🏍️',
  a_caminho: '📍',
  cheguei: '📬',
  contatando: '📞',
  contato_ok: '✅',
  cobrando: '💰',
  entregue: '✅',
  cancelado: '❌',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  saiu: 'Em Rota',
  a_caminho: 'A Caminho',
  cheguei: 'Chegou',
  contatando: 'Contatando',
  contato_ok: 'Aguardando',
  cobrando: 'Cobrando',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export default function LojistaScreen() {
  const { mode, toggle, colors } = useTheme();
  const searchParams = useLocalSearchParams();
  const lojaCode = (searchParams.loja as string) || '';
  const [lojaNome, setLojaNome] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState('');
  const [filtroMotoboy, setFiltroMotoboy] = useState<Record<'rota' | 'historico', string | null>>({ rota: null, historico: null });
  const [aba, setAba] = useState<'rota' | 'historico'>('rota');
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [detalhePedido, setDetalhePedido] = useState<Pedido | null>(null);

  // Carregar nome da loja
  useEffect(() => {
    if (!lojaCode) return;
    fetch(`${API_BASE}/loja?code=${encodeURIComponent(lojaCode)}`)
      .then(r => r.json())
      .then((l: any) => { if (l.nome) setLojaNome(l.nome); })
      .catch(() => {});
  }, [lojaCode]);

  // Polling público (lojista não tem sessão — usa code na URL)
  useEffect(() => {
    if (!lojaCode) return;
    const fetchPedidos = () => {
      fetch(`${API_BASE}/lojas/pedidos?code=${encodeURIComponent(lojaCode)}`)
        .then(r => r.json())
        .then((data: any[]) => {
          const normalized = data.map((p: any) => ({
            ...p,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
            historico: (p.historico || []).map((h: any) => ({
              status: h.status,
              timestamp: new Date(h.timestamp),
              observacao: h.observacao,
            })),
          }));
          setPedidos(normalized);
        })
        .catch(() => {});
    };
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 2000);
    return () => clearInterval(interval);
  }, [lojaCode]);

  const emRota = pedidos
    .filter(p => ['pendente', 'saiu', 'a_caminho', 'cheguei'].includes(p.status))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const historicoLista = pedidos
    .filter(p => ['entregue', 'cancelado'].includes(p.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const motoboys = Array.from(new Set(pedidos.map(p => p.motoboyNome).filter(Boolean))).sort();

  const base = aba === 'rota' ? emRota : historicoLista;
  const currentFiltro = filtroMotoboy[aba];

  const filtered = base.filter(p => {
    if (aba === 'historico' && !currentFiltro) return false;
    if (currentFiltro && p.motoboyNome !== currentFiltro) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.clienteNome.toLowerCase().includes(s) || p.comandaNumero.includes(search);
    }
    return true;
  });

  const rotaOrdem: Record<string, number> = {};
  if (aba === 'rota') {
    filtered.forEach((p, i) => { rotaOrdem[p.id] = i + 1; });
  }

  const totalEntregue = pedidos.filter(p => p.status === 'entregue').length;
  const totalEmRota = emRota.length;

  const renderPedido = ({ item }: { item: Pedido }) => {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => setDetalhePedido({ ...item })}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardBody}>
            <View style={styles.cardTop}>
              <Text style={[styles.comanda, { color: colors.textSubtle }]}>#{item.comandaNumero}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#888' }]}>
                <Text style={styles.statusIcon}>{STATUS_ICONS[item.status] || '●'}</Text>
              </View>
            </View>

            <Text style={[styles.cliente, { color: colors.text }]} numberOfLines={1}>{item.clienteNome}</Text>
            <Text style={[styles.endereco, { color: colors.textSubtle }]} numberOfLines={1}>{item.clienteEndereco}</Text>

            {item.fotoComanda && (
              <TouchableOpacity style={styles.fotoLinha} onPress={() => setFotoZoom(item.fotoComanda!)}>
                <Image source={{ uri: item.fotoComanda }} style={styles.fotoThumb} resizeMode="cover" />
                <Text style={[styles.fotoHint, { color: colors.textSubtle }]}>📸 Comanda · toque pra ver</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            <View style={styles.cardBottom}>
              <Text style={[styles.valor, { color: colors.text }]}>R$ {item.valorTotal.toFixed(2).replace('.', ',')}</Text>
              <Text style={[styles.moto, { color: colors.textSubtle }]} numberOfLines={1}>🏍️ {item.motoboyNome}</Text>
            </View>

            {item.status === 'entregue' && item.formasPagamento && item.formasPagamento.length > 0 && (
              <View style={styles.pagRow}>
                {item.formasPagamento.map((fp, i) => (
                  <View key={i} style={[styles.pagChip, { backgroundColor: colors.pagBg }]}>
                    <Text style={[styles.pagText, { color: colors.pagText }]}>
                      {fp.tipo === 'dinheiro' ? '💵' : fp.tipo === 'pix' ? '📱' : '💳'} R$ {fp.valor.toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.titulo, { color: colors.text }]}>
              🏪 {lojaNome ? lojaNome : 'Painel Lojista'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {lojaCode && (
                <TouchableOpacity onPress={() => router.replace('/(auth)/lojas')}>
                  <Text style={{ color: colors.accent, fontSize: 13 }}>← Lojas</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.subtitulo, { color: colors.textSubtle }]}>{totalEmRota} em rota · {totalEntregue} entregues</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/codigo')} style={[styles.themeBtn, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ fontSize: 14, color: colors.text }}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggle} style={[styles.themeBtn, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ fontSize: 18 }}>{mode === 'light' ? '🌙' : '☀️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: colors.surfaceAlt }, aba === 'rota' && { backgroundColor: colors.accent }]}
            onPress={() => setAba('rota')}
          >
            <Text style={[styles.tabTxt, { color: colors.textMuted }, aba === 'rota' && { color: colors.accentText }]}>
              🚚 Em Rota ({emRota.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: colors.surfaceAlt }, aba === 'historico' && { backgroundColor: colors.accent }]}
            onPress={() => setAba('historico')}
          >
            <Text style={[styles.tabTxt, { color: colors.textMuted }, aba === 'historico' && { color: colors.accentText }]}>
              📜 Histórico ({historicoLista.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.filterLabel, { color: colors.textSubtle }]}>
          {aba === 'historico' ? 'Selecione um motoboy' : 'Filtrar por motoboy'}
        </Text>
        <View style={styles.filterRow}>
          {aba === 'rota' && (
            <Chip
              selected={!currentFiltro}
              onPress={() => setFiltroMotoboy(prev => ({ ...prev, [aba]: null }))}
              style={[styles.chip, { backgroundColor: colors.chip }]}
              mode="flat"
            >
              Todos
            </Chip>
          )}
          {motoboys.map(n => (
            <Chip
              key={n}
              selected={currentFiltro === n}
              onPress={() => setFiltroMotoboy(prev => ({ ...prev, [aba]: n }))}
              style={[styles.chip, { backgroundColor: colors.chip }]}
              mode="flat"
            >
              {n}
            </Chip>
          ))}
        </View>
      </View>

      <Searchbar
        placeholder="Buscar cliente ou comanda"
        value={search}
        onChangeText={setSearch}
        style={[styles.search, { backgroundColor: colors.surface }]}
        inputStyle={[styles.searchInput, { color: colors.text }]}
        iconColor={colors.textSubtle}
      />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderPedido}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{aba === 'rota' ? '📦' : '🔍'}</Text>
            <Text style={[styles.emptyText, { color: colors.emptyText }]}>
              {aba === 'historico' && !currentFiltro ? 'Selecione um motoboy acima' : 'Nenhuma entrega'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSubtle }]}>
              {aba === 'historico' && !currentFiltro ? 'O histórico é filtrado por motoboy' : 'Pedidos aparecerão aqui'}
            </Text>
          </View>
        }
      />

      <Overlay visible={!!fotoZoom} onClose={() => setFotoZoom(null)} style={styles.zoomBgOverride}>
        {fotoZoom && <Image source={{ uri: fotoZoom }} style={styles.zoomImg} resizeMode="contain" />}
      </Overlay>

      <Overlay visible={!!detalhePedido} onClose={() => setDetalhePedido(null)}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>📋 Pedido #{detalhePedido?.comandaNumero}</Text>
              <TouchableOpacity onPress={() => setDetalhePedido(null)}>
                <Text style={{ fontSize: 24, color: colors.textSubtle }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={[styles.statusBanner, { backgroundColor: STATUS_COLORS[detalhePedido?.status || 'pendente'] }]}>
                <Text style={styles.statusBannerText}>
                  {STATUS_ICONS[detalhePedido?.status || 'pendente']} {STATUS_LABELS[detalhePedido?.status || 'pendente']}
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>👤 Cliente</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>{detalhePedido?.clienteNome}</Text>
              <Text style={[styles.infoText, { color: colors.textSubtle }]}>📍 {detalhePedido?.clienteEndereco}</Text>
              <Text style={[styles.infoText, { color: colors.textSubtle }]}>📞 {detalhePedido?.clienteTelefone}</Text>
              {detalhePedido?.clienteReferencia && (
                <Text style={[styles.infoText, { color: colors.textSubtle }]}>📌 {detalhePedido?.clienteReferencia}</Text>
              )}

              <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>🏍️ Motoboy</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>{detalhePedido?.motoboyNome || 'Não atribuído'}</Text>

              <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>💰 Valores</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>Taxa: R$ {detalhePedido?.valorTotal.toFixed(2).replace('.', ',')}</Text>
              <Text style={[styles.infoText, { color: colors.text }]}>Pedido: R$ {((detalhePedido?.valorPedido || 0) + (detalhePedido?.valorTotal || 0)).toFixed(2).replace('.', ',')}</Text>

              {detalhePedido?.formasPagamento && detalhePedido.formasPagamento.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>💳 Pagamentos</Text>
                  {detalhePedido.formasPagamento.map((fp, i) => (
                    <Text key={i} style={[styles.infoText, { color: colors.text }]}>
                      {fp.tipo === 'dinheiro' ? '💵' : fp.tipo === 'pix' ? '📱' : '💳'} {fp.tipo}: R$ {fp.valor.toFixed(2).replace('.', ',')}
                    </Text>
                  ))}
                </>
              )}

              <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>📜 Histórico</Text>
              {detalhePedido?.historico && detalhePedido.historico.length > 0 ? (
                detalhePedido.historico.slice().reverse().map((h, i) => (
                  <View key={i} style={styles.historicoItem}>
                    <View style={[styles.historicoDot, { backgroundColor: STATUS_COLORS[h.status] }]} />
                    <View style={styles.historicoContent}>
                      <Text style={[styles.historicoStatus, { color: colors.text }]}>
                        {STATUS_ICONS[h.status]} {STATUS_LABELS[h.status]}
                      </Text>
                      <Text style={[styles.historicoTime, { color: colors.textSubtle }]}>
                        {h.timestamp ? new Date(h.timestamp).toLocaleString('pt-BR') : '-'}
                      </Text>
                      {h.observacao && <Text style={[styles.historicoObs, { color: colors.textSubtle }]}>{h.observacao}</Text>}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.infoText, { color: colors.textSubtle }]}>Sem histórico disponível</Text>
              )}

              {detalhePedido?.fotoComanda && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>📸 Comanda</Text>
                  <TouchableOpacity onPress={() => { setDetalhePedido(null); setFotoZoom(detalhePedido!.fotoComanda!); }}>
                    <Image source={{ uri: detalhePedido.fotoComanda }} style={styles.modalFoto} resizeMode="cover" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
      </Overlay>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerActions: { flexDirection: 'row', gap: 8 },
  titulo: { fontSize: 22, fontWeight: '700' },
  subtitulo: { fontSize: 13, marginTop: 2 },
  themeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabTxt: { fontWeight: '600', fontSize: 13 },
  filterSection: { paddingVertical: 12, borderBottomWidth: 1 },
  filterLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginBottom: 8 },
  filterRow: { paddingHorizontal: 20, gap: 8, flexDirection: 'row', flexWrap: 'wrap' },
  chip: {},
  search: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, elevation: 0 },
  searchInput: { fontSize: 14 },
  list: { padding: 16, paddingBottom: 32 },
  card: { flexDirection: 'row', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  comanda: { fontSize: 14, fontWeight: '700' },
  statusBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { fontSize: 14 },
  cliente: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  endereco: { fontSize: 13, marginBottom: 8 },
  divider: { height: 1, marginVertical: 10 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valor: { fontSize: 16, fontWeight: '700' },
  moto: { fontSize: 12, maxWidth: '50%' },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  fotoThumb: { width: 48, height: 48, borderRadius: 6 },
  fotoHint: { fontSize: 12, flex: 1 },
  pagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pagChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pagText: { fontSize: 11, fontWeight: '600' },
  ordemCol: { width: 56, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  ordemNum: { fontSize: 24, fontWeight: '900', color: '#FFF', lineHeight: 26 },
  ordemLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  zoomBgOverride: { backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomImg: { width: '95%', height: '90%' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '85%', minHeight: 300, width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalContent: { padding: 20 },
  statusBanner: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  statusBannerText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  infoText: { fontSize: 15, marginBottom: 4 },
  historicoItem: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' },
  historicoDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginRight: 12 },
  historicoContent: { flex: 1 },
  historicoStatus: { fontSize: 15, fontWeight: '600' },
  historicoTime: { fontSize: 12, marginTop: 2 },
  historicoObs: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  modalFoto: { width: '100%', height: 200, borderRadius: 12, marginTop: 8 },
  input: { marginBottom: 10 },
  erroBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
});
