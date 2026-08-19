import { AiQuota, AiPlanType, SubscriptionPlan, User } from '../types';

export const DEFAULT_FREE_DAILY_LIMIT = 10;

export interface PlanComparisonRow {
  metric: string;
  free: string;
  monthly: string;
  annual: string;
}

export const COMPARISON_METRICS: PlanComparisonRow[] = [
  {
    metric: 'نموذج الذكاء الاصطناعي',
    free: 'Gemini 3.7 Flash الأساسي',
    monthly: 'Gemini 3.7 Pro فائق الذكاء',
    annual: 'Gemini 3.7 Pro + استجابة فائقة السرعة'
  },
  {
    metric: 'عدد الاستخدامات',
    free: '10 طلبات / 24 ساعة',
    monthly: '200 استعلام / شهرياً',
    annual: 'غير محدود ♾️ طوال العام'
  },
  {
    metric: 'محرر المقالات وتوليد الهيكل',
    free: 'محدود (نصوص قصيرة)',
    monthly: 'متقدم (محتوى طويل كامل)',
    annual: 'غير محدود مع تصدير ذكي'
  },
  {
    metric: 'التدقيق اللغوي والبلاغي',
    free: 'أساسي',
    monthly: 'متقدم وعميق',
    annual: 'احترافي مع اقتراحات أسلوبية حصرية'
  },
  {
    metric: 'شارة VIP في الملف الشخصي',
    free: '—',
    monthly: 'شارة Pro ⚡',
    annual: 'شارة VIP الذهبية الملكية 👑'
  },
  {
    metric: 'أولوية خوادم الذكاء الاصطناعي',
    free: 'عادية',
    monthly: 'عالية',
    annual: 'أولوية قصوى بدون انتظار 🚀'
  }
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'باقة Pro الشهرية',
    nameEn: 'Monthly Pro Plan',
    price: 9.99,
    periodLabel: 'شهرياً',
    badge: 'الأكثر مرونة',
    aiLimitLabel: '200 استعلام ذكي / شهرياً',
    features: [
      '200 استعلام شهرياً مدعوم بـ Gemini 3.7 Pro',
      'توليد هياكل ومقالات كاملة بضغطة زر واحدة',
      'تدقيق لغوي، إملائي وبلاغي متقدم للنصوص الطويلة',
      'مساعد كتابة تفاعلي للإلهام وصياغة الأفكار 24/7',
      'أولوية معالجة سريعة وشارة Pro في الملف الشخصي'
    ],
    popular: false
  },
  {
    id: 'annual',
    name: 'باقة Unlimited السنوية VIP',
    nameEn: 'Annual Unlimited VIP',
    price: 79.99,
    periodLabel: 'سنوياً (وفر 35%)',
    badge: 'الأفضل قيمة ★',
    aiLimitLabel: 'استخدام غير محدود طوال العام ♾️',
    features: [
      'استخدام غير محدود بالكامل لـ Gemini 3.7 Pro طوال العام',
      'شارة VIP الذهبية الملكية 👑 بجانب اسمك ومقالاتك',
      'أولوية قصوى على الخوادم وأعلى سرعة استجابة بدون انتظار',
      'تحليلات ذكية وتوقعات متقدمة لمعدلات قراءة ومبيعات مقالاتك',
      'ميزات حصرية وتحديثات ذكاء اصطناعي تجريبية قبل الجميع',
      'توفير 35% مقارنة بالاشتراك الشهري (فقط ~6.6$/شهر)'
    ],
    popular: true
  }
];

/**
 * Checks if 24 hours have passed since lastResetTime and returns updated quota.
 */
export function checkAndRefreshQuota(existingQuota?: AiQuota): AiQuota {
  const now = Date.now();
  const defaultQuota: AiQuota = {
    freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
    usedToday: 0,
    lastResetTime: new Date(now).toISOString(),
    isSubscriber: false,
    plan: 'none'
  };

  if (!existingQuota) {
    return defaultQuota;
  }

  // Check if subscription has expired
  let isSubscriber = existingQuota.isSubscriber;
  let plan = existingQuota.plan;
  if (existingQuota.planExpiresAt) {
    const expireTime = new Date(existingQuota.planExpiresAt).getTime();
    if (now > expireTime) {
      isSubscriber = false;
      plan = 'none';
    }
  }

  // Check 24-hour window
  const lastReset = new Date(existingQuota.lastResetTime || now).getTime();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);

  if (hoursPassed >= 24) {
    return {
      ...existingQuota,
      isSubscriber,
      plan,
      usedToday: 0,
      lastResetTime: new Date(now).toISOString()
    };
  }

  return {
    ...existingQuota,
    isSubscriber,
    plan
  };
}

/**
 * Gets remaining free or subscription credits
 */
export function getRemainingAiUses(quota?: AiQuota): {
  remaining: number;
  isUnlimited: boolean;
  usedToday: number;
  limit: number;
  hoursUntilReset: number;
  plan: AiPlanType;
  isSubscriber: boolean;
} {
  const active = checkAndRefreshQuota(quota);
  const now = Date.now();
  const lastReset = new Date(active.lastResetTime).getTime();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);
  const hoursUntilReset = Math.max(0, Math.ceil(24 - hoursPassed));

  if (active.isSubscriber && active.plan === 'annual') {
    return {
      remaining: 9999,
      isUnlimited: true,
      usedToday: active.usedToday,
      limit: 9999,
      hoursUntilReset,
      plan: active.plan,
      isSubscriber: true
    };
  }

  if (active.isSubscriber && active.plan === 'monthly') {
    const monthlyLimit = active.planLimit || 200;
    const remaining = Math.max(0, monthlyLimit - active.usedToday);
    return {
      remaining,
      isUnlimited: false,
      usedToday: active.usedToday,
      limit: monthlyLimit,
      hoursUntilReset,
      plan: active.plan,
      isSubscriber: true
    };
  }

  const freeLimit = active.freeDailyLimit || DEFAULT_FREE_DAILY_LIMIT;
  const remaining = Math.max(0, freeLimit - active.usedToday);

  return {
    remaining,
    isUnlimited: false,
    usedToday: active.usedToday,
    limit: freeLimit,
    hoursUntilReset,
    plan: active.plan,
    isSubscriber: false
  };
}

/**
 * Consumes 1 use and returns updated User if allowed
 */
export function consumeAiQuota(user: User): {
  allowed: boolean;
  updatedUser: User;
  remaining: number;
  isSubscriber: boolean;
} {
  const currentQuota = checkAndRefreshQuota(user.aiQuota);
  const stats = getRemainingAiUses(currentQuota);

  if (stats.remaining <= 0 && !stats.isUnlimited) {
    return {
      allowed: false,
      updatedUser: { ...user, aiQuota: currentQuota },
      remaining: 0,
      isSubscriber: stats.isSubscriber
    };
  }

  const updatedQuota: AiQuota = {
    ...currentQuota,
    usedToday: currentQuota.usedToday + 1
  };

  const newStats = getRemainingAiUses(updatedQuota);

  return {
    allowed: true,
    updatedUser: {
      ...user,
      aiQuota: updatedQuota
    },
    remaining: newStats.remaining,
    isSubscriber: updatedQuota.isSubscriber
  };
}

/**
 * Consumes 1 use directly from AiQuota object
 */
export function consumeAiUsage(quota?: AiQuota): {
  allowed: boolean;
  updatedQuota: AiQuota;
  remaining: number;
} {
  const currentQuota = checkAndRefreshQuota(quota);
  const stats = getRemainingAiUses(currentQuota);

  if (stats.remaining <= 0 && !stats.isUnlimited) {
    return {
      allowed: false,
      updatedQuota: currentQuota,
      remaining: 0
    };
  }

  const updatedQuota: AiQuota = {
    ...currentQuota,
    usedToday: currentQuota.usedToday + 1
  };

  const newStats = getRemainingAiUses(updatedQuota);

  return {
    allowed: true,
    updatedQuota,
    remaining: newStats.remaining
  };
}

/**
 * Applies subscription upgrade to AiQuota object
 */
export function applySubscriptionUpgrade(
  existingQuota?: AiQuota,
  planId: 'monthly' | 'annual' = 'monthly',
  _paymentMethod?: string
): AiQuota {
  const now = new Date();
  const expiresAt = new Date();

  if (planId === 'monthly') {
    expiresAt.setDate(now.getDate() + 30);
  } else {
    expiresAt.setFullYear(now.getFullYear() + 1);
  }

  return {
    ...checkAndRefreshQuota(existingQuota),
    freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
    usedToday: 0,
    lastResetTime: now.toISOString(),
    isSubscriber: true,
    plan: planId,
    planLimit: planId === 'monthly' ? 200 : -1,
    planExpiresAt: expiresAt.toISOString()
  };
}

/**
 * Upgrades a user with a new subscription plan
 */
export function applyAiSubscription(user: User, planId: 'monthly' | 'annual'): User {
  const now = new Date();
  const expiresAt = new Date();

  if (planId === 'monthly') {
    expiresAt.setDate(now.getDate() + 30);
  } else {
    expiresAt.setFullYear(now.getFullYear() + 1);
  }

  const newQuota: AiQuota = {
    freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
    usedToday: 0,
    lastResetTime: now.toISOString(),
    isSubscriber: true,
    plan: planId,
    planLimit: planId === 'monthly' ? 200 : -1,
    planExpiresAt: expiresAt.toISOString()
  };

  return {
    ...user,
    aiQuota: newQuota
  };
}

/**
 * Formats ISO date string to a localized Arabic date
 */
export function formatAiExpiryDate(dateStr?: string): string {
  if (!dateStr) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculates remaining days until expiration
 */
export function getDaysRemaining(dateStr?: string): number {
  if (!dateStr) return 0;
  try {
    const expireTime = new Date(dateStr).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expireTime - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Returns metadata and presentation properties for a plan
 */
export function getPlanMeta(plan?: AiPlanType): {
  title: string;
  badge: string;
  color: string;
  isUnlimited: boolean;
  description: string;
} {
  if (plan === 'annual') {
    return {
      title: 'باقة Unlimited السنوية VIP',
      badge: 'مشترك VIP ذهبي 👑',
      color: 'from-amber-500 to-purple-600',
      isUnlimited: true,
      description: 'وصول غير محدود لطاقة Gemini 3.7 Pro طوال العام مع أولوية قصوى.'
    };
  }
  if (plan === 'monthly') {
    return {
      title: 'باقة Pro الشهرية',
      badge: 'مشترك Pro ⚡',
      color: 'from-purple-600 to-indigo-600',
      isUnlimited: false,
      description: '200 استعلام وتوليد متقدم شهرياً لكتابة المقالات والتدقيق.'
    };
  }
  return {
    title: 'الخطة المجانية',
    badge: 'حساب مجاني 🎁',
    color: 'from-slate-500 to-slate-700',
    isUnlimited: false,
    description: '10 استخدامات مجانية كل 24 ساعة لجميع أدوات الكتابة والذكاء الاصطناعي.'
  };
}
