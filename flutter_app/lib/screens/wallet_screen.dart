import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

/// عرض الرصيد الحي فقط — الإيداع/السحب عبر Stripe غير مفعّل هنا حالياً
/// (لا يوجد حساب Stripe/PayPal حقيقي مُعدّ لهذا التطبيق بعد). الموقع
/// نفسه غير متأثر بهذا؛ محفظته تعمل كما هي دون أي تغيير.
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
                  'الإيداع والسحب من داخل التطبيق قريباً — استخدم الموقع حالياً لإدارة رصيدك.',
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
