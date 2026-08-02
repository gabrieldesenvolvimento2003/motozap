/// Modelo de pedido extraído de uma comanda.
///
/// Pode vir do kpalabz Vision (KpalabzOcrService) ou digitado manualmente.
class ParsedOrder {
  final String orderNumber;
  final String customerName;
  final String customerPhone;
  final String address;
  final String complement;
  final String neighborhood;
  final String reference;
  final double amount;
  final String paymentMethod;
  final String scheduledFor;
  final bool alreadyPaid;
  final String rawText;

  // Campos extras
  final double deliveryFee;
  final double discount;
  final double cashback;
  final String changeFor;
  final int itemCount;
  final String itemsSummary;
  final String observation;
  final String orderDateTime;
  final String manualAnnotation;
  final String devPhotoPath;  // Foto da comanda (temporário, vindo da câmera)

  ParsedOrder({
    required this.orderNumber,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    this.complement = '',
    this.neighborhood = '',
    this.reference = '',
    this.amount = 0,
    this.paymentMethod = '',
    this.scheduledFor = '',
    this.alreadyPaid = false,
    this.rawText = '',
    this.deliveryFee = 0,
    this.discount = 0,
    this.cashback = 0,
    this.changeFor = '',
    this.itemCount = 0,
    this.itemsSummary = '',
    this.observation = '',
    this.orderDateTime = '',
    this.manualAnnotation = '',
    this.devPhotoPath = '',
  });
}
