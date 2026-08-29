import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/ad_campaign.dart';
import '../models/user_profile.dart';

/// انعكاس مباشر لأفعال الأدمن الأساسية في App.tsx (اعتماد/رفض التوثيق،
/// اعتماد/رفض الحملات) — نفس الكتابات المباشرة على Firestore بالضبط.
class AdminService {
  final _db = FirebaseFirestore.instance;

  Stream<List<UserProfile>> watchPendingKyc() {
    return _db
        .collection('users')
        .where('kycDetails.status', isEqualTo: 'pending')
        .snapshots()
        .map((snap) => snap.docs.map(UserProfile.fromFirestore).toList());
  }

  Future<void> approveKyc({required String userId, required String reviewerId}) async {
    await _db.collection('users').doc(userId).update({
      'isKycVerified': true,
      'kycDetails.status': 'verified',
    });
    await _db.collection('kycDocuments').doc(userId).update({
      'decision': 'manually_approved',
      'reviewedAt': DateTime.now().toIso8601String(),
      'reviewedBy': reviewerId,
    });
  }

  Future<void> rejectKyc({required String userId, required String reviewerId}) async {
    await _db.collection('users').doc(userId).update({
      'isKycVerified': false,
      'kycDetails.status': 'rejected',
    });
    await _db.collection('kycDocuments').doc(userId).update({
      'decision': 'rejected',
      'reviewedAt': DateTime.now().toIso8601String(),
      'reviewedBy': reviewerId,
    });
  }

  Stream<List<AdCampaign>> watchPendingCampaigns() {
    return _db
        .collection('campaigns')
        .where('status', isEqualTo: 'pending')
        .snapshots()
        .map((snap) => snap.docs.map(AdCampaign.fromFirestore).toList());
  }

  Future<void> setCampaignStatus(String campaignId, String status) {
    return _db.collection('campaigns').doc(campaignId).update({'status': status});
  }
}
