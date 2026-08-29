/**
 * عميل إرسال طلب التحقق من الهوية (KYC) — يرفع صورة الوثيقة فعلياً عبر
 * الخادم (Cloudinary بنوع 'authenticated' غير القابل للوصول العلني) مع
 * فحص مطابقة الاسم بالذكاء الاصطناعي على السيرفر. لا رابط للصورة يُعاد
 * لهذا العميل مطلقاً — فقط حالة النتيجة (verified/pending).
 */
import { auth } from '../firebase';

export interface KycSubmitResult {
  status: 'verified' | 'pending';
  message: string;
}

export async function submitKycDocument(params: {
  idType: string;
  idNumber: string;
  file: File;
}): Promise<KycSubmitResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();

  const formData = new FormData();
  formData.append('document', params.file);
  formData.append('idType', params.idType);
  formData.append('idNumber', params.idNumber);

  const res = await fetch('/api/kyc/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر إرسال طلب التوثيق.');
  return data;
}

export interface KycDocumentReview {
  imageUrl: string | null;
  idType: string;
  idNumber: string;
  extractedName?: string;
  matchConfidence?: string;
  aiReasoning?: string;
  decision: string;
  submittedAt: string;
}

export async function fetchKycDocumentForReview(userId: string): Promise<KycDocumentReview> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();

  const res = await fetch(`/api/kyc/document/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر جلب وثيقة المراجعة.');
  return data;
}
