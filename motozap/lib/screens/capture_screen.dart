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
  bool _alreadyPaid = false;

  Future<void> _takePicture() async {
    await _pickImage(ImageSource.camera);
  }

  Future<void> _pickFromGallery() async {
    await _pickImage(ImageSource.gallery);
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
      final parsed = await _ocr.parseReceipt(photo.path);
      if (!mounted) return;

      if (parsed == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Não consegui ler a comanda. Tente novamente ou digite manualmente.'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _processing = false);
        return;
      }

      // Copia a foto para o diretório do app (sobrevive ao cache temporário)
      final savedPhotoPath = await _savePhotoToApp(photo.path);

      final result = await Navigator.of(context).push<ParsedOrder>(
        MaterialPageRoute(
          builder: (_) => ConfirmOrderScreen(parsed: parsed, photoPath: savedPhotoPath),
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
          photoPath: savedPhotoPath,
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

  /// Copia a foto temporária da câmera/galeria para o diretório de documentos do app.
  /// Retorna o novo path, ou null se falhar.
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
  void dispose() {
    super.dispose();
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
                onPressed: _processing ? null : _takePicture,
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
                onPressed: _processing ? null : _pickFromGallery,
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
              const SizedBox(height: 24),
              const Center(
                child: Column(
                  children: [
                    CircularProgressIndicator(color: Color(0xFFFF6B00)),
                    SizedBox(height: 12),
                    Text('Lendo a comanda...', style: TextStyle(fontSize: 18)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}