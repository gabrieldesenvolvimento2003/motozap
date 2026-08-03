import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models/delivery_order.dart';
import 'services/database_service.dart';
import 'services/firebase_service.dart';
import 'screens/setup_screen.dart';
import 'screens/main_scaffold.dart';

void main() {
  runApp(const MotoZapApp());
}

class MotoZapApp extends StatelessWidget {
  const MotoZapApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MotoZap',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFF6B00),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const _Root(),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool? _configured;
  Timer? _syncTimer;

  @override
  void initState() {
    super.initState();
    _checkConfig();
    _startSync();
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final whatsapp = prefs.getString('whatsapp');
    setState(() {
      _configured = whatsapp != null && whatsapp.isNotEmpty;
    });
  }

  void _startSync() {
    _syncTimer = FirebaseService.startPeriodicSync(
      onOrders: _syncOrders,
    );
  }

  Future<void> _syncOrders(List<Map<String, dynamic>> orders) async {
    final db = DatabaseService();
    for (final d in orders) {
      final order = DeliveryOrder(
        id: d['id'] as String,
        orderNumber: (d['order_number'] ?? '') as String,
        customerName: (d['customer_name'] ?? '') as String,
        customerPhone: (d['customer_phone'] ?? '') as String,
        address: (d['address'] ?? '') as String,
        complement: (d['complement'] ?? '') as String,
        neighborhood: (d['neighborhood'] ?? '') as String,
        reference: (d['reference'] ?? '') as String,
        paymentMethod: (d['payment_method'] ?? '') as String,
        amount: (d['amount'] as num?)?.toDouble() ?? 0,
        alreadyPaid: false,
        createdAt: DateTime.tryParse(d['created_at'] ?? '') ?? DateTime.now(),
        status: (d['status'] ?? 'pending') as String,
        deliveryFee: (d['delivery_fee'] as num?)?.toDouble() ?? 0,
        discount: (d['discount'] as num?)?.toDouble() ?? 0,
        cashback: (d['cashback'] as num?)?.toDouble() ?? 0,
        changeFor: (d['change_for'] ?? '') as String,
        itemsSummary: (d['items_summary'] ?? '') as String,
        observation: (d['observation'] ?? '') as String,
        orderDateTime: (d['order_date_time'] ?? '') as String,
        manualAnnotation: (d['manual_annotation'] ?? '') as String,
      );
      await db.upsertOrder(order);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_configured == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return _configured! ? const MainScaffold() : const SetupScreen();
  }
}
