import React from 'react';
import {
  Settings,
  Sparkles,
  Layers,
  ShieldCheck,
  BadgePercent,
  CheckCircle2,
  DollarSign,
  Info
} from 'lucide-react';
import { THEME_PRESETS, ThemePresetKey, DEFAULT_THEME_PRESET } from '../../constants/themePresets';
import { BACKGROUND_PRESETS, BackgroundPresetKey, DEFAULT_BACKGROUND_PRESET } from '../../constants/backgroundPresets';
import { REVENUE_SHARES } from '../../constants/revenueShares';

interface AdminSettingsTabProps {
  currentThemePreset?: ThemePresetKey;
  onChangeThemePreset?: (preset: ThemePresetKey) => void;
  currentBackgroundPreset?: BackgroundPresetKey;
  onChangeBackgroundPreset?: (preset: BackgroundPresetKey) => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  currentThemePreset = DEFAULT_THEME_PRESET,
  onChangeThemePreset,
  currentBackgroundPreset = DEFAULT_BACKGROUND_PRESET,
  onChangeBackgroundPreset
}) => {
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
    </div>
  );
};
