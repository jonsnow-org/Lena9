import { THEME_PRESETS, ThemePresetKey, isValidThemePreset, DEFAULT_THEME_PRESET } from '../constants/themePresets';

const STORAGE_KEY = 'literium_theme_preset';

/** يطبّق قالباً لونياً فوراً على كامل التطبيق عبر استبدال متغيرات CSS
 *  الجذرية (--color-brand-*) — كل عنصر يستخدم فئات brand-* يتحدّث بصرياً
 *  في نفس اللحظة دون أي إعادة تحميل، لأي مستخدم متصل حالياً. */
export function applyThemePreset(preset: ThemePresetKey): void {
  const def = THEME_PRESETS[preset] || THEME_PRESETS[DEFAULT_THEME_PRESET];
  const root = document.documentElement;
  (Object.keys(def.shades) as Array<keyof typeof def.shades>).forEach((shade) => {
    root.style.setProperty(`--color-brand-${shade}`, def.shades[shade]);
  });
  try {
    localStorage.setItem(STORAGE_KEY, def.key);
  } catch {
    // لا شيء — فشل التخزين المحلي (وضع خاص مثلاً) لا يمنع تطبيق اللون نفسه
  }
}

/** يُستدعى عند إقلاع التطبيق لتطبيق آخر قالب معروف فوراً من التخزين
 *  المحلي (رسم أولي صحيح دون وميض اللون الافتراضي)، قبل وصول القيمة
 *  الحقيقية من Firestore والتي قد تستغرق جزءاً من الثانية. */
export function applyStoredThemePresetImmediately(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isValidThemePreset(saved) && saved !== DEFAULT_THEME_PRESET) {
      applyThemePreset(saved);
    }
  } catch {
    // تجاهل — العرض الافتراضي (بنفسجي) يبقى صحيحاً بصرياً بأي حال
  }
}
