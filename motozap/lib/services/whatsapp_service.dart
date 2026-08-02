import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

class WhatsappService {
  String? _phone;
  String? _driverName;

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _phone = prefs.getString('whatsapp');
    _driverName = prefs.getString('driver_name');
  }

  String _buildMessage({
    required String orderNumber,
    required String customerName,
    required String address,
    required String statusLabel,
    required bool alreadyPaid,
    required String note,
  }) {
    final emoji = _emojiFor(statusLabel);
    final paymentInfo = alreadyPaid ? '✅ Já pago' : '💰 Cobrar do cliente';
    final driverInfo = (_driverName != null && _driverName!.isNotEmpty)
        ? 'Motoboy: $_driverName\n'
        : '';
    final noteInfo = note.isNotEmpty ? '\n📝 Obs: $note' : '';
    return '''$emoji *$statusLabel*
Pedido #$orderNumber
$driverInfo$customerName
📍 $address
$paymentInfo$noteInfo''';
  }

  String _emojiFor(String label) {
    if (label.contains('Iniciada')) return '🚀';
    if (label.contains('caminho')) return '🛵';
    if (label.contains('Chegou')) return '📍';
    if (label.contains('contato')) return '📞';
    if (label.contains('Contato')) return '✅';
    if (label.contains('buscando')) return '🏃';
    if (label.contains('Cobrando')) return '💰';
    if (label.contains('entregue')) return '✓';
    if (label.contains('finalizada')) return '🏁';
    return '📋';
  }

  /// Tenta enviar a mensagem. Retorna true se o WhatsApp foi aberto com sucesso.
  Future<bool> send({
    required String orderNumber,
    required String customerName,
    required String address,
    required String statusLabel,
    required bool alreadyPaid,
    String note = '',
  }) async {
    await _load();
    if (_phone == null || _phone!.isEmpty) return false;
    final rawPhone = _phone!.replaceAll(RegExp(r'\D'), '');
    final phone = (rawPhone.length <= 11) ? '55$rawPhone' : rawPhone;
    final msg = _buildMessage(
      orderNumber: orderNumber,
      customerName: customerName,
      address: address,
      statusLabel: statusLabel,
      alreadyPaid: alreadyPaid,
      note: note,
    );
    final uri = Uri.parse(
      'https://wa.me/$phone?text=${Uri.encodeComponent(msg)}',
    );
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class ConnectivityMonitor {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _sub;

  /// Retorna true se há internet.
  Future<bool> isOnline() async {
    final results = await _connectivity.checkConnectivity();
    return results.any((e) => e != ConnectivityResult.none);
  }

  /// Escuta mudanças. Callback é chamado com [true] quando volta online.
  void listen(void Function(bool online) onChange) {
    _sub = _connectivity.onConnectivityChanged.listen((results) {
      onChange(results.any((e) => e != ConnectivityResult.none));
    });
  }

  void dispose() => _sub?.cancel();
}