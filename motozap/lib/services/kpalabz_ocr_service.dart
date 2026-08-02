import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'ocr_service.dart';

/// OCR usando a API OpenAI-compatible do kpalabz
/// (endpoint aceita formato chat/completions com vision).
class KpalabzOcrService {
  // Trail slash removido
  static const _endpoint = 'https://api.kpalabz.com/v1/chat/completions';

  Future<String?> _apiKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('claude_api_key');
  }

  /// Tenta identificar o modelo de visão disponível automaticamente
  Future<String> _detectVisionModel(String apiKey) async {
    // Tenta os modelos mais comuns. O kpalabz provê geralmente um que suporte vision.
    final candidates = ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-flash'];
    for (final m in candidates) {
      try {
        final probe = await http.post(
          Uri.parse(_endpoint),
          headers: {
            'Authorization': 'Bearer $apiKey',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'model': m,
            'messages': [
              {
                'role': 'user',
                'content': [
                  {'type': 'text', 'text': 'ok'},
                ]
              }
            ],
            'max_tokens': 1,
          }),
        ).timeout(const Duration(seconds: 10));
        if (probe.statusCode == 200) {
          debugPrint('=== Kpalabz model detected: $m ===');
          return m;
        }
      } catch (_) {}
    }
    // Fallback
    return 'gpt-4o-mini';
  }

  String get _prompt => '''
Analise esta foto de uma comanda (recibo) de delivery e extraia os dados em JSON.

A comanda típica tem:
- "Pedido #N" no topo (1-4 dígitos). NÃO confunda com "Pedido Yooga #XXXXXXXX" (ID interno, 8+ dígitos)
- "Data do Pedido: dd/mm/yyyy HH:mm" (quando informado)
- "Nome: X", "Telefone: (DD) 9XXXX-XXXX" (às vezes com DDI 55 antes)
- "Endereço: ...", "Complemento: ..." (linha separada), "Bairro, Cidade - ES" (linha separada)
- "CEP: XXXXX-XXX"
- "P. Referência: ..." (pode ser "Sem referência")
- "Agendado para: dd/mm/yyyy HH:mm" (se for agendado)
- "Itens" / lista de itens
- "Sub-total" / "Taxa de entrega" / "Taxa de Serviço" / "Desconto no PIX" / "Cashback resgatado"
- "Cobrar do cliente R\$ X,XX" ou "Pago online R\$ X,XX" ou "Não cobrar do cliente R\$ X,XX"
- "Forma de pgto: ..." (pode vir como "Delivery - Débito", "YOOGA ONLINE - PIX", "pix", "Cartão de Crédito")
- Anotação manuscrita (se houver): "Pagou R\$ X,XX", "Anotação Anotada à mão", etc.
- Observação em itens (ex: "5 de cada / Separar", "Obs: calabresa")

Responda APENAS o JSON válido (sem markdown, sem explicações):
{
  "orderNumber": "21",
  "customerName": "Nome do cliente",
  "customerPhone": "27 99243-7144",
  "address": "Rua Castro Alves, 170",
  "complement": "Condomínio Vista do Limoeiro / H407",
  "neighborhood": "São Diogo II, Serra - ES",
  "reference": "",
  "amount": 139.00,
  "paymentMethod": "Débito",
  "alreadyPaid": false,
  "scheduledFor": "01/08/2026 19:30",
  "deliveryFee": 9.00,
  "discount": 0,
  "cashback": 0,
  "changeFor": "",
  "itemCount": 2,
  "itemsSummary": "100 Salgados Fritos (variados); 20 Salgados Fritos (Churros)",
  "observation": "Anotação à mão: 19:00h Entrega",
  "orderDateTime": "01/08/2026 13:38",
  "manualAnnotation": ""
}

Regras estritas:
- orderNumber: número após "Pedido #N" (1-4 dígitos), NUNCA o "Pedido Yooga #XXXXXXXX"
- customerPhone: SEMPRE no formato "DD 9XXXX-XXXX" (DDD + 9 dígitos). SEM DDI 55.
- address: SOMENTE rua e número, sem complemento, sem bairro
- complement: string (pode conter "Condomínio", "Apto", "Casa", "Bloco"). Se for "Sem complemento", use ""
- neighborhood: "Bairro, Cidade - UF" (extraído da linha separada após Complemento)
- reference: "" se for "Sem referência" ou "Sem referencia"
- amount: número (0.00 se não houver "Cobrar" ou "Pago online")
- paymentMethod: APENAS o método (PIX, Débito, Crédito, Dinheiro). SEM prefixo "Delivery -" ou "YOOGA ONLINE -"
- alreadyPaid: TRUE se tiver "Pago online" ou "Não cobrar do cliente". FALSE se tiver "Cobrar do cliente"
- scheduledFor: "dd/mm/yyyy HH:mm" se agendado, ou "" se não
- deliveryFee: valor da "Taxa de entrega" (ex: 7.00, 9.00, 12.00). 0 se não houver
- discount: valor absoluto do "Desconto no PIX" (ex: 6.55). 0 se não houver
- cashback: valor absoluto do "Cashback resgatado". 0 se não houver
- changeFor: "" se não houver (sem info de troco). Deixe vazio se não houver info
- itemCount: número total de itens distintos (não unidades). Ex: 2 linhas em "Itens" = 2
- itemsSummary: resumo curto (até 200 chars) tipo "100 Salgados Fritos; 20 Salgados Fritos"
- observation: anotações manuais no campo de itens (ex: "Separar", "5 de cada"). Geralmente anotação à mão no pedido
- orderDateTime: "dd/mm/yyyy HH:mm" da data/hora do pedido visível na comanda. "" se não houver
- manualAnnotation: "" se não houver. Se houver "Pagou R\$ X,XX" anotado à mão, colocar aqui
- Todos campos string ausentes: use ""
- Valor numérico ausente: use 0.0
''';

  Future<ParsedOrder?> parseReceipt(String imagePath) async {
    final apiKey = await _apiKey();
    if (apiKey == null || apiKey.isEmpty) {
      throw Exception('API key não configurada. Vá em Configurações.');
    }

    final imageBytes = await File(imagePath).readAsBytes();
    final base64Image = base64Encode(imageBytes);

    final model = await _detectVisionModel(apiKey);

    final body = jsonEncode({
      'model': model,
      'messages': [
        {
          'role': 'user',
          'content': [
            {'type': 'text', 'text': _prompt},
            {
              'type': 'image_url',
              'image_url': {
                'url': 'data:image/jpeg;base64,$base64Image',
              }
            }
          ]
        }
      ],
      'max_tokens': 1024,
      'temperature': 0.1,
    });

    final response = await http
        .post(
          Uri.parse(_endpoint),
          headers: {
            'Authorization': 'Bearer $apiKey',
            'Content-Type': 'application/json',
          },
          body: body,
        )
        .timeout(const Duration(seconds: 45));

    if (response.statusCode == 401) {
      throw Exception('API key inválida. Verifique em Configurações.');
    }
    if (response.statusCode == 429) {
      throw Exception('Limite de requisições excedido. Aguarde e tente novamente.');
    }
    if (response.statusCode != 200) {
      throw Exception('Erro API (${response.statusCode}): ${response.body.substring(0, response.body.length.clamp(0, 200))}');
    }

    final responseJson = jsonDecode(response.body) as Map<String, dynamic>;
    final choices = responseJson['choices'] as List?;
    if (choices == null || choices.isEmpty) {
      throw Exception('API não retornou resultado.');
    }

    final message = choices[0]['message'] as Map<String, dynamic>?;
    final content = message?['content'] as String? ?? '';
    final cleaned = content.trim();
    debugPrint('=== KPALABZ TEXT ===\n$cleaned\n=== END ===');

    Map<String, dynamic> data;
    try {
      data = jsonDecode(cleaned) as Map<String, dynamic>;
    } catch (e) {
      throw Exception('Resposta API não é JSON válido: ${cleaned.substring(0, cleaned.length.clamp(0, 100))}');
    }

    return ParsedOrder(
      orderNumber: (data['orderNumber'] ?? '').toString().trim(),
      customerName: (data['customerName'] ?? '').toString().trim(),
      customerPhone: (data['customerPhone'] ?? '').toString().trim(),
      address: (data['address'] ?? '').toString().trim(),
      complement: (data['complement'] ?? '').toString().trim(),
      neighborhood: (data['neighborhood'] ?? '').toString().trim(),
      reference: (data['reference'] ?? '').toString().trim(),
      amount: (data['amount'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: (data['paymentMethod'] ?? '').toString().trim(),
      scheduledFor: (data['scheduledFor'] ?? '').toString().trim(),
      alreadyPaid: data['alreadyPaid'] == true,
      rawText: cleaned,
      deliveryFee: (data['deliveryFee'] as num?)?.toDouble() ?? 0.0,
      discount: (data['discount'] as num?)?.toDouble() ?? 0.0,
      cashback: (data['cashback'] as num?)?.toDouble() ?? 0.0,
      changeFor: (data['changeFor'] ?? '').toString().trim(),
      itemCount: (data['itemCount'] as int?) ?? 0,
      itemsSummary: (data['itemsSummary'] ?? '').toString().trim(),
      observation: (data['observation'] ?? '').toString().trim(),
      orderDateTime: (data['orderDateTime'] ?? '').toString().trim(),
      manualAnnotation: (data['manualAnnotation'] ?? '').toString().trim(),
    );
  }
}
