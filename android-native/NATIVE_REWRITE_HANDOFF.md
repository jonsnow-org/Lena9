# ملاحظة تسليم: إعادة كتابة تطبيق Literium بواجهات Kotlin/Jetpack Compose الأصلية

> للعميل/المطوّر الذي يكمل العمل. آخر تحديث: 2026-11-09. الفرع: `claude/project-error-analysis-zhu2ux`.
> رد المالك دائماً بالعربية وباختصار. لا تدفع بالقوة. لا تلمس الويب (React) ولا الخادم إلا لضرورة.

## 1) الهدف
المالك يريد تطبيق أندرويد **أصلياً بالكامل** (Compose، بلا WebView) **مطابقاً 100% بصرياً** للتطبيق الحالي
المبني بـReact في `src/` (مصدر الحقيقة للمظهر والسلوك). الكود الأصلي يعيش في
`android-native/app/src/main/kotlin/studio/ai/literium/literium_app/`.
الاتصال بالبيانات: Firestore/Firebase Auth مباشرة + الخادم `server.ts` (لا يتغيّر).

## 2) الوضعان داخل نفس المشروع
- **الإنتاج (الافتراضي):** `MainActivity` يعرض الموقع في WebView (ما يراه المستخدمون الآن). لا تكسره.
- **التجريبي الأصلي:** `-PnativeUi=true` ⇒ `BuildConfig.NATIVE_UI=true` ⇒ `MainActivity.setContent` يعرض
  `LiteriumNavHost()` (شاشات Compose) بدل WebView. يُبنى فقط بتشغيل يدوي للـworkflow:
  `build-kotlin-apk.yml` ← `workflow_dispatch` بمدخل `native_ui=true` على الفرع، وينشر الناتج في
  `public/downloads/Literium-native.apk` (على الفرع فقط، لا يلمس `Literium.apk` ولا إصدارات GitHub).
  أي دفع يمسّ `android-native/**` يبني الوضع الإنتاجي (يفيد كفحص ترجمة).
- لا يوجد Android SDK/محاكي في بيئة العمل ⇒ **التحقق الوحيد من الترجمة هو CI** (~9 دقائق). سجل Gradle صار
  مفلتراً من أسطر stack-trace فأخطاء Kotlin تظهر كأسطر `e: file:///...`؛ اقرأها بـ`get_job_logs` (`tail_lines≈300`).

## 3) أسلوب المطابقة (القواعد)
1. اقرأ مكوّن الويب (`src/components/X.tsx`) وانسخ **أصناف Tailwind حرفياً** إلى Compose:
   `p-4`=16dp، `rounded-2xl`=16dp، `text-xs`=12sp، `gap-2`=8dp، `border`=1dp…
2. استخدم الأدوات في `ui/theme/`:
   - `Tw.*` ألوان (slate/rose/amber/emerald/sky/blue/teal…)، `brand.s50..s950` ألوان قالب الأدمن الحي،
     `isDark`/`pick()` للوضع الداكن (الويب الافتراضي: فاتح).
   - `Lu.*` أيقونات Lucide الفعلية (مولّدة آلياً في `LucideIcons.kt` من lucide-react 0.546 — لا تعدّلها يدوياً؛
     لإضافة أيقونة: أضف اسمها لقائمة الاستيراد وأعد التوليد بسكربت `genicons.py` كما في سجل الجلسة، أو اكتب مسارها).
     رسمها عبر `LuIcon(icon, size, tint)`.
   - `twClickable(pressScale=…)` نقرة بلا ripple مع `active:scale-N`. `twText(size, weight, lineHeight)` خط Cairo.
   - `neutralButton/neutralButtonText/solidSheen/trBrush/mixColors` تحاكي طبقة ألوان الأزرار المركزية في `src/index.css`
     (الأزرار المحايدة bg-white/slate تأخذ تدرّجاً بلون الزر؛ الصلبة تأخذ لمعة).
   - `arNum()/arDigits()` أرقام هندية كما `toLocaleString('ar-EG')`.
3. الاتجاه RTL مفروض في جذر الوضع الأصلي (`LocalLayoutDirection=Rtl`). `Modifier.offset(x)` يعكس تلقائياً؛
   «لـ end/start» استعمل Start/End لا Left/Right. الأزرار العائمة في الويب بإحداثيات فيزيائية (`left-4`)
   ⇒ في Compose RTL هي `Alignment.BottomEnd`.
4. **لا تستخدم Material3 الافتراضي** (Card/Button/TextField/NavigationBar…) في الواجهات: اكتب بـBox/Row/Column + `background/border/clip`.
   مسموح: `DropdownMenu`, `Dialog`, `PullToRefreshBox`, `CircularProgressIndicator` مع تلوينها.
5. أبقِ منطق ViewModel/Repository الموجود (مكتمل وسليم إلى حد كبير)؛ غيّر **الواجهة** فقط. لكن قارن حقول
   النماذج `data/model/*` مع `src/types.ts` — وُجدت فروق قديمة (مثلاً نقص `Tweet.mediaType`، ونقص إعداد `teal` الافتراضي).

## 4) المنجز (المرحلة 1 ✅ مُرسلة للمالك)
- أساس: `Tw.kt`, `TwUi.kt`, `LucideIcons.kt`, خط `res/font/cairo_var.ttf`, `res/drawable-nodpi/web_icon.png`,
  `Theme.kt` (فاتح افتراضي، يقرأ تفضيل المستخدم، `LocalBrand`), `ThemePresets.kt` (+teal الافتراضي), `Color.kt`.
- الهيكل: `TopHeaderBar`, `LiveClock`(+نقطة الحالة), `BottomNavBar`, `DrawerMenu`(`DrawerOverlay` يسار في RTL), `MainScaffold`
  (بلا FAB؛ الأزرار العائمة داخل شاشة الرئيسية فقط).
- الرئيسية: `ui/screens/feed/FeedScreen.kt` + `HomeFeedParts.kt` (مبدّل، بحث، شرائح، مميز، رائج، هياكل، حالة فارغة),
  `ui/components/ArticleCard.kt`.
- التغريد: `TweetCard.kt`, `TweetComposerBar.kt` (إبلاغ/مشاركة/تعليقات/ردود/فيديو).

## 5) المتبقي (بهذا الترتيب تقريباً) — كل بند: اقرأ مكوّن الويب ثم أعد كتابة واجهة الشاشة
| # | الشاشة (Kotlin) | مرجع الويب |
|---|---|---|
| 1 | `ui/screens/auth/*` (Splash/Login/Register/Forgot/Reset) | `AuthModal.tsx`, `ResetPasswordModal`, App.tsx سطر ~593 (التطبيق بلا جلسة ⇒ شاشة دخول **إلزامية** بخلفية `brand-950→slate-950`، بلا تصفّح زائر ⇒ عدّل SplashScreen ليوجّه غير المسجّل إلى Login) |
| 2 | `ui/screens/article/ArticleReaderScreen.kt`, `ArticleEditorScreen.kt` | `ArticleReader.tsx`, `ArticleEditorModal.tsx` |
| 3 | `ui/screens/explore/*` | `ExploreView.tsx` |
| 4 | `ui/screens/profile/*` (Profile/WriterProfile/EditProfile), follow list | `UserProfileView.tsx`, `WriterProfileView.tsx` |
| 5 | `ui/screens/notifications/*`, `messages/*` (Messages/Chat/NewConversation) | `DirectMessagesModal.tsx`, إشعارات App |
| 6 | `wallet/*`, `kyc/*`, `subscription/*`, `ads/*` (Dashboard/NewCampaign/Promote), `ui/ads/AdSlot.kt` | `WalletModal`, `KycModal`, `SubscriptionModal`, `AdvertiserDashboard`, `NewCampaignModal`, `AdSlot.tsx` |
| 7 | `aiassistant/*`, `imagestudio/*`, `policies/*`, `ui/screens/admin/**` | `AiAssistantModal`, `ImageStudioModal`, `LegalPages`, `components/admin/*` |
| 8 | `navigation/LiteriumNavHost.kt` | مراجعة أن كل مسار يعرض الشاشة الجديدة |

ملاحظات: الويب يخفي أرباح الكتّاب (`WRITER_MONETIZATION_ENABLED=false`) فلا تعرض نصوص/شارات الأرباح؛ إعلانات الويب
(Adsterra/Start.io/داخلية) لها منطق في `src/utils/adCampaigns.ts` و`AdSlot.tsx` — الأصلي يستخدم Start.io SDK للبانر.

## 6) سير العمل لكل دفعة
1. اكتب الواجهة. 2. `git add -A android-native && git commit` (الذيل: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` و`Claude-Session: https://claude.ai/code/session_01UZMMvSjkRsFXzMywrihgYK`).
3. `git pull --rebase origin <الفرع>` ثم `git push origin <الفرع>` (الدفع يبني وضع الإنتاج للتحقق من الترجمة).
4. شغّل الوضع الأصلي: `mcp__github__actions_run_trigger` (workflow `build-kotlin-apk.yml`, ref الفرع, inputs `{"native_ui":"true"}`).
5. بعد النجاح يظهر `public/downloads/Literium-native.apk` على الفرع (`git show origin/<الفرع>:public/downloads/Literium-native.apk`)
   فأرسله للمالك بـSendUserFile. الدمج في `main` فقط حين يطلب المالك (مصرَّح سابقاً لكن لا تفعله لهذا الوضع التجريبي دون حاجة).
6. أخطاء الترجمة الشائعة هنا: نسيان `import androidx.compose.ui.draw.drawBehind`/`animateFloat`، نداء `@Composable` داخل lambda غير composable
   (احسب `LocalXxx.current` خارج lambda)، `padding` سالب (استعمل `offset`)، `by` يحتاج `getValue/setValue`.

## 7) ما يخصّ المالك (لا تفعله أنت)
نشر `firestore.rules` من Firebase Console، ضغط «Publish» في AI Studio، رفع الـAPK للمتاجر، وإدخال أي أسرار.
