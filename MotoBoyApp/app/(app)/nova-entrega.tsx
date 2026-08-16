import { useState } from 'react';
import { ScrollView, View, StyleSheet, Alert, Platform, TouchableOpacity, Image, Modal, Pressable, Linking } from 'react-native';
import { TextInput, Button, Text, Card, IconButton, ActivityIndicator, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { criarPedido } from '../../src/services/pedidos';
import { consultarCEP } from '../../src/services/geolocation';
import { lerComanda, temSuporteOCR } from '../../src/services/ocr';

export default function NovaEntregaScreen() {
  const { user, usuario } = useAuth();
  const { colors } = useTheme();

  const [comandaNumero, setComandaNumero] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteCEP, setClienteCEP] = useState('');
  const [clienteReferencia, setClienteReferencia] = useState('');
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState('');
  const [valorPedido, setValorPedido] = useState('');
  const [totalCobrar, setTotalCobrar] = useState('');
  const [enderecoOrigem, setEnderecoOrigem] = useState<'cep' | 'manual'>('manual');
  const [loading, setLoading] = useState(false);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [fonteImagem, setFonteImagem] = useState<'camera' | 'galeria' | 'manual'>('manual');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoZoom, setFotoZoom] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const abrirCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Câmera não disponível no navegador');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Habilite a câmera nas configurações');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processarImagem(result.assets[0], 'camera');
    }
  };

  const abrirGaleria = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Habilite a galeria nas configurações');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      await processarImagem(result.assets[0], 'galeria');
    }
  };

  const processarImagem = async (asset: ImagePicker.ImagePickerAsset, fonte: 'camera' | 'galeria') => {
    setLoadingOCR(true);
    setFonteImagem(fonte);
    try {
      const base64 = asset.base64;
      if (!base64) {
        Alert.alert('Erro', 'Não foi possível obter a imagem. Tente novamente.');
        return;
      }
      const mime = asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      setFotoUri(`data:${mime};base64,${base64}`);

      const suporta = await temSuporteOCR();
      if (!suporta) {
        Alert.alert(
          'OCR indisponível',
          'Seu app precisa ser instalado como APK (development build) pra usar leitura de comanda. No Expo Go, o OCR não funciona.'
        );
        return;
      }

      const dados = await lerComanda(asset.uri);
      console.log('[OCR] texto extraído:', dados.textoCompleto);

      if (dados.comandaNumero) setComandaNumero(dados.comandaNumero);
      if (dados.clienteNome) setClienteNome(dados.clienteNome);

      if (dados.clienteEndereco) {
        const partes = [dados.clienteEndereco];
        if (dados.clienteBairro) partes.push(dados.clienteBairro);
        if (dados.clienteCEP) partes.push(`CEP ${dados.clienteCEP}`);
        const endCompleto = partes.join(', ');
        setClienteEndereco(endCompleto);
        setEnderecoOrigem('manual');
      }
      if (dados.clienteCEP) {
        setClienteCEP(dados.clienteCEP);
      }
      if (dados.clienteReferencia) setClienteReferencia(dados.clienteReferencia);
      if (dados.clienteTelefone) setClienteTelefone(dados.clienteTelefone);
      if (dados.valorPedido) setValorPedido(dados.valorPedido);
      if (dados.taxaEntrega) setTaxaEntrega(dados.taxaEntrega);
      if (dados.totalCobrar) setTotalCobrar(dados.totalCobrar);

      const extraidos = [
        dados.comandaNumero && `Comanda #${dados.comandaNumero}`,
        dados.clienteNome,
        dados.clienteEndereco,
        dados.clienteBairro,
        dados.clienteCEP,
        dados.clienteReferencia,
        dados.clienteTelefone,
        dados.valorPedido && `Pedido R$ ${dados.valorPedido}`,
        dados.taxaEntrega && `Taxa R$ ${dados.taxaEntrega}`,
      ].filter(Boolean).length;

      if (extraidos === 0 || !dados.comandaNumero || !dados.valorPedido) {
        const preview = dados.textoCompleto.trim().substring(0, 800) || '(nenhum texto reconhecido)';
        Alert.alert(
          '🔍 DEBUG - texto OCR',
          `Campos extraídos: ${extraidos}\nComanda: ${dados.comandaNumero || 'NÃO'}\nValor: ${dados.valorPedido || 'NÃO'}\nTaxa: ${dados.taxaEntrega || 'NÃO'}\n\n📝 TEXTO LIDO PELO OCR:\n\n${preview}${dados.textoCompleto.length > 800 ? '...' : ''}`
        );
      } else {
        Alert.alert(
          '✅ Comanda lida',
          `${extraidos} campo(s) extraído(s). Confira abaixo antes de salvar.`
        );
      }
    } catch (e: any) {
      console.error('[OCR] erro:', e);
      Alert.alert(
        '❌ Erro no OCR',
        `${e?.message || 'erro desconhecido'}\n\nTente tirar outra foto ou preencha manualmente.`
      );
    } finally {
      setLoadingOCR(false);
    }
  };

  const limparDados = () => {
    setComandaNumero('');
    setClienteNome('');
    setClienteEndereco('');
    setClienteTelefone('');
    setClienteCEP('');
    setClienteReferencia('');
    setValorPedido('');
    setTaxaEntrega('');
    setFonteImagem('manual');
    setFotoUri(null);
  };

  const buscarCEP = async () => {
    if (clienteCEP.replace(/\D/g, '').length !== 8) {
      Alert.alert('CEP inválido', 'Digite um CEP com 8 números');
      return;
    }
    setLoadingCEP(true);
    try {
      const result = await consultarCEP(clienteCEP);
      if (result) {
        const enderecoCompleto = `${result.rua}, ${result.bairro}, ${result.cidade} - ${result.estado}`;
        setClienteEndereco(enderecoCompleto);
        setEnderecoOrigem('cep');
      } else {
        Alert.alert('CEP não encontrado', 'Verifique o número e tente novamente');
      }
    } finally {
      setLoadingCEP(false);
    }
  };

  // Abre Waze ou Google Maps pesquisando o endereço direto (sem geocode)
  const abrirNavegacao = async (app: 'waze' | 'google') => {
    const end = (clienteEndereco || '').trim();
    if (!end) {
      Alert.alert('Endereço vazio', 'Preencha o endereço do cliente antes de navegar.');
      return;
    }
    const destino = /serra/i.test(end) ? end : `${end}, Serra, ES`;
    const destinoEnc = encodeURIComponent(destino);
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${destinoEnc}&navigate=yes`
      : `https://www.google.com/maps/search/${destinoEnc}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o mapa.');
    }
  };

  const handleCriar = async () => {
    if (!user || !usuario) return;
    const taxaNum = parseFloat(taxaEntrega.replace(',', '.')) || 0;
    const pedidoNum = parseFloat(valorPedido.replace(',', '.')) || 0;
    const totalCobrarNum = parseFloat(totalCobrar.replace(',', '.')) || +(taxaNum + pedidoNum).toFixed(2);

    try {
      setLoading(true);
      await criarPedido(
        user.uid,
        usuario.nome,
        comandaNumero,
        clienteNome,
        clienteEndereco,
        clienteTelefone,
        taxaNum,
        fotoUri ?? undefined,
        [],
        pedidoNum,
        undefined,
        clienteReferencia || undefined,
        undefined,
        undefined,
      );
      setSucesso(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível criar a entrega: ${e?.message || 'tente novamente'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {loadingOCR && (
        <View style={styles.ocrOverlay}>
          <Card style={[styles.ocrCard, { backgroundColor: colors.surface }]}>
            <Card.Content style={styles.ocrContent}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={[styles.ocrText, { color: colors.text }]}>Lendo comanda...</Text>
            </Card.Content>
          </Card>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Escanear */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📸 Escanear Comanda</Text>
          <View style={styles.scanRow}>
            <Button
              mode="contained"
              icon="camera"
              onPress={abrirCamera}
              style={[styles.scanBtn, { backgroundColor: colors.accent }]}
              labelStyle={styles.btnLabel}
            >
              Câmera
            </Button>
            <Button
              mode="outlined"
              icon="image"
              onPress={abrirGaleria}
              style={[styles.scanBtn, { borderColor: colors.border }]}
              textColor={colors.text}
              labelStyle={[styles.btnLabel, { color: colors.text }]}
            >
              Galeria
            </Button>
          </View>
          {fonteImagem !== 'manual' && (
            <View style={[styles.fonteRow, { backgroundColor: colors.surfaceAlt }]}>
              <IconButton icon="check-circle" iconColor="#43A047" size={16} />
              <Text style={[styles.fonteText, { color: colors.textSubtle }]}>
                Dados extraídos · revise antes de salvar
              </Text>
              <Button compact onPress={limparDados} textColor="#E53935">Limpar</Button>
            </View>
          )}
        </View>

        {/* Preview da foto */}
        {fotoUri && (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => setFotoZoom(true)}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>📷 Foto da Comanda</Text>
            <Image source={{ uri: fotoUri }} style={styles.fotoPreview} resizeMode="cover" />
            <Text style={[styles.fotoHint, { color: colors.textSubtle }]}>Toque para ampliar</Text>
          </TouchableOpacity>
        )}

        {/* Dados da comanda */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📋 Dados da Comanda</Text>
          <TextInput
            label="Número da Comanda"
            value={comandaNumero}
            onChangeText={setComandaNumero}
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
          <TextInput
            label="Total a Cobrar (R$)"
            value={totalCobrar}
            onChangeText={setTotalCobrar}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
        </View>

        {/* Dados do cliente */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>👤 Dados do Cliente</Text>
          <TextInput
            label="Nome do Cliente"
            value={clienteNome}
            onChangeText={setClienteNome}
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
          <View style={styles.cepRow}>
            <TextInput
              label="CEP"
              value={clienteCEP}
              onChangeText={setClienteCEP}
              keyboardType="number-pad"
              maxLength={9}
              mode="outlined"
              style={[styles.cepInput, { backgroundColor: colors.bg }]}
              textColor={colors.text}
              outlineColor={colors.border}
              activeOutlineColor={colors.accent}
            />
            <Button
              mode="contained"
              onPress={buscarCEP}
              loading={loadingCEP}
              disabled={loadingCEP || clienteCEP.replace(/\D/g, '').length !== 8}
              style={[styles.cepBtn, { backgroundColor: colors.accent }]}
            >
              Buscar
            </Button>
          </View>
          <TextInput
            label="Endereço do Cliente"
            value={clienteEndereco}
            onChangeText={(t) => {
              setClienteEndereco(t);
              setEnderecoOrigem('manual');
            }}
            mode="outlined"
            multiline
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
          <TextInput
            label="Telefone"
            value={clienteTelefone}
            onChangeText={setClienteTelefone}
            keyboardType="phone-pad"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg, marginTop: 12 }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
          <TextInput
            label="Ponto de Referência (opcional)"
            value={clienteReferencia}
            onChangeText={setClienteReferencia}
            placeholder="Ex: perto da padaria, condomínio azul..."
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={colors.text}
            outlineColor={colors.border}
            activeOutlineColor={colors.accent}
          />
          <TextInput
            label="Taxa de Entrega (R$) — você recebe"
            value={taxaEntrega}
            onChangeText={setTaxaEntrega}
            keyboardType="decimal-pad"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.bg }]}
            textColor={'#43A047'}
            outlineColor={colors.border}
            activeOutlineColor={'#43A047'}
          />

          {/* Botões de navegação (sem mapa) */}
          {clienteEndereco && clienteEndereco.length >= 5 && (
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnWaze]}
                onPress={() => abrirNavegacao('waze')}
              >
                <Text style={styles.navBtnIcon}>🧭</Text>
                <Text style={styles.navBtnText}>Waze</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, styles.navBtnGoogle]}
                onPress={() => abrirNavegacao('google')}
              >
                <Text style={styles.navBtnIcon}>🗺️</Text>
                <Text style={styles.navBtnText}>Google Maps</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Button
          mode="contained"
          onPress={handleCriar}
          loading={loading}
          disabled={loading || !comandaNumero || !clienteNome || !taxaEntrega}
          style={[styles.criarBtn, { backgroundColor: colors.accent }]}
          labelStyle={styles.criarLabel}
        >
          Criar Entrega
        </Button>
      </ScrollView>

      {/* Modal de zoom */}
      <Modal visible={fotoZoom} transparent animationType="fade" onRequestClose={() => setFotoZoom(false)}>
        <Pressable style={styles.zoomBg} onPress={() => setFotoZoom(false)}>
          {fotoUri && <Image source={{ uri: fotoUri }} style={styles.zoomImg} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <Snackbar
        visible={sucesso}
        onDismiss={() => setSucesso(false)}
        duration={1200}
        style={{ backgroundColor: '#43A047' }}
      >
        ✅ Entrega criada com sucesso!
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  ocrOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  ocrCard: { padding: 24, borderRadius: 16 },
  ocrContent: { alignItems: 'center', gap: 16 },
  ocrText: { fontSize: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  scanRow: { flexDirection: 'row', gap: 12 },
  scanBtn: { flex: 1 },
  btnLabel: { fontSize: 14 },
  fonteRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    padding: 8, borderRadius: 8,
  },
  fonteText: { flex: 1, fontSize: 12 },
  fotoPreview: { width: '100%', height: 200, borderRadius: 8 },
  fotoHint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  input: { marginBottom: 12 },
  cepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cepInput: { flex: 1 },
  cepBtn: { marginTop: 6 },
  criarBtn: { paddingVertical: 8, borderRadius: 12 },
  criarLabel: { fontSize: 16, fontWeight: '700' },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomImg: { width: '95%', height: '90%' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  navBtnWaze: { backgroundColor: '#33CCFF' },
  navBtnGoogle: { backgroundColor: '#4285F4' },
  navBtnIcon: { fontSize: 18 },
  navBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
});