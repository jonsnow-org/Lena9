import { FraudFlag, PricingModel, AdCampaign, User } from '../types';

export interface AdViewabilityContext {
  campaignId: string;
  pricingModel: PricingModel;
  visiblePercentage: number;
  continuousVisibleMs: number;
  pageScrollDepth: number; // 0 - 100%
  pageDwellTimeSeconds: number;
  userIp?: string;
  userId?: string;
  articleId?: string;
  articleWriterId?: string;
  clickTimeFromLoadSeconds?: number;
}

export interface AdValidationResult {
  isValid: boolean;
  reason?: string;
  fraudFlag?: Omit<FraudFlag, 'id' | 'detectedAt'>;
}

// Session store for anti-fraud tracking
const sessionImpressionMap = new Map<string, number>();
const sessionClickMap = new Map<string, number[]>();

export class AntiFraudEngine {
  /**
   * Validate CPM / Impression according to Pricing Model
   */
  static validateImpression(ctx: AdViewabilityContext): AdValidationResult {
    const now = Date.now();
    const sessionKey = `${ctx.userId || 'anon'}_${ctx.campaignId}`;

    // 1. Fixed Price / Fixed Duration: Basic validation
    if (ctx.pricingModel === 'fixed') {
      return { isValid: true };
    }

    // 2. Self-View Check for Writer Ads (If writer views their own ad repeatedly)
    if (ctx.articleWriterId && ctx.userId && ctx.articleWriterId === ctx.userId) {
      // Writer viewing own article ad is allowed for preview, but not credited if rapid
      const lastSelfView = sessionImpressionMap.get(`self_${sessionKey}`) || 0;
      if (now - lastSelfView < 5000) {
        return {
          isValid: false,
          reason: 'تكرار مشاهدة الكاتب لإعلانات مقالاته الخاصة في وقت قصير',
          fraudFlag: {
            campaignId: ctx.campaignId,
            articleId: ctx.articleId,
            writerId: ctx.articleWriterId,
            userId: ctx.userId,
            userIp: ctx.userIp || '192.168.1.1',
            pricingModel: ctx.pricingModel,
            triggerType: 'self_click',
            severity: 'low',
            status: 'flagged',
            details: 'مشاهدات متكررة وسريعة من الكاتب لنفس المقال (تم تحييد المشاهدة)',
            mitigationAction: 'عدم احتساب المشاهدة في الأرباح لحماية المعلن',
            revenueBlocked: 0.002
          }
        };
      }
      sessionImpressionMap.set(`self_${sessionKey}`, now);
    }

    // 3. CPM Viewability Rules:
    // - At least 50% of the ad must be visible in viewport for at least 1 continuous second
    if (ctx.visiblePercentage < 50 || ctx.continuousVisibleMs < 1000) {
      return {
        isValid: false,
        reason: 'الإعلان لم يحقق معيار الرؤية المستمرة (50% من المساحة لمدة ثانية على الأقل)'
      };
    }

    // - Check scroll depth and minimum page dwell
    if (ctx.pageDwellTimeSeconds < 1.5 && ctx.pageScrollDepth < 10) {
      return {
        isValid: false,
        reason: 'تخطي سريع بدون قراءة أو تمرير (سلوك شبيه بالبوتات)',
        fraudFlag: {
          campaignId: ctx.campaignId,
          articleId: ctx.articleId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: ctx.pricingModel,
          triggerType: 'rapid_refresh',
          severity: 'low',
          status: 'flagged',
          details: 'تجاوز المشهد بسرعة غير طبيعية (< 1.5 ثانية)',
          mitigationAction: 'استبعاد الظهور من الفاتورة',
          revenueBlocked: 0.003
        }
      };
    }

    // - Rapid refresh detection (throttle impressions from same user within 15 seconds)
    const lastImpression = sessionImpressionMap.get(sessionKey) || 0;
    if (now - lastImpression < 15000) {
      return {
        isValid: false,
        reason: 'تكرار الظهور في أقل من 15 ثانية (تحديث سريع للصفحة)',
        fraudFlag: {
          campaignId: ctx.campaignId,
          articleId: ctx.articleId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: ctx.pricingModel,
          triggerType: 'rapid_refresh',
          severity: 'medium',
          status: 'flagged',
          details: 'إعادة تحميل سريع متكرر للصفحة لنفس الحملة',
          mitigationAction: 'حظر احتساب مرات الظهور المتكررة',
          revenueBlocked: 0.005
        }
      };
    }

    sessionImpressionMap.set(sessionKey, now);
    return { isValid: true };
  }

  /**
   * Validate CPC / Click with Maximum Shield Protection
   */
  static validateClick(ctx: AdViewabilityContext): AdValidationResult {
    const now = Date.now();
    const sessionKey = `${ctx.userId || 'anon'}_${ctx.campaignId}`;

    // 1. Strict Self-Click Prevention:
    // Writer cannot generate valid clicks on their own articles or profile
    if (ctx.articleWriterId && ctx.userId && ctx.articleWriterId === ctx.userId) {
      return {
        isValid: false,
        reason: 'نظام الحماية: يُحظر على الكاتب النقر على الإعلانات داخل مقالاته الشخصية',
        fraudFlag: {
          campaignId: ctx.campaignId,
          articleId: ctx.articleId,
          writerId: ctx.articleWriterId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: 'cpc',
          triggerType: 'self_click',
          severity: 'high',
          status: 'auto_blocked',
          details: 'محاولة نقر من الكاتب صاحب المقال على إعلان داخل صفحته (Self-Click)',
          mitigationAction: 'حجب النقر تلقائياً وحماية ميزانية المعلن وتحذير الكاتب',
          revenueBlocked: 0.20
        }
      };
    }

    // 2. Click Timing Validation: Clicks within 2.2 seconds of page load are ignored (accidental / bot)
    if (ctx.clickTimeFromLoadSeconds !== undefined && ctx.clickTimeFromLoadSeconds < 2.2) {
      return {
        isValid: false,
        reason: 'تم تجاهل النقرة لأنها تمت فور تحميل الصفحة (< 2.2 ثانية)',
        fraudFlag: {
          campaignId: ctx.campaignId,
          articleId: ctx.articleId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: 'cpc',
          triggerType: 'insufficient_dwell',
          severity: 'medium',
          status: 'flagged',
          details: 'نقر فوري مفاجئ قبل استيعاب محتوى الصفحة (احتمال نقر عشوائي أو بوت)',
          mitigationAction: 'إلغاء احتساب تكلفة النقرة على المعلن',
          revenueBlocked: 0.20
        }
      };
    }

    // 3. Viewability Check before click
    if (ctx.visiblePercentage < 40) {
      return {
        isValid: false,
        reason: 'تم النقر على الإعلان وهو خارج نطاق الرؤية المباشر',
        fraudFlag: {
          campaignId: ctx.campaignId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: 'cpc',
          triggerType: 'bot_pattern',
          severity: 'critical',
          status: 'auto_blocked',
          details: 'نقرة برمجية غير مرئية (Invisible Ad Click Injection)',
          mitigationAction: 'حظر المعرف وحماية الحساب الإعلاني',
          revenueBlocked: 0.20
        }
      };
    }

    // 4. Duplicate Click Throttling:
    // Ignore repeated clicks from same user/session on the same campaign within 10 minutes
    const pastClicks = sessionClickMap.get(sessionKey) || [];
    const recentClicks = pastClicks.filter((t) => now - t < 10 * 60 * 1000);

    if (recentClicks.length >= 2) {
      return {
        isValid: false,
        reason: 'تم تجاوز الحد المسموح للنقرات لنفس المستخدم (Duplicate Click Throttling)',
        fraudFlag: {
          campaignId: ctx.campaignId,
          articleId: ctx.articleId,
          userId: ctx.userId,
          userIp: ctx.userIp || '192.168.1.1',
          pricingModel: 'cpc',
          triggerType: 'click_throttle',
          severity: 'high',
          status: 'auto_blocked',
          details: `نقرات متكررة متعددة (${recentClicks.length + 1}) لنفس المستخدم خلال 10 دقائق`,
          mitigationAction: 'حظر التكرار واحتساب نقرة واحدة فقط',
          revenueBlocked: 0.40
        }
      };
    }

    recentClicks.push(now);
    sessionClickMap.set(sessionKey, recentClicks);

    return { isValid: true };
  }
}
