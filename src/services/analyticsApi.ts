/**
 * إحصائيات زوار حقيقية — بديل عن utils/trafficTracker.ts الذي كان يولّد
 * بيانات وهمية بالكامل محلياً في متصفح كل أدمن (سجلات بأسماء عشوائية
 * وأرقام أساس ثابتة لا علاقة لها بأي زيارة حقيقية). كل شيء هنا يُقرأ من
 * ويُكتب إلى Firestore عبر السيرفر (مجموعتا pageViews وvisitorSessions).
 */
import { auth } from '../firebase';

const VISITOR_ID_KEY = 'literium_visitor_id';

/** معرّف زائر ثابت لكل متصفح — يُنشأ مرة واحدة ويبقى في localStorage،
 *  يُستخدم لعدّ "الزوار الفريدين" الحقيقيين (وليس عدد المشاهدات فقط). */
function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    // متصفح يحظر localStorage (وضع خاص مثلاً) — معرّف مؤقت لهذه الجلسة فقط.
    return `v_temp_${Date.now().toString(36)}`;
  }
}

function detectDevice(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|iemobile|blackberry|opera mini/i.test(ua) || window.innerWidth < 768) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(): string {
  if (typeof window === 'undefined') return 'Browser';
  const ua = navigator.userAgent;
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Other';
}

/**
 * تسجيل زيارة حقيقية — تُستدعى مرة واحدة عند تحميل التطبيق. لا تحتاج
 * تسجيل دخول (يجب احتساب الزوار غير المسجَّلين أيضاً)، وفشلها لا يجب أن
 * يوقف أي شيء في الواجهة (fire-and-forget).
 */
export function trackVisit(path: string, pageTitle: string, userId?: string): void {
  try {
    const sessionId = getOrCreateVisitorId();
    fetch('/api/analytics/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        path,
        pageTitle,
        device: detectDevice(),
        browser: detectBrowser(),
        userId
      })
    }).catch(() => {});
  } catch {
    // تجاهل — التتبع ثانوي تماماً، لا يجب أن يكسر أي شيء في التطبيق.
  }
}

export interface AnalyticsSummary {
  totalVisitors: number;
  visitorsToday: number;
  visitorsLast24h: number;
  totalPageViews: number;
  pageViewsToday: number;
  pageViewsLast24h: number;
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  hourlyTraffic: { hour: string; views: number; visitors: number }[];
  recentVisits: {
    id: string;
    path: string;
    pageTitle: string;
    isRegistered: boolean;
    device: string;
    browser: string;
    timestamp: string;
  }[];
}

/** إحصائيات مجمَّعة — للأدمن فقط، يتحقق منها السيرفر عبر توكن Firebase حقيقي. */
export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();
  const res = await fetch('/api/analytics/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر تحميل الإحصائيات.');
  return data;
}
