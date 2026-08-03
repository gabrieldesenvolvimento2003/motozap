# Plano 003: Sincronizar pedidos do Firestore para o app

## Contexto

A screenshot mostra o app com o pedido `#60071279` (8 dígitos = Pedido Yooga). Esse pedido foi criado no Firestore pelo print-monitor da loja e apareceu no app do motoboy. Mas o motoboy clica "Avançar" e dá "Falha ao atualizar" porque o app não tem código Firebase/sync — só lê do SQLite local.

## Diagnóstico

- `lib/services/` **NÃO tem** `firebase_service.dart` (apesar de marcado como completed)
- `DatabaseService.updateOrderStatus` faz UPDATE WHERE id = ? — se ID não existe, retorna 0 sem erro
- Por isso o toast "Falha ao atualizar" é provavelmente do **WhatsAppService.send** que falha (não tem o telefone do cliente pra mandar mensagem)

## Por que isso importa

O fluxo atual da ferramenta Yooga → ESO monitor → Firestore → painel funciona. Mas o motoboy no celular não consegue gerenciar esses pedidos porque o app deles não sincroniza. Resultado: **só a loja visualiza, motoboy continua no escuro**.

## Solução

**Sincronização unidirecional Firestore → SQLite:**

1. Criar `FirebaseService` que faz GET em `/orders` (com API key)
2. Criar `FirestoreSync` que roda a cada 30s em background
3. Converte cada doc do Firestore pra `DeliveryOrder` e salva local
4. Quando o motoboy muda status no app, atualiza SQLite E também faz PATCH no Firestore

## Arquivos a modificar

- `motozap/lib/services/firebase_service.dart` (novo) — wrapper REST API
- `motozap/lib/services/database_service.dart` — adicionar `upsertOrder()` que insere ou atualiza
- `motozap/lib/main.dart` — inicializar sync no startup
- `motozap/pubspec.yaml` — adicionar `http` dependency

## Implementação

### Step 1: FirebaseService (REST API)

```dart
// lib/services/firebase_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class FirebaseService {
  static const PROJECT_ID = 'motozap-cc78b';
  static const API_KEY = 'AIzaSyAGczElpREFXvh6axmy7aT1xm5tOJpTsM4';
  static const BASE = 'https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents';

  static Future<List<Map<String, dynamic>>> listOrders() async {
    final url = Uri.parse('$BASE/orders?key=$API_KEY&pageSize=20&orderBy=created_at%20desc');
    final res = await http.get(url).timeout(Duration(seconds: 10));
    if (res.statusCode != 200) throw Exception('Firestore ${res.statusCode}');
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final docs = (data['documents'] as List?) ?? [];
    return docs.map((d) => _parseDoc(d as Map<String, dynamic>)).toList();
  }

  static Future<void> updateOrderStatus(String docId, String status) async {
    final url = Uri.parse('$BASE/orders/$docId?key=$API_KEY');
    await http.patch(url, headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'fields': {
          'status': {'stringValue': status},
          'updated_at': {'timestampValue': DateTime.now().toIso8601String()},
        }
      })
    ).timeout(Duration(seconds: 10));
  }

  static Map<String, dynamic> _parseDoc(Map<String, dynamic> doc) {
    final fields = doc['fields'] as Map<String, dynamic>;
    String s(String k) => (fields[k]?['stringValue'] ?? '').toString();
    double d(String k) => (fields[k]?['doubleValue'] ?? 0).toDouble();
    String docId = (doc['name'] as String).split('/').last;
    return {
      'id': docId,
      'order_number': s('order_number'),
      'customer_name': s('customer_name'),
      'customer_phone': s('customer_phone'),
      'address': s('address'),
      'amount': d('amount'),
      'payment_method': s('payment_method'),
      'status': s('status').isEmpty ? 'pending' : s('status'),
      'created_at': fields['created_at']?['timestampValue'] ?? DateTime.now().toIso8601String(),
    };
  }
}
```

### Step 2: upsertOrder no DatabaseService

```dart
Future<void> upsertOrder(DeliveryOrder o) async {
  final db = await database;
  await db.insert(
    'orders',
    o.toMap(),
    conflictAlgorithm: ConflictAlgorithm.replace,
  );
}
```

### Step 3: Sync no main.dart

```dart
Future<void> _syncFirestore() async {
  try {
    final docs = await FirebaseService.listOrders();
    final db = DatabaseService();
    for (final d in docs) {
      final order = DeliveryOrder(
        id: d['id'],
        orderNumber: d['order_number'],
        customerName: d['customer_name'],
        customerPhone: d['customer_phone'],
        address: d['address'],
        amount: d['amount'],
        paymentMethod: d['payment_method'],
        alreadyPaid: false,
        createdAt: DateTime.parse(d['created_at']),
        status: d['status'],
      );
      await db.upsertOrder(order);
    }
  } catch (e) {
    debugPrint('Sync failed: $e');
  }
}

// No WidgetsFlutterBinding.ensureInitialized():
Timer.periodic(Duration(seconds: 30), (_) => _syncFirestore());
```

### Step 4: Patch bidirecional em order_detail_screen

```dart
// No final de _advanceStatus, depois do _db.updateOrderStatus:
await FirebaseService.updateOrderStatus(_order!.id, next);
```

## Verificação

- [ ] Sync roda a cada 30s
- [ ] Pedido novo no Firestore aparece no app em <1min
- [ ] Avançar status no app atualiza Firestore
- [ ] Recarregar painel mostra o novo status

## Esforço

**S** (~1h) — só REST API, sem Firebase SDK.
