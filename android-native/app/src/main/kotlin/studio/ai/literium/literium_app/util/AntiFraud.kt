package studio.ai.literium.literium_app.util

import studio.ai.literium.literium_app.data.model.FraudFlag
import studio.ai.literium.literium_app.data.model.FraudFlagStatus
import studio.ai.literium.literium_app.data.model.FraudSeverity
import studio.ai.literium.literium_app.data.model.FraudTriggerType
import studio.ai.literium.literium_app.data.model.PricingModel
import java.util.concurrent.ConcurrentHashMap

/**
 * Client-side ad-fraud validation engine — exact port of
 * `src/utils/antiFraud.ts`'s `AntiFraudEngine`, including every threshold
 * and message. This is the FIRST of the two parallel anti-fraud layers
 * described in spec §5.7: an immediate accept/reject decision made before
 * an impression/click event is even sent to Firestore. The second layer
 * (`evaluateAdEventBatch`, an admin-run batch re-evaluation over logged
 * `adEvents`) belongs in [studio.ai.literium.literium_app.data.repository.AdCampaignRepository]
 * as a Kotlin port of that separate pass — do not assume this engine alone
 * is sufficient, since a modified client can bypass it entirely (spec §5.7).
 *
 * State ([sessionImpressionMap]/[sessionClickMap]) is deliberately
 * in-memory / per-process, matching the source's module-level JS `Map`s —
 * it resets on process death, exactly like the source resets on a page
 * reload.
 */
object AntiFraudEngine {

    data class ViewabilityContext(
        val campaignId: String,
        val pricingModel: String,
        /** 0-100. */
        val visiblePercentage: Double,
        val continuousVisibleMs: Long,
        /** 0-100. */
        val pageScrollDepth: Double,
        val pageDwellTimeSeconds: Double,
        val userIp: String? = null,
        val userId: String? = null,
        val articleId: String? = null,
        val articleWriterId: String? = null,
        val clickTimeFromLoadSeconds: Double? = null
    )

    data class ValidationResult(
        val isValid: Boolean,
        val reason: String? = null,
        /** A [FraudFlag] to log (id/detectedAt left blank — the caller fills those in on write). */
        val fraudFlag: FraudFlag? = null
    )

    private val sessionImpressionMap = ConcurrentHashMap<String, Long>()
    private val sessionClickMap = ConcurrentHashMap<String, MutableList<Long>>()

    private fun sessionKey(ctx: ViewabilityContext) = "${ctx.userId ?: "anon"}_${ctx.campaignId}"

    /** Validate a CPM/impression event according to its pricing model. */
    fun validateImpression(ctx: ViewabilityContext): ValidationResult {
        val now = System.currentTimeMillis()
        val key = sessionKey(ctx)

        // 1. Fixed-price/fixed-duration campaigns: basic validation only.
        if (ctx.pricingModel == PricingModel.FIXED) {
            return ValidationResult(isValid = true)
        }

        // 2. Self-view check: a writer viewing their own article's ad repeatedly (allowed for preview,
        // but not credited if rapid — under a 5s cooldown).
        if (ctx.articleWriterId != null && ctx.userId != null && ctx.articleWriterId == ctx.userId) {
            val selfKey = "self_$key"
            val lastSelfView = sessionImpressionMap[selfKey] ?: 0L
            if (now - lastSelfView < 5000) {
                return ValidationResult(
                    isValid = false,
                    reason = "تكرار مشاهدة الكاتب لإعلانات مقالاته الخاصة في وقت قصير",
                    fraudFlag = FraudFlag(
                        campaignId = ctx.campaignId,
                        articleId = ctx.articleId,
                        writerId = ctx.articleWriterId,
                        userId = ctx.userId,
                        userIp = ctx.userIp ?: "192.168.1.1",
                        pricingModel = ctx.pricingModel,
                        triggerType = FraudTriggerType.SELF_CLICK,
                        severity = FraudSeverity.LOW,
                        status = FraudFlagStatus.FLAGGED,
                        details = "مشاهدات متكررة وسريعة من الكاتب لنفس المقال (تم تحييد المشاهدة)",
                        mitigationAction = "عدم احتساب المشاهدة في الأرباح لحماية المعلن",
                        revenueBlocked = 0.002
                    )
                )
            }
            sessionImpressionMap[selfKey] = now
        }

        // 3. CPM viewability rule: at least 50% visible for at least 1 continuous second.
        if (ctx.visiblePercentage < 50 || ctx.continuousVisibleMs < 1000) {
            return ValidationResult(
                isValid = false,
                reason = "الإعلان لم يحقق معيار الرؤية المستمرة (50% من المساحة لمدة ثانية على الأقل)"
            )
        }

        // Minimum page dwell/scroll-depth check.
        if (ctx.pageDwellTimeSeconds < 1.5 && ctx.pageScrollDepth < 10) {
            return ValidationResult(
                isValid = false,
                reason = "تخطي سريع بدون قراءة أو تمرير (سلوك شبيه بالبوتات)",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    articleId = ctx.articleId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = ctx.pricingModel,
                    triggerType = FraudTriggerType.RAPID_REFRESH,
                    severity = FraudSeverity.LOW,
                    status = FraudFlagStatus.FLAGGED,
                    details = "تجاوز المشهد بسرعة غير طبيعية (< 1.5 ثانية)",
                    mitigationAction = "استبعاد الظهور من الفاتورة",
                    revenueBlocked = 0.003
                )
            )
        }

        // Rapid-refresh throttle: same user+campaign impression logged again within 15s.
        val lastImpression = sessionImpressionMap[key] ?: 0L
        if (now - lastImpression < 15000) {
            return ValidationResult(
                isValid = false,
                reason = "تكرار الظهور في أقل من 15 ثانية (تحديث سريع للصفحة)",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    articleId = ctx.articleId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = ctx.pricingModel,
                    triggerType = FraudTriggerType.RAPID_REFRESH,
                    severity = FraudSeverity.MEDIUM,
                    status = FraudFlagStatus.FLAGGED,
                    details = "إعادة تحميل سريع متكرر للصفحة لنفس الحملة",
                    mitigationAction = "حظر احتساب مرات الظهور المتكررة",
                    revenueBlocked = 0.005
                )
            )
        }

        sessionImpressionMap[key] = now
        return ValidationResult(isValid = true)
    }

    /** Validate a CPC/click event with maximum-shield protection. */
    fun validateClick(ctx: ViewabilityContext): ValidationResult {
        val now = System.currentTimeMillis()
        val key = sessionKey(ctx)

        // 1. Strict self-click prevention: a writer cannot generate valid clicks on ads in their own
        // articles/profile.
        if (ctx.articleWriterId != null && ctx.userId != null && ctx.articleWriterId == ctx.userId) {
            return ValidationResult(
                isValid = false,
                reason = "نظام الحماية: يُحظر على الكاتب النقر على الإعلانات داخل مقالاته الشخصية",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    articleId = ctx.articleId,
                    writerId = ctx.articleWriterId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = PricingModel.CPC,
                    triggerType = FraudTriggerType.SELF_CLICK,
                    severity = FraudSeverity.HIGH,
                    status = FraudFlagStatus.AUTO_BLOCKED,
                    details = "محاولة نقر من الكاتب صاحب المقال على إعلان داخل صفحته (Self-Click)",
                    mitigationAction = "حجب النقر تلقائياً وحماية ميزانية المعلن وتحذير الكاتب",
                    revenueBlocked = 0.20
                )
            )
        }

        // 2. Click-timing validation: clicks within 2.2s of page load are ignored (accidental/bot).
        if (ctx.clickTimeFromLoadSeconds != null && ctx.clickTimeFromLoadSeconds < 2.2) {
            return ValidationResult(
                isValid = false,
                reason = "تم تجاهل النقرة لأنها تمت فور تحميل الصفحة (< 2.2 ثانية)",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    articleId = ctx.articleId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = PricingModel.CPC,
                    triggerType = FraudTriggerType.INSUFFICIENT_DWELL,
                    severity = FraudSeverity.MEDIUM,
                    status = FraudFlagStatus.FLAGGED,
                    details = "نقر فوري مفاجئ قبل استيعاب محتوى الصفحة (احتمال نقر عشوائي أو بوت)",
                    mitigationAction = "إلغاء احتساب تكلفة النقرة على المعلن",
                    revenueBlocked = 0.20
                )
            )
        }

        // 3. Viewability check before click.
        if (ctx.visiblePercentage < 40) {
            return ValidationResult(
                isValid = false,
                reason = "تم النقر على الإعلان وهو خارج نطاق الرؤية المباشر",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = PricingModel.CPC,
                    triggerType = FraudTriggerType.BOT_PATTERN,
                    severity = FraudSeverity.CRITICAL,
                    status = FraudFlagStatus.AUTO_BLOCKED,
                    details = "نقرة برمجية غير مرئية (Invisible Ad Click Injection)",
                    mitigationAction = "حظر المعرف وحماية الحساب الإعلاني",
                    revenueBlocked = 0.20
                )
            )
        }

        // 4. Duplicate-click throttling: ignore a 3rd+ click from the same user/session on the same
        // campaign within a rolling 10-minute window.
        val pastClicks = sessionClickMap.getOrPut(key) { mutableListOf() }
        val recentClicks = pastClicks.filter { now - it < 10 * 60 * 1000 }.toMutableList()

        if (recentClicks.size >= 2) {
            return ValidationResult(
                isValid = false,
                reason = "تم تجاوز الحد المسموح للنقرات لنفس المستخدم (Duplicate Click Throttling)",
                fraudFlag = FraudFlag(
                    campaignId = ctx.campaignId,
                    articleId = ctx.articleId,
                    userId = ctx.userId,
                    userIp = ctx.userIp ?: "192.168.1.1",
                    pricingModel = PricingModel.CPC,
                    triggerType = FraudTriggerType.CLICK_THROTTLE,
                    severity = FraudSeverity.HIGH,
                    status = FraudFlagStatus.AUTO_BLOCKED,
                    details = "نقرات متكررة متعددة (${recentClicks.size + 1}) لنفس المستخدم خلال 10 دقائق",
                    mitigationAction = "حظر التكرار واحتساب نقرة واحدة فقط",
                    revenueBlocked = 0.40
                )
            )
        }

        recentClicks.add(now)
        sessionClickMap[key] = recentClicks

        return ValidationResult(isValid = true)
    }
}
