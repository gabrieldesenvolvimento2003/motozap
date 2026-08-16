import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { subscribeTodosPedidos } from '../../src/services/pedidos';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Pedido } from '../../src/types';

const FILTROS = [
  { key: 'hoje', label: '📅 Hoje' },
  { key: '7dias', label: '7 dias' },
  { key: '15dias', label: '15 dias' },
  { key: '30dias', label: '30 dias' },
  { key: 'custom', label: '📆 Custom' },
];

export default function ResumoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<string>('hoje');
  const [dataIni, setDataIni] = useState<Date>(new Date());
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [showIni, setShowIni] = useState(false);
  const [showFim, setShowFim] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeTodosPedidos(setPedidos);
    return unsubscribe;
  }, []);

  const getRange = (): { inicio: Date; fim: Date } => {
    const agora = new Date();
    const fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
    switch (filtro) {
      case 'hoje':
        return { inicio: new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()), fim };
      case '7dias':
        return { inicio: new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000), fim };
      case '15dias':
        return { inicio: new Date(agora.getTime() - 15 * 24 * 60 * 60 * 1000), fim };
      case '30dias':
        return { inicio: new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000), fim };
      default:
        const dIni = new Date(dataIni.getFullYear(), dataIni.getMonth(), dataIni.getDate());
        const dFim = new Date(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate(), 23, 59, 59);
        return { inicio: dIni, fim: dFim };
    }
  };

  const { inicio, fim } = getRange();

  const pedidosFiltrados = pedidos.filter(p =>
    p.createdAt && new Date(p.createdAt) >= inicio && new Date(p.createdAt) <= fim
  );

  const totalEntregues = pedidosFiltrados.filter(p => p.status === 'entregue').length;
  const totalTaxas = pedidosFiltrados
    .filter(p => p.status === 'entregue')
    .reduce((acc, p) => acc + (p.valorTotal || 0), 0);
  const totalPedidos = pedidosFiltrados
    .filter(p => p.status === 'entregue')
    .reduce((acc, p) => acc + (p.valorPedido || 0), 0);

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR');

  const onChangeIni = (_: DateTimePickerEvent, date?: Date) => {
    setShowIni(Platform.OS === 'ios');
    if (date) setDataIni(date);
  };
  const onChangeFim = (_: DateTimePickerEvent, date?: Date) => {
    setShowFim(Platform.OS === 'ios');
    if (date) setDataFim(date);
  };

  const entregas = pedidosFiltrados
    .filter(p => p.status === 'entregue')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header com filtros */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.titulo, { color: colors.text }]}>📊 Resumo</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtroRow}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filtroBtn,
                { borderColor: colors.border },
                filtro === f.key && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filtroText, { color: filtro === f.key ? '#FFF' : colors.textMuted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtro === 'custom' && (
          <View style={styles.dateRow}>
            <TouchableOpacity style={[styles.dateBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowIni(true)}>
              <Text style={{ color: colors.text }}>De: {fmt(dataIni)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dateBtn, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowFim(true)}>
              <Text style={{ color: colors.text }}>Até: {fmt(dataFim)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showIni && (
          <DateTimePicker value={dataIni} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onChangeIni} maximumDate={new Date()} />
        )}
        {showFim && (
          <DateTimePicker value={dataFim} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onChangeFim} maximumDate={new Date()} />
        )}

        <Text style={[styles.range, { color: colors.textSubtle }]}>
          {fmt(inicio)} → {fmt(fim)}
        </Text>
      </View>

      {/* Card de total */}
      <View style={[styles.totalCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.totalLabel, { color: colors.textSubtle }]}>Total de Taxas (você recebe)</Text>
        <Text style={[styles.totalValor, { color: '#43A047' }]}>
          R$ {totalTaxas.toFixed(2).replace('.', ',')}
        </Text>
        <Text style={[styles.totalSub, { color: colors.textSubtle }]}>
          {totalEntregues} entrega{totalEntregues !== 1 ? 's' : ''} realizada{totalEntregues !== 1 ? 's' : ''}
        </Text>
      </View>

      {totalEntregues === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyText, { color: colors.emptyText }]}>Nenhuma entrega neste período</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.list}>
          <Text style={[styles.listHeader, { color: colors.textSubtle }]}>📋 Entregas</Text>
          {entregas.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.pedidoItem, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/entrega/${item.id}`)}
            >
              <View style={styles.pedidoLeft}>
                <Text style={[styles.pedidoCliente, { color: colors.text }]}>{item.clienteNome}</Text>
                <Text style={[styles.pedidoSub, { color: colors.textSubtle }]}>#{item.comandaNumero}</Text>
              </View>
              <View style={styles.pedidoRight}>
                <Text style={[styles.pedidoValor, { color: '#43A047' }]}>
                  R$ {item.valorTotal.toFixed(2).replace('.', ',')}
                </Text>
                <Text style={[styles.pedidoDate, { color: colors.textSubtle }]}>
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('pt-BR') : '-'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  filtroRow: { flexDirection: 'row', gap: 8 },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filtroText: { fontSize: 13, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  dateBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  range: { fontSize: 12, marginTop: 8 },
  totalCard: { margin: 16, borderRadius: 16, padding: 24, alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalValor: { fontSize: 42, fontWeight: '900', marginTop: 8 },
  totalLabel2: { fontSize: 14, fontWeight: '600', marginTop: 16 },
  totalValor2: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  totalSub: { fontSize: 13, marginTop: 8 },
  listContainer: { flex: 1 },
  list: { padding: 16 },
  listHeader: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pedidoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  pedidoLeft: { flex: 1 },
  pedidoCliente: { fontSize: 15, fontWeight: '600' },
  pedidoSub: { fontSize: 12, marginTop: 2 },
  pedidoRight: { alignItems: 'flex-end' },
  pedidoValor: { fontSize: 16, fontWeight: '700' },
  pedidoDate: { fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600' },
});
