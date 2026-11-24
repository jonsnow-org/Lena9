import React, { useEffect, useRef } from 'react';
import { setNativeSystemBars, setNativeBannerAds } from '../utils/nativeBridge';
import { ExternalAdsConfig } from '../utils/externalAdsStore';

export function useNativeAndBackNavigation(params: {
  isNativeApp: boolean;
  theme: 'light' | 'dark';
  platformAdsEnabled: boolean;
  externalAdsConfig: ExternalAdsConfig;
  setShowExitToast: React.Dispatch<React.SetStateAction<boolean>>;
  readingArticle: any;
  setReadingArticle: React.Dispatch<React.SetStateAction<any>>;
  editingArticle: any;
  setEditingArticle: React.Dispatch<React.SetStateAction<any>>;
  isArticleEditorOpen: boolean;
  setIsArticleEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewingWriterProfile: any;
  setViewingWriterProfile: React.Dispatch<React.SetStateAction<any>>;
  isImageStudioOpen: boolean;
  setIsImageStudioOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDirectMessagesOpen: boolean;
  setIsDirectMessagesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  followListModal: any;
  setFollowListModal: React.Dispatch<React.SetStateAction<any>>;
  promotingArticle: any;
  setPromotingArticle: React.Dispatch<React.SetStateAction<any>>;
  moneyModalMode: any;
  setMoneyModalMode: React.Dispatch<React.SetStateAction<any>>;
  isWalletOpen: boolean;
  setIsWalletOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSubscriptionOpen: boolean;
  setIsSubscriptionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isKycOpen: boolean;
  setIsKycOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNewCampaignOpen: boolean;
  setIsNewCampaignOpen: React.Dispatch<React.SetStateAction<boolean>>;
  legalSection: any;
  setLegalSection: React.Dispatch<React.SetStateAction<any>>;
  isAuthOpen: boolean;
  setIsAuthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDrawerOpen: boolean;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
}) {
  const {
    isNativeApp,
    theme,
    platformAdsEnabled,
    externalAdsConfig,
    setShowExitToast,
    readingArticle,
    setReadingArticle,
    editingArticle,
    setEditingArticle,
    isArticleEditorOpen,
    setIsArticleEditorOpen,
    viewingWriterProfile,
    setViewingWriterProfile,
    isImageStudioOpen,
    setIsImageStudioOpen,
    isDirectMessagesOpen,
    setIsDirectMessagesOpen,
    isAiAssistantOpen,
    setIsAiAssistantOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    followListModal,
    setFollowListModal,
    promotingArticle,
    setPromotingArticle,
    moneyModalMode,
    setMoneyModalMode,
    isWalletOpen,
    setIsWalletOpen,
    isSubscriptionOpen,
    setIsSubscriptionOpen,
    isKycOpen,
    setIsKycOpen,
    isNewCampaignOpen,
    setIsNewCampaignOpen,
    legalSection,
    setLegalSection,
    isAuthOpen,
    setIsAuthOpen,
    isDrawerOpen,
    setIsDrawerOpen,
    activeTab,
    setActiveTab
  } = params;

  // زر الرجوع الفعلي (فيزيائي على الجوال أو زر متصفح): ضغطة واحدة تُغلق
  // أعلى طبقة/نافذة مفتوحة حالياً إن وُجدت (نفس منطق "رجوع" المعتاد في كل
  // تطبيق)، وإن لم يكن هناك شيء مفتوح تظهر تلميح "اضغط رجوع مرة أخرى
  // للخروج"، وضغطة ثانية خلال 2.5 ثانية تسمح للتنقّل الفعلي بالمتابعة
  // (خروج من التطبيق/المتصفح). القراءة من مرجع (ref) مُحدَّث في كل رسم بدل
  // استخدامه كاعتماديات useEffect تتجنّب دفع مدخل تاريخي جديد (pushState)
  // عند كل تغيّر حالة، وتُبقي مستمع popstate واحداً طوال عمر الصفحة.
  const closeTopmostOverlayRef = useRef<() => boolean>(() => false);
  closeTopmostOverlayRef.current = () => {
    if (readingArticle) {
      setReadingArticle(null);
      return true;
    }
    if (editingArticle || isArticleEditorOpen) {
      setEditingArticle(null);
      setIsArticleEditorOpen(false);
      return true;
    }
    if (viewingWriterProfile) {
      setViewingWriterProfile(null);
      return true;
    }
    if (isImageStudioOpen) {
      setIsImageStudioOpen(false);
      return true;
    }
    if (isDirectMessagesOpen) {
      setIsDirectMessagesOpen(false);
      return true;
    }
    if (isAiAssistantOpen) {
      setIsAiAssistantOpen(false);
      return true;
    }
    if (isNotificationsOpen) {
      setIsNotificationsOpen(false);
      return true;
    }
    if (followListModal) {
      setFollowListModal(null);
      return true;
    }
    if (promotingArticle) {
      setPromotingArticle(null);
      return true;
    }
    if (moneyModalMode) {
      setMoneyModalMode(null);
      return true;
    }
    if (isWalletOpen) {
      setIsWalletOpen(false);
      return true;
    }
    if (isSubscriptionOpen) {
      setIsSubscriptionOpen(false);
      return true;
    }
    if (isKycOpen) {
      setIsKycOpen(false);
      return true;
    }
    if (isNewCampaignOpen) {
      setIsNewCampaignOpen(false);
      return true;
    }
    if (legalSection) {
      setLegalSection(null);
      return true;
    }
    if (isAuthOpen) {
      setIsAuthOpen(false);
      return true;
    }
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
      return true;
    }
    // كما في التطبيقات الأصيلة: الرجوع من أي تبويب آخر يعود للرئيسية أولاً.
    if (activeTab !== 'feed') {
      setActiveTab('feed');
      return true;
    }
    return false;
  };

  // داخل تطبيق أندرويد: زر الرجوع يُعالَج أصلياً (MainActivity يستدعي هذه الدالة
  // مباشرة) بدل حواجز history التي كانت تتطلب عدة ضغطات قبل الخروج.
  useEffect(() => {
    if (!isNativeApp) return;
    const w = window as unknown as { __literiumHandleBack?: () => boolean };
    w.__literiumHandleBack = () => closeTopmostOverlayRef.current();
    document.documentElement.classList.add('native-app');
    return () => {
      delete w.__literiumHandleBack;
    };
  }, [isNativeApp]);

  // شريطا الحالة والتنقل في التطبيق يأخذان لون رأس الصفحة نفسه.
  useEffect(() => {
    if (!isNativeApp) return;
    setNativeSystemBars(theme === 'dark' ? '#020617' : '#ffffff', theme !== 'dark');
  }, [isNativeApp, theme]);

  // شريط Start.io الأصلي أسفل شاشة التطبيق — يتبع المفتاح العام لإعلانات
  // المنصة ومفتاح Start.io في لوحة الأدمن.
  useEffect(() => {
    if (!isNativeApp) return;
    setNativeBannerAds(platformAdsEnabled && externalAdsConfig.startIo?.enabled !== false);
  }, [isNativeApp, platformAdsEnabled, externalAdsConfig]);

  useEffect(() => {
    if (isNativeApp) return;
    window.history.pushState({ literiumBackGuard: true }, '');
    let exitArmed = false;
    let exitTimer: number | null = null;

    const handlePopState = () => {
      const closedSomething = closeTopmostOverlayRef.current();
      if (closedSomething) {
        // أعد نصب الحاجز حتى تُعترَض الضغطة التالية أيضاً
        window.history.pushState({ literiumBackGuard: true }, '');
        return;
      }
      if (exitArmed) {
        // ضغطة ثانية خلال المهلة: لا نعيد نصب الحاجز، فيكمل المتصفح
        // تنقّله الطبيعي فعلياً (خروج/رجوع لصفحة سابقة حقيقية)
        exitArmed = false;
        if (exitTimer) window.clearTimeout(exitTimer);
        setShowExitToast(false);
        return;
      }
      exitArmed = true;
      setShowExitToast(true);
      window.history.pushState({ literiumBackGuard: true }, '');
      exitTimer = window.setTimeout(() => {
        exitArmed = false;
        setShowExitToast(false);
      }, 2500);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, []);
}
