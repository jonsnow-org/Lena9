# خريطة عمل: تطابق تطبيق كوتلين مع نسخة الويب (Literium)

مرجع دائم يُحدَّث مع كل دفعة عمل. الهدف: لا تُفقد أي ميزة من `src/` (الويب) أثناء
نقلها إلى `android-native/` (كوتلين). كل بند إما ✅ (مطابق ومتحقَّق) أو 🔲 (بحاجة
لمراجعة/إصلاح) أو ➖ (غير منطبق على تطبيق جوال بطبيعته).

آخر تحديث: 2026-09-02.

## 1. الصفحات والمكوّنات الرئيسية

| الويب (`src/components/`) | كوتلين (`ui/screens/`) | الحالة |
|---|---|---|
| LandingPage / SplashScreen | auth/ | ✅ |
| AuthModal | auth/ | ✅ |
| TopHeader + DrawerMenu | MainScaffold + drawer | ✅ (مُدمَجة سابقاً) |
| BottomNav | MainScaffold bottom bar | ✅ |
| TweetFeed / TweetCard / TweetComposer | feed/ + tweet/ | ✅ (بحث/فلترة/حذف تعليق أُضيفت هذه الدفعة) |
| ArticleCard / ArticleReader | feed/ + article/ | ✅ |
| ArticleEditorModal | article/ (محرر) | 🔲 يحتاج مراجعة أدوات AI والفئات |
| ExploreView | explore/ | ✅ (بحث مفعّل مسبقاً) |
| UserProfileView / WriterProfileView | profile/ | 🔲 جزء من مراجعة الشكل العام |
| EditProfileModal | profile/ | ✅ |
| FollowListModal | follow/ | ✅ |
| DirectMessagesModal + ChatStickers | messages/ | ✅ |
| NotificationsModal | notifications/ | ✅ |
| WalletModal / MoneyRequestModal | wallet/ | ✅ |
| KycModal | kyc/ | ✅ |
| SubscriptionModal | subscription/ | ✅ |
| ImageStudioModal (Gemini) | imagestudio/ | ✅ |
| PoliciesModal / LegalPages | policies/ | ✅ |
| AdSlot / AdTickerBar / ExternalAdScript / SmartAdBanner | ads/ | 🔲 Adsterra مكتمل (كتالوج وحدات + تبديل فردي)، AdMob لم يبدأ بعد (مهام #129 #130 #131) |
| CreatorEligibilityCard | — | ✅ منطق الأهلية والترقية التلقائية متطابق ومتحقَّق (مهمة #128) — لكن أُصلح خطأ حقيقي: عائد الإعلانات الداخلية للكاتب كان يُمنح دون تحقق من الشروط إطلاقاً في كوتلين |
| PromoteArticleModal / SocialPromoCta / NewCampaignModal | ads/ + wallet | 🔲 يحتاج تحقق |
| AdvertiserDashboard | — | 🔲 تحقق من وجودها لتطبيق كوتلين للمعلنين |
| AppUpdateWidget | ➖ (APK تُحدَّث عبر متجر/رابط مباشر لا داخل التطبيق) |

## 2. لوحة تحكم الأدمن (10 تبويبات كلا الجانبين)

| الويب (`components/admin/`) | كوتلين (`admin/tabs/`) | الحالة |
|---|---|---|
فحص شامل اكتمل (مهمة #127) لكل التبويبات العشرة — لا خطر انهيار متبقٍ في أي
منها. الحالة التفصيلية:

| الويب (`components/admin/`) | كوتلين (`admin/tabs/`) | الحالة |
|---|---|---|
| AdminOverviewTab | OverviewTab.kt | ✅ نظيف |
| AdminUsersTab | UsersTab.kt | ✅ نظيف |
| AdminFinanceTab | FinanceTab.kt | ✅ سبب انهيار "المالية" مُصلح ومتحقَّق؛ 🔲 عائد الإعلانات الخارجية للكاتب مفقود كلياً (مهمة #132)؛ ✅ حماية الاعتماد المزدوج على الموافقات المالية أُضيفت |
| AdminAdsTab | CampaignsTab.kt | ✅ سبب انهيار "الإعلانات" مُصلح؛ ✅ Adsterra مُعاد تنظيمها؛ ✅ حماية الاعتماد المزدوج على موافقة الحملات أُضيفت |
| AdminContentTab | ModerationTab.kt | ✅ نظيف (فلتر تصنيف واحد مفقود، تجميلي) |
| AdminChatsTab | ChatsTab.kt | ✅ نظيف (معاينة وسائط مضمّنة مفقودة، تجميلي) |
| AdminAnalyticsTab | AnalyticsTab.kt | ✅ نظيف — زر التصفير و3 تبويبات فرعية والرسم البياني غائبة عمداً (لا مسار خادم متاح للجوال، موثَّق في الكود نفسه). بند "اليوم" مؤجل بطلب المستخدم |
| AdminFraudTab | FraudTab.kt | ✅ نظيف (فلتر حالة + بحث نصي مفقودان، تجميلي) |
| AdminBotsTab | BotsTab.kt | ✅ نظيف — زر "إنشاء 8 حسابات بوت" غائب عمداً (نفس سبب Analytics) |
| AdminSettingsTab | SettingsTab.kt | ✅ نظيف |
| BalanceAdjustModal | BalanceAdjustDialog.kt | ✅ موجود ومربوط؛ ✅ تأكيد ثانٍ للمبالغ ≥500$ أُضيف |
| KycReviewModal | KycReviewDialog.kt | ✅ نظيف |

## 3. نظام الإعلانات (أولوية حالية)

ترتيب الطبقات في `AdSlot` على الويب: راعي القسم ← حملة داخلية معتمدة ← شبكة
خارجية مؤهّلة (PropellerAds/Adsterra/Taboola عبر `externalAdsStore.ts`) ← لا شيء.

- ✅ Adsterra: كتالوج 7 وحدات حقيقية ثابتة في الكود (ويب: `adsterraUnits.ts`،
  كوتلين: `AdsterraUnits.kt` — نسخة مطابقة حرفياً)، تبديل فردي لكل وحدة + مفتاح
  شبكة رئيسي + مفتاح شامل "متوافقة مع APK"، مربوطة بنفس مستند
  `settings/externalAds` فتتحكم لوحة الويب الواحدة بالمنصتين معاً. لا حاجة لمربع
  لصق بعد الآن — حُلّت مشكلة "مربع لصق واحد فقط".
- 🔲 AdMob كشبكة أساسية للتطبيق — لم يبدأ بعد، بانتظار App ID ومعرّفات الوحدات
  الإعلانية من حساب المستخدم (لا يمكن توليدها).
- ✅ تشخيص سبب عدم ظهور الإعلانات على الويب (مهمة #131): الإعدادات الافتراضية
  لكل الشبكات كانت "معطّلة" ما لم يحفظ الأدمن يدوياً، ونظام Adsterra القديم
  اعتمد على مربع لصق هش. بعد تفعيل الوحدات الجديدة افتراضياً (enabled=true)
  يجب أن تبدأ الإعلانات بالظهور فعلياً — يحتاج تأكيداً بصرياً من المستخدم بعد
  النشر. نوع الإعلان المستخدم ('format':'iframe') يعمل بأمان داخل الإطارات
  المعزولة (opaque origin) فمخاوف العزل السابقة غير مؤثرة.
- ✅ مراجعة تنظيم كل مواضع الإعلانات (مهمة #130): جدول `SLOT_CONFIG` (13 موضعاً)
  منسوخ حرفياً في كوتلين بنفس حصص الكاتب. وجدت وأصلحت 3 مواضع كانت معرَّفة لكن
  غير مستخدَمة إطلاقاً في كوتلين: `reader_profile`، `writer_profile_top`،
  `writer_profile_feed` (فقدان إيرادات حقيقي للكُتّاب) — أُضيفت الآن بنفس شرط
  ومكان الويب تماماً.
- ✅ عائد الكُتّاب من مشاهدات الشبكات الخارجية (مهمة #132): كان غائباً كلياً في
  كوتلين (`processAdEvents` كان يهمل أحداث `isExternalAdView` بلا احتساب ولا
  إمكانية استرجاع). أُضيفت `processExternalAdRevenue()` مطابقة لـ
  `handleProcessExternalAdRevenue` في الويب، مع زر مستقل في تبويب "المالية".

## 4. الربح التلقائي وترقية الحساب

- ✅ تحقّق (مهمة #128): منطق `creatorEligibility.ts` ونظيره `CreatorEligibility.kt`
  متطابقان تماماً، والترقية التلقائية قارئ→كاتب تعمل تفاعلياً وصحيحاً في
  `ProfileViewModel`/`WriterProfileViewModel`. لكن وُجد خطأ حقيقي: نقطتا احتساب
  الربح الفعلي في `AdminViewModel` (عائد الإعلانات الداخلية، وشراء المقالات
  المقفلة) لم تكونا تتحققان من الشروط أصلاً/كانتا تستخدمان عدد متابعين مزيّف
  (صفر دائماً) — أُصلح الاثنان بربط عدد متابعين حقيقي من مجموعة `follows`.

## 5. الشكل العام (ألوان/حواف/أزرار)

- 🔲 مهمة #123: مراجعة الحواف الدائرية وألوان الأزرار في كل شاشة، بالاستناد
  للقطات الشاشة الفعلية المرسلة من المستخدم، وليس تخميناً.

## قواعد العمل الثابتة لهذا الملف

1. كل ميزة جديدة أو مُصلَحة على الويب **يجب** أن تُسجَّل هنا وتُنقَل لكوتلين قبل
   اعتبار الدفعة مكتملة.
2. لا تُعتبر أي صف "✅" إلا بعد تحقق فعلي (قراءة كود + اختبار منطقي)، لا افتراضاً.
3. يُحدَّث هذا الملف في كل جلسة عمل تالية قبل الإغلاق.
