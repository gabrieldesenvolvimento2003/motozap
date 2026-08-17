// Tela do motoboy: ver pedidos da loja selecionada
import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { API_URL } from '../src/services/api';
import { storage } from '../src/storage';
import { Pedido } from '../src/types';

const STATUS_COLORS: Record<string, string> = {
  pendente: '#FF9800',
  saiu: '#2196F3',
  a_caminho: '#9C27B0',
  cheguei: '#4CAF50',
  entregue: '#8BC34A',
  cancelado: '#F44336',
};

export default function PedidosScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [lojaAtiva, setLojaAtiva] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const lojaStr = await storage.getItem('lojaAtiva');
      if (lojaStr) {
        setLojaAtiva(JSON.parse(lojaStr));
      } else {
        // Volta pro painel se não tem loja selecionada
        router.replace('/painel-motoboy');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!lojaAtiva?.code) return;

    const carregar = async () => {
      try {
        const res = await fetch(`${API_URL}/lojas/pedidos?code=${lojaAtiva.code}`);
        if (res.ok) {
          const data = await res.json();
          setPedidos(data);
        }
      } catch {}
      finally { setLoading(false); }
    };

    carregar();
    // Polling a cada 3s
    const interval = setInterval(carregar, 3000);
    return () => clearInterval(interval);
  }, [lojaAtiva]);

  const itemStyle = { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/painel-motoboy')}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={[styles.titulo, { color: colors.text }]}>{lojaAtiva?.nome || 'Pedidos'}</Text>
        <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
          {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading ? (
        <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 40 }}>Carregando...</Text>
      ) : pedidos.length === 0 ? (
        <View style={[itemStyle, { alignItems: 'center', padding: 40 }]}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 16 }}>
            Nenhum pedido{'\n'}nesta loja ainda
          </Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: STATUS_COLORS[item.status] || colors.accent }]}>
              <View style={styles.pedidoHeader}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }}>
                  #{item.comandaNumero || item.id.slice(-6)}
                </Text>
                <View style={{ backgroundColor: STATUS_COLORS[item.status] + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: STATUS_COLORS[item.status] }}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={{ color: colors.text, marginTop: 8, fontWeight: '600' }}>
                {item.clienteNome || 'Sem nome'}
              </Text>
              <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                📍 {item.clienteEndereco || 'Sem endereço'}
              </Text>
              {item.clienteTelefone && (
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                  📱 {item.clienteTelefone}
                </Text>
              )}
              {item.clienteReferencia && (
                <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 2 }}>
                  📌 {item.clienteReferencia}
                </Text>
              )}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ fontWeight: '900', fontSize: 18, color: colors.accent }}>
                  R$ {item.valorTotal?.toFixed(2) || '0,00'}
                </Text>
                {item.distancia && (
                  <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                    📏 {item.distancia}km
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={() => router.push(`/app/pedido/${item.id}`)}
              >
                <Text style={styles.btnText}>Ver Detalhes →</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 20 },
  titulo: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  pedidoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700' },
});
