import React from 'react';
import { UserCheck, X, CheckCircle2, AlertTriangle, ShieldCheck, User as UserIcon } from 'lucide-react';
import { User } from '../../types';

interface KycReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onApproveKyc?: (userId: string) => void;
}

export const KycReviewModal: React.FC<KycReviewModalProps> = ({
  isOpen,
  onClose,
  user,
  onApproveKyc
}) => {
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

          {kyc?.selfieUrl && (
            <div>
              <div className="text-[10px] text-slate-400 mb-1.5">صورة الوثيقة المرفوعة:</div>
              <div className="rounded-xl overflow-hidden border border-slate-800 max-h-48 flex items-center justify-center bg-slate-900">
                <img
                  src={kyc.selfieUrl}
                  alt="KYC Document"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
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
              <span>اعتماد وتوثيق الهوية الآن ✓</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
