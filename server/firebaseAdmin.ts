/**
 * تهيئة Firebase Admin SDK من جهة الخادم فقط.
 *
 * ⚠️ فرق مهم عن Cloud Functions: هذا السيرفر (server.ts) هو عملية Node.js
 * عادية تُشغَّل على استضافتك الخاصة (Cloud Run / VPS / أي مضيف)، وليس Cloud
 * Function — لذا لا يتطلب أي خطة Firebase مدفوعة (Blaze). Admin SDK هنا
 * يتصل بـ Firestore عبر حساب خدمة (Service Account) له صلاحيات كاملة
 * تتجاوز قواعد الأمان (Security Rules) — وهذا هو المطلوب فعلياً كي يستطيع
 * الخادم احتساب الودائع/السحوبات تلقائياً بعد تأكيد بوابة الدفع، دون أن
 * يمر عبر متصفح المستخدم أو يخضع لقيود قواعد العميل.
 *
 * لا يُفعَّل شيء تلقائياً بدون مفاتيح — إن لم تتوفر بيانات اعتماد صالحة،
 * isAdminConfigured() تعيد false وكل نقاط API الآلية تفشل برسالة واضحة
 * بدل رمي استثناء أثناء الإقلاع، فيبقى بقية التطبيق (السيرفر + الواجهة)
 * يعمل بشكل طبيعي بالمسار اليدوي الحالي.
 */
import { initializeApp, cert, type App, type Credential } from 'firebase-admin/app';
import { getFirestore, FieldValue as AdminFieldValue, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

let app: App | null = null;
let initAttempted = false;
let initError: string | null = null;

function tryInit(): void {
  if (initAttempted) return;
  initAttempted = true;

  try {
    // الخيار 1: كامل ملف Service Account كنص JSON واحد في متغير بيئة واحد
    // (الأنسب لمنصات النشر التي لا تدعم رفع ملفات، كـ Cloud Run/Render).
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    // الخيار 2: مسار ملف محلي (غير مُدرَج في git أبداً).
    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    // الخيار 3: ثلاثة متغيرات منفصلة (نمط شائع في لوحات النشر السحابية).
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    let credential: Credential | null = null;

    if (rawJson && rawJson.trim()) {
      credential = cert(JSON.parse(rawJson));
    } else if (jsonPath && jsonPath.trim()) {
      credential = cert(JSON.parse(readFileSync(jsonPath, 'utf8')));
    } else if (projectId && clientEmail && privateKey) {
      // متغيرات البيئة غالباً تخزّن newline كـ "\n" حرفياً، فيجب استبدالها.
      privateKey = privateKey.replace(/\\n/g, '\n');
      credential = cert({ projectId, clientEmail, privateKey });
    }

    if (!credential) {
      initError = 'لم يتم ضبط بيانات اعتماد Firebase Admin (FIREBASE_SERVICE_ACCOUNT_JSON أو الثلاثية FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).';
      return;
    }

    app = initializeApp({ credential });
  } catch (err: any) {
    initError = `فشل تهيئة Firebase Admin: ${err?.message || err}`;
    console.error(initError);
  }
}

export function isAdminConfigured(): boolean {
  tryInit();
  return app !== null;
}

export function getAdminInitError(): string | null {
  tryInit();
  return initError;
}

export function getAdminDb(): Firestore {
  tryInit();
  if (!app) {
    throw new Error(initError || 'Firebase Admin غير مُهيَّأ.');
  }
  return getFirestore(app);
}

export function getAdminAuth(): Auth {
  tryInit();
  if (!app) {
    throw new Error(initError || 'Firebase Admin غير مُهيَّأ.');
  }
  return getAuth(app);
}

export const FieldValue = AdminFieldValue;

/**
 * يتحقق من رمز هوية Firebase (ID Token) المُرسَل من العميل في ترويسة
 * Authorization: Bearer <token>، ويعيد uid المستخدم الحقيقي — بدل الثقة
 * بأي userId يُرسله العميل ضمن جسم الطلب (يمكن تزويره بسهولة).
 *
 * isAnonymous: مأخوذ من firebase.sign_in_provider في الرمز نفسه —
 * يفرّق بدقة بين جلسة زائر (Anonymous Auth، تحمل uid حقيقياً وتُقبل هنا
 * بلا مشكلة لأي نقطة API لا تمانع الزوار) وحساب مسجَّل حقيقي (Google/
 * بريد). أي نقطة API يجب أن تُحصر بالأعضاء المسجَّلين فقط (كمكافآت مالية)
 * يتوجّب عليها فحص هذا الحقل صراحةً بنفسها ورفض الزوار.
 */
export async function verifyRequestAuth(
  authHeader: string | undefined
): Promise<{ uid: string; email: string | null; isAnonymous: boolean }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('missing_auth_token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('missing_auth_token');
  }
  const decoded = await getAdminAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email || null,
    isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous'
  };
}
