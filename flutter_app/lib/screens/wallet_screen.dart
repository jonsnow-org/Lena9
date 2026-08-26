import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth_service.dart';
import '../services/payment_api.dart';

/// إيداع وسحب حقيقيان — يستدعيان نفس /api/payments/* الموجودة أصلاً في
/// server.ts، بلا أي منطق مالي جديد. الإيداع يفتح نفس صفحة Stripe
/// Checkout المُستضافة (وليس نموذج بطاقة أصيلاً منفصلاً)، لأن هذا هو
/// بالضبط ما يفعله الموقع أيضاً — إعادة استخدام تام، لا تكرار.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final _paymentApi = PaymentApi();
  bool _isProcessing = false;

  Future<void> _showAmountDialog({required bool isDeposit}) async {
    final controller = TextEditingController();
    final amount = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isDeposit ? 'إيداع مبلغ' : 'طلب سحب'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: isDeposit ? 'المبلغ بالدولار (1 - 50,000)' : 'المبلغ بالدولار (٥٠ فأكثر)',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          FilledButton(
            onPressed: () {
              final value = double.tryParse(controller.text.trim());
              Navigator.pop(ctx, value);
            },
            child: const Text('متابعة'),
          ),
        ],
      ),
    );
    if (amount == null || amount <= 0) return;

    final idToken = await context.read<AuthService>().getIdToken();
    if (idToken == null || !mounted) return;

    setState(() => _isProcessing = true);
    final result = isDeposit
        ? await _paymentApi.createDepositCheckout(idToken: idToken, amount: amount)
        : await _paymentApi.requestPayout(idToken: idToken, amount: amount);
    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (!result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message ?? 'تعذّرت العملية. حاول مرة أخرى.')),
      );
      return;
    }

    if (isDeposit && result.checkoutUrl != null) {
      await launchUrl(Uri.parse(result.checkoutUrl!), mode: LaunchMode.inAppBrowserView);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message ?? 'تم بنجاح')),
      );
    }
  }

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
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FilledButton.icon(
                    onPressed: _isProcessing ? null : () => _showAmountDialog(isDeposit: true),
                    icon: const Icon(Icons.add),
                    label: const Text('إيداع'),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: _isProcessing ? null : () => _showAmountDialog(isDeposit: false),
                    icon: const Icon(Icons.arrow_upward),
                    label: const Text('سحب'),
                  ),
                ],
              ),
              if (_isProcessing) const Padding(
                padding: EdgeInsets.only(top: 16),
                child: CircularProgressIndicator(),
              ),
            ],
          ),
        );
      },
    );
  }
}
