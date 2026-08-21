/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** اسم مستخدم بوت تيليجرام (بدون @) — لعرض زر تسجيل الدخول عبر تيليجرام */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  /** Google OAuth Client ID — للتحقق الحقيقي من الاشتراك في يوتيوب */
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
