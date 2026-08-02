class DeliveryOrder {
  final String id;
  final String orderNumber;
  final String customerName;
  final String customerPhone;
  final String address;
  final String complement;
  final String neighborhood;
  final String reference;
  final String paymentMethod;
  final String scheduledFor;
  final double amount;
  final bool alreadyPaid;
  final DateTime createdAt;
  final String status;

  // Campos extras da comanda (v5)
  final double deliveryFee;       // taxa de entrega
  final double discount;          // desconto (PIX, etc.)
  final double cashback;          // cashback resgatado
  final String changeFor;         // troco para (ex: "R$ 150")
  final int itemCount;            // qtd de itens
  final String itemsSummary;      // resumo dos itens
  final String observation;       // observação do cliente ("Sem cebola", "Separar")
  final String orderDateTime;     // data/hora do pedido (dd/MM/yyyy HH:mm)
  final String manualAnnotation;  // anotação manuscrita ("Pagou R$ 169,33")
  final String photoPath;         // caminho da foto da comanda

  DeliveryOrder({
    required this.id,
    required this.orderNumber,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    this.complement = '',
    this.neighborhood = '',
    this.reference = '',
    this.paymentMethod = '',
    this.scheduledFor = '',
    required this.amount,
    required this.alreadyPaid,
    required this.createdAt,
    this.status = 'pending',
    this.deliveryFee = 0,
    this.discount = 0,
    this.cashback = 0,
    this.changeFor = '',
    this.itemCount = 0,
    this.itemsSummary = '',
    this.observation = '',
    this.orderDateTime = '',
    this.manualAnnotation = '',
    this.photoPath = '',
  });

  Map<String, Object?> toMap() => {
        'id': id,
        'order_number': orderNumber,
        'customer_name': customerName,
        'customer_phone': customerPhone,
        'address': address,
        'complement': complement,
        'neighborhood': neighborhood,
        'reference': reference,
        'payment_method': paymentMethod,
        'scheduled_for': scheduledFor,
        'amount': amount,
        'already_paid': alreadyPaid ? 1 : 0,
        'created_at': createdAt.toIso8601String(),
        'status': status,
        'delivery_fee': deliveryFee,
        'discount': discount,
        'cashback': cashback,
        'change_for': changeFor,
        'item_count': itemCount,
        'items_summary': itemsSummary,
        'observation': observation,
        'order_date_time': orderDateTime,
        'manual_annotation': manualAnnotation,
        'photo_path': photoPath,
      };

  factory DeliveryOrder.fromMap(Map<String, Object?> m) => DeliveryOrder(
        id: m['id'] as String,
        orderNumber: m['order_number'] as String,
        customerName: m['customer_name'] as String,
        customerPhone: (m['customer_phone'] as String?) ?? '',
        address: m['address'] as String,
        complement: (m['complement'] as String?) ?? '',
        neighborhood: (m['neighborhood'] as String?) ?? '',
        reference: (m['reference'] as String?) ?? '',
        paymentMethod: (m['payment_method'] as String?) ?? '',
        scheduledFor: (m['scheduled_for'] as String?) ?? '',
        amount: (m['amount'] as num).toDouble(),
        alreadyPaid: (m['already_paid'] as int) == 1,
        createdAt: DateTime.parse(m['created_at'] as String),
        status: (m['status'] as String?) ?? 'pending',
        deliveryFee: ((m['delivery_fee'] as num?) ?? 0).toDouble(),
        discount: ((m['discount'] as num?) ?? 0).toDouble(),
        cashback: ((m['cashback'] as num?) ?? 0).toDouble(),
        changeFor: (m['change_for'] as String?) ?? '',
        itemCount: ((m['item_count'] as int?) ?? 0),
        itemsSummary: (m['items_summary'] as String?) ?? '',
        observation: (m['observation'] as String?) ?? '',
        orderDateTime: (m['order_date_time'] as String?) ?? '',
        manualAnnotation: (m['manual_annotation'] as String?) ?? '',
        photoPath: (m['photo_path'] as String?) ?? '',
      );

  DeliveryOrder copyWith({String? status}) => DeliveryOrder(
        id: id,
        orderNumber: orderNumber,
        customerName: customerName,
        customerPhone: customerPhone,
        address: address,
        amount: amount,
        alreadyPaid: alreadyPaid,
        createdAt: createdAt,
        status: status ?? this.status,
        deliveryFee: deliveryFee,
        discount: discount,
        cashback: cashback,
        changeFor: changeFor,
        itemCount: itemCount,
        itemsSummary: itemsSummary,
        observation: observation,
        orderDateTime: orderDateTime,
        manualAnnotation: manualAnnotation,
        photoPath: photoPath,
      );
}

const kStatusFlow = <String>[
  'pending',
  'route_started',
  'on_the_way',
  'arrived',
  'trying_contact',
  'contact_made',
  'customer_coming',
  'collecting_payment',
  'delivered',
  'route_finished',
];

const kStatusLabels = <String, String>{
  'pending': 'Pendente',
  'route_started': 'Rota Iniciada',
  'on_the_way': 'A caminho',
  'arrived': 'Chegou no endereço',
  'trying_contact': 'Tentando contato',
  'contact_made': 'Contato feito',
  'customer_coming': 'Cliente buscando',
  'collecting_payment': 'Cobrando cliente',
  'delivered': 'Pedido entregue',
  'route_finished': 'Rota finalizada',
};

const kStatusEmojis = <String, String>{
  'pending': '📋',
  'route_started': '🚀',
  'on_the_way': '🛵',
  'arrived': '📍',
  'trying_contact': '📞',
  'contact_made': '✅',
  'customer_coming': '🏃',
  'collecting_payment': '💰',
  'delivered': '✓',
  'route_finished': '🏁',
};

String nextStatus(String current) {
  final i = kStatusFlow.indexOf(current);
  if (i < 0 || i >= kStatusFlow.length - 1) return current;
  return kStatusFlow[i + 1];
}
