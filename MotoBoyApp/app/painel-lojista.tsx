import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Share } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { API_URL } from '../src/services/api';
import { storage } from '../src/storage';

interface MotoboyItem {
  id: string;
  nome: string;
  telefone: string | null;
  codigo: string;
  usado: boolean;
  usuario_id: string | null;
  usuario_nome: string | null;
}

export default function PainelLojistaScreen() {
  const { usuario, logout } = useAuth();
  const { colors } = useTheme();
  const [motoboys, setMotoboys] = useState<MotoboyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [criando, setCriando] = useState(false);
  const [lojaCode, setLojaCode] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const getUserId = async () => {
    return await storage.getItem('userId');
  };

  const carregarDados = async () => {
    try {
      const userId = await getUserId();
      const headers = { 'X-User-Id': userId || '' };

      const [mbRes, lojaRes] = await Promise.all([
        fetch(`${API_URL}/lojista/motoboys`, { headers }),
        fetch(`${API_URL}/lojista/loja`, { headers }),
      ]);

      if (mbRes.ok) {
        const data = await mbRes.json();
        setMotoboys(data);
      }
      if (lojaRes.ok) {
        const loja = await lojaRes.json();
        setLojaCode(loja.code);
      }
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const criarMotoboy = async () => {
    if (!novoNome.trim()) {
      Alert.alert('Erro', 'Digite o nome do motoboy');
      return;
    }
    setCriando(true);
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/lojista/motoboys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ nome: novoNome.trim(), telefone: novoTelefone.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMotoboys(prev => [data, ...prev]);
      setNovoNome('');
      setNovoTelefone('');
      setShowAdd(false);

      Alert.alert(
        '✅ Código gerado!',
        `Motoboy: ${data.nome}\n\nCódigo: ${data.codigo}\n\nEnvie este código para o motoboy!`,
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível criar');
    } finally {
      setCriando(false);
    }
  };

  const copiarLinkLoja = async () => {
    if (!lojaCode) return;
    const link = `https://motoboyapp.vercel.app/lojista?loja=${lojaCode}`;
    await Share.share({ message: `Acesse os pedidos da loja: ${link}` });
  };

  const itemStyle = { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.titulo, { color: colors.text }]}>🏪 Painel Lojista</Text>
          <Text style={{ color: colors.textSubtle }}>Bem-vindo, {usuario?.nome}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Link do painel */}
      <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: colors.accent }]}>
        <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 8 }}>📊 Link dos Pedidos</Text>
        <Text style={{ color: colors.textSubtle, fontSize: 12, marginBottom: 12 }}>
          Compartilhe este link com seus motoboys para eles verem os pedidos:
        </Text>
        <Text style={{ color: colors.accent, fontSize: 12, marginBottom: 8 }}>
          motoboyapp.vercel.app/lojista?loja={lojaCode}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.accent, padding: 10, borderRadius: 8, alignItems: 'center' }}
          onPress={copiarLinkLoja}
        >
          <Text style={{ color: '#FFF', fontWeight: '700' }}>📲 Enviar link</Text>
        </TouchableOpacity>
      </View>

      {/* Adicionar motoboy */}
      <View style={[itemStyle]}>
        <View style={styles.addHeader}>
          <Text style={{ fontWeight: '700', color: colors.text }}>👤 Adicionar Motoboy</Text>
          {!showAdd && (
            <TouchableOpacity onPress={() => setShowAdd(true)}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </View>

        {showAdd && (
          <View style={{ marginTop: 12 }}>
            <TextInput
              placeholder="Nome do motoboy"
              value={novoNome}
              onChangeText={setNovoNome}
              mode="outlined"
              style={{ marginBottom: 8, backgroundColor: colors.bg }}
            />
            <TextInput
              placeholder="Telefone (opcional)"
              value={novoTelefone}
              onChangeText={setNovoTelefone}
              keyboardType="phone-pad"
              mode="outlined"
              style={{ marginBottom: 8, backgroundColor: colors.bg }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="outlined"
                onPress={() => { setShowAdd(false); setNovoNome(''); setNovoTelefone(''); }}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={criarMotoboy}
                loading={criando}
                disabled={criando || !novoNome.trim()}
                style={{ flex: 1, backgroundColor: colors.accent }}
              >
                Gerar Código
              </Button>
            </View>
          </View>
        )}
      </View>

      {/* Lista de motoboys */}
      <Text style={[styles.secao, { color: colors.textSubtle }]}>
        Motoboys ({motoboys.length})
      </Text>

      {loading ? (
        <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 20 }}>Carregando...</Text>
      ) : motoboys.length === 0 ? (
        <View style={[itemStyle, { alignItems: 'center', padding: 32 }]}>
          <Text style={{ color: colors.textSubtle, textAlign: 'center' }}>
            Nenhum motoboy cadastrado.{'\n'}Clique em "+ Novo" acima!
          </Text>
        </View>
      ) : (
        <FlatList
          data={motoboys}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: item.usado ? '#4CAF50' : colors.accent }]}>
              <View style={styles.mbHeader}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }}>{item.nome}</Text>
                <View style={{ backgroundColor: item.usado ? '#4CAF5030' : '#FF980030', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 11, color: item.usado ? '#4CAF50' : '#FF9800' }}>
                    {item.usado ? '✅ Ativado' : '⏳ Pendente'}
                  </Text>
                </View>
              </View>
              {item.telefone && (
                <Text style={{ color: colors.textSubtle, fontSize: 13, marginTop: 2 }}>📱 {item.telefone}</Text>
              )}
              <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 4 }}>
                Código: <Text style={{ fontWeight: '700', color: colors.accent }}>{item.codigo}</Text>
              </Text>
              {item.usado && item.usuario_nome && (
                <Text style={{ color: colors.textSubtle, fontSize: 12, marginTop: 2 }}>
                  Conta: {item.usuario_nome}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titulo: { fontSize: 24, fontWeight: '900' },
  addHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secao: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  mbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
});
