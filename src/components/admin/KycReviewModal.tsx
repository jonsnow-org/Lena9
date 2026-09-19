import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  X,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { User } from '../../types';
import { fetchKycDocumentForReview, KycDocumentReview } from '../../services/kycApi';

interface KycReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onApproveKyc?: (userId: string) => void;
  onRejectKyc?: (userId: string) => void;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'مرتفعة جداً',
  medium: 'متوسطة',
  low: 'منخفضة',
  none: 'لا تطابق'
};

export const KycReviewModal: React.FC<KycReviewModalProps> = ({
  isOpen,
  onClose,
  user,
  onApproveKyc,
  onRejectKyc
}) => {
  const [doc, setDoc] = useState<KycDocumentReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) {
      setDoc(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchKycDocumentForReview(user.id)
      .then((result) => {
        if (!cancelled) setDoc(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'تعذر جلب وثيقة المراجعة.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  const kyc = user.kycDetails;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">تدقيق وتوثيق الهوية (KYC)</h3>
              <p className="text-xs text-slate-400">
                مراجعة بيانات إثبات الشخصية للحساب المالي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-xl object-cover border border-brand-500/20"
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-white flex items-center gap-1.5">
              {user.fullName}
              {user.isVerified && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
            </div>
            <div className="text-xs text-slate-400 font-mono">@{user.username}</div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>
        </div>

        {/* KYC Document Information */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-slate-300">بيانات الوثيقة الرسمية المقدمة:</div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">نوع وثيقة الإثبات</div>
              <div className="font-bold text-white mt-0.5">
                {kyc?.idType || 'بطاقة هوية وطنية / جواز سفر'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400">رقم الوثيقة / الهوية</div>
              <div className="font-bold text-brand-300 font-mono mt-0.5">
                {kyc?.idNumber || 'غير متوفر'}
              </div>
            </div>
          </div>

          {kyc?.submittedAt && (
            <div className="text-[11px] text-slate-400">
              تاريخ تقديم الطلب: {new Date(kyc.submittedAt).toLocaleDateString('ar-EG')}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري جلب صورة الوثيقة وتحليل الذكاء الاصطناعي...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {doc?.imageUrl && (
            <div>
              <div className="text-[10px] text-slate-400 mb-1.5">صورة الوثيقة المرفوعة (للأدمن فقط):</div>
              <div className="rounded-xl overflow-hidden border border-slate-800 max-h-56 flex items-center justify-center bg-slate-900">
                <img
                  src={doc.imageUrl}
                  alt="وثيقة KYC"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {doc && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-300">
                <Sparkles className="w-3.5 h-3.5" />
                نتيجة تحليل الذكاء الاصطناعي
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">الاسم المستخرَج من الوثيقة</div>
                  <div className="font-bold text-white mt-0.5">{doc.extractedName || 'تعذّرت القراءة'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">درجة المطابقة مع اسم الحساب</div>
                  <div className="font-bold text-white mt-0.5">
                    {CONFIDENCE_LABEL[doc.matchConfidence || 'none'] || doc.matchConfidence}
                  </div>
                </div>
              </div>
              {doc.aiReasoning && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{doc.aiReasoning}</p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
          {onRejectKyc && !user.isKycVerified && (
            <button
              type="button"
              onClick={() => {
                onRejectKyc(user.id);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/20"
            >
              <XCircle className="w-4 h-4" />
              <span>رفض الطلب</span>
            </button>
          )}
          {onApproveKyc && !user.isKycVerified && (
            <button
              type="button"
              onClick={() => {
                onApproveKyc(user.id);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>اعتماد وتوثيق</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
