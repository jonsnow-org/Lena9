import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

/// انعكاس مباشر لـ src/services/mediaApi.ts — يستدعي /api/media/upload
/// الموجود أصلاً في server.ts (رفع Cloudinary حقيقي)، بنفس معامل purpose.
class MediaUploadResult {
  final bool success;
  final String? url;
  final String? message;

  MediaUploadResult({required this.success, this.url, this.message});
}

class MediaService {
  Future<MediaUploadResult> upload({required String idToken, required String filePath, required String purpose}) async {
    try {
      final request = http.MultipartRequest('POST', Uri.parse('$kApiBaseUrl/api/media/upload'))
        ..headers['Authorization'] = 'Bearer $idToken'
        ..fields['purpose'] = purpose
        ..files.add(await http.MultipartFile.fromPath('file', filePath));

      final streamed = await request.send();
      final res = await http.Response.fromStream(streamed);
      final data = jsonDecode(res.body) as Map<String, dynamic>;

      if (res.statusCode != 200) {
        return MediaUploadResult(success: false, message: (data['message'] ?? 'تعذر رفع الملف.') as String);
      }
      return MediaUploadResult(success: true, url: data['url'] as String?);
    } catch (_) {
      return MediaUploadResult(success: false, message: 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    }
  }
}
