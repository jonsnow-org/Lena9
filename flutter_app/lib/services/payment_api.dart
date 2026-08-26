import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class PaymentApiResult {
  final bool success;
  final String? checkoutUrl;
  final String? error;
  final String? message;

  PaymentApiResult({required this.success, this.checkoutUrl, this.error, this.message});
}

/// يستدعي نفس endpoints الدفع الحقيقية في server.ts — لا خادم جديد، لا
/// منطق مالي مُعاد بناؤه هنا، فقط طلبات HTTP بنفس التوكن الذي يرسله
/// العميل الويب بالضبط (Authorization: Bearer <Firebase ID Token>).
class PaymentApi {
  Future<PaymentApiResult> createDepositCheckout({
    required String idToken,
    required double amount,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$kApiBaseUrl/api/payments/deposit/create-checkout'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({'amount': amount}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) {
        return PaymentApiResult(success: false, error: data['error'] as String?, message: data['message'] as String?);
      }
      return PaymentApiResult(success: true, checkoutUrl: data['checkoutUrl'] as String?);
    } catch (_) {
      return PaymentApiResult(success: false, message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    }
  }

  Future<PaymentApiResult> requestPayout({
    required String idToken,
    required double amount,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$kApiBaseUrl/api/payments/payout/create'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $idToken',
        },
        body: jsonEncode({'amount': amount}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode != 200) {
        return PaymentApiResult(success: false, error: data['error'] as String?, message: data['message'] as String?);
      }
      return PaymentApiResult(success: true, message: 'تم تنفيذ عملية السحب بنجاح.');
    } catch (_) {
      return PaymentApiResult(success: false, message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    }
  }
}
