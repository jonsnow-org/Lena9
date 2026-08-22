import { auth } from '../firebase';
import { User } from '../types';

export interface GenerateImageParams {
  prompt: string;
  style?: string;
  aspectRatio?: '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
  user: User;
}

export interface GenerateImageResult {
  success: boolean;
  imageUrl?: string;
  charged?: boolean;
  cost?: number;
  remainingFreeUses?: number;
  newBalance?: number | null;
  error?: string;
  message?: string;
}

export async function requestAiImageGeneration(
  params: GenerateImageParams
): Promise<GenerateImageResult> {
  const { prompt, style = 'oil_painting', aspectRatio = '16:9', user } = params;

  try {
    let token: string | undefined;
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {
        // Continue with user object info
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/ai/generate-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        style,
        aspectRatio,
        userId: user.id,
        userEmail: user.email,
        isSubscriber: user.aiQuota?.isSubscriber ?? false,
        plan: user.aiQuota?.plan ?? 'none'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'generation_failed',
        message: data.message || 'تعذر توليد الصورة.'
      };
    }

    return {
      success: true,
      imageUrl: data.imageUrl,
      charged: data.charged,
      cost: data.cost,
      remainingFreeUses: data.remainingFreeUses,
      newBalance: data.newBalance
    };
  } catch (err: any) {
    console.error('requestAiImageGeneration network error:', err);
    return {
      success: false,
      error: 'network_error',
      message: 'تعذر الاتصال بالخادم لتوليد الصورة. يرجى التحقق من اتصالك بالإنترنت.'
    };
  }
}
