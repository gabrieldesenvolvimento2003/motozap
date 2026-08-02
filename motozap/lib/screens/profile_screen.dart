import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/database_service.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final DatabaseService _db = DatabaseService();
  String _driverName = '';
  String _storeName = '';
  int _todayCount = 0;
  int _totalCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final today = await _db.getTodayCount();
    final all = await _db.listAllOrders();
    if (!mounted) return;
    setState(() {
      _driverName = prefs.getString('driver_name') ?? 'Motoboy';
      _storeName = prefs.getString('store_name') ?? '';
      _todayCount = today;
      _totalCount = all.length;
    });
  }

  String _initials(String name) {
    if (name.isEmpty) return '🛵';
    final parts = name.trim().split(' ');
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  void _openSettings() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SettingsScreen()),
    );
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Perfil'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 44,
                    backgroundColor: const Color(0xFFFF6B00),
                    child: Text(
                      _initials(_driverName),
                      style: const TextStyle(fontSize: 32, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _driverName,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  if (_storeName.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      _storeName,
                      style: const TextStyle(fontSize: 14, color: Colors.black54),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _miniStat('Hoje', _todayCount.toString()),
                      Container(width: 1, height: 40, color: Colors.grey.shade300),
                      _miniStat('Total', _totalCount.toString()),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _menuItem(
                    icon: Icons.settings,
                    label: 'Configurações',
                    subtitle: 'Loja, motoboy, API key',
                    onTap: _openSettings,
                  ),
                  Divider(height: 1, color: Colors.grey.shade200),
                  _menuItem(
                    icon: Icons.help_outline,
                    label: 'Sobre o app',
                    subtitle: 'MotoZap v1.0',
                    onTap: () => showAboutDialog(
                      context: context,
                      applicationName: 'MotoZap',
                      applicationVersion: '1.0.0',
                      applicationIcon: const Icon(Icons.delivery_dining, size: 48, color: Color(0xFFFF6B00)),
                      children: const [
                        Text('App para motoboys de delivery.\nGerencia pedidos, envia WhatsApp automático e rastreia entregas.'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _miniStat(String label, String value) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFFFF6B00)),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
      ],
    );
  }

  Widget _menuItem({required IconData icon, required String label, required String subtitle, required VoidCallback onTap}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: const Color(0xFFFF6B00).withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: const Color(0xFFFF6B00)),
      ),
      title: Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
      trailing: const Icon(Icons.chevron_right, color: Colors.black38),
      onTap: onTap,
    );
  }
}
