import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _whatsappCtrl = TextEditingController();
  final _storeNameCtrl = TextEditingController();
  final _storeAddrCtrl = TextEditingController();
  final _storePhoneCtrl = TextEditingController();
  final _driverNameCtrl = TextEditingController();
  final _claudeKeyCtrl = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    _whatsappCtrl.text = p.getString('whatsapp') ?? '';
    _storeNameCtrl.text = p.getString('store_name') ?? '';
    _storeAddrCtrl.text = p.getString('store_address') ?? '';
    _storePhoneCtrl.text = p.getString('store_phone') ?? '';
    _driverNameCtrl.text = p.getString('driver_name') ?? '';
    _claudeKeyCtrl.text = p.getString('claude_api_key') ?? '';
    if (mounted) setState(() {});
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final p = await SharedPreferences.getInstance();
    await p.setString('whatsapp', _whatsappCtrl.text.trim());
    await p.setString('store_name', _storeNameCtrl.text.trim());
    await p.setString('store_address', _storeAddrCtrl.text.trim());
    await p.setString('store_phone', _storePhoneCtrl.text.trim());
    await p.setString('driver_name', _driverNameCtrl.text.trim());
    await p.setString('claude_api_key', _claudeKeyCtrl.text.trim());
    setState(() => _saving = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Configurações salvas'),
          backgroundColor: Color(0xFFFF6B00),
        ),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Configurações'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _section(
              title: 'Loja',
              children: [
                _buildField(_whatsappCtrl, 'WhatsApp da loja', TextInputType.phone),
                const SizedBox(height: 12),
                _buildField(_storeNameCtrl, 'Nome da loja'),
                const SizedBox(height: 12),
                _buildField(_storeAddrCtrl, 'Endereço da loja'),
                const SizedBox(height: 12),
                _buildField(_storePhoneCtrl, 'Telefone de contato', TextInputType.phone),
              ],
            ),
            const SizedBox(height: 16),
            _section(
              title: 'Motoboy',
              children: [
                _buildField(_driverNameCtrl, 'Seu nome'),
              ],
            ),
            const SizedBox(height: 16),
            _section(
              title: 'OCR (API Vision)',
              children: [
                _buildField(_claudeKeyCtrl, 'API Key (kpalabz)'),
                const SizedBox(height: 4),
                const Text(
                  'Chave usada para ler as fotos das comandas',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6B00),
                  foregroundColor: Colors.white,
                  textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('SALVAR'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _section({required String title, required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildField(TextEditingController c, String label, [TextInputType? k]) {
    return TextField(
      controller: c,
      keyboardType: k,
      style: const TextStyle(fontSize: 16),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 16),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
