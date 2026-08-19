import React, { useState } from 'react';
import {
  Globe,
  Youtube,
  MessageCircle,
  Twitter,
  Instagram,
  Linkedin,
  Facebook,
  Send,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { User } from '../types';

interface SocialLinksEditorProps {
  currentUser: User;
  onSave: (links: Record<string, string>) => Promise<void> | void;
}

interface LinkField {
  key: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  /** تحويل المدخل إلى رابط كامل (مثل رقم واتساب) */
  normalize?: (value: string) => string;
  hint?: string;
}

const LINK_FIELDS: LinkField[] = [
  {
    key: 'website',
    label: 'الموقع الشخصي أو المدونة',
    icon: <Globe className="w-4 h-4 text-teal-500" />,
    placeholder: 'https://example.com'
  },
  {
    key: 'youtube',
    label: 'قناة يوتيوب',
    icon: <Youtube className="w-4 h-4 text-rose-500" />,
    placeholder: 'https://youtube.com/@yourchannel'
  },
  {
    key: 'whatsapp',
    label: 'واتساب',
    icon: <MessageCircle className="w-4 h-4 text-emerald-500" />,
    placeholder: '905XXXXXXXXX',
    hint: 'أدخل الرقم بصيغة دولية بدون + أو أصفار، وسيُحوَّل تلقائياً إلى رابط.',
    normalize: (v) => {
      const clean = v.trim();
      if (!clean) return '';
      if (clean.startsWith('http')) return clean;
      const digits = clean.replace(/[^0-9]/g, '');
      return digits ? `https://wa.me/${digits}` : '';
    }
  },
  {
    key: 'telegram',
    label: 'تيليجرام',
    icon: <Send className="w-4 h-4 text-sky-500" />,
    placeholder: '@username',
    normalize: (v) => {
      const clean = v.trim();
      if (!clean) return '';
      if (clean.startsWith('http')) return clean;
      return `https://t.me/${clean.replace(/^@/, '')}`;
    }
  },
  {
    key: 'twitter',
    label: 'إكس (تويتر)',
    icon: <Twitter className="w-4 h-4 text-slate-500" />,
    placeholder: 'https://x.com/username'
  },
  {
    key: 'instagram',
    label: 'إنستغرام',
    icon: <Instagram className="w-4 h-4 text-pink-500" />,
    placeholder: 'https://instagram.com/username'
  },
  {
    key: 'linkedin',
    label: 'لينكدإن',
    icon: <Linkedin className="w-4 h-4 text-blue-600" />,
    placeholder: 'https://linkedin.com/in/username'
  },
  {
    key: 'facebook',
    label: 'فيسبوك',
    icon: <Facebook className="w-4 h-4 text-blue-500" />,
    placeholder: 'https://facebook.com/username'
  }
];

export const SocialLinksEditor: React.FC<SocialLinksEditorProps> = ({ currentUser, onSave }) => {
  const existing = (currentUser.socialLinks || {}) as Record<string, string>;
  const [links, setLinks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    LINK_FIELDS.forEach((f) => {
      init[f.key] = existing[f.key] || '';
    });
    return init;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    setSaved(false);
    try {
      // تطبيع القيم وحذف الفارغة — Firestore يرفض undefined
      const clean: Record<string, string> = {};
      LINK_FIELDS.forEach((f) => {
        const raw = (links[f.key] || '').trim();
        if (!raw) return;
        const normalized = f.normalize ? f.normalize(raw) : raw;
        if (normalized) clean[f.key] = normalized;
      });
      await onSave(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('تعذر حفظ الروابط:', err);
      setError('تعذر حفظ الروابط. تحقق من اتصالك ثم حاول مجدداً.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
      <div>
        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">روابطي الخارجية</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          تظهر هذه الروابط للزوار في صفحتك الشخصية. اترك أي حقل فارغاً إن لم ترغب بعرضه.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3">
        {LINK_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              {field.icon}
              {field.label}
            </label>
            <input
              type="text"
              dir="ltr"
              value={links[field.key]}
              onChange={(e) => setLinks((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-purple-500 text-start"
            />
            {field.hint && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{field.hint}</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-extrabold text-xs active:scale-95 transition-all"
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
            <span>حفظ الروابط</span>
          </>
        )}
      </button>
    </div>
  );
};
