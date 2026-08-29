import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/kyc_details.dart';
import '../services/kyc_service.dart';

const _kIdTypes = [
  'بطاقة الهوية الوطنية',
  'جواز سفر رسمي',
  'رخصة قيادة سارية',
  'سجل تجاري للشركات',
];

/// انعكاس مباشر لـ KycModal.tsx في الموقع — نفس الحقول والقيم ونفس منطق
/// الحالات الثلاث بعد الإرسال (موثّق فوراً / قيد المراجعة / مرفوض سابقاً
/// فيُسمح بإعادة الإرسال). لا يوجد مسار هنا لاسترجاع صورة الوثيقة بعد
/// رفعها، تماماً كما في الموقع — فقط حالة التوثيق العامة تُقرأ حياً.
class KycScreen extends StatefulWidget {
  final String uid;
  final String idToken;

  const KycScreen({super.key, required this.uid, required this.idToken});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  final _service = KycService();
  final _picker = ImagePicker();
  final _idNumberController = TextEditingController();
  String _idType = _kIdTypes.first;
  XFile? _pickedFile;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _idNumberController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    final file = await _picker.pickImage(source: source, imageQuality: 90);
    if (file == null) return;
    final sizeBytes = await file.length();
    if (sizeBytes > 8 * 1024 * 1024) {
      setState(() => _error = 'حجم الصورة يتجاوز 8 ميغابايت.');
      return;
    }
    setState(() {
      _pickedFile = file;
      _error = null;
    });
  }

  void _showImageSourceSheet() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('من المعرض'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('التقاط صورة'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_idNumberController.text.trim().isEmpty || _pickedFile == null) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });
    final result = await _service.submitKycDocument(
      idToken: widget.idToken,
      idType: _idType,
      idNumber: _idNumberController.text.trim(),
      filePath: _pickedFile!.path,
    );
    if (!mounted) return;
    setState(() => _isLoading = false);
    if (!result.success) {
      setState(() => _error = result.message);
      return;
    }
    // الحالة الفعلية تُعرض عبر StreamBuilder على users/{uid} أدناه — لا
    // حاجة لحفظ حالة محلية هنا، نفس ما يحدث في الموقع بعد نجاح الطلب.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('التحقق من الهوية (KYC)')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: FirebaseFirestore.instance.collection('users').doc(widget.uid).snapshots(),
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final data = snap.data!.data() ?? {};
          final kyc = KycDetails.fromMap(data['kycDetails'] as Map<String, dynamic>?);

          if (kyc != null && kyc.status == 'verified') {
            return _StatusCard(
              icon: Icons.verified_outlined,
              iconColor: Colors.teal,
              title: 'حسابك موثق ومعتمد بنجاح ✓',
              body: 'تمت مراجعة الوثيقة الرسمية (${kyc.idType}: ${kyc.idNumber}) واعتماد حسابك. '
                  'يمكنك الآن سحب وإيداع الأرباح بحرية كاملة.',
            );
          }
          if (kyc != null && kyc.status == 'pending') {
            return _StatusCard(
              icon: Icons.access_time_outlined,
              iconColor: Colors.amber.shade700,
              title: 'تم إرسال طلب التوثيق — قيد المراجعة',
              body: 'استلمنا وثيقتك (${kyc.idType}: ${kyc.idNumber}) وسيراجعها فريق ليتيريوم يدوياً '
                  'خلال 24 إلى 48 ساعة. سيصلك إشعار فور اعتماد حسابك.',
            );
          }

          return _buildForm(context, wasRejected: kyc?.status == 'rejected');
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context, {required bool wasRejected}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (wasRejected)
            _InfoBanner(
              icon: Icons.error_outline,
              color: Colors.red,
              text: 'تم رفض طلب التوثيق السابق. راجع بياناتك وأرسل طلباً جديداً بمعلومات ووثيقة صحيحة وواضحة.',
            ),
          if (_error != null)
            _InfoBanner(icon: Icons.error_outline, color: Colors.red, text: _error!),
          _InfoBanner(
            icon: Icons.lock_outline,
            color: Colors.teal,
            text: 'صورة وثيقتك تُرفع مباشرة إلى خوادمنا الداخلية بشكل آمن ومشفَّر، ولا يمكن لأي طرف — '
                'بما فيك أنت بعد اعتمادها — عرضها مرة أخرى. تُستخدم فقط لمطابقة اسمها مع اسم حسابك آلياً.',
          ),
          const SizedBox(height: 8),
          const Text('نوع الوثيقة الرسمية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _idType,
            items: _kIdTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            onChanged: (v) => setState(() => _idType = v ?? _idType),
            decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
          ),
          const SizedBox(height: 16),
          const Text('رقم الوثيقة / الهوية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(height: 6),
          TextField(
            controller: _idNumberController,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              isDense: true,
              hintText: 'مثال: SA1092841...',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 16),
          const Text('صورة واضحة للوثيقة (يظهر فيها اسمك كاملاً)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: _showImageSourceSheet,
            child: _pickedFile != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.file(File(_pickedFile!.path), height: 160, width: double.infinity, fit: BoxFit.cover),
                  )
                : Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade400, style: BorderStyle.solid, width: 1.5),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.camera_alt_outlined, size: 28),
                        SizedBox(height: 8),
                        Text('انقر لاختيار صورة الوثيقة', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        SizedBox(height: 4),
                        Text('JPG أو PNG، حتى 8 ميغابايت', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      ],
                    ),
                  ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: (_isLoading || _idNumberController.text.trim().isEmpty || _pickedFile == null) ? null : _submit,
            child: Text(_isLoading ? 'جاري رفع الوثيقة والتحقق...' : 'إرسال طلب التوثيق (KYC)'),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String body;

  const _StatusCard({required this.icon, required this.iconColor, required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: iconColor),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            const SizedBox(height: 8),
            Text(body, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;

  const _InfoBanner({required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 11, color: color, height: 1.5))),
        ],
      ),
    );
  }
}
