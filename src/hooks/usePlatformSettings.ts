import { useState, useEffect } from 'react';
import { User } from '../types';
import { applyThemePreset, applyBackgroundPreset, syncBackgroundOverlayMode } from '../utils/themeEngine';
import { subscribePlatformAdsEnabled, getPlatformAdsEnabled } from '../utils/platformAdsStore';
import { subscribeExternalAdsConfig, getExternalAdsConfig, ExternalAdsConfig } from '../utils/externalAdsStore';
import { isValidThemePreset, DEFAULT_THEME_PRESET, ThemePresetKey } from '../constants/themePresets';
import { isValidBackgroundPreset, DEFAULT_BACKGROUND_PRESET, BackgroundPresetKey } from '../constants/backgroundPresets';
import {
  subscribeToThemePreset,
  setThemePresetInFirestore,
  setBackgroundPresetInFirestore,
  setPlatformAdsEnabledInFirestore,
  setExternalAdsConfigInFirestore,
  subscribeToPublishingBotsEnabled,
  setPublishingBotsEnabledInFirestore
} from '../services/firestoreService';
import { seedBotAccounts } from '../services/botsApi';

export function usePlatformSettings(params: {
  currentUser: User;
  users: any[];
  articles: any[];
  campaigns: any[];
  transactions: any[];
  fraudFlags: any[];
  bookmarkedArticleIds: string[];
  followedWriterIds: string[];
  theme: 'light' | 'dark';
  language: string;
}) {
  const {
    currentUser,
    users,
    articles,
    campaigns,
    transactions,
    fraudFlags,
    bookmarkedArticleIds,
    followedWriterIds,
    theme,
    language
  } = params;

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem('literium_users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    localStorage.setItem('literium_articles', JSON.stringify(articles));
  }, [articles]);
  useEffect(() => {
    localStorage.setItem('literium_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);
  // ملاحظة: التعليقات والإشعارات لم تعد تُحفظ في localStorage — أصبحت
  // تُقرأ وتُكتب مباشرة من/إلى Firestore (انظر الاشتراكات الفورية أدناه)
  // حتى تتزامن فعلياً بين كل المستخدمين والأجهزة.
  useEffect(() => {
    localStorage.setItem('literium_transactions', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem('literium_fraud_flags', JSON.stringify(fraudFlags));
  }, [fraudFlags]);
  useEffect(() => {
    localStorage.setItem('literium_bookmarks', JSON.stringify(bookmarkedArticleIds));
  }, [bookmarkedArticleIds]);
  useEffect(() => {
    localStorage.setItem('literium_following', JSON.stringify(followedWriterIds));
  }, [followedWriterIds]);
  useEffect(() => {
    localStorage.setItem('literium_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    syncBackgroundOverlayMode();
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('literium_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // القالب اللوني العام وخلفية التطبيق: يستمع للتغيير الحي من Firestore ويطبّقه فوراً —
  // يعمل لأي مستخدم متصل (بمن فيهم الزوار)، لأن اللون والخلفية جزء من هوية التطبيق
  // نفسه وليس تفضيلاً شخصياً لكل حساب.
  const [themePreset, setThemePresetState] = useState<ThemePresetKey>(DEFAULT_THEME_PRESET);
  const [backgroundPreset, setBackgroundPresetState] = useState<BackgroundPresetKey>(DEFAULT_BACKGROUND_PRESET);

  useEffect(() => {
    const unsub = subscribeToThemePreset(
      (settings) => {
        const resolvedTheme = isValidThemePreset(settings.preset) ? settings.preset : DEFAULT_THEME_PRESET;
        applyThemePreset(resolvedTheme);
        setThemePresetState(resolvedTheme);

        const resolvedBg = isValidBackgroundPreset(settings.backgroundPreset)
          ? settings.backgroundPreset
          : DEFAULT_BACKGROUND_PRESET;
        applyBackgroundPreset(resolvedBg);
        setBackgroundPresetState(resolvedBg);
      },
      (err) => console.error('تعذر تحميل إعدادات القالب والخلفية:', err)
    );
    return () => unsub();
  }, []);

  const handleChangeThemePreset = async (preset: ThemePresetKey) => {
    if (currentUser.role !== 'admin') return;
    applyThemePreset(preset);
    setThemePresetState(preset);
    try {
      await setThemePresetInFirestore(preset, currentUser.id);
    } catch (err) {
      console.error('تعذر حفظ القالب اللوني:', err);
      alert('تعذر حفظ اللون الجديد. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  const handleChangeBackgroundPreset = async (preset: BackgroundPresetKey) => {
    if (currentUser.role !== 'admin') return;
    applyBackgroundPreset(preset);
    setBackgroundPresetState(preset);
    try {
      await setBackgroundPresetInFirestore(preset, currentUser.id);
    } catch (err) {
      console.error('تعذر حفظ خلفية القالب:', err);
      alert('تعذر حفظ الخلفية الجديدة. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // مفتاح إعلانات المنصة العامة — نفس مخزن AdSlot المشترك، حتى تُطابق
  // شارة اللوحة الحالة الحقيقية المطبَّقة فعلياً على كل الإعلانات.
  const [platformAdsEnabled, setPlatformAdsEnabledState] = useState(getPlatformAdsEnabled());
  useEffect(() => {
    return subscribePlatformAdsEnabled(setPlatformAdsEnabledState);
  }, []);

  const handleTogglePlatformAds = async (enabled: boolean) => {
    if (currentUser.role !== 'admin') return;
    setPlatformAdsEnabledState(enabled);
    try {
      await setPlatformAdsEnabledInFirestore(enabled, currentUser.id);
    } catch (err) {
      console.error('تعذر حفظ إعداد إعلانات المنصة:', err);
      alert('تعذر حفظ الإعداد الجديد. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // مفتاح تشغيل/إيقاف بوتات النشر والتفاعل التلقائي — settings/publishingBots،
  // نفس منطق platformAdsEnabled أعلاه تماماً. الدورة اليومية الفعلية تعمل
  // على الخادم (server.ts، مُشغَّلة عبر GitHub Actions cron)، وتقرأ هذا
  // المستند بنفسها قبل أي نشر — تعطيله من هنا يوقف كل نشاط البوتات فوراً.
  const [publishingBotsEnabled, setPublishingBotsEnabledState] = useState(false);
  useEffect(() => {
    return subscribeToPublishingBotsEnabled(setPublishingBotsEnabledState, (err) =>
      console.error('تعذر تحميل إعداد بوتات النشر:', err)
    );
  }, []);

  const handleTogglePublishingBots = async (enabled: boolean) => {
    if (currentUser.role !== 'admin') return;
    setPublishingBotsEnabledState(enabled);
    try {
      await setPublishingBotsEnabledInFirestore(enabled, currentUser.id);
    } catch (err) {
      console.error('تعذر حفظ إعداد بوتات النشر:', err);
      setPublishingBotsEnabledState(!enabled);
      alert('تعذر حفظ الإعداد الجديد. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  const handleSeedBotAccounts = async () => {
    return seedBotAccounts();
  };

  // إعدادات الشبكات الإعلانية الخارجية الاحتياطية — نفس مخزن AdSlot
  // المشترك تماماً كحال platformAdsEnabled أعلاه.
  const [externalAdsConfig, setExternalAdsConfigState] = useState(getExternalAdsConfig());
  useEffect(() => {
    return subscribeExternalAdsConfig(setExternalAdsConfigState);
  }, []);

  const handleSaveExternalAdsConfig = async (config: ExternalAdsConfig) => {
    if (currentUser.role !== 'admin') return;
    setExternalAdsConfigState(config);
    try {
      await setExternalAdsConfigInFirestore(config, currentUser.id);
    } catch (err) {
      console.error('تعذر حفظ إعدادات الشبكات الإعلانية الخارجية:', err);
      alert('تعذر حفظ الإعداد الجديد. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  return {
    themePreset,
    backgroundPreset,
    handleChangeThemePreset,
    handleChangeBackgroundPreset,
    platformAdsEnabled,
    handleTogglePlatformAds,
    publishingBotsEnabled,
    handleTogglePublishingBots,
    handleSeedBotAccounts,
    externalAdsConfig,
    handleSaveExternalAdsConfig
  };
}
