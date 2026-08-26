import 'package:flutter/material.dart';

/// المرحلة الأولى: عنصر نائب واضح فقط — نظام الرسائل الحقيقي في الموقع
/// معقّد (حضور لحظي، مؤشر كتابة، ملصقات، حظر/كتم) ويحتاج مرحلة منفصلة
/// لبنائه بدقة وموثوقية بدل نسخة منقوصة أو غير مضمونة الصحة الآن.
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.construction, size: 40, color: Colors.grey),
            SizedBox(height: 12),
            Text(
              'نظام الرسائل الكامل (حضور لحظي، ملصقات، حظر وكتم) قيد الإعداد '
              'للمرحلة القادمة — استخدم الموقع حالياً للرسائل.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
