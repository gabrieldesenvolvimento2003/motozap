// Tela do motoboy: criar e gerenciar painéis de loja para lojistas
import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Share } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { apiListarLojas, apiCriarLoja } from '../src/services/api';
import { Loja } from '../src/types';
import { API_BASE } from '../src/services/api';

export default function PainelScreen() {
  const { usuario } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaNome, setNovaNome] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = async () => {
    try {
      const lista = await apiListarLojas();
      setLojas(lista);
    } catch { setLojas([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const criarLoja = async () => {
    if (!novaNome.trim()) return;
    setCriando(true);
    try {
      const nova = await apiCriarLoja(novaNome.trim());
      setLojas(prev => [...prev, nova]);
      setNovaNome('');
    } catch {}
    finally { setCriando(false); }
  };

  const copiarCodigo = async (loja: Loja) => {
    await Share.share({
      message: `🔗 Acesse o painel da loja "${loja.nome}":\n\n${linkSite(loja.code)}\n\nCódigo: ${loja.code}`,
      title: `Painel ${loja.nome}`,
    });
  };

  const linkSite = (code: string) => `${API_BASE}/codigo?code=${code}`;

  const itemStyle = { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: colors.text }]}>📊 Meus Painéis</Text>
        <Text style={[styles.sub, { color: colors.textSubtle }]}>
          Crie painéis para seus lojistas acessarem
        </Text>
      </View>

      {/* Criar nova loja */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitulo, { color: colors.text }]}>＋ Criar Novo Painel</Text>
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
          Criar Painel
        </Button>
      </View>

      <Text style={[styles.secaoTitulo, { color: colors.textSubtle }]}>
        Meus painéis ({lojas.length})
      </Text>

      {loading ? (
        <Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 20 }}>Carregando...</Text>
      ) : lojas.length === 0 ? (
        <View style={[styles.vazio, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.textSubtle, textAlign: 'center' }}>
            Nenhum painel ainda.{'\n'}Crie um acima e envie o código ao lojista!
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
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 8, marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: colors.textSubtle }}>Código da loja:</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.accent, letterSpacing: 2 }}>
                  {item.code}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#25D366' }]}
                onPress={() => copiarCodigo(item)}
              >
                <Text style={styles.btnText}>📲 Enviar Código ao Lojista</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: colors.textSubtle, marginTop: 8 }}>
                Link: {linkSite(item.code)}
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
  btn: { marginTop: 12, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
