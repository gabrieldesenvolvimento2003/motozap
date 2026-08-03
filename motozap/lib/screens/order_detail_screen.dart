import 'dart:io';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/delivery_order.dart';
import '../services/database_service.dart';
import '../services/whatsapp_service.dart';
import '../services/firebase_service.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final DatabaseService _db = DatabaseService();
  final WhatsappService _whatsapp = WhatsappService();
  final ConnectivityMonitor _conn = ConnectivityMonitor();
  DeliveryOrder? _order;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
    _conn.listen(_onConnChange);
  }

  void _onConnChange(bool online) {
    if (online) {
      _flushPending();
    }
  }

  Future<void> _flushPending() async {
    final pending = await _db.listPendingMessages();
    if (pending.isEmpty) return;
    int sent = 0;
    for (final m in pending) {
      final orders = await _db.listPendingOrders();
      final o = orders.firstWhere(
        (o) => o.id == m['order_id'],
        orElse: () => DeliveryOrder(
          id: '', orderNumber: '', customerName: '', customerPhone: '',
          address: '', amount: 0, alreadyPaid: false, createdAt: DateTime.now(),
        ),
      );
      if (o.id.isEmpty) continue;
      final ok = await _whatsapp.send(
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        address: o.address,
        statusLabel: m['status'] as String,
        alreadyPaid: o.alreadyPaid,
        note: (m['note'] as String?) ?? '',
      );
      if (ok) {
        await _db.markMessageDelivered(m['id'] as int);
        sent++;
      }
    }
    if (sent > 0 && mounted) {
      _showToast('$sent mensagem(ns) enviada(s)!', false);
    }
  }

  Future<void> _load() async {
    final list = await _db.listPendingOrders();
    setState(() {
      _order = list.firstWhere(
        (o) => o.id == widget.orderId,
        orElse: () => DeliveryOrder(
          id: '', orderNumber: '', customerName: '', customerPhone: '',
          address: '', amount: 0, alreadyPaid: false, createdAt: DateTime.now(),
        ),
      );
      if (_order!.id.isEmpty) _order = null;
    });
  }

  void _showToast(String msg, bool isError) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? Colors.red : const Color(0xFFFF6B00),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _advanceStatus() async {
    if (_order == null) return;
    final next = nextStatus(_order!.status);
    if (next == _order!.status) return;
    setState(() => _sending = true);

    final note = next == 'delivered' ? await _askNote() : '';

    final ok = await _whatsapp.send(
      orderNumber: _order!.orderNumber,
      customerName: _order!.customerName,
      address: _order!.address,
      statusLabel: kStatusLabels[next] ?? next,
      alreadyPaid: _order!.alreadyPaid,
      note: note ?? '',
    );

    if (ok) {
      await _db.updateOrderStatus(_order!.id, next);
      _showToast('Mensagem enviada!', false);
    } else {
      await _db.queueMessage(
        _order!.id,
        kStatusLabels[next] ?? next,
        note ?? '',
      );
      await _db.updateOrderStatus(_order!.id, next);
      _showToast('Sem internet — mensagem será enviada depois', true);
    }

    // Sync status back to Firestore (best-effort)
    try {
      await FirebaseService.updateOrderStatus(_order!.id, next);
    } catch (_) {}

    await _load();
    setState(() => _sending = false);

    if (next == 'route_finished' && mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<String?> _askNote() async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Observação (opcional)'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Ex: Cliente pediu pra deixar na portaria',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, ''),
            child: const Text('PULAR'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF6B00)),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _openMaps() async {
    if (_order == null) return;
    final query = Uri.encodeComponent(_order!.address);
    // Tenta primeiro o esquema nativo do Google Maps (direções)
    final geoUri = Uri.parse('google.navigation:q=$query&mode=d');
    if (await canLaunchUrl(geoUri)) {
      await launchUrl(geoUri, mode: LaunchMode.externalApplication);
    } else {
      // Fallback: web Maps com direções
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=$query&travelmode=driving',
      );
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _call() async {
    if (_order == null || _order!.customerPhone.isEmpty) return;
    final uri = Uri.parse('tel:${_order!.customerPhone.replaceAll(RegExp(r'\D'), '')}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  void _whatsappCustomer() async {
    if (_order == null || _order!.customerPhone.isEmpty) return;
    final phone = _order!.customerPhone.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/55$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _showPhotoZoom(BuildContext context, String path) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.zero,
        child: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: InteractiveViewer(
            child: Image.file(
              File(path),
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _conn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_order == null) {
      return const Scaffold(
        body: Center(child: Text('Pedido não encontrado')),
      );
    }

    final next = nextStatus(_order!.status);
    final canAdvance = next != _order!.status;
    final statusLabel = kStatusLabels[_order!.status] ?? _order!.status;
    final emoji = kStatusEmojis[_order!.status] ?? '📋';
    final nextLabel = kStatusLabels[next] ?? next;

    return Scaffold(
      appBar: AppBar(
        title: Text('Pedido #${_order!.orderNumber}'),
        backgroundColor: const Color(0xFFFF6B00),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 48)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Status atual',
                          style: TextStyle(fontSize: 14, color: Colors.black54),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          statusLabel,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_order!.photoPath.isNotEmpty) ...[
              const SizedBox(height: 16),
              GestureDetector(
                onTap: () => _showPhotoZoom(context, _order!.photoPath),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(
                    File(_order!.photoPath),
                    height: 220,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 80,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text('📷 Foto da comanda'),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              const Center(
                child: Text(
                  'Toque na foto para ampliar',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ),
            ],
            const SizedBox(height: 24),
            const Text(
              'Cliente',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(_order!.customerName, style: const TextStyle(fontSize: 18)),
            if (_order!.customerPhone.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(_order!.customerPhone, style: const TextStyle(fontSize: 16, color: Colors.black54)),
            ],
            if (_order!.scheduledFor.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFE3F2FD),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.schedule, size: 18, color: Color(0xFF1976D2)),
                    const SizedBox(width: 6),
                    Text(
                      'Agendado: ${_order!.scheduledFor}',
                      style: const TextStyle(fontSize: 16, color: Color(0xFF1976D2), fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            const Text(
              'Endereço',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(_order!.address, style: const TextStyle(fontSize: 18)),
            if (_order!.complement.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                _order!.complement,
                style: const TextStyle(fontSize: 16, color: Colors.black54),
              ),
            ],
            if (_order!.neighborhood.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_city, size: 18, color: Colors.black54),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _order!.neighborhood,
                      style: const TextStyle(fontSize: 16, color: Colors.black54),
                    ),
                  ),
                ],
              ),
            ],
            if (_order!.reference.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.place, size: 20, color: Colors.black54),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Ponto de ref.: ${_order!.reference}',
                      style: const TextStyle(fontSize: 16, color: Colors.black54),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _openMaps,
                    icon: const Icon(Icons.map),
                    label: const Text('Google Maps'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFFF6B00),
                      side: const BorderSide(color: Color(0xFFFF6B00), width: 2),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_order!.customerPhone.isNotEmpty)
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _call,
                      icon: const Icon(Icons.call),
                      label: const Text('Ligar'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFFF6B00),
                        side: const BorderSide(color: Color(0xFFFF6B00), width: 2),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _whatsappCustomer,
                      icon: const Icon(Icons.chat),
                      label: const Text('WhatsApp'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFFF6B00),
                        side: const BorderSide(color: Color(0xFFFF6B00), width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _order!.alreadyPaid ? Icons.check_circle : Icons.payments,
                        color: _order!.alreadyPaid ? Colors.green : Colors.amber.shade800,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _order!.alreadyPaid ? 'Cliente já pagou' : 'Cobrar do cliente na entrega',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  if (_order!.amount > 0 || _order!.paymentMethod.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 8),
                    if (_order!.amount > 0)
                      Row(
                        children: [
                          const Icon(Icons.attach_money, size: 20, color: Color(0xFFFF6B00)),
                          const SizedBox(width: 8),
                          Text(
                            'Total: R\$ ${_order!.amount.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    if (_order!.paymentMethod.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.credit_card, size: 20, color: Color(0xFFFF6B00)),
                          const SizedBox(width: 8),
                          Text(
                            'Pagar com: ${_order!.paymentMethod}',
                            style: const TextStyle(fontSize: 16),
                          ),
                        ],
                      ),
                    ],
                    if (_order!.deliveryFee > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.delivery_dining, size: 20, color: Color(0xFFFF6B00)),
                          const SizedBox(width: 8),
                          Text(
                            'Taxa entrega: R\$ ${_order!.deliveryFee.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(fontSize: 16),
                          ),
                        ],
                      ),
                    ],
                    if (_order!.changeFor.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.attach_money, size: 20, color: Colors.green),
                          const SizedBox(width: 8),
                          Text(
                            'Troco para: ${_order!.changeFor}',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.green),
                          ),
                        ],
                      ),
                    ],
                    if (_order!.discount > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.discount, size: 20, color: Colors.blue),
                          const SizedBox(width: 8),
                          Text(
                            'Desconto: R\$ ${_order!.discount.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(fontSize: 16, color: Colors.blue),
                          ),
                        ],
                      ),
                    ],
                    if (_order!.cashback > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.redeem, size: 20, color: Colors.purple),
                          const SizedBox(width: 8),
                          Text(
                            'Cashback: R\$ ${_order!.cashback.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(fontSize: 16, color: Colors.purple),
                          ),
                        ],
                      ),
                    ],
                  ],
                ],
              ),
            ),
            if (_order!.itemsSummary.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.shopping_basket, size: 22, color: Color(0xFFFF6B00)),
                        const SizedBox(width: 8),
                        Text(
                          _order!.itemCount > 0
                              ? 'Itens (${_order!.itemCount})'
                              : 'Itens',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(_order!.itemsSummary, style: const TextStyle(fontSize: 16)),
                  ],
                ),
              ),
            ],
            if (_order!.observation.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.warning_amber, size: 22, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _order!.observation,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_order!.manualAnnotation.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.edit_note, size: 22, color: Colors.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _order!.manualAnnotation,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_order!.orderDateTime.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 18, color: Colors.black54),
                  const SizedBox(width: 6),
                  Text(
                    'Pedido feito: ${_order!.orderDateTime}',
                    style: const TextStyle(fontSize: 14, color: Colors.black54),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 24),
            if (canAdvance)
              SizedBox(
                height: 80,
                child: ElevatedButton(
                  onPressed: _sending ? null : _advanceStatus,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF6B00),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _sending
                      ? const SizedBox(
                          width: 28, height: 28,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                        )
                      : Text(
                          'AVANÇAR → $nextLabel',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                ),
              ),
            if (!canAdvance)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green),
                    SizedBox(width: 12),
                    Text('Pedido finalizado', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}