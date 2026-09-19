import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { fetchMediaUploadStatus, uploadAdMedia } from '../services/mediaApi';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface EditProfileModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onSave: (updates: { fullName?: string; penName?: string; companyName?: string; bio?: string; avatarUrl?: string }) => Promise<void> | void;
}

const BIO_MAX_LENGTH = 160;

/**
 * تعديل بيانات الملف الشخصي الأساسية — كانت هذه البيانات (الاسم، السيرة
 * الذاتية، الصورة) قابلة للتعديل حسب قواعد الأمان دائماً، لكن لا توجد أي
 * واجهة فعلية للوصول إليها بعد التسجيل الأولي، بما في ذلك حساب المالك.
 */
export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, currentUser, onClose, onSave }) => {
  // حقل الاسم يتبع الدور: كاتب → اسم مستعار، معلن → اسم جهة/شركة،
  // غير ذلك (قارئ/أدمن) → الاسم الكامل — نفس المنطق المعروض به الاسم
  // في رأس صفحة "ملفي" (penName || companyName || fullName).
  const nameField: 'penName' | 'companyName' | 'fullName' =
    currentUser.role === 'writer' ? 'penName' : currentUser.role === 'advertiser' ? 'companyName' : 'fullName';
  const nameLabel =
    nameField === 'penName' ? 'الاسم المستعار (اسم الكاتب)' : nameField === 'companyName' ? 'اسم الجهة أو الشركة' : 'الاسم الكامل';

  const [name, setName] = useState(currentUser[nameField] || currentUser.fullName || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [uploadConfigured, setUploadConfigured] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(currentUser[nameField] || currentUser.fullName || '');
    setBio(currentUser.bio || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setError(null);
    setSaved(false);
    fetchMediaUploadStatus().then(setUploadConfigured);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser.id]);
  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const result = await uploadAdMedia(file);
      setAvatarUrl(result.url);
    } catch (err: any) {
      setError(err?.message || 'تعذر رفع الصورة.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('لا يمكن ترك الاسم فارغاً.');
      return;
    }
    setError(null);
    setIsSaving(true);
    setSaved(false);
    try {
      await onSave({ [nameField]: name.trim(), bio: bio.trim(), avatarUrl: avatarUrl.trim() } as any);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('تعذر حفظ الملف الشخصي:', err);
      setError('تعذر حفظ التعديلات. تحقق من اتصالك ثم حاول مجدداً.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <h3 className="font-black text-base text-slate-900 dark:text-white">تعديل الملف الشخصي</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* الصورة الشخصية */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <img
                src={avatarUrl || currentUser.avatarUrl}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-24 h-24 rounded-3xl object-cover shadow-md ring-4 ring-brand-500/20"
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-3xl bg-slate-950/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>

            {uploadConfigured ? (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>تغيير الصورة</span>
                </button>
              </>
            ) : (
              <div className="w-full space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">رابط صورة خارجي</label>
                <input
                  type="text"
                  dir="ltr"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500"
                />
              </div>
            )}
          </div>

          {/* الاسم */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{nameLabel}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-hidden focus:border-brand-500"
            />
          </div>

          {/* السيرة الذاتية / الحالة */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">نبذة تعريفية (الحالة)</label>
              <span className="text-[10px] text-slate-400">{bio.length}/{BIO_MAX_LENGTH}</span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))}
              rows={3}
              placeholder="اكتب نبذة قصيرة تظهر في ملفك الشخصي..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-brand-500 resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-extrabold text-xs active:scale-95 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ الحفظ…</span>
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
