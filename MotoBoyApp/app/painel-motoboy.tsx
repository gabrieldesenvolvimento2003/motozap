// Workflow: motoboy vê lojas, adiciona código para linkar nova loja
import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Share } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { API_URL } from '../src/services/api';
import { storage } from '../src/storage';

interface Loja {
  id: string;
  nome: string;
  code: string;
  lojistaNome?: string;
}

export default function PainelMotoboyScreen() {
  const { usuario, logout } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCode, setShowAddCode] = useState(false);
  const [codigoInput, setCodigoInput] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [codigoInfo, setCodigoInfo] = useState<any>(null);

  useEffect(() => {
    carregarLojas();
  }, []);

  const getUserId = async () => {
    return await storage.getItem('userId');
  };

  const carregarLojas = async () => {
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/motoboy/lojas`, {
        headers: { 'X-User-Id': userId || '' },
      });
      if (res.ok) {
        const data = await res.json();
        setLojas(data);
      }
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async () => {
    if (!codigoInput || codigoInput.length < 5) {
      Alert.alert('Erro', 'Digite um código válido');
      return;
    }
    setVerificando(true);
    try {
      const res = await fetch(`${API_URL}/motoboy/codigo?codigo=${codigoInput}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      setCodigoInfo(data);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
      setCodigoInfo(null);
    } finally {
      setVerificando(false);
    }
  };

  const adicionarLoja = async () => {
    if (!codigoInfo) return;
    try {
      const userId = await getUserId();
      const res = await fetch(`${API_URL}/motoboy/lojas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId || '' },
        body: JSON.stringify({ lojaCode: codigoInfo.lojaCode, codigoId: codigoInfo.codigoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar');

      setLojas(prev => [...prev, { id: data.lojaId, nome: codigoInfo.lojaNome, code: codigoInfo.lojaCode, lojistaNome: codigoInfo.lojistaNome }]);
      setCodigoInput('');
      setCodigoInfo(null);
      setShowAddCode(false);
      Alert.alert('✅ Sucesso', `Loja "${codigoInfo.lojaNome}" adicionada!`);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  const selecionarLoja = (loja: Loja) => {
    // Salva loja ativa e vai pro painel de pedidos
    storage.setItem('lojaAtiva', JSON.stringify(loja));
    router.push('/painel');
  };

  const copiarLinkLoja = async (loja: Loja) => {
    const link = `https://motoboyapp.vercel.app/lojista?loja=${loja.code}`;
    await Share.share({ message: `Pedidos da loja ${loja.nome}: ${link}` });
  };

  const itemStyle = { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.titulo, { color: colors.text }]}>🏍️ Minhas Lojas</Text>
          <Text style={{ color: colors.textSubtle }}>Bem-vindo, {usuario?.nome}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Adicionar loja */}
      <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: colors.accent }]}>
        <View style={styles.addHeader}>
          <Text style={{ fontWeight: '700', color: colors.text }}>➕ Adicionar Loja</Text>
          {!showAddCode && (
            <TouchableOpacity onPress={() => setShowAddCode(true)}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>+ Código</Text>
            </TouchableOpacity>
          )}
        </View>

        {showAddCode && (
          <View style={{ marginTop: 12 }}>
            <TextInput
              placeholder="Digite o código da loja"
              value={codigoInput}
              onChangeText={(text) => { setCodigoInput(text.toUpperCase()); setCodigoInfo(null); }}
              autoCapitalize="characters"
              mode="outlined"
              style={{ marginBottom: 8, backgroundColor: colors.bg }}
            />

            {codigoInfo ? (
              <View style={{ backgroundColor: colors.bg, padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>✓ Código válido!</Text>
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>Loja: {codigoInfo.lojaNome}</Text>
                <Text style={{ color: colors.textSubtle, fontSize: 13 }}>Lojista: {codigoInfo.lojistaNome}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="outlined"
                onPress={() => { setShowAddCode(false); setCodigoInput(''); setCodigoInfo(null); }}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              {codigoInfo ? (
                <Button
                  mode="contained"
                  onPress={adicionarLoja}
                  style={{ flex: 1, backgroundColor: '#4CAF50' }}
                >
                  ✓ Adicionar
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={verificarCodigo}
                  loading={verificando}
                  disabled={verificando || codigoInput.length < 5}
                  style={{ flex: 1, backgroundColor: colors.accent }}
                >
                  Verificar
                </Button>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Lista de lojas */}
      <Text style={[styles.secao, { color: colors.textSubtle }]}>
        Suas lojas ({lojas.length})
      </Text>

      {loading ? (
        <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 20 }}>Carregando...</Text>
      ) : lojas.length === 0 ? (
        <View style={[itemStyle, { alignItems: 'center', padding: 32 }]}>
          <Text style={{ color: colors.textSubtle, textAlign: 'center' }}>
            Nenhuma loja vinculada.{'\n'}Adicione acima com um código!
          </Text>
        </View>
      ) : (
        <FlatList
          data={lojas}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: colors.accent }]}>
              <View style={styles.lojaHeader}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 18 }}>{item.nome}</Text>
              </View>
              {item.lojistaNome && (
                <Text style={{ color: colors.textSubtle, fontSize: 13, marginTop: 2 }}>
                  Lojista: {item.lojistaNome}
                </Text>
              )}
              <View style={styles.lojaBotoes}>
                <TouchableOpacity
                  style={{ backgroundColor: colors.accent, padding: 10, borderRadius: 8, flex: 1, alignItems: 'center' }}
                  onPress={() => selecionarLoja(item)}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>📋 Ver Pedidos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#25D366', padding: 10, borderRadius: 8, flex: 1, alignItems: 'center', marginLeft: 8 }}
                  onPress={() => copiarLinkLoja(item)}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>📲 Link</Text>
                </TouchableOpacity>
              </View>
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
  lojaHeader: { marginBottom: 4 },
  lojaBotoes: { flexDirection: 'row', marginTop: 12 },
});
