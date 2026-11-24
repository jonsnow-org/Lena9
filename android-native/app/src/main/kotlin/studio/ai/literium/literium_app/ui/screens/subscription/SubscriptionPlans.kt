package studio.ai.literium.literium_app.ui.screens.subscription

import studio.ai.literium.literium_app.data.model.SubscriptionPlan

/**
 * Static plan catalog — not a Firestore document, just the fixed pricing table `SubscriptionModal`
 * renders (spec §4.13/§12.5). Ported field-for-field from `src/utils/aiQuota.ts`'s `SUBSCRIPTION_PLANS`.
 */
val SUBSCRIPTION_PLANS: List<SubscriptionPlan> = listOf(
    SubscriptionPlan(
        id = "monthly",
        name = "باقة Pro الشهرية",
        nameEn = "Monthly Pro Plan",
        price = 9.99,
        periodLabel = "شهرياً",
        badge = "الأكثر مرونة",
        aiLimitLabel = "200 استعلام ذكي / شهرياً",
        features = listOf(
            "200 استعلام شهرياً مدعوم بالذكاء الاصطناعي",
            "توليد هياكل ومقالات كاملة بضغطة زر واحدة",
            "تدقيق لغوي، إملائي وبلاغي متقدم للنصوص الطويلة",
            "مساعد كتابة تفاعلي للإلهام وصياغة الأفكار 24/7",
            "أولوية معالجة سريعة وشارة Pro في الملف الشخصي"
        ),
        popular = false
    ),
    SubscriptionPlan(
        id = "annual",
        name = "باقة Unlimited السنوية VIP",
        nameEn = "Annual Unlimited VIP",
        price = 79.99,
        periodLabel = "سنوياً (وفر 35%)",
        badge = "الأفضل قيمة ★",
        aiLimitLabel = "استخدام غير محدود طوال العام ♾️",
        features = listOf(
            "استخدام غير محدود بالكامل للذكاء الاصطناعي طوال العام",
            "شارة VIP الذهبية الملكية 👑 بجانب اسمك ومقالاتك",
            "أولوية قصوى على الخوادم وأعلى سرعة استجابة بدون انتظار",
            "تحليلات ذكية وتوقعات متقدمة لمعدلات قراءة ومبيعات مقالاتك",
            "ميزات حصرية وتحديثات ذكاء اصطناعي تجريبية قبل الجميع",
            "توفير 35% مقارنة بالاشتراك الشهري (فقط ~6.6$/شهر)"
        ),
        popular = true
    )
)

/** Free tier limits — spec §12.5. */
const val FREE_TIER_DAILY_CHAT_LIMIT = 10
const val FREE_TIER_LIFETIME_IMAGES = 3
