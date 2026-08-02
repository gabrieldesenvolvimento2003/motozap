import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'main_scaffold.dart';

class SetupScreen extends StatefulWidget {
  const SetupScreen({super.key});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final _formKey = GlobalKey<FormState>();
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
    SharedPreferences.getInstance().then((p) {
      if (mounted) {
        setState(() {
          _claudeKeyCtrl.text = p.getString('claude_api_key') ?? '';
        });
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('whatsapp', _whatsappCtrl.text.trim());
    await prefs.setString('store_name', _storeNameCtrl.text.trim());
    await prefs.setString('store_address', _storeAddrCtrl.text.trim());
    await prefs.setString('store_phone', _storePhoneCtrl.text.trim());
    await prefs.setString('driver_name', _driverNameCtrl.text.trim());
    await prefs.setString('claude_api_key', _claudeKeyCtrl.text.trim());
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainScaffold()),
      );
    }
  }

  @override
  void dispose() {
    _whatsappCtrl.dispose();
    _storeNameCtrl.dispose();
    _storeAddrCtrl.dispose();
    _storePhoneCtrl.dispose();
    _driverNameCtrl.dispose();
    _claudeKeyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Configuração inicial'),
        backgroundColor: const Color(0xFFFF6B00),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              const Icon(
                Icons.delivery_dining,
                size: 64,
                color: Color(0xFFFF6B00),
              ),
              const SizedBox(height: 8),
              const Text(
                'MotoZap',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                'Configure os dados da loja e do motoboy',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.black54),
              ),
              const SizedBox(height: 24),
              const Text(
                'Loja',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _whatsappCtrl,
                label: 'WhatsApp da loja (com DDD)',
                keyboardType: TextInputType.phone,
                hint: '27 99999-9999',
                validator: (v) =>
                    (v == null || v.trim().length < 10) ? 'Informe o WhatsApp' : null,
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _storeNameCtrl,
                label: 'Nome da loja',
                hint: 'Ex: Sabores Salgados',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe o nome' : null,
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _storeAddrCtrl,
                label: 'Endereço da loja',
                hint: 'Ex: Rua Principal, 100',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe o endereço' : null,
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _storePhoneCtrl,
                label: 'Telefone de contato da loja',
                keyboardType: TextInputType.phone,
                hint: '27 3333-3333',
              ),
              const SizedBox(height: 24),
              const Text(
                'Motoboy',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _driverNameCtrl,
                label: 'Seu nome',
                hint: 'Ex: João',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe seu nome' : null,
              ),
              const SizedBox(height: 24),
              const Text(
                'OCR da Comanda (Visão)',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                'O app usa o serviço kpalabz pra ler as comandas. Cole sua API key abaixo.',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 12),
              _buildField(
                controller: _claudeKeyCtrl,
                label: 'API Key (kpalabz)',
                hint: 'sk-kpa-...',
                keyboardType: TextInputType.text,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe a API key' : null,
              ),
              const SizedBox(height: 32),
              SizedBox(
                height: 60,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF6B00),
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('COMEÇAR'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 18),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: const TextStyle(fontSize: 18),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      validator: validator,
    );
  }
}