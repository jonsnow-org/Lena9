import React, { useEffect, useState } from 'react';
import {
  Settings,
  Sparkles,
  Layers,
  ShieldCheck,
  BadgePercent,
  CheckCircle2,
  DollarSign,
  Info,
  AlertOctagon,
  Store,
  Power
} from 'lucide-react';
import { THEME_PRESETS, ThemePresetKey, DEFAULT_THEME_PRESET } from '../../constants/themePresets';
import { BACKGROUND_PRESETS, BackgroundPresetKey, DEFAULT_BACKGROUND_PRESET } from '../../constants/backgroundPresets';
import { REVENUE_SHARES } from '../../constants/revenueShares';
import { resetAllTestFinancialData } from '../../services/adminDangerZoneApi';
import { subscribeToAppPublishedOnStores, setAppPublishedOnStoresInFirestore } from '../../services/firestoreService';

interface AdminSettingsTabProps {
  currentThemePreset?: ThemePresetKey;
  onChangeThemePreset?: (preset: ThemePresetKey) => void;
  currentBackgroundPreset?: BackgroundPresetKey;
  onChangeBackgroundPreset?: (preset: BackgroundPresetKey) => void;
  adminUserId: string;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  currentThemePreset = DEFAULT_THEME_PRESET,
  onChangeThemePreset,
  currentBackgroundPreset = DEFAULT_BACKGROUND_PRESET,
  onChangeBackgroundPreset,
  adminUserId
}) => {
  const [isResettingFinancials, setIsResettingFinancials] = useState(false);
  const [resetFinancialsResultMsg, setResetFinancialsResultMsg] = useState('');
  const [resetFinancialsErrorMsg, setResetFinancialsErrorMsg] = useState('');

  // علم "نُشر التطبيق على المتاجر" — راجع settings/appDistribution في
  // firestoreService.ts. بمجرد تفعيله يختفي زر "تحديث" الداخلي كلياً لدى
  // كل من يملك نسخة APK، بصرف النظر عن وجود نسخة أحدث من حزمة الموقع.
  const [publishedOnStores, setPublishedOnStoresState] = useState(false);
  const [isTogglingStores, setIsTogglingStores] = useState(false);
  useEffect(() => {
    return subscribeToAppPublishedOnStores(setPublishedOnStoresState, (err) =>
      console.error('تعذر تحميل إعداد النشر على المتاجر:', err)
    );
  }, []);

  const handleTogglePublishedOnStores = async () => {
    const next = !publishedOnStores;
    setIsTogglingStores(true);
    setPublishedOnStoresState(next);
    try {
      await setAppPublishedOnStoresInFirestore(next, adminUserId);
    } catch (err) {
      console.error('تعذر حفظ إعداد النشر على المتاجر:', err);
      setPublishedOnStoresState(!next);
      alert('تعذر حفظ الإعداد الجديد. تحقق من اتصالك ثم حاول مجدداً.');
    } finally {
      setIsTogglingStores(false);
    }
  };

  const handleResetTestFinancialData = async () => {
    const confirmed = window.confirm(
      'سيتم تصفير رصيد كل حساب (المحفظة والأرباح المتاحة والمجمَّدة) إلى صفر، وتصفير إنفاق كل حملة إعلانية ومبيعات كل مقال حصري، وحذف كل سجلات الإيداعات والسحوبات والمشتريات والأرباح وأحداث الإعلانات وبلاغات الاحتيال نهائياً.\n\nلن تُحذف حسابات المستخدمين أو الحملات أو المقالات نفسها — فقط أرقامها المالية. هذا الإجراء لا رجعة فيه إطلاقاً.\n\nاستخدمه فقط إن كنت متأكداً أن كل البيانات الحالية تجريبية ولا يوجد مستخدم حقيقي واحد بعد. هل تريد المتابعة؟'
    );
    if (!confirmed) return;

    const typed = window.prompt('للتأكيد النهائي، اكتب بالضبط: تصفير الكل');
    if (typed?.trim() !== 'تصفير الكل') {
      if (typed !== null) alert('النص غير مطابق — لم يتم تنفيذ أي شيء.');
      return;
    }

    setIsResettingFinancials(true);
    setResetFinancialsResultMsg('');
    setResetFinancialsErrorMsg('');
    try {
      const result = await resetAllTestFinancialData();
      setResetFinancialsResultMsg(
        `تم التصفير: ${result.usersReset} حساب، ${result.campaignsReset} حملة، ${result.articlesReset} مقال. وحُذف: ${result.earningsDeleted} سجل ربح، ${result.articlePurchasesDeleted} عملية شراء مقال، ${result.transactionsDeleted} حركة مالية، ${result.depositRequestsDeleted} طلب إيداع، ${result.payoutRequestsDeleted} طلب سحب، ${result.purchaseRequestsDeleted} طلب شراء، ${result.adEventsDeleted} حدث إعلاني، ${result.fraudFlagsDeleted} بلاغ احتيال.`
      );
    } catch (err: any) {
      setResetFinancialsErrorMsg(err?.message || 'تعذر تنفيذ التصفير.');
    } finally {
      setIsResettingFinancials(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" />
            إعدادات المنظومة والمظهر
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            تخصيص هوية التطبيق البصرية، خلفيات القالب، والاطلاع على معايير تقاسم الأرباح الثابتة.
          </p>
        </div>
      </div>

      {/* 1. THEME PRESETS */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              لون السمة البصرية للمنصة (Theme Accent)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              يغير اللون الرئيسي للأزرار، التمييز، والواجهات في كل التطبيق.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-brand-300 bg-brand-950 px-2.5 py-1 rounded-full border border-brand-500/20">
            {THEME_PRESETS[currentThemePreset]?.label || currentThemePreset}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(Object.entries(THEME_PRESETS) as [ThemePresetKey, any][]).map(([key, item]) => {
            const isSelected = currentThemePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeThemePreset?.(key)}
                className={`p-3 rounded-2xl border text-start transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-slate-950 border-brand-500 ring-2 ring-brand-500/20 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-xl shadow-md shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: item.primaryHex || '#10b981' }}
                >
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{item.description || key}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BACKGROUND PRESETS */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              خلفية القالب الذكية (Background Style)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              نمط وتدرج خلفية الشاشة وتأثيراتها البصرية العامة.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.entries(BACKGROUND_PRESETS) as [BackgroundPresetKey, any][]).map(([key, item]) => {
            const isSelected = currentBackgroundPreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeBackgroundPreset?.(key)}
                className={`p-4 rounded-2xl border text-start transition-all ${
                  isSelected
                    ? 'bg-slate-950 border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{item.label}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400">{item.description || key}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. REVENUE SPLIT & FINANCIAL MATRIX */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h4 className="font-bold text-white text-sm flex items-center gap-2">
          <BadgePercent className="w-4 h-4 text-emerald-400" />
          مصفوفة تقاسم العوائد والضمان المالي (Revenue Split Matrix)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-white mb-1">إعلانات المقالات (In-Article)</div>
            <div className="text-emerald-400 font-bold font-mono">
              {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% للكاتب / {REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% للمنصة
            </div>
            <div className="text-[10px] text-slate-500 mt-1">تُطبق آلياً عند فحص أحداث النقرات والظهور.</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-white mb-1">إعلانات الملف الشخصي (Profile)</div>
            <div className="text-emerald-400 font-bold font-mono">
              {REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER_PERCENT}% للكاتب / {REVENUE_SHARES.WRITER_PROFILE_ADS.PLATFORM_PERCENT}% للمنصة
            </div>
            <div className="text-[10px] text-slate-500 mt-1">إعلانات البانر في صفحة الكاتب الشخصية.</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="font-bold text-white mb-1">مبيعات المقالات الحصرية</div>
            <div className="text-amber-400 font-bold font-mono">
              {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% للكاتب / {REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% للمنصة
            </div>
            <div className="text-[10px] text-slate-500 mt-1">15% رسوم المنصة على كل عملية شراء مقال.</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
          <span>
            فترة التجميد المالية (30 يوماً): لضمان حماية المنصة من النقر الاحتيالي ومطالبات الاسترداد، تظل أرباح الكُتّاب في رصيد "أرباح مجمّدة" لمدة 30 يوماً قبل أن تظهر في تبويب "تحرير الأرباح" وتصبح قابلة للسحب.
          </span>
        </div>
      </div>

      {/* 4. APP STORE DISTRIBUTION FLAG — بعد رفع التطبيق فعلياً على متجر
          (Google Play مثلاً)، يخفي زر "تحديث" الداخلي كلياً لدى كل من
          يملك نسخة APK ويعتمد على تحديث المتجر نفسه بدلاً منه. */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">التطبيق منشور على متاجر التطبيقات</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                فعّله فقط بعد رفع ونشر التطبيق فعلياً على Google Play (أو أي متجر آخر). عند التفعيل يختفي زر "تحديث" العائم داخل التطبيق لدى كل من يملك نسخة APK نهائياً — تحديث النسخة يصبح مسؤولية المتجر وحده.
              </p>
            </div>
          </div>
          <button
            onClick={handleTogglePublishedOnStores}
            disabled={isTogglingStores}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 disabled:opacity-50 ${
              publishedOnStores
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {publishedOnStores ? 'منشور ✓' : 'غير منشور بعد'}
          </button>
        </div>
      </div>

      {/* 5. DANGER ZONE — تصفير كل البيانات المالية التجريبية دفعة واحدة.
          مخصص للاستخدام مرة واحدة فقط قبل الإطلاق الحقيقي، بعد تأكيد
          صريح أن كل الحسابات/الحملات/المقالات الحالية بيانات اختبار. */}
      <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-4">
        <h4 className="font-bold text-rose-300 text-sm flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400" />
          منطقة الخطر — تصفير كل البيانات المالية التجريبية
        </h4>
        <p className="text-xs text-rose-200/80 leading-relaxed">
          يُصفِّر رصيد كل حساب وإنفاق كل حملة ومبيعات كل مقال إلى صفر، ويحذف نهائياً كل سجلات الإيداعات والسحوبات والمشتريات والأرباح وأحداث الإعلانات وبلاغات الاحتيال. لا يحذف الحسابات أو الحملات أو المقالات نفسها. استخدمه فقط قبل الإطلاق الحقيقي وبعد التأكد أن كل البيانات الحالية تجريبية — لا رجعة عنه بعد التنفيذ.
        </p>

        <button
          type="button"
          onClick={handleResetTestFinancialData}
          disabled={isResettingFinancials}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20"
        >
          {isResettingFinancials ? 'جارٍ التصفير...' : 'تصفير كل البيانات المالية التجريبية'}
        </button>

        {resetFinancialsResultMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
            {resetFinancialsResultMsg}
          </div>
        )}
        {resetFinancialsErrorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
            {resetFinancialsErrorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
