/**
 * فلاتر كشف الاحتيال في أحداث الإعلانات.
 *
 * تُطبَّق عند المراجعة في لوحة الإدارة، قبل احتساب أي مبلغ.
 * المبدأ: لا يُخصم من المعلن ولا يُضاف للكاتب مقابل أي حدث مشبوه.
 *
 * ⚠️ هذه الفلاتر تعمل على البيانات المتاحة في المتصفح للأدمن فقط.
 * ليست بديلاً عن تحقق من جهة الخادم، لكنها الطبقة العملية المتاحة
 * ضمن خطة Spark المجانية بدون Cloud Functions.
 */

export interface AdEventRecord {
  id: string;
  campaignId?: string;
  promotionId?: string;
  slotId: string;
  articleId?: string;
  writerId?: string;
  viewerId?: string | null;
  eventType: 'impression' | 'click';
  createdAt: string;
  processed?: boolean;
  isValid?: boolean | null;
}

export interface FraudVerdict {
  isValid: boolean;
  reasons: string[];
}

/** الحد الأدنى بين نقرتين من نفس المستخدم (ثانيتان) */
const MIN_CLICK_INTERVAL_MS = 2000;
/** نافذة منع تكرار النقر من نفس المستخدم على نفس الحملة (24 ساعة) */
const CLICK_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** نسبة نقر تُعتبر شاذة (CTR أعلى من 25%) */
const ABNORMAL_CTR_THRESHOLD = 0.25;
/** حد أقصى معقول لأحداث الزوار غير المسجّلين لكل حملة في الساعة */
const MAX_ANON_EVENTS_PER_HOUR = 200;
/** لا يُحتسب ظهور نفس الإعلان لنفس المستخدم أكثر من مرة كل 30 دقيقة */
const IMPRESSION_DEDUP_WINDOW_MS = 30 * 60 * 1000;
/** حد مشاهدات الزوار المجهولين لإعلانات مقالات كاتب واحد في الساعة */
const MAX_ANON_WRITER_VIEWS_PER_HOUR = 60;

/**
 * يفحص حدثاً واحداً في سياق بقية الأحداث ويعيد حكماً بصلاحيته.
 *
 * @param event الحدث محل الفحص
 * @param allEvents كل الأحداث المتاحة (للمقارنة والسياق)
 * @param campaignAdvertiserId معرّف مالك الحملة (لكشف النقر الذاتي)
 */
export function evaluateAdEvent(
  event: AdEventRecord,
  allEvents: AdEventRecord[],
  campaignAdvertiserId?: string
): FraudVerdict {
  const reasons: string[] = [];
  const eventTime = new Date(event.createdAt).getTime();

  // ---- الفلتر 3: نقر الكاتب على إعلان في صفحته أو مقاله ----
  if (event.viewerId && event.writerId && event.viewerId === event.writerId) {
    reasons.push('الكاتب نقر على إعلان يستفيد منه بنفسه');
  }

  // ---- الفلتر 4: نقر المعلن على حملته ----
  if (event.viewerId && campaignAdvertiserId && event.viewerId === campaignAdvertiserId) {
    reasons.push('المعلن تفاعل مع حملته الخاصة');
  }

  if (event.eventType === 'click' && event.viewerId) {
    const sameUserClicks = allEvents.filter(
      (e) =>
        e.id !== event.id &&
        e.eventType === 'click' &&
        e.viewerId === event.viewerId &&
        e.campaignId === event.campaignId
    );

    // ---- الفلتر 1: أكثر من نقرة من نفس المستخدم خلال 24 ساعة ----
    const withinWindow = sameUserClicks.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return Math.abs(eventTime - t) < CLICK_DEDUP_WINDOW_MS && t < eventTime;
    });
    if (withinWindow.length > 0) {
      reasons.push('نقرة مكررة من نفس المستخدم على نفس الحملة خلال 24 ساعة');
    }

    // ---- الفلتر 2: نقرات متتالية بفاصل أقل من ثانيتين ----
    const tooFast = sameUserClicks.some((e) => {
      const t = new Date(e.createdAt).getTime();
      return Math.abs(eventTime - t) < MIN_CLICK_INTERVAL_MS;
    });
    if (tooFast) {
      reasons.push('سرعة نقر غير بشرية (أقل من ثانيتين بين نقرتين)');
    }
  }

  // ---- الفلتر 5: نسبة نقر شاذة على مستوى الحملة ----
  if (event.campaignId) {
    const campaignEvents = allEvents.filter((e) => e.campaignId === event.campaignId);
    const impressions = campaignEvents.filter((e) => e.eventType === 'impression').length;
    const clicks = campaignEvents.filter((e) => e.eventType === 'click').length;
    if (impressions >= 20 && clicks / impressions > ABNORMAL_CTR_THRESHOLD) {
      reasons.push(
        `نسبة نقر شاذة للحملة (${Math.round((clicks / impressions) * 100)}% — الطبيعي أقل من 25%)`
      );
    }
  }

  // ---- الفلتر 6: كثافة غير طبيعية من زوار غير مسجّلين ----
  if (!event.viewerId && event.campaignId) {
    const anonSameHour = allEvents.filter((e) => {
      if (e.viewerId || e.campaignId !== event.campaignId) return false;
      const t = new Date(e.createdAt).getTime();
      return Math.abs(eventTime - t) < 60 * 60 * 1000;
    });
    if (anonSameHour.length > MAX_ANON_EVENTS_PER_HOUR) {
      reasons.push('كثافة أحداث غير طبيعية من زوار غير مسجّلين');
    }
  }

  // ---- الفلتر 7: تكرار ظهور نفس الإعلان لنفس المستخدم (إعادة تحميل متكررة) ----
  if (event.eventType === 'impression' && event.viewerId) {
    const duplicate = allEvents.some((e) => {
      if (e.id === event.id || e.eventType !== 'impression' || e.viewerId !== event.viewerId) return false;
      if (e.slotId !== event.slotId || (e.articleId || '') !== (event.articleId || '')) return false;
      if ((e.campaignId || '') !== (event.campaignId || '') || (e.promotionId || '') !== (event.promotionId || '')) return false;
      const t = new Date(e.createdAt).getTime();
      return t < eventTime && eventTime - t < IMPRESSION_DEDUP_WINDOW_MS;
    });
    if (duplicate) {
      reasons.push('ظهور مكرر لنفس الإعلان لنفس المستخدم خلال 30 دقيقة');
    }
  }

  // ---- الفلتر 8: كثافة مشاهدات مجهولة على إعلانات مقالات كاتب واحد ----
  if (!event.viewerId && !event.campaignId && event.writerId) {
    const anonSameHour = allEvents.filter((e) => {
      if (e.viewerId || e.campaignId || e.writerId !== event.writerId) return false;
      const t = new Date(e.createdAt).getTime();
      return Math.abs(eventTime - t) < 60 * 60 * 1000;
    });
    if (anonSameHour.length > MAX_ANON_WRITER_VIEWS_PER_HOUR) {
      reasons.push('كثافة مشاهدات مجهولة غير طبيعية على إعلانات كاتب واحد');
    }
  }

  return { isValid: reasons.length === 0, reasons };
}

/**
 * يفحص دفعة أحداث ويعيدها مصنّفة إلى صالحة ومشبوهة.
 */
export function evaluateAdEventBatch(
  events: AdEventRecord[],
  advertiserIdByCampaign: Record<string, string> = {}
): { valid: AdEventRecord[]; suspicious: Array<AdEventRecord & { reasons: string[] }> } {
  const valid: AdEventRecord[] = [];
  const suspicious: Array<AdEventRecord & { reasons: string[] }> = [];

  events.forEach((event) => {
    const verdict = evaluateAdEvent(
      event,
      events,
      event.campaignId ? advertiserIdByCampaign[event.campaignId] : undefined
    );
    if (verdict.isValid) {
      valid.push(event);
    } else {
      suspicious.push({ ...event, reasons: verdict.reasons });
    }
  });

  return { valid, suspicious };
}

/**
 * يحسب المبلغ المستحق لحدث واحد حسب نموذج تسعير الحملة.
 */
export function calculateEventCost(
  event: AdEventRecord,
  campaign: { pricingModel?: string; cpcRate?: number; cpmRate?: number }
): number {
  if (!campaign) return 0;
  if (campaign.pricingModel === 'cpc') {
    return event.eventType === 'click' ? campaign.cpcRate || 0.08 : 0;
  }
  if (campaign.pricingModel === 'cpm') {
    return event.eventType === 'impression' ? (campaign.cpmRate || 1.0) / 1000 : 0;
  }
  // النموذج الثابت: التكلفة مدفوعة مقدماً، لا تُحسب لكل حدث
  return 0;
}
