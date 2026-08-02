import 'package:flutter/material.dart';
import 'orders_list_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';
import 'capture_screen.dart';

class MainScaffold extends StatefulWidget {
  const MainScaffold({super.key});

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  int _index = 0;

  final _screens = const [
    OrdersListScreen(),
    HistoryScreen(),
    ProfileScreen(),
  ];

  void _openCapture() async {
    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const CaptureScreen()),
    );
    if (added == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pedido adicionado!'),
          backgroundColor: Color(0xFFFF6B00),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCapture,
        backgroundColor: const Color(0xFFFF6B00),
        foregroundColor: Colors.white,
        elevation: 6,
        child: const Icon(Icons.add_a_photo, size: 28),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        height: 72,
        color: Colors.white,
        elevation: 8,
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _navItem(
              icon: Icons.delivery_dining,
              label: 'Pedidos',
              index: 0,
            ),
            const SizedBox(width: 56), // espaço pro FAB
            _navItem(
              icon: Icons.history,
              label: 'Histórico',
              index: 1,
            ),
            _navItem(
              icon: Icons.person_outline,
              label: 'Perfil',
              index: 2,
            ),
          ],
        ),
      ),
    );
  }

  Widget _navItem({required IconData icon, required String label, required int index}) {
    final isActive = _index == index;
    final color = isActive ? const Color(0xFFFF6B00) : Colors.black54;
    return InkWell(
      onTap: () => setState(() => _index = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
