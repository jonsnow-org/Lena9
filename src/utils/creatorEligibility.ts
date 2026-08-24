import { User, Article, UserRole } from '../types';

// -------------------------------------------------------------------
// شروط الأهلية لاحتساب أرباح المحتوى (منشئ محتوى موثّق)
// -------------------------------------------------------------------
// الكتابة والنشر متاحان لأي حساب مسجَّل من البداية دون قيد. هذه الشروط
// تحكم فقط "احتساب" أرباح الإعلانات ومبيعات المقالات المقفلة لحساب
// الكاتب — لا تمنع الكتابة أو النشر نفسه بأي شكل.
// جميع الشروط الأربعة (متابعون + مشاهدات + عمر الحساب + عدد المقالات)
// إلزامية معاً، بالإضافة لتحقق الهوية (KYC) كشرط أخير لا غنى عنه مهما
// تحققت بقية الشروط — تماشياً مع متطلبات الامتثال القانوني ومكافحة
// الاحتيال في برامج الإعلانات (AdSense وغيره).
export const CREATOR_ELIGIBILITY_THRESHOLDS = {
  MIN_FOLLOWERS: 100,
  MIN_VALID_VIEWS: 1000,
  MIN_ACCOUNT_AGE_DAYS: 14,
  MIN_PUBLISHED_ARTICLES: 3
} as const;

export interface CreatorEligibilityStatus {
  isEligible: boolean;
  isKycVerified: boolean;
  accountAgeDays: number;
  publishedArticlesCount: number;
  validViewsCount: number;
  followersCount: number;
  meetsFollowers: boolean;
  meetsViews: boolean;
  meetsAge: boolean;
  meetsArticles: boolean;
  meetsAllActivityThresholds: boolean;
}

export function getAccountAgeDays(createdAt?: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
}

/**
 * @param followersCountOverride عدد المتابعين الحقيقي المحسوب من مجموعة
 *   follows الفعلية — وليس من user.followersCount المخزَّن، فهذا الحقل لا
 *   يُحدَّث فعلياً من أي مسار في التطبيق ويبقى صفراً دائماً، ما يجعل شرط
 *   المتابعين مستحيل التحقق لو اعتمدنا عليه وحده. مرِّر القيمة الحقيقية
 *   كلما توفّرت بيانات follows لدى المستدعي؛ عند غيابها نرجع لحقل
 *   المستخدم المخزَّن كحل احتياطي فقط.
 */
export function getCreatorEligibility(
  user: User,
  articles: Article[],
  followersCountOverride?: number
): CreatorEligibilityStatus {
  const followersCount = followersCountOverride ?? (user.followersCount || 0);
  const ownPublished = articles.filter((a) => a.writerId === user.id && a.status === 'published');
  const validViewsCount = ownPublished.reduce((sum, a) => sum + (a.viewsCount || 0), 0);
  const accountAgeDays = getAccountAgeDays(user.createdAt);
  const isKycVerified = !!(user.isKycVerified || user.kycDetails?.status === 'verified');

  const meetsFollowers = followersCount >= CREATOR_ELIGIBILITY_THRESHOLDS.MIN_FOLLOWERS;
  const meetsViews = validViewsCount >= CREATOR_ELIGIBILITY_THRESHOLDS.MIN_VALID_VIEWS;
  const meetsAge = accountAgeDays >= CREATOR_ELIGIBILITY_THRESHOLDS.MIN_ACCOUNT_AGE_DAYS;
  const meetsArticles = ownPublished.length >= CREATOR_ELIGIBILITY_THRESHOLDS.MIN_PUBLISHED_ARTICLES;
  const meetsAllActivityThresholds = meetsFollowers && meetsViews && meetsAge && meetsArticles;

  return {
    // التحقق من الهوية شرط إلزامي أخير — لا يكفي تحقق بقية الشروط وحدها.
    isEligible: meetsAllActivityThresholds && isKycVerified,
    isKycVerified,
    accountAgeDays,
    publishedArticlesCount: ownPublished.length,
    validViewsCount,
    followersCount,
    meetsFollowers,
    meetsViews,
    meetsAge,
    meetsArticles,
    meetsAllActivityThresholds
  };
}

/** يُستخدم في نقاط احتساب الأرباح الفعلية (أحداث الإعلانات، مبيعات
 *  المقالات المقفلة) قبل إضافة أي مبلغ لرصيد الكاتب المعلَّق. */
export function isEligibleForMonetization(
  user: User | undefined | null,
  articles: Article[],
  followersCountOverride?: number
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getCreatorEligibility(user, articles, followersCountOverride).isEligible;
}

/**
 * وسم "الحالة" الظاهر بجانب اسم المستخدم — مصدر واحد يُستخدم في كل مكان
 * (الملف الشخصي، القائمة الجانبية، صفحة ملف كاتب آخر). نوعان فقط من
 * الحسابات المسجَّلة عدا الأدمن — كما حُدِّد صراحة: "قارئ" افتراضياً،
 * يتحوّل تلقائياً إلى "كاتب" فقط عند تحقيق شروط احتساب الأرباح الكاملة
 * (متابعون + مشاهدات + عمر حساب + عدد مقالات + توثيق KYC معاً). لا يوجد
 * وسم منفصل لدور "معلن" ولا وسم وسيط لمجرد نشر مقال بلا استيفاء الشروط
 * — role/navPersona المخزَّنان لا يُستخدَمان هنا إطلاقاً، فقط الأهلية
 * الفعلية، تجنّباً لتضارب سابق كانت فيه نفس الحساب يظهر بلقبين مختلفين
 * في صفحتين مختلفتين حسب أي منطق حُسِب به.
 */
export function getMemberStatusLabel(
  role: UserRole,
  isMonetizationEligible: boolean
): string {
  if (role === 'admin') return 'مالك المنصة';
  return isMonetizationEligible ? 'كاتب' : 'قارئ مسجل';
}
