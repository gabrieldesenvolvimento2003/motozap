import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Share, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { apiListarLojas, apiCriarLoja } from '../../src/services/api';
import { Loja } from '../../src/types';
import { storage } from '../../src/storage';

const LOJA_KEY = 'lojaCode';

export default function LojasScreen() {
  const { usuario } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaNome, setNovaNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregarLojas = async () => {
    try {
      const lista = await apiListarLojas();
      setLojas(lista);
    } catch {
      setLojas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarLojas(); }, []);

  const criarLoja = async () => {
    if (!novaNome.trim()) return;
    setCriando(true);
    try {
      const nova = await apiCriarLoja(novaNome.trim());
      setLojas(prev => [...prev, nova]);
      setNovaNome('');
      await storage.setItem(LOJA_KEY, nova.code);
      router.replace(`/lojista?loja=${nova.code}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a loja');
    } finally {
      setCriando(false);
    }
  };

  const selecionarLoja = async (loja: Loja) => {
    await storage.setItem(LOJA_KEY, loja.code);
    router.replace(`/lojista?loja=${loja.code}`);
  };

  const gerarLink = (code: string) => {
    // Link pro painel — funciona no navegador do celular da loja
    return `https://motoboyapp.vercel.app/lojista?loja=${code}`;
  };

  const copiarLink = async (loja: Loja) => {
    const link = gerarLink(loja.code);
    await Share.share({ message: link, title: `Painel ${loja.nome}` });
    setCopiado(loja.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const itemStyle = { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: colors.text }]}>🏪 Minhas Lojas</Text>
        <Text style={[styles.sub, { color: colors.textSubtle }]}>Bem-vindo, {usuario?.nome}</Text>
      </View>

      {/* Criar nova loja */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitulo, { color: colors.text }]}>＋ Nova Loja</Text>
        <TextInput
          label="Nome da loja"
          value={novaNome}
          onChangeText={setNovaNome}
          mode="outlined"
          style={styles.input}
          textColor={colors.text}
          outlineColor={colors.border}
          activeOutlineColor={colors.accent}
        />
        <Button
          mode="contained"
          onPress={criarLoja}
          loading={criando}
          disabled={!novaNome.trim() || criando}
          style={{ backgroundColor: colors.accent, borderRadius: 10 }}
        >
          Criar Loja
        </Button>
      </View>

      {/* Lista de lojas */}
      <Text style={[styles.secaoTitulo, { color: colors.textSubtle }]}>
        Suas lojas ({lojas.length})
      </Text>

      {loading ? (
        <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 20 }}>Carregando...</Text>
      ) : lojas.length === 0 ? (
        <View style={[styles.vazio, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.textSubtle, textAlign: 'center' }}>
            Nenhuma loja ainda.{'\n'}Crie uma acima!
          </Text>
        </View>
      ) : (
        <FlatList
          data={lojas}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[itemStyle, { borderLeftWidth: 4, borderLeftColor: colors.accent }]}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{item.nome}</Text>
              <Text style={{ fontSize: 12, color: colors.textSubtle, marginTop: 4 }}>
                Código: {item.code}
              </Text>

              <View style={styles.botoes}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.accent }]}
                  onPress={() => selecionarLoja(item)}
                >
                  <Text style={styles.btnText}>📊 Abrir Painel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: '#25D366' }]}
                  onPress={() => copiarLink(item)}
                >
                  <Text style={styles.btnText}>
                    {copiado === item.id ? '✅ Enviado!' : '📲 Enviar p/ Loja'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 11, color: colors.textSubtle, marginTop: 8 }}>
                Link: {gerarLink(item.code).substring(0, 60)}...
              </Text>
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
  titulo: { fontSize: 28, fontWeight: '900' },
  sub: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: 12, padding: 16, marginBottom: 24 },
  cardTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { marginBottom: 12 },
  secaoTitulo: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  vazio: { borderRadius: 12, padding: 32, alignItems: 'center' },
  botoes: { flexDirection: 'row', marginTop: 12, gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
