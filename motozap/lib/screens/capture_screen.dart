import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../models/delivery_order.dart';
import '../services/database_service.dart';
import '../services/kpalabz_ocr_service.dart' as ocr_impl;
import '../services/ocr_service.dart';
import 'confirm_order_screen.dart';

class CaptureScreen extends StatefulWidget {
  const CaptureScreen({super.key});

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  final ocr_impl.KpalabzOcrService _ocr = ocr_impl.KpalabzOcrService();
  final DatabaseService _db = DatabaseService();
  bool _processing = false;
  String? _lastPhotoPath;

  // Retry: tenta novamente com a última foto sem abrir câmera
  Future<void> _retryWithSamePhoto() async {
    if (_lastPhotoPath == null) return;
    await _processImage(_lastPhotoPath!, retry: true);
  }

  Future<void> _pickImage(ImageSource source) async {
    setState(() => _processing = true);
    try {
      final XFile? photo = await _picker.pickImage(
        source: source,
        imageQuality: 80,
      );
      if (photo == null) {
        setState(() => _processing = false);
        return;
      }
      await _processImage(photo.path, retry: false);
    } catch (e) {
      setState(() => _processing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _processImage(String photoPath, {required bool retry}) async {
    setState(() {
      _processing = true;
      _lastPhotoPath = photoPath;
    });

    try {
      final parsed = await _ocr.parseReceipt(photoPath);

      if (!mounted) return;

      // Validação pós-OCR: se retornou mas campos essenciais estão vazios
      if (parsed != null && parsed.customerName.isEmpty && parsed.address.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OCR leu a foto mas não encontrou dados. Complete manualmente.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 4),
          ),
        );
      }

      if (parsed == null) {
        // OCR falhou completamente — mostra retry
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Não consegui ler a comanda.'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'TENTAR NOVAMENTE',
              textColor: Colors.white,
              onPressed: _retryWithSamePhoto,
            ),
          ),
        );
        setState(() => _processing = false);
        return;
      }

      // Salva foto e vai pra confirmação
      final savedPhotoPath = await _savePhotoToApp(photoPath);

      final result = await Navigator.of(context).push<ParsedOrder>(
        MaterialPageRoute(
          builder: (_) => ConfirmOrderScreen(
            parsed: parsed,
            photoPath: savedPhotoPath ?? photoPath,
          ),
        ),
      );

      if (result != null) {
        final order = DeliveryOrder(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          orderNumber: result.orderNumber,
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          address: result.address,
          complement: result.complement,
          neighborhood: result.neighborhood,
          reference: result.reference,
          amount: result.amount,
          paymentMethod: result.paymentMethod,
          alreadyPaid: result.alreadyPaid,
          createdAt: DateTime.now(),
          deliveryFee: result.deliveryFee,
          discount: result.discount,
          cashback: result.cashback,
          changeFor: result.changeFor,
          itemCount: result.itemCount,
          itemsSummary: result.itemsSummary,
          observation: result.observation,
          orderDateTime: result.orderDateTime,
          manualAnnotation: result.manualAnnotation,
          photoPath: savedPhotoPath ?? photoPath,
        );
        await _db.insertOrder(order);
        if (mounted) Navigator.of(context).pop(true);
      } else {
        setState(() => _processing = false);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
        setState(() => _processing = false);
      }
    }
  }

  Future<void> _enterManually() async {
    final result = await Navigator.of(context).push<ParsedOrder>(
      MaterialPageRoute(
        builder: (_) => const ConfirmOrderScreen(parsed: null),
      ),
    );
    if (result != null) {
      final order = DeliveryOrder(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        orderNumber: result.orderNumber,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        address: result.address,
        complement: result.complement,
        neighborhood: result.neighborhood,
        reference: result.reference,
        amount: result.amount,
        paymentMethod: result.paymentMethod,
        alreadyPaid: result.alreadyPaid,
        createdAt: DateTime.now(),
        deliveryFee: result.deliveryFee,
        discount: result.discount,
        cashback: result.cashback,
        changeFor: result.changeFor,
        itemCount: result.itemCount,
        itemsSummary: result.itemsSummary,
        observation: result.observation,
        orderDateTime: result.orderDateTime,
        manualAnnotation: result.manualAnnotation,
      );
      await _db.insertOrder(order);
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  Future<String?> _savePhotoToApp(String tempPath) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final photosDir = Directory(p.join(dir.path, 'photos'));
      if (!await photosDir.exists()) {
        await photosDir.create(recursive: true);
      }
      final stamp = DateTime.now().millisecondsSinceEpoch;
      final ext = p.extension(tempPath).isEmpty ? '.jpg' : p.extension(tempPath);
      final finalPath = p.join(photosDir.path, 'comanda_$stamp$ext');
      await File(tempPath).copy(finalPath);
      return finalPath;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Adicionar Pedido'),
        backgroundColor: const Color(0xFFFF6B00),
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.receipt_long, size: 100, color: Color(0xFFFF6B00)),
            const SizedBox(height: 24),
            const Text(
              'Tire uma foto da comanda',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text(
              'O app vai ler os dados pra você',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, color: Colors.black54),
            ),
            const SizedBox(height: 40),
            SizedBox(
              height: 70,
              child: ElevatedButton.icon(
                onPressed: _processing ? null : () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt, size: 32),
                label: const Text(
                  'TIRAR FOTO',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6B00),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 70,
              child: OutlinedButton.icon(
                onPressed: _processing ? null : () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library, size: 32),
                label: const Text(
                  'GALERIA',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFFF6B00),
                  side: const BorderSide(color: Color(0xFFFF6B00), width: 3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 70,
              child: OutlinedButton.icon(
                onPressed: _processing ? null : _enterManually,
                icon: const Icon(Icons.edit, size: 32),
                label: const Text(
                  'DIGITAR MANUALMENTE',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFFF6B00),
                  side: const BorderSide(color: Color(0xFFFF6B00), width: 3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            if (_processing) ...[
              const SizedBox(height: 32),
              Center(
                child: Column(
                  children: [
                    const CircularProgressIndicator(color: Color(0xFFFF6B00)),
                    const SizedBox(height: 12),
                    Text(
                      'Lendo a comanda...',
                      style: TextStyle(fontSize: 18, color: Colors.grey.shade700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '(tentando múltiplos modelos)',
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              ),
            ],
            // Botão retry aparece quando falhou mas temos foto anterior
            if (!_processing && _lastPhotoPath != null) ...[
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: _retryWithSamePhoto,
                icon: const Icon(Icons.refresh),
                label: const Text('🔄 Tentar novamente com a última foto'),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.orange.shade700,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
