/**
 * رفع الوسائط الإعلانية (صور وفيديوهات قصيرة) عبر Cloudinary.
 *
 * لماذا Cloudinary وليس Firebase Storage؟ Firebase Storage يتطلب خطة
 * Blaze المدفوعة. Cloudinary لديه باقة مجانية دائمة (بلا بطاقة ائتمان)
 * تكفي مشروعاً بهذا الحجم: نطاق تخزين ونقل بيانات مجاني شهرياً، ويدعم
 * الصور والفيديو معاً عبر نفس الحساب.
 *
 * التفعيل اختياري بالكامل: بدون مفاتيح Cloudinary في متغيرات البيئة،
 * isMediaUploadConfigured() تعيد false، ويعرض التطبيق حقل رابط خارجي
 * فقط (السلوك السابق) دون أي عطل.
 */
import { v2 as cloudinary } from 'cloudinary';

let configured = false;
let configAttempted = false;

function tryConfigure(): void {
  if (configAttempted) return;
  configAttempted = true;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  configured = true;
}

export function isMediaUploadConfigured(): boolean {
  tryConfigure();
  return configured;
}

// حدود صارمة: صورة حتى 8 ميغابايت، فيديو حتى 50 ميغابايت (كافٍ لمقطع
// قصير بجودة معقولة لا يتجاوز دقيقة واحدة).
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 61; // هامش ثانية واحدة لفروق التقريب

export interface UploadResult {
  url: string;
  publicId: string;
  resourceType: 'image' | 'video';
  durationSeconds?: number;
}

/**
 * يرفع ملفاً (Buffer) إلى Cloudinary. للفيديو: إن تجاوزت مدته الحد
 * الأقصى المسموح، يُحذف فوراً من Cloudinary وتُرمى استثناء — لا يبقى
 * أي مقطع مخالف مخزّناً حتى بعد الرفض.
 */
export function uploadMediaBuffer(
  buffer: Buffer,
  opts: { folder: string; resourceType: 'image' | 'video'; maxDurationSeconds?: number }
): Promise<UploadResult> {
  tryConfigure();
  if (!configured) {
    return Promise.reject(new Error('media_upload_not_configured'));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        resource_type: opts.resourceType
      },
      async (err, result) => {
        if (err || !result) {
          reject(err || new Error('upload_failed'));
          return;
        }

        if (opts.resourceType === 'video') {
          const durationLimit = opts.maxDurationSeconds ?? MAX_VIDEO_DURATION_SECONDS;
          const duration = (result as any).duration as number | undefined;
          if (typeof duration === 'number' && duration > durationLimit) {
            try {
              await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' });
            } catch {
              /* حتى إن فشل الحذف، لن نُعيد رابط مقطع مخالف للمستخدم */
            }
            reject(new Error('video_too_long'));
            return;
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: 'video',
            durationSeconds: duration
          });
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: 'image'
        });
      }
    );
    stream.end(buffer);
  });
}
