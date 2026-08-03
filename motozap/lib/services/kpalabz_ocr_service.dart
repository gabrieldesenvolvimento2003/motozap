import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'ocr_service.dart';

/// OCR usando a API OpenAI-compatible do kpalabz
/// (endpoint aceita formato chat/completions com vision).
/// Faz retry automático com modelos diferentes em caso de falha.
class KpalabzOcrService {
  static const _endpoint = 'https://api.kpalabz.com/v1/chat/completions';

  // Modelos a tentar em ordem de preferência
  static const _models = ['gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-flash'];
  static const _maxRetries = 3;

  Future<String?> _apiKey() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('claude_api_key');
  }

  String get _prompt => '''
Analise esta foto de uma comanda (recibo) de delivery e extraia os dados em JSON.

Exemplo de resposta CORRETA:
{
  "orderNumber": "21",
  "customerName": "Nome do cliente",
  "customerPhone": "27 99243-7144",
  "address": "Rua Castro Alves, 170",
  "complement": "Condomínio Vista do Limoeiro / H407",
  "neighborhood": "São Diogo II, Serra - ES",
  "reference": "Ao lado do quiosque",
  "amount": 139.00,
  "paymentMethod": "PIX",
  "alreadyPaid": false,
  "scheduledFor": "01/08/2026 19:30",
  "deliveryFee": 9.00,
  "discount": 0,
  "cashback": 0,
  "changeFor": "150",
  "itemCount": 2,
  "itemsSummary": "100 Salgados Fritos (variados); 20 Salgados Fritos (Churros)",
  "observation": "Sem cebola na pizza",
  "orderDateTime": "01/08/2026 13:38",
  "manualAnnotation": "Pagou R\$ 169,33"
}

CAMPO A CAMPO:
- orderNumber: número após "Pedido #" (1-4 dígitos). NUNCA o ID Yooga de 8+ dígitos.
- customerPhone: formato "DD 9XXXX-XXXX" (10-11 dígitos). SEM DDI 55.
- address: SOMENTE rua e número. Sem complemento, sem bairro.
- complement: pode conter "Condomínio", "Apto", "Casa", "Bloco". Se não houver, use "".
- neighborhood: "Bairro, Cidade - UF". Extraído da linha após Complemento.
- reference: "" se for "Sem referência".
- amount: número com ponto (ex: 139.00). Use 0 se não houver valor.
- paymentMethod: APENAS o método — PIX, Débito, Crédito, Dinheiro. SEM prefixos como "Delivery -" ou "YOOGA ONLINE -".
- alreadyPaid: true se tiver "Pago online", "Não cobrar do cliente" ou "Ja esta PAGADO OK". false se tiver "Cobrar do cliente".
- scheduledFor: "dd/mm/yyyy HH:mm" se agendado, ou "" se não.
- deliveryFee: valor da "Taxa de entrega" (ex: 7.00, 9.00). Use 0 se não houver.
- discount: valor do "Desconto no PIX". Use 0 se não houver.
- cashback: valor do "Cashback resgatado". Use 0 se não houver.
- changeFor: "" se não houver info de troco.
- itemCount: número de linhas distintas na seção de itens.
- itemsSummary: resumo curto dos itens (ex: "100 Salgados Fritos; 20 Salgados Fritos").
- observation: anotações manuscritas ou observações nos itens. Use "" se não houver.
- orderDateTime: "dd/mm/yyyy HH:mm" visível na comanda. Use "" se não houver.
- manualAnnotation: info manuscrita importante (ex: "Pagou R\$ 169,33"). Use "" se não houver.

REGRAS CRÍTICAS:
- Responda APENAS com JSON válido. Sem markdown, sem texto antes ou depois.
- Se não conseguir ler um campo, use "" para string e 0 para número. NÃO invente dados.
- telefone SEMPRE deve ter 10 ou 11 dígitos. Se não conseguir ler, use "".
- amount SEMPRE deve ser > 0. Se não conseguir ler, use 0.
- customerName SEMPRE deve ter pelo menos 2 palavras. Se não conseguir ler, use "".
''';

  Future<ParsedOrder?> _callApi(String imagePath, String model) async {
    final apiKey = await _apiKey();
    if (apiKey == null || apiKey.isEmpty) {
      throw Exception('API key não configurada. Vá em Configurações.');
    }

    final imageBytes = await File(imagePath).readAsBytes();
    final base64Image = base64Encode(imageBytes);

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
      throw Exception('Erro API (${response.statusCode})');
    }

    final responseJson = jsonDecode(response.body) as Map<String, dynamic>;
    final choices = responseJson['choices'] as List?;
    if (choices == null || choices.isEmpty) {
      throw Exception('API não retornou resultado.');
    }

    final message = choices[0]['message'] as Map<String, dynamic>?;
    final content = (message?['content'] as String?)?.trim() ?? '';

    // Limpa markdown se vier envolvido
    var cleaned = content;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replaceFirst(RegExp(r'^```json\s*', caseSensitive: false), '');
      cleaned = cleaned.replaceFirst(RegExp(r'^```\s*'), '');
      cleaned = cleaned.replaceFirst(RegExp(r'\s*```$'), '');
    }

    debugPrint('=== OCR [$model] ===\n$cleaned\n=== END ===');

    final data = jsonDecode(cleaned) as Map<String, dynamic>;
    return _toParsedOrder(data);
  }

  ParsedOrder _toParsedOrder(Map<String, dynamic> data) {
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
      rawText: data.toString(),
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

  /// Verifica se o resultado tem campos mínimos úteis.
  bool _hasMinimumFields(ParsedOrder p) {
    return p.customerName.isNotEmpty &&
           p.address.isNotEmpty &&
           p.amount > 0;
  }

  /// Parseia uma comanda com retry automático em modelos diferentes.
  /// Tenta até _maxRetries modelos antes de retornar null.
  Future<ParsedOrder?> parseReceipt(String imagePath) async {
    String? lastError;

    for (int i = 0; i < _models.length; i++) {
      final model = _models[i];
      try {
        debugPrint('=== Tentando modelo: $model ($i+1/${_models.length}) ===');
        final result = await _callApi(imagePath, model);
        if (result == null) continue;

        // Verifica se tem campos mínimos
        if (_hasMinimumFields(result)) {
          debugPrint('=== Sucesso com $model ===');
          return result;
        }

        // Tem resultado mas campos mínimos faltando — tenta próximo modelo
        debugPrint('=== $model retornou campos insuficientes, tentando próximo ===');
        lastError = 'Campos insuficientes (nome/endereço/valor vazios)';
      } catch (e) {
        debugPrint('=== Erro com $model: $e ===');
        lastError = e.toString();
      }
    }

    debugPrint('=== Todos os modelos falharam: $lastError ===');
    return null;
  }
}
