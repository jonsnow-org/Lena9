import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

/// انعكاس مباشر لـ src/services/kycApi.ts — يرفع صورة الوثيقة عبر
/// /api/kyc/submit الموجود أصلاً في server.ts (رفع Cloudinary بنوع
/// "authenticated" + مطابقة اسم بالذكاء الاصطناعي). لا رابط للصورة يعود
/// لهذا العميل مطلقاً، فقط حالة النتيجة.
class KycSubmitResult {
  final bool success;
  final String? status; // 'verified' | 'pending'
  final String message;

  KycSubmitResult({required this.success, this.status, required this.message});
}

class KycDocumentReview {
  final String? imageUrl;
  final String idType;
  final String idNumber;
  final String extractedName;
  final String matchConfidence;
  final String aiReasoning;

  KycDocumentReview({
    this.imageUrl,
    required this.idType,
    required this.idNumber,
    required this.extractedName,
    required this.matchConfidence,
    required this.aiReasoning,
  });
}

class KycService {
  /// انعكاس مباشر لـ fetchKycDocumentForReview في kycApi.ts — للأدمن فقط
  /// (GET /api/kyc/document/:userId، يتحقق الخادم من صلاحية الأدمن نفسه).
  Future<KycDocumentReview?> fetchDocumentForReview({required String idToken, required String userId}) async {
    try {
      final res = await http.get(
        Uri.parse('$kApiBaseUrl/api/kyc/document/$userId'),
        headers: {'Authorization': 'Bearer $idToken'},
      );
      if (res.statusCode != 200) return null;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return KycDocumentReview(
        imageUrl: data['imageUrl'] as String?,
        idType: (data['idType'] ?? '') as String,
        idNumber: (data['idNumber'] ?? '') as String,
        extractedName: (data['extractedName'] ?? '') as String,
        matchConfidence: (data['matchConfidence'] ?? 'none') as String,
        aiReasoning: (data['aiReasoning'] ?? '') as String,
      );
    } catch (_) {
      return null;
    }
  }

  Future<KycSubmitResult> submitKycDocument({
    required String idToken,
    required String idType,
    required String idNumber,
    required String filePath,
  }) async {
    try {
      final request = http.MultipartRequest('POST', Uri.parse('$kApiBaseUrl/api/kyc/submit'))
        ..headers['Authorization'] = 'Bearer $idToken'
        ..fields['idType'] = idType
        ..fields['idNumber'] = idNumber
        ..files.add(await http.MultipartFile.fromPath('document', filePath));

      final streamed = await request.send();
      final res = await http.Response.fromStream(streamed);
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      if (res.statusCode != 200) {
        return KycSubmitResult(success: false, message: (data['message'] ?? 'تعذر إرسال طلب التوثيق.') as String);
      }
      return KycSubmitResult(success: true, status: data['status'] as String?, message: (data['message'] ?? '') as String);
    } catch (_) {
      return KycSubmitResult(success: false, message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    }
  }
}
