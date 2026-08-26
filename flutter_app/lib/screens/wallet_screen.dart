import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

/// المرحلة الأولى: عرض الرصيد الحقيقي فقط (قراءة مباشرة من users/{uid}
/// في Firestore، نفس المستند الذي يقرأ منه الموقع بالضبط). الإيداع
/// والسحب الفعليان (يحتاجان flutter_stripe SDK منفصل) في المرحلة التالية.
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final uid = context.watch<AuthService>().user?.uid;
    if (uid == null) return const SizedBox.shrink();

    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: FirebaseFirestore.instance.collection('users').doc(uid).snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data!.data() ?? {};
        final available = (data['availableBalance'] as num?) ?? (data['walletBalance'] as num?) ?? 0;

        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('الرصيد المتاح', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                '\$${available.toStringAsFixed(2)}',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'الإيداع والسحب من داخل التطبيق قيد الإعداد — استخدم الموقع حالياً لهذه العمليات.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
