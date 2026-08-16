// Tela pública: lojista coloca o código da loja e entra no painel
import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { API_BASE } from '../src/services/api';

interface LojaInfo {
  nome: string;
  code: string;
  motoboyNome: string;
}

export default function CodigoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [code, setCode] = useState((searchParams.code as string) || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [loja, setLoja] = useState<LojaInfo | null>(null);

  const validar = async () => {
    if (!code.trim()) { setErro('Digite o código da loja'); return; }
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`${API_BASE}/loja?code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) {
        setErro('Código inválido ou loja não encontrada');
        setLoja(null);
      } else {
        const data = await res.json();
        setLoja(data);
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-validar se vier link direto com code
  useEffect(() => {
    if (searchParams.code) validar();
  }, []);

  const entrar = () => {
    if (!loja) return;
    router.replace(`/lojista?loja=${encodeURIComponent(loja.code)}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.logo, { color: colors.accent }]}>🚴 MotoBoy</Text>
        <Text style={[styles.titulo, { color: colors.text }]}>Painel do Lojista</Text>
        <Text style={[styles.sub, { color: colors.textSubtle }]}>
          Digite o código que o motoboy te enviou
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TextInput
            label="Código da loja"
            value={code}
            onChangeText={t => { setCode(t); setErro(''); setLoja(null); }}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />

          {erro ? (
            <Text style={styles.erro}>{erro}</Text>
          ) : null}

          {loja ? (
            <View style={[styles.lojaBox, { borderColor: '#43A047' }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                ✅ {loja.nome}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSubtle }}>
                Motoboy: {loja.motoboyNome}
              </Text>
              <Button
                mode="contained"
                onPress={entrar}
                style={{ backgroundColor: '#43A047', marginTop: 12, borderRadius: 10 }}
              >
                📊 Entrar no Painel
              </Button>
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={validar}
              loading={loading}
              disabled={loading || !code.trim()}
              style={{ backgroundColor: colors.accent, borderRadius: 10 }}
            >
              🔍 Validar Código
            </Button>
          )}
        </View>

        <Text style={[styles.ajuda, { color: colors.textSubtle }]}>
          Não tem o código?{'\n'}Peça ao seu motoboy pelo app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 40, fontWeight: '900', textAlign: 'center' },
  titulo: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 16 },
  sub: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  card: { borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
  erro: { color: '#E53935', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  lojaBox: { borderWidth: 2, borderRadius: 12, padding: 16, alignItems: 'center' },
  ajuda: { fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 20 },
});
