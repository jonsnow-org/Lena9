/**
 * تحميل زر "تسجيل الدخول عبر تيليجرام" (Telegram Login Widget) بشكل
 * ديناميكي داخل عنصر حاوٍ محدد. لا يتطلب أي مراجعة من تيليجرام —
 * الودجت الرسمي متاح لأي بوت مجاناً.
 */
export interface TelegramWidgetUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

let callbackCounter = 0;

export function mountTelegramLoginWidget(
  container: HTMLElement,
  botUsername: string,
  onAuth: (user: TelegramWidgetUser) => void
): () => void {
  container.innerHTML = '';

  const callbackName = `__literiumTelegramAuth_${++callbackCounter}`;
  (window as any)[callbackName] = onAuth;

  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.async = true;
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'medium');
  script.setAttribute('data-radius', '10');
  script.setAttribute('data-onauth', `${callbackName}(user)`);
  script.setAttribute('data-request-access', 'write');

  container.appendChild(script);

  return () => {
    delete (window as any)[callbackName];
  };
}
