import { auth } from '../firebase';

export interface ClaudeChatResult {
  success: boolean;
  reply?: string;
  model?: 'haiku' | 'sonnet';
  charged?: boolean;
  cost?: number;
  remainingFreeUses?: number;
  newBalance?: number | null;
  error?: string;
  message?: string;
  requiredAmount?: number;
  currentBalance?: number;
}

export async function sendClaudeChatMessage(message: string): Promise<ClaudeChatResult> {
  try {
    let token: string | undefined;
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {
        // Continue without a token — the server will reject with auth_required.
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/ai/claude-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message })
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'claude_chat_failed',
        message: data.message || 'تعذّر الاتصال بـ Claude.',
        requiredAmount: data.requiredAmount,
        currentBalance: data.currentBalance
      };
    }

    return {
      success: true,
      reply: data.reply,
      model: data.model,
      charged: data.charged,
      cost: data.cost,
      remainingFreeUses: data.remainingFreeUses,
      newBalance: data.newBalance
    };
  } catch (err: any) {
    console.error('sendClaudeChatMessage network error:', err);
    return {
      success: false,
      error: 'network_error',
      message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.'
    };
  }
}
