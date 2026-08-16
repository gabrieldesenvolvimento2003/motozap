import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Chip, Searchbar } from 'react-native-paper';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { subscribePedidosDoMotoboy } from '../../src/services/pedidos';
import { Pedido } from '../../src/types';

const STATUS_COLORS: Record<string, string> = {
  pendente: '#FFA000',
  saiu: '#1976D2',
  a_caminho: '#7B1FA2',
  entregue: '#43A047',
  cancelado: '#E53935',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  saiu: 'Saiu',
  a_caminho: 'A Caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export default function HistoricoScreen() {
  const { usuario } = useAuth();
  const { colors } = useTheme();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = subscribePedidosDoMotoboy(usuario!.id, setPedidos);
    return unsubscribe;
  }, [usuario]);

  const historico = pedidos
    .filter(p => p.status === 'entregue' || p.status === 'cancelado')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const filtrados = historico.filter(p =>
    p.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
    p.comandaNumero.includes(search)
  );

  const totalValor = historico
    .filter(p => p.status === 'entregue')
    .reduce((acc, p) => acc + p.valorTotal, 0);

  const renderItem = ({ item }: { item: Pedido }) => (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.comanda, { color: colors.textSubtle }]}>#{item.comandaNumero}</Text>
        <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[item.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
        </View>
      </View>
      <Text style={[styles.cliente, { color: colors.text }]}>{item.clienteNome}</Text>
      <Text style={[styles.endereco, { color: colors.textSubtle }]} numberOfLines={1}>
        {item.clienteEndereco}
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />
      <View style={styles.cardFooter}>
        <Text style={[styles.valor, { color: item.status === 'entregue' ? '#43A047' : colors.textMuted }]}>
          R$ {item.valorTotal.toFixed(2).replace('.', ',')}
        </Text>
        <Text style={[styles.hora, { color: colors.textSubtle }]}>
          {item.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.titulo, { color: colors.text }]}>📜 Histórico</Text>
        <Text style={[styles.subText, { color: colors.textSubtle }]}>
          {historico.length} entregas · R$ {totalValor.toFixed(2).replace('.', ',')} total
        </Text>
      </View>

      <Searchbar
        placeholder="Buscar no histórico..."
        value={search}
        onChangeText={setSearch}
        style={[styles.search, { backgroundColor: colors.surface }]}
        inputStyle={[styles.searchInput, { color: colors.text }]}
        iconColor={colors.textSubtle}
        placeholderTextColor={colors.textSubtle}
      />

      <FlatList
        data={filtrados}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.emptyText }]}>Nenhuma entrega no histórico</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  titulo: { fontSize: 20, fontWeight: '700' },
  subText: { fontSize: 13, marginTop: 4 },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    elevation: 0,
  },
  searchInput: { fontSize: 14 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comanda: { fontSize: 13, fontWeight: '700' },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  cliente: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  endereco: { fontSize: 13 },
  divider: { height: 1, marginVertical: 10 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valor: { fontSize: 16, fontWeight: '700' },
  hora: { fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
