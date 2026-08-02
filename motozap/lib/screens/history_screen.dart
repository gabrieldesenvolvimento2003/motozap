import 'dart:io';
import 'package:flutter/material.dart';
import '../models/delivery_order.dart';
import '../services/database_service.dart';
import 'order_detail_screen.dart';

enum _HistoryFilter { today, yesterday, week, month, all }

extension _FilterLabel on _HistoryFilter {
  String get label => switch (this) {
        _HistoryFilter.today => 'Hoje',
        _HistoryFilter.yesterday => 'Ontem',
        _HistoryFilter.week => '7 dias',
        _HistoryFilter.month => 'Mês',
        _HistoryFilter.all => 'Todos',
      };
}

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final DatabaseService _db = DatabaseService();
  List<DeliveryOrder> _allOrders = [];
  bool _loading = true;
  _HistoryFilter _filter = _HistoryFilter.today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await _db.listAllOrders();
    setState(() {
      _allOrders = list;
      _loading = false;
    });
  }

  List<DeliveryOrder> _filteredOrders() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final cutoff = switch (_filter) {
      _HistoryFilter.today => today,
      _HistoryFilter.yesterday => today.subtract(const Duration(days: 1)),
      _HistoryFilter.week => today.subtract(const Duration(days: 7)),
      _HistoryFilter.month => DateTime(now.year, now.month, 1),
      _HistoryFilter.all => DateTime(2000),
    };
    return _allOrders.where((o) {
      return !o.createdAt.isBefore(cutoff);
    }).toList();
  }

  double get _totalAmount =>
      _filteredOrders().fold<double>(0.0, (sum, o) => sum + o.amount);

  double get _totalFees =>
      _filteredOrders().fold<double>(0.0, (sum, o) => sum + o.deliveryFee);

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredOrders();
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Histórico de entregas'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF6B00)))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _HistoryFilter.values.map((f) {
                        final selected = _filter == f;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(f.label),
                            selected: selected,
                            onSelected: (_) => setState(() => _filter = f),
                            selectedColor: const Color(0xFFFF6B00),
                            labelStyle: TextStyle(
                              color: selected ? Colors.white : Colors.black87,
                              fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                            ),
                            backgroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                color: selected ? const Color(0xFFFF6B00) : Colors.grey.shade300,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: _statCard(
                          'Total das entregas',
                          'R\$ ${_totalAmount.toStringAsFixed(2).replaceAll('.', ',')}',
                          Icons.attach_money,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _statCard(
                          'Entregas',
                          '${filtered.length}',
                          Icons.delivery_dining,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: filtered.isEmpty
                      ? _emptyState()
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) => _HistoryCard(
                              order: filtered[i],
                              onTap: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => OrderDetailScreen(orderId: filtered[i].id),
                                  ),
                                );
                                _load();
                              },
                            ),
                          ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _statCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B00).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: const Color(0xFFFF6B00)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.store_mall_directory_outlined, size: 100, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            'Você não tem histórico\nde pedidos por enquanto',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: Colors.black54, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final DeliveryOrder order;
  final VoidCallback onTap;
  const _HistoryCard({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final time = '${order.createdAt.hour.toString().padLeft(2, '0')}:${order.createdAt.minute.toString().padLeft(2, '0')}';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                  image: order.photoPath.isNotEmpty && File(order.photoPath).existsSync()
                      ? DecorationImage(
                          image: FileImage(File(order.photoPath)),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: order.photoPath.isEmpty || !File(order.photoPath).existsSync()
                    ? const Icon(Icons.check_circle, color: Colors.green, size: 32)
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '#${order.orderNumber}',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            time,
                            style: const TextStyle(fontSize: 12, color: Colors.black54),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order.customerName,
                      style: const TextStyle(fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (order.amount > 0)
                          Text(
                            'R\$ ${order.amount.toStringAsFixed(2).replaceAll('.', ',')}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFFF6B00),
                            ),
                          ),
                        if (order.paymentMethod.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Text(
                            '· ${order.paymentMethod}',
                            style: const TextStyle(fontSize: 13, color: Colors.black54),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 22, color: Colors.black38),
            ],
          ),
        ),
      ),
    );
  }
}
