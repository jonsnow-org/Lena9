/**
 * عميل رفع الوسائط الإعلانية (صورة/فيديو قصير) — اختياري بالكامل.
 * إن لم يضبط مالك المنصة مفاتيح Cloudinary على الخادم، fetchMediaUploadStatus
 * تعيد configured=false وتبقى واجهات الإدخال تعتمد على رابط خارجي فقط
 * (السلوك السابق) دون أي عطل.
 */
import { auth } from '../firebase';

export interface MediaUploadResult {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video';
  durationSeconds?: number;
}

export async function fetchMediaUploadStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/media/status');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.configured);
  } catch {
    return false;
  }
}

export async function uploadAdMedia(file: File, purpose: 'ad' | 'article' = 'ad'): Promise<MediaUploadResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('يجب تسجيل الدخول أولاً.');
  const token = await user.getIdToken();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);

  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'تعذر رفع الملف.');
  return data;
}
