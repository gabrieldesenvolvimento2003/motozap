import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Image, Modal, Pressable, TouchableOpacity, Linking, Clipboard, AppState } from 'react-native';
import { Text, Card, Button, Chip, Divider, TextInput, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { subscribePedidosDoMotoboy, atualizarStatusPedido } from '../../../src/services/pedidos';
import { Pedido, FormaPagamento } from '../../../src/types';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useTheme } from '../../../src/contexts/ThemeContext';

const STATUS_FLOW: Pedido['status'][] = ['pendente', 'saiu', 'a_caminho', 'cheguei', 'entregue'];
const STATUS_COLORS: Record<string, string> = {
  pendente: '#FFA000',
  saiu: '#1976D2',
  a_caminho: '#7B1FA2',
  cheguei: '#00838F',
  contatando: '#1976D2',
  contato_ok: '#00838F',
  cobrando: '#7B1FA2',
  entregue: '#43A047',
  cancelado: '#E53935',
};
const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  saiu: 'Em Rota',
  a_caminho: 'A Caminho',
  cheguei: 'Chegou',
  contatando: 'Contatando',
  contato_ok: 'Aguardando',
  cobrando: 'Cobrando',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
const STATUS_ICONS: Record<string, string> = {
  pendente: '⏳',
  saiu: '🏍️',
  a_caminho: '📍',
  cheguei: '📬',
  contatando: '📞',
  contato_ok: '✅',
  cobrando: '💰',
  entregue: '✅',
  cancelado: '❌',
};

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: '💵 Din' },
  { value: 'pix', label: '📱 PIX' },
  { value: 'cartao_credito', label: '💳 Créd' },
  { value: 'cartao_debito', label: '💳 Déb' },
];

// Timeline horizontal de status (estilo iFood/Rappi)
const TimelineStatus = ({ statusAtual }: { statusAtual: string }) => {
  const etapas = [
    { id: 'pendente', label: 'Pendente' },
    { id: 'saiu', label: 'Em Rota' },
    { id: 'a_caminho', label: 'A Caminho' },
    { id: 'cheguei', label: 'Chegou' },
    { id: 'entregue', label: 'Entregue' },
  ];

  // Mapear status principais para índice (ignora sub-status)
  const mainStatus = ['pendente', 'saiu', 'a_caminho', 'cheguei', 'entregue', 'cancelado'].includes(statusAtual)
    ? statusAtual
    : 'cheguei';
  const idxAtual = etapas.findIndex(e => e.id === mainStatus);

  return (
    <View style={styles.timeline}>
      {etapas.map((etapa, i) => {
        const isConcluido = i < idxAtual;
        const isAtual = i === idxAtual;
        return (
          <View key={etapa.id} style={styles.timelineStep}>
            {i > 0 && (
              <View style={[
                styles.timelineLine,
                isConcluido && styles.timelineLineActive,
              ]} />
            )}
            <View style={[
              styles.timelineCircle,
              isConcluido && styles.timelineCircleActive,
              isAtual && styles.timelineCircleAtual,
            ]}>
              <Text style={styles.timelineIcon}>{STATUS_ICONS[etapa.id] || '●'}</Text>
            </View>
            <Text style={[
              styles.timelineLabel,
              (isConcluido || isAtual) && styles.timelineLabelActive,
            ]}>
              {etapa.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default function EntregaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pagamentos, setPagamentos] = useState<FormaPagamento[]>([]);
  const [formaAtual, setFormaAtual] = useState<FormaPagamento['tipo']>('dinheiro');
  const [valorForma, setValorForma] = useState('');
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    const unsub = subscribePedidosDoMotoboy(user.uid, (pedidos) => {
      const p = pedidos.find(x => x.id === id);
      if (p) setPedido(p);
    });
    return unsub;
  }, [id, user]);

  const adicionarPagamento = () => {
    const valor = parseFloat(valorForma.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      Alert.alert('Erro', 'Digite um valor válido');
      return;
    }
    setPagamentos([...pagamentos, { tipo: formaAtual, valor }]);
    setValorForma('');
  };

  const removerPagamento = (i: number) =>
    setPagamentos(pagamentos.filter((_, idx) => idx !== i));

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const valorDoPedido = (pedido?.valorPedido || 0) + (pedido?.valorTotal || 0);
  const troco = totalPago - valorDoPedido;

  const atualizarStatus = async (novoStatus: Pedido['status'], formasPag?: typeof pagamentos, subStatus?: Pedido['subStatus'] | null, notificarCliente = true) => {
    if (!pedido) return;
    if (novoStatus === 'entregue') {
      if (pagamentos.length === 0) {
        Alert.alert('Sem pagamento', 'Registre como o cliente pagou antes de marcar como entregue.');
        return;
      }
      if (totalPago < valorDoPedido) {
        Alert.alert('Valor insuficiente', `Pago: R$ ${totalPago.toFixed(2).replace('.', ',')} | Total: R$ ${valorDoPedido.toFixed(2).replace('.', ',')}`);
        return;
      }
    }
    const clienteTelefone = pedido?.clienteTelefone;
    const clienteNome = pedido?.clienteNome;
    const comandaNumero = pedido?.comandaNumero;
    const valorPedido = pedido?.valorPedido || 0;
    const valorTotal = pedido?.valorTotal || 0;

    try {
      await atualizarStatusPedido(pedido.id, novoStatus, formasPag ?? (novoStatus === 'entregue' ? pagamentos : undefined), subStatus);
      // Envia WhatsApp automático pro cliente (exceto pra status pendente/cancelado)
      if (notificarCliente && novoStatus !== 'pendente' && novoStatus !== 'cancelado') {
        if (!clienteTelefone) {
          Alert.alert('Sem telefone', 'Pedido sem telefone do cliente cadastrado.');
          return;
        }
        await enviarMensagemStatus(novoStatus, clienteTelefone, clienteNome, comandaNumero, valorPedido, valorTotal);
      }
      if (novoStatus === 'entregue') {
        setPagamentos([]);
        Alert.alert('✅ Entrega concluída!', 'Pedido marcado como entregue.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar');
    }
  };

  const LOJA_LAT = -20.1974779;
  const LOJA_LON = -40.2591266;

  const enviarMensagemStatus = async (
    novoStatus: Pedido['status'],
    clienteTelefone?: string,
    clienteNome?: string,
    comandaNumero?: string,
    valorPedido?: number,
    valorTotal?: number
  ) => {
    if (!clienteTelefone) {
      Alert.alert('Erro', 'Pedido sem telefone do cliente');
      return;
    }
    const tel = clienteTelefone.replace(/\D/g, '');
    const mensagens: Record<string, string> = {
      saiu: `Olá! ${clienteNome}! Sou o entregador do seu pedido.\n\n⚠️A entrega é realizada apenas na porta, portaria ou guarita — não subo andares nem entro em estabelecimentos.⚠️\n\n⚠️Caso não consiga contato em 10 minutos, seguirei para as próximas entregas e seu pedido retornará para a loja.\n\nPor favor, esteja disponível ou avise alguém de confiança para retirar.\n\nObrigado pela atenção! Até já! 😊\n\n📦 STATUS: ENTREGADOR EM ROTA!`,
      a_caminho: `📦 Seu pedido está a caminho!\n\nO entregador está a caminho do seu endereço. Fique atento(a)! 😊\n\n📦 STATUS: A CAMINHO`,
      chegou: `📬 Seu pedido chegou! 🛵\n\nEntregador chegou no local da entrega!\n\n📦 STATUS: PEDIDO CHEGOU!`,
      entregue: `✅ Entrega realizada com sucesso! 🛵\n\nPedido #${comandaNumero} entregue.\n\nObrigado pela preferência! 😊`,
    };
    const msg = mensagens[novoStatus];
    if (msg) {
      const tel = clienteTelefone!.replace(/\D/g, '');
      const url = `whatsapp://send?phone=55${tel}&text=${encodeURIComponent(msg)}`;
      const urlFallback = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
      // Tenta primeiro whatsapp://send (iOS e alguns Android)
      try {
        await Linking.openURL(url);
      } catch {
        // Fallback universal: wa.me abre direto no WhatsApp em qualquer Android moderno
        try {
          await Linking.openURL(urlFallback);
        } catch {
          Alert.alert('Erro', 'Não foi possível abrir o WhatsApp');
        }
      }
    }
  };

  const abrirNavegacao = async (app: 'waze' | 'google') => {
    const end = (pedido?.clienteEndereco || '')
      .replace(/comanda\s*[#:]?\s*\d+/gi, '')
      .replace(/\bpedido\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const destino = /serra/i.test(end) ? end : `${end}, Serra, ES`;
    const destinoEnc = encodeURIComponent(destino);

    let url = '';
    if (app === 'waze') {
      url = `https://waze.com/ul?q=${destinoEnc}&navigate=yes`;
    } else {
      url = `https://www.google.com/maps/search/${destinoEnc}`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback: tenta intent nativo geo:
        const geoUrl = `geo:0,0?q=${destinoEnc}`;
        await Linking.openURL(geoUrl);
      }
    } catch {
      try {
        await Linking.openURL(`geo:0,0?q=${destinoEnc}`);
      } catch {}
    }
  };

  // Abre o Google Maps pesquisando o endereço (igual Waze/Google fazem)
  const abrirGoogleMapsPorEndereco = async () => {
    const end = pedido?.clienteEndereco || '';
    if (!end) {
      Alert.alert('Sem endereço', 'Este pedido não tem endereço.');
      return;
    }
    // Limpa "comanda N", "pedido N", etc.
    const endLimpo = end
      .replace(/comanda\s*[#:]?\s*\d+/gi, '')
      .replace(/\bpedido\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const destino = /serra/i.test(endLimpo) ? endLimpo : `${endLimpo}, Serra, ES`;
    const url = `geo:0,0?q=${encodeURIComponent(destino)}`;
    try {
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(destino)}`);
    }
    Alert.alert(
      '📋 Próximo passo',
      '1. Toque no pino correto no Google Maps\n' +
      '2. Toque em "Compartilhar"\n' +
      '3. Copie as coordenadas (ex: -20.198, -40.264)\n' +
      '4. Volte aqui e toque em "📋 Colar coordenadas"'
    );
  };

  const colarCoordenadas = async () => {
    try {
      const texto = await Clipboard.getString();
      const match = texto.match(/(-?\d{1,3}\.\d+)[,\s]\s*(-?\d{1,3}\.\d+)/);
      if (!match) {
        Alert.alert('Formato inválido', 'Copie no formato: -20.198, -40.264');
        return;
      }
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        Alert.alert('Coordenada inválida', `${lat}, ${lon} não parece válida.`);
        return;
      }
      // Atualiza as coordenadas no pedido
      if (pedido) {
        setPedido({ ...pedido, clienteLat: lat, clienteLon: lon });
      }
      Alert.alert('Pronto!', `Coords salvas: ${lat.toFixed(4)}, ${lon.toFixed(4)}. Agora toque em Waze ou Google Maps.`);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    }
  };

  // Liga pro cliente
  const ligarCliente = () => {
    if (!pedido?.clienteTelefone) {
      Alert.alert('Sem telefone', 'Este pedido não tem telefone do cliente.');
      return;
    }
    const tel = pedido.clienteTelefone.replace(/\D/g, '');
    Linking.openURL(`tel:${tel}`);
  };

  // Abre WhatsApp com o cliente
  const abrirWhatsApp = () => {
    if (!pedido?.clienteTelefone) {
      Alert.alert('Sem telefone', 'Este pedido não tem telefone do cliente.');
      return;
    }
    const tel = pedido.clienteTelefone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=55${tel}`);
  };

  // ── AUTO-COLETA: detecta quando volta do Google Maps e lê clipboard ──
  const esperandoColeta = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      // Quando volta do background (Google Maps), tenta ler clipboard
      if (state === 'active' && esperandoColeta.current) {
        esperandoColeta.current = false;
        try {
          const texto = await Clipboard.getString();
          const match = texto.match(/(-?\d{1,3}\.\d+)[,\s]\s*(-?\d{1,3}\.\d+)/);
          if (!match) return; // clipboard não tem coords
          const lat = parseFloat(match[1]);
          const lon = parseFloat(match[2]);
          if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
          // Atualiza as coordenadas no pedido
          if (pedido) {
            setPedido({ ...pedido, clienteLat: lat, clienteLon: lon });
          }
          Alert.alert(
            '📍 Localização salva!',
            `Coords ${lat.toFixed(4)}, ${lon.toFixed(4)} capturadas do Google Maps.\n\nAgora toque em Waze ou Google Maps pra navegar.`
          );
        } catch {}
      }
    });
    return () => sub.remove();
  }, [pedido]);

  const abrirGoogleMapsAuto = async () => {
    const end = pedido?.clienteEndereco || '';
    if (!end) {
      Alert.alert('Sem endereço', 'Este pedido não tem endereço.');
      return;
    }
    const endLimpo = end
      .replace(/comanda\s*[#:]?\s*\d+/gi, '')
      .replace(/\bpedido\s*\d+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const destino = /serra/i.test(endLimpo) ? endLimpo : `${endLimpo}, Serra, ES`;
    const url = `geo:0,0?q=${encodeURIComponent(destino)}`;
    esperandoColeta.current = true;
    try {
      await Linking.openURL(url);
    } catch {
      esperandoColeta.current = false;
      await Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(destino)}`);
    }
  };

  if (!pedido) return (
    <View style={[styles.loading, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.text }}>Carregando...</Text>
    </View>
  );

  const statusIndex = STATUS_FLOW.indexOf(pedido.status);
  const proximoStatus = STATUS_FLOW[statusIndex + 1];
  const isEntregue = pedido.status === 'entregue' || pedido.status === 'cancelado';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Timeline de status no topo */}
      {!isEntregue && <TimelineStatus statusAtual={pedido.status} />}

      {/* CARD: Cliente + Comanda + Status */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {/* Header com badge de comanda */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.comandaBig, { color: colors.accent }]}>#{pedido.comandaNumero}</Text>
            <Text style={[styles.clienteNome, { color: colors.text }]}>{pedido.clienteNome}</Text>
          </View>
          <View style={[styles.valorBadge, { backgroundColor: '#43A047' }]}>
            <Text style={styles.valorBadgeLabel}>Taxa</Text>
            <Text style={styles.valorBadgeValue}>R$ {(pedido.valorTotal || 0).toFixed(2).replace('.', ',')}</Text>
          </View>
        </View>

        {/* Chip de status moderno */}
        <View style={[styles.statusChipNew, { backgroundColor: STATUS_COLORS[pedido.status] + '20' }]}>
          <Text style={styles.statusChipIcon}>{STATUS_ICONS[pedido.status] || '●'}</Text>
          <Text style={[styles.statusChipText, { color: STATUS_COLORS[pedido.status] }]}>
            {STATUS_LABELS[pedido.status]}
          </Text>
        </View>

        {/* Sub-status visível */}
        {pedido.status === 'cheguei' && (
          <View style={styles.subStatusBanner}>
            <View style={[styles.subStatusDot, { backgroundColor: STATUS_COLORS[pedido.subStatus!] }]} />
            <Text style={[styles.subStatusText, { color: STATUS_COLORS[pedido.subStatus!] }]}>
              {STATUS_LABELS[pedido.subStatus!]}
            </Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: colors.divider }]} />

        <Text style={[styles.subText, { color: colors.textSubtle }]}>📍 {pedido.clienteEndereco}</Text>
        <Text style={[styles.subText, { color: colors.textSubtle }]}>📞 {pedido.clienteTelefone}</Text>
        {pedido.clienteReferencia ? (
          <Text style={[styles.subText, { color: colors.textSubtle }]}>
            📌 <Text style={{ fontWeight: '700' }}>Referência:</Text> {pedido.clienteReferencia}
          </Text>
        ) : null}

        {/* Botões de contato */}
        <View style={styles.contatoRow}>
          <TouchableOpacity
            style={[styles.contatoBtn, { backgroundColor: '#25D366' }]}
            onPress={abrirWhatsApp}
          >
            <Text style={styles.contatoBtnIcon}>💬</Text>
            <Text style={styles.contatoBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contatoBtn, { backgroundColor: '#1976D2' }]}
            onPress={ligarCliente}
          >
            <Text style={styles.contatoBtnIcon}>📞</Text>
            <Text style={styles.contatoBtnText}>Ligar</Text>
          </TouchableOpacity>
        </View>

        {!isEntregue && (
          <TouchableOpacity
            style={[styles.navBtnSingle, { backgroundColor: '#4285F4' }]}
            onPress={() => setNavMenuOpen(true)}
          >
            <Text style={styles.navBtnIcon}>🧭</Text>
            <Text style={styles.navBtnText}>Navegar até o cliente</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal de escolha do app de mapa */}
      <Modal visible={navMenuOpen} transparent animationType="fade" onRequestClose={() => setNavMenuOpen(false)}>
        <Pressable style={styles.navMenuBg} onPress={() => setNavMenuOpen(false)}>
          <View style={[styles.navMenuCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.navMenuTitle, { color: colors.text }]}>Abrir com</Text>
            <TouchableOpacity
              style={[styles.navMenuBtn, { backgroundColor: '#33CCFF' }]}
              onPress={() => { setNavMenuOpen(false); abrirNavegacao('waze'); }}
            >
              <Text style={styles.navMenuBtnText}>🧭 Waze</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navMenuBtn, { backgroundColor: '#4285F4' }]}
              onPress={() => { setNavMenuOpen(false); abrirNavegacao('google'); }}
            >
              <Text style={styles.navMenuBtnText}>🗺️ Google Maps</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* CARD 4: Valores (só quando entregue) */}
      {pedido.status === 'entregue' && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>💰 Valor do Pedido (cliente)</Text>
          <Text style={[styles.valor, { color: colors.text }]}>
            R$ {((pedido.valorPedido || 0) + (pedido.valorTotal || 0)).toFixed(2).replace('.', ',')}
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>💵 Taxa de Entrega (você recebe)</Text>
          <Text style={[styles.valor, { color: '#43A047' }]}>
            R$ {(pedido.valorTotal || 0).toFixed(2).replace('.', ',')}
          </Text>
        </View>
      )}

      {/* CARD 5: Foto da comanda */}
      {pedido.fotoComanda && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>📸 Comanda</Text>
          <TouchableOpacity onPress={() => setFotoZoom(pedido.fotoComanda!)}>
            <Image source={{ uri: pedido.fotoComanda }} style={styles.fotoComanda} resizeMode="cover" />
            <Text style={[styles.fotoHint, { color: colors.textSubtle }]}>Toque pra ampliar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Registrar pagamento (só aparece no sub-status "cobrando") */}
      {!isEntregue && pedido.status === 'cheguei' && pedido.subStatus === 'cobrando' && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>💳 Registrar Pagamento</Text>
          <View style={styles.formaRow}>
            {FORMAS_PAGAMENTO.map((fp) => (
              <TouchableOpacity
                key={fp.value}
                style={[
                  styles.formaBtn,
                  { borderColor: colors.border },
                  formaAtual === fp.value && { backgroundColor: colors.accent, borderColor: colors.accent }
                ]}
                onPress={() => setFormaAtual(fp.value as FormaPagamento['tipo'])}
              >
                <Text style={[
                  styles.formaText,
                  { color: formaAtual === fp.value ? '#FFF' : colors.text }
                ]}>
                  {fp.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.pagamentoRow}>
            <TextInput
              label="Valor (R$)"
              value={valorForma}
              onChangeText={setValorForma}
              keyboardType="decimal-pad"
              mode="outlined"
              style={[styles.valorInput, { backgroundColor: colors.bg }]}
              textColor={colors.text}
              outlineColor={colors.border}
              activeOutlineColor={colors.accent}
              placeholder={valorDoPedido.toFixed(2).replace('.', ',')}
            />
            <Button
              mode="contained"
              onPress={adicionarPagamento}
              style={[styles.addBtn, { backgroundColor: colors.accent }]}
            >
              +
            </Button>
          </View>

          {pagamentos.map((p, i) => (
            <View key={i} style={[styles.pagamentoItem, { borderBottomColor: colors.divider }]}>
              <Text style={{ color: colors.text }}>
                {FORMAS_PAGAMENTO.find(f => f.value === p.tipo)?.label}: R$ {p.valor.toFixed(2).replace('.', ',')}
              </Text>
              <Button compact onPress={() => removerPagamento(i)} textColor="#E53935">✕</Button>
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={[styles.resumo, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={{ color: colors.text }}>Valor do pedido: R$ {valorDoPedido.toFixed(2).replace('.', ',')}</Text>
            <Text style={{ color: colors.text }}>Pago: R$ {totalPago.toFixed(2).replace('.', ',')}</Text>
            {troco > 0 && (
              <Text style={[styles.troco, { color: '#43A047' }]}>Troco: R$ {troco.toFixed(2).replace('.', ',')}</Text>
            )}
          </View>
        </View>
      )}

      {/* Pagamento registrado */}
      {isEntregue && pedido.formasPagamento.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>💳 Forma de Pagamento</Text>
          {pedido.formasPagamento.map((p, i) => {
            const nomeForma = p.tipo === 'dinheiro' ? 'Dinheiro' : p.tipo === 'pix' ? 'PIX' : p.tipo === 'cartao_credito' ? 'Cartão Crédito' : 'Cartão Débito';
            const icone = p.tipo === 'dinheiro' ? '💵' : p.tipo === 'pix' ? '📱' : '💳';
            return (
              <View key={i} style={[styles.pagRow, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.pagNome, { color: colors.text }]}>
                  {icone} {nomeForma}
                </Text>
                <Text style={[styles.pagValor, { color: '#43A047' }]}>
                  R$ {p.valor.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Botão Avançar FIXO na parte inferior (estilo iFood) */}
      {!isEntregue && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={styles.fixedButton}
            onPress={() => {
              // Status principal
              if (pedido.status === 'pendente') {
                atualizarStatus('saiu');
              } else if (pedido.status === 'saiu') {
                atualizarStatus('a_caminho');
              } else if (pedido.status === 'a_caminho') {
                atualizarStatus('cheguei');
              }
              // Sub-status quando CHEGOU
              else if (pedido.status === 'cheguei' && !pedido.subStatus) {
                atualizarStatus('cheguei', undefined, 'contatando');
              } else if (pedido.status === 'cheguei' && pedido.subStatus === 'contatando') {
                atualizarStatus('cheguei', undefined, 'contato_ok');
              } else if (pedido.status === 'cheguei' && pedido.subStatus === 'contato_ok') {
                atualizarStatus('cheguei', undefined, 'cobrando');
              } else if (pedido.status === 'cheguei' && pedido.subStatus === 'cobrando') {
                atualizarStatus('entregue', pagamentos, null);
              }
            }}
          >
            <Text style={styles.fixedButtonText}>▶️ Avançar</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.voltarBtn} onPress={() => router.back()}>
        <Text style={[styles.voltarText, { color: colors.accent }]}>← Voltar</Text>
      </TouchableOpacity>

      <Modal visible={!!fotoZoom} transparent animationType="fade" onRequestClose={() => setFotoZoom(null)}>
        <Pressable style={styles.zoomBg} onPress={() => setFotoZoom(null)}>
          {fotoZoom && <Image source={{ uri: fotoZoom }} style={styles.zoomImg} resizeMode="contain" />}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { margin: 16, marginTop: 0, borderRadius: 16, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subStatusContainer: { marginTop: 8, padding: 8, backgroundColor: '#F5F5F5', borderRadius: 8 },
  subStatusLabel: { fontSize: 13, fontWeight: '600' },
  comanda: { fontSize: 16, fontWeight: '700' },
  // Novo card header
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { flex: 1 },
  comandaBig: { fontSize: 28, fontWeight: '900' },
  clienteNome: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  valorBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  valorBadgeLabel: { fontSize: 10, color: '#FFF', opacity: 0.9 },
  valorBadgeValue: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  // Chip de status moderno
  statusChipNew: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12 },
  statusChipIcon: { fontSize: 14, marginRight: 6 },
  statusChipText: { fontSize: 13, fontWeight: '700' },
  // Sub-status banner
  subStatusBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F5F5F5', borderRadius: 10, gap: 10 },
  subStatusDot: { width: 8, height: 8, borderRadius: 4 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  divider: { height: 1, marginVertical: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  subText: { fontSize: 14, marginTop: 4 },
  valor: { fontSize: 28, fontWeight: '900' },
  // Timeline de status
  timeline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 8, paddingVertical: 16, marginHorizontal: 16 },
  timelineStep: { alignItems: 'center', flex: 1 },
  timelineLine: { position: 'absolute', top: 16, right: '50%', width: '100%', height: 3, backgroundColor: '#E0E0E0', zIndex: -1 },
  timelineLineActive: { backgroundColor: '#43A047' },
  timelineCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  timelineCircleActive: { backgroundColor: '#43A047' },
  timelineCircleAtual: { backgroundColor: '#FF6B00', borderWidth: 3, borderColor: '#FFE0B2' },
  timelineIcon: { fontSize: 14 },
  timelineLabel: { fontSize: 10, color: '#888', marginTop: 4, textAlign: 'center' },
  timelineLabelActive: { color: '#333' },
  // Botão fixo na parte inferior
  fixedButtonContainer: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 32 },
  fixedButton: { backgroundColor: '#43A047', paddingVertical: 18, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  fixedButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  subStatusBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginVertical: 4 },
  subStatusText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  formaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  formaBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  formaText: { fontSize: 13, fontWeight: '600' },
  pagamentoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valorInput: { flex: 1 },
  addBtn: { height: 48, justifyContent: 'center' },
  pagamentoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  resumo: { padding: 12, borderRadius: 8, gap: 4 },
  troco: { fontWeight: '700', marginTop: 4 },
  pagamentos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pagChipText: { fontSize: 13, fontWeight: '600' },
  pagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  pagNome: { fontSize: 16, fontWeight: '600' },
  pagValor: { fontSize: 16, fontWeight: '700' },
  actions: { padding: 16, gap: 12 },
  btn: { paddingVertical: 8, borderRadius: 12 },
  cancelBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  voltarBtn: { alignItems: 'center', paddingBottom: 32 },
  voltarText: { fontSize: 16, fontWeight: '600' },
  fotoComanda: { width: '100%', height: 80, borderRadius: 12 },
  fotoHint: { fontSize:  12, textAlign: 'center', marginTop: 8 },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomImg: { width: '95%', height: '90%' },
  navBtnSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  navMenuBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  navMenuCard: { padding: 24, borderRadius: 16, gap: 12, minWidth: 260 },
  navMenuTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  navMenuBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  navMenuBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
  navNoCoords: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  contatoRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contatoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  contatoBtnIcon: { fontSize: 18 },
  contatoBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
