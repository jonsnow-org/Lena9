/**
 * طلب رمز OAuth مؤقت (Access Token) بنطاق youtube.readonly عبر Google
 * Identity Services (GIS) — يُحمَّل السكربت فقط عند الحاجة الفعلية
 * (عند نقر القارئ على "تحقق من الاشتراك")، وليس عند تحميل الصفحة.
 *
 * ⚠️ يتطلب Client ID مُعدّاً في Google Cloud Console (مجاني بالكامل)،
 * ومشروعاً مفعّلاً فيه YouTube Data API v3. راجع دليل الإعداد المرفق.
 */
let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('تعذر تحميل خدمة Google لتسجيل الدخول.'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);
}

export async function requestYoutubeReadonlyToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error('التحقق من يوتيوب غير مفعّل على هذا الخادم بعد.');

  await loadGisScript();

  return new Promise((resolve, reject) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error('لم تمنح الإذن اللازم للتحقق من الاشتراك.'));
          return;
        }
        resolve(response.access_token as string);
      }
    });
    tokenClient.requestAccessToken();
  });
}
