import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function LoginScreen() {
  const [modo, setModo] = useState<'inicio' | 'lojista' | 'motoboy'>('inicio');
  const [isCadastro, setIsCadastro] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, cadastrarLojista } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  // Lojista: login
  const handleLoginLojista = async () => {
    if (!email || !senha) {
      setErro('Preencha email e senha');
      return;
    }
    try {
      setErro('');
      setLoading(true);
      await login(email, senha, 'lojista');
      router.replace('/painel-lojista');
    } catch (e: any) {
      setErro(e.message?.includes('credenciais') ? 'Email ou senha incorretos' : e.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  // Motoboy: login normal
  const handleLoginMotoboy = async () => {
    if (!email || !senha) {
      setErro('Preencha email e senha');
      return;
    }
    try {
      setErro('');
      setLoading(true);
      await login(email, senha, 'motoboy');
      router.replace('/painel-motoboy');
    } catch (e: any) {
      setErro(e.message?.includes('credenciais') ? 'Email ou senha incorretos' : e.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  // Lojista: cadastro
  const handleCadastroLojista = async () => {
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
      await cadastrarLojista(nome, email, senha);
      router.replace('/painel-lojista');
    } catch (e: any) {
      setErro(e.message?.includes('já cadastrado') ? 'Email já cadastrado' : e.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const voltar = () => {
    setModo('inicio');
    setIsCadastro(false);
    setErro('');
    setEmail('');
    setSenha('');
    setNome('');
  };

  // ===== TELA INICIAL =====
  if (modo === 'inicio') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.accent }]}>🚴 MotoBoy</Text>
          <Text style={[styles.subtitle, { color: colors.textSubtle }]}>App de Entregas</Text>

          <View style={styles.cardsContainer}>
            <TouchableOpacity
              style={[styles.cardOpcao, { backgroundColor: colors.surface }]}
              onPress={() => setModo('lojista')}
            >
              <Text style={styles.cardIcon}>🏪</Text>
              <Text style={[styles.cardTitulo, { color: colors.text }]}>Sou Lojista</Text>
              <Text style={[styles.cardDesc, { color: colors.textSubtle }]}>
                Gerenciar pedidos e motoboys
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardOpcao, { backgroundColor: colors.surface }]}
              onPress={() => setModo('motoboy')}
            >
              <Text style={styles.cardIcon}>🏍️</Text>
              <Text style={[styles.cardTitulo, { color: colors.text }]}>Sou Motoboy</Text>
              <Text style={[styles.cardDesc, { color: colors.textSubtle }]}>
                Fazer login na sua conta
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ===== LOGIN LOJISTA =====
  if (modo === 'lojista') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={voltar} style={styles.voltar}>
            <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.accent }]}>🏪 Lojista</Text>
          <Text style={[styles.subtitle, { color: colors.textSubtle }]}>
            {isCadastro ? 'Crie sua conta' : 'Entre na sua conta'}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {isCadastro && (
              <TextInput
                label="Nome da loja"
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

            {erro ? (
              <View style={[styles.erroBox, { backgroundColor: 'rgba(229,57,53,0.15)' }]}>
                <Text style={styles.erroText}>{erro}</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={isCadastro ? handleCadastroLojista : handleLoginLojista}
              loading={loading}
              disabled={loading}
              style={[styles.button, { backgroundColor: colors.accent }]}
              labelStyle={styles.buttonLabel}
            >
              {isCadastro ? '📝 Criar Conta' : '🚪 Entrar'}
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

  // ===== MOTOBOY =====
  if (modo === 'motoboy') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={voltar} style={styles.voltar}>
            <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.accent }]}>🏍️ Motoboy</Text>
          <Text style={[styles.subtitle, { color: colors.textSubtle }]}>Entre na sua conta</Text>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
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

            {erro ? (
              <View style={[styles.erroBox, { backgroundColor: 'rgba(229,57,53,0.15)' }]}>
                <Text style={styles.erroText}>{erro}</Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLoginMotoboy}
              loading={loading}
              disabled={loading}
              style={[styles.button, { backgroundColor: colors.accent }]}
              labelStyle={styles.buttonLabel}
            >
              🚪 Entrar
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  voltar: { marginBottom: 16 },
  voltarText: { fontSize: 16, fontWeight: '600' },
  cardsContainer: { marginTop: 40, gap: 16 },
  cardOpcao: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 0 },
  cardIcon: { fontSize: 48, marginBottom: 12 },
  cardTitulo: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 14, textAlign: 'center' },
  card: { borderRadius: 16, padding: 20, marginTop: 24 },
  title: { fontSize: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  input: { marginBottom: 12 },
  erroBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
  erroText: { color: '#E53935', textAlign: 'center', fontSize: 13 },
  button: { marginTop: 8, paddingVertical: 6, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  toggle: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
});
