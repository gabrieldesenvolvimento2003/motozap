import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'motoboy' | 'lojista'>('motoboy');
  const [isCadastro, setIsCadastro] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, cadastrar } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !senha) {
      setErro('Preencha email e senha');
      return;
    }
    try {
      setErro('');
      setLoading(true);
      await login(email, senha, tipo);
      // Lojista vai pro painel, Motoboy vai pro app
      router.replace(tipo === 'lojista' ? '/codigo' : '/painel');
    } catch (e: any) {
      const msg = e.message || '';
      setErro(
        msg.includes('login é para') ? msg
        : msg.includes('credenciais') ? 'Email ou senha incorretos'
        : msg || 'Erro ao entrar'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCadastro = async () => {
    if (!nome || !email || !senha) {
      setErro('Preencha todos os campos');
      return;
    }
    if (senha.length < 4) {
      setErro('Senha deve ter pelo menos 4 caracteres');
      return;
    }
    try {
      setErro('');
      setLoading(true);
      await cadastrar(nome, email, senha, tipo);
      router.replace('/painel');
    } catch (e: any) {
      const msg = e.message || '';
      setErro(
        msg.includes('já cadastrado') ? 'Email já cadastrado'
        : msg.includes('senha') ? 'Senha inválida'
        : msg || 'Erro ao cadastrar'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.accent }]}>🚴 MotoBoy</Text>
        <Text style={[styles.subtitle, { color: colors.textSubtle }]}>App de Entregas</Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {isCadastro && (
            <TextInput
              label="Nome completo"
              value={nome}
              onChangeText={setNome}
              mode="outlined"
              style={styles.input}
              textColor={colors.text}
              outlineColor={colors.border}
              activeOutlineColor={colors.accent}
            />
          )}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />

          <TextInput
            label="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />

          {/* Toggle Motoboy / Lojista */}
          <View style={styles.tipoRow}>
            <Text style={[styles.tipoLabel, { color: colors.textSubtle }]}>Entrar como:</Text>
            <SegmentedButtons
              value={tipo}
              onValueChange={(v) => setTipo(v as 'motoboy' | 'lojista')}
              buttons={[
                { value: 'motoboy', label: '🏍️ Motoboy' },
                { value: 'lojista', label: '🏪 Lojista' },
              ]}
              style={styles.segmented}
            />
          </View>

          {isCadastro && (
            <View style={styles.tipoRow}>
              <Text style={[styles.tipoLabel, { color: colors.textSubtle }]}>Você é:</Text>
              <SegmentedButtons
                value={tipo}
                onValueChange={(v) => setTipo(v as 'motoboy' | 'lojista')}
                buttons={[
                  { value: 'motoboy', label: '🏍️ Motoboy' },
                  { value: 'lojista', label: '🏪 Lojista' },
                ]}
                style={styles.segmented}
              />
            </View>
          )}

          {erro ? (
            <View style={[styles.erroBox, { backgroundColor: 'rgba(229,57,53,0.15)' }]}>
              <Text style={styles.erroText}>{erro}</Text>
            </View>
          ) : null}

          <Button
            mode="contained"
            onPress={isCadastro ? handleCadastro : handleLogin}
            loading={loading}
            disabled={loading}
            style={[styles.button, { backgroundColor: colors.accent }]}
            labelStyle={styles.buttonLabel}
          >
            {isCadastro ? '📝 Cadastrar' : '🚴 Entrar'}
          </Button>

          <TouchableOpacity onPress={() => { setIsCadastro(!isCadastro); setErro(''); }}>
            <Text style={[styles.toggle, { color: colors.accent }]}>
              {isCadastro ? '← Já tem conta? Entre' : 'Não tem conta? Cadastre-se →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 16, padding: 20, marginTop: 24 },
  title: { fontSize: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  input: { marginBottom: 12 },
  tipoRow: { marginBottom: 12 },
  tipoLabel: { fontSize: 14, marginBottom: 8 },
  segmented: {},
  erroBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
  erroText: { color: '#E53935', textAlign: 'center', fontSize: 13 },
  button: { marginTop: 8, paddingVertical: 6, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  toggle: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
});
