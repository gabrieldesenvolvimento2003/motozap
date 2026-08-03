import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// Wrapper REST API do Firestore para o app do motoboy.
/// Sincroniza pedidos criados pelo print-monitor da loja.
class FirebaseService {
  static const PROJECT_ID = 'motozap-cc78b';
  static const API_KEY = 'AIzaSyAGczElpREFXvh6axmy7aT1xm5tOJpTsM4';
  static const BASE = 'https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents';

  /// Lista pedidos pendentes (status != route_finished), ordenados do mais novo.
  static Future<List<Map<String, dynamic>>> listPendingOrders() async {
    final url = Uri.parse(
      '$BASE/orders?key=$API_KEY&pageSize=30&orderBy=created_at%20desc',
    );
    final res = await http.get(url).timeout(const Duration(seconds: 10));
    if (res.statusCode != 200) {
      throw Exception('Firestore list ${res.statusCode}: ${res.body.substring(0, res.body.length.clamp(0, 200))}');
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final docs = (data['documents'] as List?) ?? [];
    return docs.map((d) => _parseDoc(d as Map<String, dynamic>)).toList();
  }

  /// Atualiza o status de um pedido no Firestore.
  static Future<void> updateOrderStatus(String docId, String status) async {
    final url = Uri.parse('$BASE/orders/$docId?key=$API_KEY');
    final body = jsonEncode({
      'fields': {
        'status': {'stringValue': status},
        'updated_at': {'timestampValue': DateTime.now().toIso8601String()},
      },
    });
    final res = await http.patch(
      url,
      headers: {'Content-Type': 'application/json'},
      body: body,
    ).timeout(const Duration(seconds: 10));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Firestore update ${res.statusCode}: ${res.body.substring(0, res.body.length.clamp(0, 200))}');
    }
  }

  static Map<String, dynamic> _parseDoc(Map<String, dynamic> doc) {
    final fields = doc['fields'] as Map<String, dynamic>? ?? {};
    String s(String k) => (fields[k]?['stringValue'] ?? '').toString().trim();
    double d(String k) {
      final v = fields[k];
      if (v == null) return 0;
      if (v['doubleValue'] != null) return (v['doubleValue'] as num).toDouble();
      if (v['integerValue'] != null) return (v['integerValue'] as num).toDouble();
      return 0;
    }
    String ts(String k) {
      final raw = fields[k]?['timestampValue'] ?? fields[k]?['stringValue'];
      return (raw ?? DateTime.now().toIso8601String()).toString();
    }
    final docId = (doc['name'] as String).split('/').last;
    return {
      'id': docId,
      'order_number': s('order_number'),
      'customer_name': s('customer_name'),
      'customer_phone': s('customer_phone'),
      'address': s('address'),
      'complement': s('complement'),
      'neighborhood': s('neighborhood'),
      'reference': s('reference'),
      'payment_method': s('payment_method'),
      'amount': d('amount'),
      'delivery_fee': d('delivery_fee'),
      'discount': d('discount'),
      'cashback': d('cashback'),
      'change_for': s('change_for'),
      'items_summary': s('items_summary'),
      'observation': s('observation'),
      'order_date_time': s('order_date_time'),
      'manual_annotation': s('manual_annotation'),
      'status': s('status').isEmpty ? 'pending' : s('status'),
      'created_at': ts('created_at'),
    };
  }

  /// Faz sync em background. Roda a cada 30s.
  static Timer startPeriodicSync({
    required Future<void> Function(List<Map<String, dynamic>>) onOrders,
    Duration interval = const Duration(seconds: 30),
  }) {
    Future<void> tick() async {
      try {
        final orders = await listPendingOrders();
        await onOrders(orders);
      } catch (e) {
        // Silencioso — sync é best-effort
      }
    }
    // Roda imediatamente depois a cada X
    tick();
    return Timer.periodic(interval, (_) => tick());
  }
}
