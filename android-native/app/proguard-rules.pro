# Firebase/Firestore تعتمد على الانعكاس (reflection) لتحويل مستندات
# Firestore تلقائياً من/إلى صفوف بيانات Kotlin (@Serializable/data class) —
# بلا هذه القواعد يحذف R8 حقول الصفوف فتفشل كل عمليات القراءة صامتة دون أي
# خطأ ظاهر وقت البناء (نفس نمط عطل WorkManager الذي واجهناه سابقاً في
# flutter_app — انظر التعليق التاريخي في .github/workflows/build-flutter-apk.yml).
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers class studio.ai.literium.literium_app.data.model.** {
  <fields>;
  <init>();
}
-keep class studio.ai.literium.literium_app.data.model.** { *; }

-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
