import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import '../models/ad_campaign.dart';
import '../models/user_profile.dart';
import '../services/admin_service.dart';
import '../services/kyc_service.dart';

/// لوحة أدمن مبسّطة — أهم فعلين تشغيليين حقيقيين فقط (اعتماد/رفض توثيق
/// الهوية، واعتماد/رفض الحملات الإعلانية المعلّقة)، بنفس منطق KycReviewModal
/// وAdminAdsTab في الموقع تماماً. باقي لوحة الأدمن الكاملة (إدارة المستخدمين،
/// الإحصائيات، البث الجماعي...) تبقى عبر الموقع حالياً.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _adminService = AdminService();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('لوحة الأدمن'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'توثيق الهوية'),
            Tab(text: 'الحملات الإعلانية'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _KycReviewTab(adminService: _adminService),
          _CampaignsReviewTab(adminService: _adminService),
        ],
      ),
    );
  }
}

class _KycReviewTab extends StatelessWidget {
  final AdminService adminService;
  const _KycReviewTab({required this.adminService});

  Future<void> _openReview(BuildContext context, UserProfile user) async {
    final admin = FirebaseAuth.instance.currentUser;
    if (admin == null) return;
    showDialog(context: context, barrierDismissible: false, builder: (_) => const Center(child: CircularProgressIndicator()));
    final idToken = await admin.getIdToken();
    final doc = await KycService().fetchDocumentForReview(idToken: idToken!, userId: user.id);
    if (!context.mounted) return;
    Navigator.pop(context);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(user.fullName.isNotEmpty ? user.fullName : '@${user.username}'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (doc?.imageUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(doc!.imageUrl!, height: 180, fit: BoxFit.contain),
                ),
              const SizedBox(height: 8),
              Text('نوع الوثيقة: ${doc?.idType ?? '-'}'),
              Text('رقم الوثيقة: ${doc?.idNumber ?? '-'}'),
              Text('الاسم المستخرَج آلياً: ${doc?.extractedName ?? '-'}'),
              Text('درجة المطابقة: ${doc?.matchConfidence ?? '-'}'),
              if (doc?.aiReasoning.isNotEmpty == true) Text(doc!.aiReasoning, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إغلاق')),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () async {
              await adminService.rejectKyc(userId: user.id, reviewerId: admin.uid);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('رفض'),
          ),
          FilledButton(
            onPressed: () async {
              await adminService.approveKyc(userId: user.id, reviewerId: admin.uid);
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('اعتماد وتوثيق'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<UserProfile>>(
      stream: adminService.watchPendingKyc(),
      builder: (context, snap) {
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final users = snap.data!;
        if (users.isEmpty) return const Center(child: Text('لا توجد طلبات توثيق بانتظار المراجعة'));
        return ListView.builder(
          itemCount: users.length,
          itemBuilder: (context, i) {
            final u = users[i];
            return ListTile(
              leading: CircleAvatar(
                backgroundImage: u.avatarUrl.isNotEmpty ? NetworkImage(u.avatarUrl) : null,
                child: u.avatarUrl.isEmpty ? const Icon(Icons.person) : null,
              ),
              title: Text(u.fullName.isNotEmpty ? u.fullName : '@${u.username}'),
              subtitle: const Text('طلب توثيق قيد المراجعة'),
              trailing: const Icon(Icons.chevron_left),
              onTap: () => _openReview(context, u),
            );
          },
        );
      },
    );
  }
}

class _CampaignsReviewTab extends StatelessWidget {
  final AdminService adminService;
  const _CampaignsReviewTab({required this.adminService});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<AdCampaign>>(
      stream: adminService.watchPendingCampaigns(),
      builder: (context, snap) {
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final campaigns = snap.data!;
        if (campaigns.isEmpty) return const Center(child: Text('لا توجد حملات بانتظار المراجعة'));
        return ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: campaigns.length,
          itemBuilder: (context, i) {
            final c = campaigns[i];
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.campaignName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text('المعلن: ${c.advertiserName}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    if (c.adText.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(c.adText, maxLines: 3, overflow: TextOverflow.ellipsis),
                    ],
                    const SizedBox(height: 6),
                    Text('الميزانية المطلوبة: \$${c.requestedBudget.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                            onPressed: () => adminService.setCampaignStatus(c.id, 'rejected'),
                            child: const Text('رفض'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton(
                            onPressed: () => adminService.setCampaignStatus(c.id, 'active'),
                            child: const Text('اعتماد'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
