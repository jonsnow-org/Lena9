import { AdCampaign } from '../types';

/**
 * أدوات موحّدة لاختيار الإعلانات وعرضها — يستخدمها كل مكوّن إعلاني (AdSlot و
 * AdTickerBar وبانر الصفحة الرئيسية) كي يتبع الجميع نفس القواعد: أي حملة
 * "حيّة" فعلاً، وأي توزيع بين الإعلانات الداخلية والشبكات الخارجية.
 */

function todayKey(now: Date): string {
  return now.toISOString().split('T')[0];
}

/**
 * الحملة صالحة للعرض الآن؟ لا يكفي status === 'active':
 * - حملة انتهت مدتها (endDate) كانت تستمر بالظهور حتى تلاحظها جلسة أدمن وتُنهيها يدوياً.
 * - حملة CPC/CPM استنفدت ميزانيتها (totalSpent >= totalBudget) لا يجب أن تظهر.
 * (الحملة الثابتة "fixed" مدفوعة مقدماً بالكامل فلا يحكمها سقف إنفاق، فقط مدتها.)
 */
export function isCampaignLive(campaign: AdCampaign, now: Date = new Date()): boolean {
  if (campaign.status !== 'active') return false;
  if (campaign.endDate && todayKey(now) > String(campaign.endDate).slice(0, 10)) return false;
  if (
    (campaign.pricingModel === 'cpc' || campaign.pricingModel === 'cpm') &&
    campaign.totalBudget > 0 &&
    (campaign.totalSpent || 0) >= campaign.totalBudget
  ) {
    return false;
  }
  return true;
}

/** هل تستهدف الحملة هذا التصنيف؟ (الاستهداف العام 'all' أو الفارغ يطابق كل شيء) */
export function matchesCategory(campaign: AdCampaign, category?: string): boolean {
  const targets = campaign.targetCategories || [];
  if (!category || targets.length === 0 || targets.includes('all')) return true;
  return targets.includes(category);
}

/** حملات تصلح لمواضع الإعلان العادية (غير رعاية الأقسام)، مفلترة بالحيوية والتصنيف. */
export function getLiveCampaigns(
  campaigns: AdCampaign[],
  category?: string,
  now: Date = new Date()
): AdCampaign[] {
  return campaigns.filter(
    (c) =>
      (c as any).placementType !== 'category_sponsor' && isCampaignLive(c, now) && matchesCategory(c, category)
  );
}

/**
 * دورة التوزيع بين المجموعتين: من كل 5 أدوار، 3 للمعلنين الداخليين (مدفوعون)
 * و2 للشبكات الخارجية. إن غابت إحدى المجموعتين تأخذ الأخرى كل الأدوار — فلا
 * يبقى موضع فارغاً ولا يُقصى أي طرف دائماً.
 */
const INTERNAL_TURNS = 3;
const CYCLE = 5;

export type AdGroup = 'internal' | 'external' | 'none';

export function pickAdGroup(turn: number, hasInternal: boolean, hasExternal: boolean): AdGroup {
  if (!hasInternal && !hasExternal) return 'none';
  if (!hasExternal) return 'internal';
  if (!hasInternal) return 'external';
  const t = ((turn % CYCLE) + CYCLE) % CYCLE;
  return t < INTERNAL_TURNS ? 'internal' : 'external';
}

/**
 * فهرس العنصر داخل مجموعته بحيث تمرّ الأدوار المتتالية على كل العناصر بالتساوي
 * (round-robin حقيقي بدل اختيار عشوائي قد يكرر نفس العنصر).
 */
export function indexInGroup(turn: number, group: 'internal' | 'external', size: number, bothGroups: boolean): number {
  if (size <= 0) return 0;
  if (!bothGroups) return ((turn % size) + size) % size;
  const cycleNo = Math.floor(turn / CYCLE);
  const t = ((turn % CYCLE) + CYCLE) % CYCLE;
  const perCycle = group === 'internal' ? INTERNAL_TURNS : CYCLE - INTERNAL_TURNS;
  const pos = group === 'internal' ? t : t - INTERNAL_TURNS;
  return (((cycleNo * perCycle + pos) % size) + size) % size;
}
