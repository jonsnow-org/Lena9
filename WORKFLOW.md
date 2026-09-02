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

- 🔲 قرار المستخدم: الاعتماد على **AdMob** كشبكة أساسية للتطبيق + بقية الشبكات
  (Adsterra بوحدات متعددة الأحجام حسب الأكواد المرسلة، PropellerAds) بنفس آلية
  الويب: زر تفعيل/إيقاف لكل شبكة من لوحة الأدمن، بلا بانرات افتراضية حتى تُفعَّل.
- 🔲 توسيع `ExternalAdNetworkConfig`/`ExternalAdsConfig` (`externalAdsStore.ts`)
  لدعم عدة وحدات إعلانية مسماة لكل شبكة (بدل حقل `snippet` واحد) — يحل مشكلة
  "لا يوجد سوى مربع لصق واحد" التي ذكرها المستخدم.
- 🔲 تشخيص سبب عدم ظهور أي إعلان على الويب حالياً (مهمة #131) — الفرضية الأولى:
  لم تُفعَّل أي شبكة/حملة بعد فلا شيء يظهر بتصميم النظام (لا بانر افتراضي)؛
  الفرضية الثانية (بحاجة تحقق فعلي): عزل الـ iframe في `ExternalAdScript.tsx`
  (sandbox بلا allow-same-origin) قد يمنع بعض سكربتات الشبكات من العمل حتى لو
  فُعِّلت، لأنها تعمل داخل مستند بأصل معزول (opaque origin) — يحتاج اختبار فعلي
  بعد تفعيل شبكة حقيقية.
- 🔲 مراجعة كل خانات الإعلانات (داخلية/خارجية) وتنظيمها وتكرارها وتناوبها
  (مهمة #130) بعد إنجاز إعادة التنظيم أعلاه.

## 4. الربح التلقائي وترقية الحساب

- 🔲 التحقق من `src/utils/creatorEligibility.ts` (شروط الأهلية) مقابل أي منطق
  مكافئ في كوتلين، والتأكد أن بطاقة "قارئ" تتحول تلقائياً إلى "كاتب" عند تحقق
  الشروط في كلا النسختين (مهمة #128).

## 5. الشكل العام (ألوان/حواف/أزرار)

- 🔲 مهمة #123: مراجعة الحواف الدائرية وألوان الأزرار في كل شاشة، بالاستناد
  للقطات الشاشة الفعلية المرسلة من المستخدم، وليس تخميناً.

## قواعد العمل الثابتة لهذا الملف

1. كل ميزة جديدة أو مُصلَحة على الويب **يجب** أن تُسجَّل هنا وتُنقَل لكوتلين قبل
   اعتبار الدفعة مكتملة.
2. لا تُعتبر أي صف "✅" إلا بعد تحقق فعلي (قراءة كود + اختبار منطقي)، لا افتراضاً.
3. يُحدَّث هذا الملف في كل جلسة عمل تالية قبل الإغلاق.
