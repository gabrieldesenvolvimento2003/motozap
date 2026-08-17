import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function LoginScreen() {
  const [modo, setModo] = useState<'inicio' | 'lojista' | 'motoboy'>('inicio');
  const [motoboySubModo, setMotoboySubModo] = useState<'escolha' | 'login' | 'ativar'>('escolha');
  const [isCadastro, setIsCadastro] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoInfo, setCodigoInfo] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, cadastrarLojista, ativarMotoboy } = useAuth();
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

  // Motoboy: login normal (já tem conta)
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

  // Motoboy: verificar código
  const handleVerificarCodigo = async () => {
    if (!codigo || codigo.length < 5) {
      setErro('Digite um código válido');
      return;
    }
    try {
      setErro('');
      setLoading(true);
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/motoboy/codigo?codigo=${codigo}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      setCodigoInfo(data);
    } catch (e: any) {
      setErro(e.message);
      setCodigoInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Motoboy: ativar conta
  const handleAtivarMotoboy = async () => {
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
      await ativarMotoboy(codigo, nome, email, senha);
      router.replace('/painel');
    } catch (e: any) {
      setErro(e.message || 'Erro ao ativar conta');
    } finally {
      setLoading(false);
    }
  };

  const voltar = () => {
    if (modo === 'motoboy' && motoboySubModo !== 'escolha') {
      setMotoboySubModo('escolha');
      setErro('');
      setEmail('');
      setSenha('');
      setNome('');
      setCodigo('');
      setCodigoInfo(null);
      return;
    }
    setModo('inicio');
    setMotoboySubModo('escolha');
    setIsCadastro(false);
    setErro('');
    setEmail('');
    setSenha('');
    setNome('');
    setCodigo('');
    setCodigoInfo(null);
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
                Tem um código de acesso?
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
    // Sub-modo: escolha
    if (motoboySubModo === 'escolha') {
      return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <View style={styles.content}>
            <TouchableOpacity onPress={voltar} style={styles.voltar}>
              <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.accent }]}>🏍️ Motoboy</Text>
            <Text style={[styles.subtitle, { color: colors.textSubtle }]}>Escolha uma opção</Text>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[styles.mbOpcao, { borderColor: colors.accent }]}
                onPress={() => { setMotoboySubModo('ativar'); setErro(''); }}
              >
                <Text style={styles.mbOpcaoIcon}>🔑</Text>
                <Text style={[styles.mbOpcaoTitulo, { color: colors.text }]}>Ativar com código</Text>
                <Text style={[styles.mbOpcaoDesc, { color: colors.textSubtle }]}>
                  Recebi um código do lojista
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mbOpcao, { borderColor: colors.accent }]}
                onPress={() => { setMotoboySubModo('login'); setErro(''); }}
              >
                <Text style={styles.mbOpcaoIcon}>🔐</Text>
                <Text style={[styles.mbOpcaoTitulo, { color: colors.text }]}>Já tenho conta</Text>
                <Text style={[styles.mbOpcaoDesc, { color: colors.textSubtle }]}>
                  Fazer login com email e senha
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // Sub-modo: login motoboy
    if (motoboySubModo === 'login') {
      return (
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: colors.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            <TouchableOpacity onPress={voltar} style={styles.voltar}>
              <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
            </TouchableOpacity>

            <Text style={[styles.title, { color: colors.accent }]}>🏍️ Login</Text>
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

    // Sub-modo: ativar com código
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity onPress={voltar} style={styles.voltar}>
            <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.accent }]}>🔑 Ativar Conta</Text>
          <Text style={[styles.subtitle, { color: colors.textSubtle }]}>
            {codigoInfo ? 'Complete seu cadastro' : 'Digite seu código de acesso'}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {!codigoInfo ? (
              <>
                <TextInput
                  label="Código de acesso"
                  value={codigo}
                  onChangeText={(text) => { setCodigo(text.toUpperCase()); setCodigoInfo(null); setErro(''); }}
                  autoCapitalize="characters"
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
                  onPress={handleVerificarCodigo}
                  loading={loading}
                  disabled={loading || codigo.length < 5}
                  style={[styles.button, { backgroundColor: colors.accent }]}
                  labelStyle={styles.buttonLabel}
                >
                  🔍 Verificar Código
                </Button>
              </>
            ) : (
              <>
                <View style={[styles.infoBox, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Código válido!</Text>
                  <Text style={{ color: colors.textSubtle, fontSize: 13, marginTop: 4 }}>
                    Lojista: {codigoInfo.lojistaNome}
                  </Text>
                  <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
                    Loja: {codigoInfo.lojaNome}
                  </Text>
                </View>

                <TextInput
                  label="Seu nome"
                  value={nome}
                  onChangeText={setNome}
                  mode="outlined"
                  style={styles.input}
                  textColor={colors.text}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.accent}
                />

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
                  label="Criar senha"
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
                  onPress={handleAtivarMotoboy}
                  loading={loading}
                  disabled={loading}
                  style={[styles.button, { backgroundColor: colors.accent }]}
                  labelStyle={styles.buttonLabel}
                >
                  ✅ Ativar Conta
                </Button>
              </>
            )}
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
  mbOpcao: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  mbOpcaoIcon: { fontSize: 32, marginBottom: 8 },
  mbOpcaoTitulo: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  mbOpcaoDesc: { fontSize: 13, textAlign: 'center' },
  title: { fontSize: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  input: { marginBottom: 12 },
  erroBox: { padding: 12, borderRadius: 8, marginBottom: 12 },
  erroText: { color: '#E53935', textAlign: 'center', fontSize: 13 },
  button: { marginTop: 8, paddingVertical: 6, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  toggle: { textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
  infoBox: { padding: 16, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
});
