import { auth } from '../firebase';
import type { TelegramWidgetUser } from '../utils/telegramWidgetAuth';

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً للتحقق.');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchSocialVerifyStatus(): Promise<{ telegram: boolean; youtube: boolean }> {
  try {
    const res = await fetch('/api/social/status');
    if (!res.ok) return { telegram: false, youtube: false };
    return await res.json();
  } catch {
    return { telegram: false, youtube: false };
  }
}

export interface SocialVerifyResult {
  verified: boolean;
  rewarded: boolean;
}

export async function verifyTelegramJoin(campaignId: string, widgetData: TelegramWidgetUser): Promise<SocialVerifyResult> {
  const headers = await authHeaders();
  const res = await fetch('/api/social/verify-telegram', {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId, widgetData })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر التحقق من الانضمام.');
  return { verified: Boolean(data.verified), rewarded: Boolean(data.rewarded) };
}

export async function verifyYoutubeSubscription(campaignId: string, accessToken: string): Promise<SocialVerifyResult> {
  const headers = await authHeaders();
  const res = await fetch('/api/social/verify-youtube', {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId, accessToken })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر التحقق من الاشتراك.');
  return { verified: Boolean(data.verified), rewarded: Boolean(data.rewarded) };
}
