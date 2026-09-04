/**
 * سجل أخطاء دائم يجمع كل أخطاء التطبيق في المتصفح — أعطال React (عبر
 * ErrorBoundary)، أخطاء JS غير مُلتقَطة (`window.onerror`)، وعود مرفوضة غير
 * مُعالَجة (`unhandledrejection`)، وطلبات fetch الفاشلة — في مكان واحد، بصيغة
 * نص جاهز للنسخ مباشرة. نظير مباشر لـ AppErrorLog في نسخة APK (Kotlin).
 *
 * عمداً بلا أي اعتماد على React — يُستورَد في main.tsx قبل تحميل <App/>
 * ويُسجَّل بمجرد الاستيراد (أثر جانبي)، حتى يلتقط أعطالاً تحدث قبل أن يُرسم
 * أي شيء على الشاشة إطلاقاً.
 */

export interface LoggedError {
  id: string;
  time: string;
  source: string;
  message: string;
  stack: string;
}

const STORAGE_KEY = 'literium_error_log';
const MAX_ENTRIES = 50;

type Listener = () => void;
const listeners = new Set<Listener>();

function readAll(): LoggedError[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: LoggedError[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // تخزين محلي ممتلئ/محظور — تجاهل صامت، لا داعي لكسر التطبيق بسبب هذا.
  }
}

export function logError(source: string, error: unknown, extra?: string): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = (error instanceof Error && error.stack ? error.stack : '') + (extra ? `\n${extra}` : '');
    const entry: LoggedError = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      source,
      message: message || 'خطأ بلا رسالة',
      stack: stack.slice(0, 4000)
    };
    const current = readAll();
    current.unshift(entry);
    while (current.length > MAX_ENTRIES) current.pop();
    writeAll(current);
    listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        /* لا تسمح لمستمع معطوب بإسقاط باقي المستمعين */
      }
    });
  } catch {
    // تسجيل الخطأ نفسه يجب ألا يُسبّب خطأ آخر أبداً.
  }
}

export function getErrorLog(): LoggedError[] {
  return readAll();
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* تجاهل صامت */
  }
  listeners.forEach((cb) => cb());
}

export function subscribeErrorLog(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** نص جاهز للنسخ مباشرة — معلومات المتصفح/الصفحة ثم كل الأخطاء الأحدث أولاً. */
export function formatErrorReportText(): string {
  const entries = readAll();
  if (entries.length === 0) return 'لا توجد أخطاء مسجَّلة حالياً.';

  const header = [
    `تقرير أخطاء موقع ليتيريوم — ${entries.length} خطأ مسجَّل`,
    `الصفحة الحالية: ${window.location.href}`,
    `المتصفح: ${navigator.userAgent}`,
    '='.repeat(40)
  ].join('\n');

  const body = entries
    .map((e) => `الوقت: ${e.time}\nالمصدر: ${e.source}\nالرسالة: ${e.message}\n\n${e.stack}`)
    .join(`\n\n${'-'.repeat(40)}\n\n`);

  return `${header}\n\n${body}`;
}

let initialized = false;

/** يُستدعى مرة واحدة من main.tsx قبل رسم React — يسجّل كل مصادر الأخطاء العامة. */
export function initErrorLog(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    logError('window.onerror', event.error ?? event.message, `${event.filename}:${event.lineno}:${event.colno}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('unhandledrejection', event.reason);
  });

  // يلتقط كل طلبات fetch الفاشلة (شبكة معطوبة أو استجابة غير ناجحة) عبر كامل
  // التطبيق تلقائياً — بلا حاجة لتعديل كل ملف خدمة (services/*.ts) على حدة،
  // تماماً مثل OkHttp interceptor في نسخة APK.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url ?? String(args[0]);
    try {
      const response = await originalFetch(...args);
      // response.type === 'opaque' يعني طلب no-cors لنطاق خارجي (كطلبات
      // تتبّع reCAPTCHA في الخلفية) — المتصفح يمنع قراءة حالته الحقيقية
      // عمداً ويُعيد status:0 دائماً بصرف النظر عن نجاح الطلب فعلياً، فتسجيله
      // كخطأ كان إنذاراً كاذباً بحتاً، لا عطلاً حقيقياً في التطبيق.
      if (!response.ok && response.type !== 'opaque') {
        logError(`fetch (${url})`, `HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      logError(`fetch (${url})`, error);
      throw error;
    }
  };
}
