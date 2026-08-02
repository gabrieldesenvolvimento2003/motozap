import 'dart:io';
import 'package:flutter/material.dart';
import '../services/ocr_service.dart';

class ConfirmOrderScreen extends StatefulWidget {
  final ParsedOrder? parsed;
  final String? photoPath;
  const ConfirmOrderScreen({super.key, this.parsed, this.photoPath});

  @override
  State<ConfirmOrderScreen> createState() => _ConfirmOrderScreenState();
}

class _ConfirmOrderScreenState extends State<ConfirmOrderScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _orderCtrl;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _addrCtrl;
  late final TextEditingController _compCtrl;
  late final TextEditingController _neighCtrl;
  late final TextEditingController _refCtrl;
  late final TextEditingController _amountCtrl;
  late final TextEditingController _paymentCtrl;
  late final TextEditingController _scheduledCtrl;
  late final TextEditingController _orderDateTimeCtrl;
  late final TextEditingController _deliveryFeeCtrl;
  late final TextEditingController _discountCtrl;
  late final TextEditingController _cashbackCtrl;
  late final TextEditingController _changeForCtrl;
  late final TextEditingController _itemCountCtrl;
  late final TextEditingController _itemsSummaryCtrl;
  late final TextEditingController _observationCtrl;
  late final TextEditingController _manualAnnotationCtrl;
  late bool _alreadyPaid;

  @override
  void initState() {
    super.initState();
    final p = widget.parsed;
    _orderCtrl = TextEditingController(text: p?.orderNumber ?? '');
    _nameCtrl = TextEditingController(text: p?.customerName ?? '');
    _phoneCtrl = TextEditingController(text: p?.customerPhone ?? '');
    _addrCtrl = TextEditingController(text: p?.address ?? '');
    _compCtrl = TextEditingController(text: p?.complement ?? '');
    _neighCtrl = TextEditingController(text: p?.neighborhood ?? '');
    _refCtrl = TextEditingController(text: p?.reference ?? '');
    _amountCtrl = TextEditingController(
      text: (p?.amount ?? 0) > 0 ? p!.amount.toStringAsFixed(2) : '',
    );
    _paymentCtrl = TextEditingController(text: p?.paymentMethod ?? '');
    _scheduledCtrl = TextEditingController(text: p?.scheduledFor ?? '');
    _orderDateTimeCtrl = TextEditingController(text: p?.orderDateTime ?? '');
    _deliveryFeeCtrl = TextEditingController(
      text: (p?.deliveryFee ?? 0) > 0 ? p!.deliveryFee.toStringAsFixed(2) : '',
    );
    _discountCtrl = TextEditingController(
      text: (p?.discount ?? 0) > 0 ? p!.discount.toStringAsFixed(2) : '',
    );
    _cashbackCtrl = TextEditingController(
      text: (p?.cashback ?? 0) > 0 ? p!.cashback.toStringAsFixed(2) : '',
    );
    _changeForCtrl = TextEditingController(text: p?.changeFor ?? '');
    _itemCountCtrl = TextEditingController(
      text: (p?.itemCount ?? 0) > 0 ? p!.itemCount.toString() : '',
    );
    _itemsSummaryCtrl = TextEditingController(text: p?.itemsSummary ?? '');
    _observationCtrl = TextEditingController(text: p?.observation ?? '');
    _manualAnnotationCtrl = TextEditingController(text: p?.manualAnnotation ?? '');
    _alreadyPaid = p?.alreadyPaid ?? false;
  }

  @override
  void dispose() {
    _orderCtrl.dispose();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addrCtrl.dispose();
    _compCtrl.dispose();
    _neighCtrl.dispose();
    _refCtrl.dispose();
    _amountCtrl.dispose();
    _paymentCtrl.dispose();
    _scheduledCtrl.dispose();
    _orderDateTimeCtrl.dispose();
    _deliveryFeeCtrl.dispose();
    _discountCtrl.dispose();
    _cashbackCtrl.dispose();
    _changeForCtrl.dispose();
    _itemCountCtrl.dispose();
    _itemsSummaryCtrl.dispose();
    _observationCtrl.dispose();
    _manualAnnotationCtrl.dispose();
    super.dispose();
  }

  double _parseAmount(String s) {
    return double.tryParse(
          s.trim().replaceAll(',', '.').replaceAll(RegExp(r'[^0-9.]'), ''),
        ) ??
        0.0;
  }

  void _confirm() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(ParsedOrder(
      orderNumber: _orderCtrl.text.trim(),
      customerName: _nameCtrl.text.trim(),
      customerPhone: _phoneCtrl.text.trim(),
      address: _addrCtrl.text.trim(),
      complement: _compCtrl.text.trim(),
      neighborhood: _neighCtrl.text.trim(),
      reference: _refCtrl.text.trim(),
      amount: _parseAmount(_amountCtrl.text),
      paymentMethod: _paymentCtrl.text.trim(),
      scheduledFor: _scheduledCtrl.text.trim(),
      alreadyPaid: _alreadyPaid,
      deliveryFee: _parseAmount(_deliveryFeeCtrl.text),
      discount: _parseAmount(_discountCtrl.text),
      cashback: _parseAmount(_cashbackCtrl.text),
      changeFor: _changeForCtrl.text.trim(),
      itemCount: int.tryParse(_itemCountCtrl.text.trim()) ?? 0,
      itemsSummary: _itemsSummaryCtrl.text.trim(),
      observation: _observationCtrl.text.trim(),
      orderDateTime: _orderDateTimeCtrl.text.trim(),
      manualAnnotation: _manualAnnotationCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Confirmar Pedido'),
        backgroundColor: const Color(0xFFFF6B00),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.photoPath != null && widget.photoPath!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: GestureDetector(
                    onTap: () => _showPhotoZoom(context, widget.photoPath!),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.file(
                        File(widget.photoPath!),
                        height: 200,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          height: 100,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('📷 Foto da comanda (erro ao carregar)'),
                        ),
                      ),
                    ),
                  ),
                ),
              if (widget.parsed != null)
                const Padding(
                  padding: EdgeInsets.only(bottom: 16),
                  child: Text(
                    'Dados lidos da comanda. Confira e ajuste o que precisar.',
                    style: TextStyle(fontSize: 16, color: Colors.black54),
                  ),
                ),
              _buildField(
                ctrl: _orderCtrl,
                label: 'Número do pedido',
                hint: 'Ex: 21',
                keyboardType: TextInputType.number,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe o número' : null,
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _nameCtrl,
                label: 'Nome do cliente',
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe o nome' : null,
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _phoneCtrl,
                label: 'Telefone',
                keyboardType: TextInputType.phone,
                hint: '27 99999-9999',
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _addrCtrl,
                label: 'Endereço (rua e número)',
                hint: 'Ex: Rua Euclídes da Cunha, 694',
                maxLines: 2,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Informe o endereço' : null,
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _compCtrl,
                label: 'Complemento',
                hint: 'Ex: Casa, Apto 302, Condomínio Vista do Limoeiro',
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _neighCtrl,
                label: 'Bairro',
                hint: 'Ex: São Diogo II, Serra - ES',
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _refCtrl,
                label: 'Ponto de referência',
                hint: 'Ex: Ao lado do quiosque das capas',
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      ctrl: _amountCtrl,
                      label: 'Valor (R\$)',
                      hint: '139,00',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField(
                      ctrl: _paymentCtrl,
                      label: 'Pagamento',
                      hint: 'Débito, PIX...',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      ctrl: _deliveryFeeCtrl,
                      label: 'Taxa entrega (R\$)',
                      hint: '9,00',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField(
                      ctrl: _changeForCtrl,
                      label: 'Troco para',
                      hint: 'R\$ 150',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      ctrl: _discountCtrl,
                      label: 'Desconto (R\$)',
                      hint: '0',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField(
                      ctrl: _cashbackCtrl,
                      label: 'Cashback (R\$)',
                      hint: '0',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildField(
                      ctrl: _orderDateTimeCtrl,
                      label: 'Data/Hora pedido',
                      hint: '01/08/2026 13:38',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField(
                      ctrl: _scheduledCtrl,
                      label: 'Agendado para',
                      hint: '01/08/2026 19:30',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _itemsSummaryCtrl,
                label: 'Itens (resumo)',
                hint: '100 Salgados Fritos; 20 Salgados Fritos',
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    flex: 1,
                    child: _buildField(
                      ctrl: _itemCountCtrl,
                      label: 'Qtd itens',
                      hint: '2',
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 4,
                    child: _buildField(
                      ctrl: _observationCtrl,
                      label: 'Observação',
                      hint: 'Ex: Sem cebola, Tocar interfone',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildField(
                ctrl: _manualAnnotationCtrl,
                label: 'Anotação manual',
                hint: 'Ex: Pagou R\$ 169,33',
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      _alreadyPaid ? Icons.check_circle : Icons.payments,
                      color: _alreadyPaid ? Colors.green : Colors.amber.shade800,
                      size: 32,
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'O cliente já pagou?',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ),
                    Switch(
                      value: _alreadyPaid,
                      activeColor: const Color(0xFFFF6B00),
                      onChanged: (v) => setState(() => _alreadyPaid = v),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 70,
                child: ElevatedButton(
                  onPressed: _confirm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF6B00),
                    foregroundColor: Colors.white,
                    textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('CONFIRMAR'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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

  Widget _buildField({
    required TextEditingController ctrl,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: ctrl,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(fontSize: 18),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        labelStyle: const TextStyle(fontSize: 18),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      validator: validator,
    );
  }
}
