/// انعكاس مباشر لحقل kycDetails داخل مستند users/{uid} (وليس مجموعة
/// مستقلة) — يطابق KycDetails في src/types.ts. صورة الوثيقة نفسها لا تصل
/// إلى هذا النموذج إطلاقاً؛ فقط الحالة العامة الظاهرة للمستخدم نفسه.
class KycDetails {
  final String idType;
  final String idNumber;
  final String status; // 'verified' | 'pending' | 'rejected'
  final String? submittedAt;

  const KycDetails({
    required this.idType,
    required this.idNumber,
    required this.status,
    this.submittedAt,
  });

  static KycDetails? fromMap(Map<String, dynamic>? map) {
    if (map == null) return null;
    final status = (map['status'] ?? '') as String;
    if (status.isEmpty) return null;
    return KycDetails(
      idType: (map['idType'] ?? '') as String,
      idNumber: (map['idNumber'] ?? '') as String,
      status: status,
      submittedAt: map['submittedAt'] as String?,
    );
  }
}
