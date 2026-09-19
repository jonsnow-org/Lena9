import React, { useState } from 'react';
import { Shield, X, FileText, AlertTriangle, Scale, Lock } from 'lucide-react';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface PoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms' | 'restricted';
}

export const PoliciesModal: React.FC<PoliciesModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy'
}) => {
  const [tab, setTab] = useState<'privacy' | 'terms' | 'restricted'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="relative w-full max-w-2xl max-h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-600" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              السياسات والشروط القانونية
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/40 dark:bg-slate-900/40 text-xs sm:text-sm font-bold">
          <button
            onClick={() => setTab('privacy')}
            className={`py-3 px-3 border-b-2 transition-all ${
              tab === 'privacy'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            سياسة الخصوصية
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`py-3 px-3 border-b-2 transition-all ${
              tab === 'terms'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            شروط الاستخدام ونظام الأرباح
          </button>
          <button
            onClick={() => setTab('restricted')}
            className={`py-3 px-3 border-b-2 transition-all ${
              tab === 'restricted'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            سياسة المحتوى المحظور
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-4">
          {tab === 'privacy' && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                سياسة الخصوصية وحماية البيانات في ليتيريوم
              </h4>
              <p>
                تلتزم منصة "ليتيريوم" بحماية خصوصية مستخدميها من القراء والكتاب والمعلنين وفقاً لأعلى معايير التشفير (TLS 1.3 / AES-256).
              </p>
              <h5 className="font-bold text-slate-900 dark:text-white pt-2">
                1. البيانات التي نجمعها:
              </h5>
              <p>
                • بيانات التسجيل الأساسية: البريد الإلكتروني، الاسم، ورقم الهاتف عند التفعيل.<br />
                • بيانات التوثيق (KYC): وثائق الهوية الوطنية للتحقق من الكتّاب والمعلنين قبل سحب وإيداع الأموال.<br />
                • بيانات الاستخدام والتحليلات: إحصائيات قراءة المقالات ومرات الظهور لحساب الأرباح بدقة.
              </p>
              <h5 className="font-bold text-slate-900 dark:text-white pt-2">
                2. إعلانات Google AdSense:
              </h5>
              <p>
                تستخدم المنصة شبكة Google AdSense لعرض الإعلانات المتوافقة، ولا نشارك أي بيانات شخصية حساسة مع أطراف ثالثة.
              </p>
            </div>
          )}

          {tab === 'terms' && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                شروط الاستخدام ونموذج تقاسم العوائد المالية
              </h4>
              <p>
                تحكم هذه الاتفاقية العلاقة بين منصة ليتيريوم وكافة أطراف المنظومة:
              </p>
              <h5 className="font-bold text-slate-900 dark:text-white pt-2">
                1. نموذج تقاسم عوائد الإعلانات:
              </h5>
              <p>
                • <strong>إعلانات داخل مقالات الكاتب:</strong> {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% لحساب كاتب المقال بناءً على المشاهدات والنقرات الحقيقية و{REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% لإدارة المنصة.<br />
                • <strong>إعلانات صفحة الكاتب الشخصية:</strong> {REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER_PERCENT}% للكاتب و{REVENUE_SHARES.WRITER_PROFILE_ADS.PLATFORM_PERCENT}% للمنصة.<br />
                • <strong>إعلانات الواجهات العامة:</strong> {REVENUE_SHARES.PLATFORM_ADS.PLATFORM_PERCENT}% للمنصة لتغطية تكاليف الخوادم والذكاء الاصطناعي.
              </p>
              <h5 className="font-bold text-slate-900 dark:text-white pt-2">
                2. المقالات الحصرية المقفولة:
              </h5>
              <p>
                يحق للكاتب الموثق تحديد سعر فتح المقال الحصري، ويحصل على <strong>{REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%</strong> من قيمة المبيعات المباشرة وتستقطع المنصة {REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% كرسوم معالجة وتشغيل.
              </p>
              <h5 className="font-bold text-slate-900 dark:text-white pt-2">
                3. شروط السحب المالي:
              </h5>
              <p>
                الحد الأدنى لطلب السحب هو 10 دولارات، ويتم التحويل خلال 24 ساعة عبر وسائل الدفع المعتمدة (USDT, Bank Wire, Stripe, PayPal).
              </p>
            </div>
          )}

          {tab === 'restricted' && (
            <div className="space-y-3">
              <h4 className="font-bold text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>سياسة المحتوى المحظور والمعايير الأخلاقية</span>
              </h4>
              <p>
                للحفاظ على بيئة أدبية وفكرية نقية وراقية، يُحظر بشكل قاطع نشر أي من المواد التالية:
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>المحتوى الذي يحرض على الكراهية، العنف، أو التمييز الديني والعرقي.</li>
                <li>انتهاك حقوق الملكية الفكرية والنسخ الحرفي من مصادر أخرى دون تصريح أو توثيق.</li>
                <li>المحتوى الإباحي، الخادش للحياء، أو المروج للأنشطة غير القانونية.</li>
                <li>محاولات التلاعب بالمشاهدات والنقرات الاحتيالية على إعلانات AdSense.</li>
              </ul>
              <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold">
                يؤدي انتهاك هذه السياسة إلى الإيقاف الفوري للحساب وتجميد الأرباح الناتجة عن المخالفة.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
