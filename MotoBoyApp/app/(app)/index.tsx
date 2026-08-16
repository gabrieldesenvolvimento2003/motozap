import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, Switch, Image, Pressable } from 'react-native';
import { Text, Searchbar, FAB, Button, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { subscribePedidosDoMotoboy, atualizarStatusPedido, excluirPedido } from '../../src/services/pedidos';
import { Pedido } from '../../src/types';

const STATUS_COLORS: Record<string, string> = {
  pendente: '#FFA000',
  saiu: '#1976D2',
  a_caminho: '#7B1FA2',
  entregue: '#43A047',
  cancelado: '#E53935',
};
const STATUS_ICONS: Record<string, string> = {
  pendente: '⏳',
  saiu: '🏍️',
  a_caminho: '📍',
  entregue: '✅',
  cancelado: '❌',
};

type SectionItem = { type: 'header'; label: string; count?: number } | { type: 'pedido'; data: Pedido };

export default function HomeScreen() {
  const { user, logout, usuario } = useAuth();
  const { mode, toggle, colors } = useTheme();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState('');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const [aba, setAba] = useState<'disponiveis' | 'emandamento'>('disponiveis');
  const [menuOpen, setMenuOpen] = useState(false);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [loadingExcluir, setLoadingExcluir] = useState(false);
  const [msgSnackbar, setMsgSnackbar] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePedidosDoMotoboy(user.uid, setPedidos);
    return unsub;
  }, [user]);

  const naRota = pedidos
    .filter(p => ['saiu', 'a_caminho', 'cheguei', 'contatando', 'contato_ok', 'cobrando'].includes(p.status))
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const pendentesLista = pedidos
    .filter(p => p.status === 'pendente')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const filaRota = [...pendentesLista, ...naRota];
  const rotaOrdem: Record<string, number> = {};
  filaRota.forEach((p, i) => { rotaOrdem[p.id] = i + 1; });

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const excluirSelecionados = () => {
    if (selecionados.length === 0) return;
    Alert.alert('Excluir pedidos', `Excluir ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          setLoadingExcluir(true);
          try {
            for (const id of selecionados) {
              await excluirPedido(id);
            }
            setSelecionados([]);
            setModoSelecao(false);
            setMsgSnackbar(`✅ ${selecionados.length} pedido${selecionados.length > 1 ? 's' : ''} excluído${selecionados.length > 1 ? 's' : ''}!`);
          } catch (e: any) {
            Alert.alert('Erro', `Não foi possível excluir: ${e?.message || 'verifique sua conexão'}`);
          } finally {
            setLoadingExcluir(false);
          }
        },
      },
    ]);
  };

  const iniciarRota = async () => {
    if (selecionados.length === 0) return;
    try {
      for (const id of selecionados) {
        await atualizarStatusPedido(id, 'saiu');
      }
      setSelecionados([]);
      setModoSelecao(false);
      setAba('emandamento');
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível iniciar a rota: ${e?.message || 'tente novamente'}`);
    }
  };

  const lista = aba === 'disponiveis' ? pendentesLista : naRota;
  const listaFiltrada = lista.filter(p => {
    const s = search.toLowerCase();
    return p.clienteNome.toLowerCase().includes(s) || p.comandaNumero.includes(search);
  });

  const renderItem = ({ item }: { item: Pedido }) => {
    const isSelecionavel = modoSelecao && aba === 'disponiveis';
    const isSelecionado = selecionados.includes(item.id);
    const ordem = isSelecionado ? selecionados.indexOf(item.id) + 1 : rotaOrdem[item.id];

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (isSelecionavel) toggleSelecionado(item.id);
          else router.push(`/entrega/${item.id}`);
        }}
      >
        <View style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.accent },
          isSelecionado && styles.cardSelecionado,
        ]}>
          {/* Header do card: foto da comanda + nome + endereço */}
          <View style={styles.cardHeader}>
            {item.fotoComanda ? (
              <TouchableOpacity onPress={() => setFotoZoom(item.fotoComanda!)}>
                <Image source={{ uri: item.fotoComanda }} style={styles.cardFoto} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.cardFotoPlaceholder, { backgroundColor: colors.accent }]}>
                <Text style={styles.logoText}>
                  {item.clienteNome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.nomeRest, { color: colors.text }]} numberOfLines={1}>
                {item.clienteNome.toUpperCase()}
              </Text>
              <Text style={[styles.enderecoRest, { color: '#43A047' }]} numberOfLines={1}>
                📍 {item.clienteEndereco}
              </Text>
            </View>
          </View>

          {/* Detalhes */}
          <View style={styles.cardDetalhes}>
            <View style={styles.detalheRow}>
              <Text style={[styles.detalheLabel, { color: colors.textSubtle }]}># ID:</Text>
              <Text style={[styles.detalheValor, { color: colors.text }]}>{item.comandaNumero}</Text>
            </View>
            <View style={styles.detalheRow}>
              <Text style={[styles.detalheLabel, { color: '#43A047', fontWeight: '700' }]}>💵 Taxa do Entregador:</Text>
              <Text style={[styles.taxaValor, { color: '#43A047' }]}>R$ {item.valorTotal.toFixed(2).replace('.', ',')}</Text>
            </View>
            <View style={styles.detalheRow}>
              <Text style={[styles.detalheLabel, { color: colors.textSubtle }]}>🛒 Valor Pedido (cliente paga):</Text>
              <Text style={[styles.detalheValor, { color: colors.text }]}>R$ {((item.valorPedido || 0) + (item.valorTotal || 0)).toFixed(2).replace('.', ',')}</Text>
            </View>
            {item.clienteTelefone ? (
              <View style={styles.detalheRow}>
                <Text style={[styles.detalheLabel, { color: colors.textSubtle }]}>📞 Cliente:</Text>
                <Text style={[styles.detalheValor, { color: colors.text }]}>{item.clienteTelefone}</Text>
              </View>
            ) : null}
          </View>

          {/* Badge de ordem */}
          {ordem !== undefined && (
            <View style={[styles.ordemBadge, { backgroundColor: isSelecionado ? '#43A047' : '#FF6B00' }]}>
              <Text style={styles.ordemNum}>{ordem}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalPendentes = pendentesLista.length;
  const totalNaRota = naRota.length;
  const totalSelecionados = selecionados.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header limpo */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn}>
            <View style={[styles.menuBar, { backgroundColor: colors.accent }]} />
            <View style={[styles.menuBar, { backgroundColor: colors.accent }]} />
            <View style={[styles.menuBar, { backgroundColor: colors.accent }]} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, aba === 'disponiveis' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
            onPress={() => setAba('disponiveis')}
          >
            <Text style={[styles.tabText, { color: aba === 'disponiveis' ? colors.text : colors.textSubtle }]}>
              Disponíveis ({totalPendentes})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, aba === 'emandamento' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
            onPress={() => setAba('emandamento')}
          >
            <Text style={[styles.tabText, { color: aba === 'emandamento' ? colors.text : colors.textSubtle }]}>
              Em Andamento ({totalNaRota})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {aba === 'disponiveis' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/nova-entrega')}
            >
              <Text style={styles.actionTextPrimary}>+ Nova Entrega</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt }]}
              onPress={() => { setModoSelecao(!modoSelecao); setSelecionados([]); }}
              disabled={totalPendentes === 0}
            >
              <Text style={[styles.actionText, { color: colors.textMuted }]}>
                {modoSelecao ? '✕ Fechar' : '☑️ Selecionar'}
              </Text>
            </TouchableOpacity>
          </>
        )}
        {modoSelecao && selecionados.length > 0 && aba === 'disponiveis' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#E53935' }]}
              onPress={excluirSelecionados}
              disabled={loadingExcluir}
            >
              <Text style={[styles.actionText, { color: '#FFF' }]}>
                {loadingExcluir ? '⏳...' : `🗑️ Excluir (${selecionados.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#43A047' }]}
              onPress={iniciarRota}
            >
              <Text style={[styles.actionText, { color: '#FFF' }]}>🚀 Iniciar Rota</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Searchbar
        placeholder="Buscar cliente ou comanda"
        value={search}
        onChangeText={setSearch}
        style={[styles.search, { backgroundColor: colors.surface }]}
        inputStyle={[styles.searchInput, { color: colors.text }]}
        iconColor={colors.textSubtle}
        placeholderTextColor={colors.textSubtle}
      />

      <FlatList
        data={listaFiltrada}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.emptyText }]}>
              {aba === 'disponiveis' ? 'Nenhuma entrega disponível' : 'Nenhuma entrega em andamento'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSubtle }]}>
              {aba === 'disponiveis' ? 'Toque em "+ Nova Entrega" para começar' : 'Suas entregas em rota aparecerão aqui'}
            </Text>
          </View>
        }
      />

      {/* Menu lateral */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBg} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuLateral, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setMenuOpen(false)}>
              <View style={[styles.menuLateralBar, { backgroundColor: colors.accent }]} />
              <View style={[styles.menuLateralBar, { backgroundColor: colors.accent }]} />
              <View style={[styles.menuLateralBar, { backgroundColor: colors.accent }]} />
            </TouchableOpacity>

            <View style={[styles.avatar, { borderColor: colors.accent, marginTop: 24 }]}>
              <View style={[styles.avatarInner, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarText}>
                  {(usuario?.nome?.[0] || 'M').toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={[styles.menuNome, { color: colors.text }]}>{usuario?.nome}</Text>
            <Text style={[styles.menuEmail, { color: colors.textSubtle }]}>{usuario?.email}</Text>

            <View style={styles.menuItems}>
              <MenuItem icon="📊" label="Diárias" onPress={() => { setMenuOpen(false); router.push('/resumo'); }} colors={colors} />
              <MenuItem icon="🌙" label={mode === 'light' ? 'Modo Escuro' : 'Modo Claro'} onPress={() => { toggle(); }} colors={colors} />
              <MenuItem icon="🚪" label="Sair" onPress={() => { setMenuOpen(false); logout(); }} colors={colors} accent="#E53935" />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal zoom foto da comanda */}
      <Modal visible={!!fotoZoom} transparent animationType="fade" onRequestClose={() => setFotoZoom(null)}>
        <Pressable style={styles.zoomBg} onPress={() => setFotoZoom(null)}>
          {fotoZoom && <Image source={{ uri: fotoZoom }} style={styles.zoomImg} resizeMode="contain" />}
        </Pressable>
      </Modal>

      {/* FAB excluir quando selecionados */}
      {modoSelecao && selecionados.length > 0 && (
        <FAB
          icon="delete"
          label={`Excluir (${selecionados.length})`}
          style={[styles.fabDelete, { backgroundColor: '#E53935' }]}
          color="#FFF"
          onPress={excluirSelecionados}
          loading={loadingExcluir}
        />
      )}

      <Snackbar
        visible={!!msgSnackbar}
        onDismiss={() => setMsgSnackbar('')}
        duration={2500}
        style={{ backgroundColor: '#43A047' }}
      >
        {msgSnackbar}
      </Snackbar>
    </View>
  );
}

function MenuItem({ icon, label, onPress, colors, accent }: { icon: string; label: string; onPress: () => void; colors: any; accent?: string }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, { color: accent || colors.text }]}>{label}</Text>
      <Text style={[styles.menuChevron, { color: colors.textSubtle }]}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: { gap: 4, padding: 8 },
  menuBar: { width: 24, height: 3, borderRadius: 2 },
  tabs: { flexDirection: 'row', marginTop: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 15, fontWeight: '600' },
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1,
  },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '600' },
  actionTextPrimary: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  search: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, elevation: 0 },
  searchInput: { fontSize: 14 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    borderRadius: 12, marginBottom: 12, overflow: 'hidden',
    borderWidth: 1,
  },
  cardSelecionado: { borderWidth: 2, borderColor: '#FF6B00' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, paddingBottom: 8,
  },
  cardFoto: {
    width: 48, height: 48, borderRadius: 8,
  },
  cardFotoPlaceholder: {
    width: 48, height: 48, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  logo: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  nomeRest: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  enderecoRest: { fontSize: 12, marginTop: 2 },
  fotoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderTopWidth: 1,
  },
  fotoCardImg: { width: 56, height: 56, borderRadius: 8 },
  fotoCardHint: { fontSize: 12, flex: 1 },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomImg: { width: '95%', height: '90%' },
  cardDetalhes: { paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  detalheRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detalheLabel: { fontSize: 13, fontWeight: '500' },
  detalheValor: { fontSize: 13, fontWeight: '600' },
  taxaValor: { fontSize: 14, fontWeight: '900' },
  statusBanner: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderTopWidth: 1, alignItems: 'center',
  },
  statusTextBanner: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  cardBotoes: {
    flexDirection: 'row', padding: 12, gap: 8,
  },
  btnRejeitar: {
    flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  btnAceitar: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  ordemBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ordemNum: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Menu lateral
  menuBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  menuLateral: {
    width: '80%', padding: 20, paddingTop: 16,
  },
  menuLateralBar: { width: 24, height: 3, borderRadius: 2, marginBottom: 4 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    alignSelf: 'center', padding: 3, borderWidth: 3,
  },
  avatarInner: { flex: 1, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 36, fontWeight: '900' },
  menuNome: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  menuEmail: { fontSize: 12, textAlign: 'center', marginTop: 2 },
  menuStatusRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 12, marginTop: 12,
  },
  statusLabel: { fontSize: 14, fontWeight: '700' },
  menuItems: { marginTop: 24 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16,
  },
  menuIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  menuChevron: { fontSize: 20, fontWeight: '300' },
  fabDelete: { position: 'absolute', right: 16, bottom: 24 },
});
