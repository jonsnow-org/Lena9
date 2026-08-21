import { THEME_PRESETS, ThemePresetKey, isValidThemePreset, DEFAULT_THEME_PRESET } from '../constants/themePresets';
import {
  BACKGROUND_PRESETS,
  BackgroundPresetKey,
  isValidBackgroundPreset,
  DEFAULT_BACKGROUND_PRESET
} from '../constants/backgroundPresets';

const THEME_STORAGE_KEY = 'literium_theme_preset';
const BG_STORAGE_KEY = 'literium_bg_preset';

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
    localStorage.setItem(THEME_STORAGE_KEY, def.key);
  } catch {
    // لا شيء — فشل التخزين المحلي (وضع خاص مثلاً) لا يمنع تطبيق اللون نفسه
  }
}

/** يطبّق خلفية جمالية لقالب التطبيق بشكل فوري مع طبقة تظليل تضمن راحة العين
 *  ووضوح الحروف والقراءة التام */
export function applyBackgroundPreset(preset: BackgroundPresetKey): void {
  const def = BACKGROUND_PRESETS[preset] || BACKGROUND_PRESETS[DEFAULT_BACKGROUND_PRESET];
  
  let bgLayer = document.getElementById('literium-theme-bg-layer');
  let overlayLayer = document.getElementById('literium-theme-overlay-layer');

  if (!def.imageUrl || def.key === 'none') {
    if (bgLayer) bgLayer.style.opacity = '0';
    if (overlayLayer) overlayLayer.style.opacity = '0';
  } else {
    if (!bgLayer) {
      bgLayer = document.createElement('div');
      bgLayer.id = 'literium-theme-bg-layer';
      bgLayer.className = 'fixed inset-0 pointer-events-none -z-20 bg-cover bg-center bg-no-repeat transition-opacity duration-700';
      document.body.prepend(bgLayer);
    }
    if (!overlayLayer) {
      overlayLayer = document.createElement('div');
      overlayLayer.id = 'literium-theme-overlay-layer';
      overlayLayer.className = 'fixed inset-0 pointer-events-none -z-10 transition-colors duration-700 backdrop-blur-[1.5px]';
      document.body.prepend(overlayLayer);
    }

    bgLayer.style.backgroundImage = `url("${def.imageUrl}")`;
    bgLayer.style.opacity = '1';
    
    const isDark = document.documentElement.classList.contains('dark');
    overlayLayer.style.backgroundColor = isDark ? def.overlayDark : def.overlayLight;
    overlayLayer.style.opacity = '1';
  }

  try {
    localStorage.setItem(BG_STORAGE_KEY, def.key);
  } catch {}
}

/** تحديث طبقة التظليل عند تبديل الوضع الليلي / الفاتح */
export function syncBackgroundOverlayMode(): void {
  const saved = localStorage.getItem(BG_STORAGE_KEY);
  if (isValidBackgroundPreset(saved) && saved !== 'none') {
    const def = BACKGROUND_PRESETS[saved];
    const overlayLayer = document.getElementById('literium-theme-overlay-layer');
    if (overlayLayer && def) {
      const isDark = document.documentElement.classList.contains('dark');
      overlayLayer.style.backgroundColor = isDark ? def.overlayDark : def.overlayLight;
    }
  }
}

/** يُستدعى عند إقلاع التطبيق لتطبيق آخر قالب ولون وخلفية معروفة فوراً من التخزين
 *  المحلي (رسم أولي صحيح دون وميض)، قبل وصول القيمة الحقيقية من Firestore */
export function applyStoredThemePresetImmediately(): void {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidThemePreset(savedTheme) && savedTheme !== DEFAULT_THEME_PRESET) {
      applyThemePreset(savedTheme);
    }
    const savedBg = localStorage.getItem(BG_STORAGE_KEY);
    if (isValidBackgroundPreset(savedBg) && savedBg !== DEFAULT_BACKGROUND_PRESET) {
      applyBackgroundPreset(savedBg);
    }
  } catch {
    // تجاهل — العرض الافتراضي يبقى صحيحاً بصرياً
  }
}
