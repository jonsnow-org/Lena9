import 'package:cloud_firestore/cloud_firestore.dart';

/// انعكاس جزئي لواجهة AdCampaign في types.ts — فقط الحقول اللازمة لمراجعة
/// الأدمن (اعتماد/رفض) لا كل حقول لوحة المعلن الكاملة.
class AdCampaign {
  final String id;
  final String advertiserName;
  final String campaignName;
  final String description;
  final String imageUrl;
  final String adText;
  final String status;
  final double totalBudget;
  final double requestedBudget;

  const AdCampaign({
    required this.id,
    required this.advertiserName,
    required this.campaignName,
    required this.description,
    required this.imageUrl,
    required this.adText,
    required this.status,
    required this.totalBudget,
    required this.requestedBudget,
  });

  factory AdCampaign.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? {};
    return AdCampaign(
      id: doc.id,
      advertiserName: (data['advertiserName'] ?? '') as String,
      campaignName: (data['campaignName'] ?? '') as String,
      description: (data['description'] ?? '') as String,
      imageUrl: (data['imageUrl'] ?? '') as String,
      adText: (data['adText'] ?? '') as String,
      status: (data['status'] ?? '') as String,
      totalBudget: ((data['totalBudget'] ?? 0) as num).toDouble(),
      requestedBudget: ((data['requestedBudget'] ?? 0) as num).toDouble(),
    );
  }
}
