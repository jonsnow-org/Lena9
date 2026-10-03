import React, { useMemo } from 'react';
import {
  RefreshCw,
  BookOpen,
  PenTool,
  ChevronUp
} from 'lucide-react';

import {
  Article,
  User,
  Conversation,
  LanguageCode,
  UserRole
} from './types';

import { LandingPage } from './components/LandingPage';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { DrawerMenu } from './components/DrawerMenu';
import { isEligibleForMonetization, getMemberStatusLabel } from './utils/creatorEligibility';
import { normalizeArabicSearch } from './utils/arabicSearch';
import { rotateArticles, pickFeatured } from './utils/feedRotation';
import { useIncrementalList } from './hooks/useIncrementalList';
import { getTranslator } from './data/translations';
import { LegalPages } from './components/LegalPages';
import { SiteFooter } from './components/SiteFooter';

import { useAppCoreState } from './hooks/useAppCoreState';
import { useEarlySubscriptionsAndAuth, useSocialAndContentSubscriptions } from './hooks/useFirestoreSubscriptions';
import { usePlatformSettings } from './hooks/usePlatformSettings';
import { usePullToRefreshAndScroll } from './hooks/usePullToRefreshAndScroll';
import { useAdminAndUserActions } from './hooks/useAdminAndUserActions';
import { useContentAndSocialActions } from './hooks/useContentAndSocialActions';
import { useNativeAndBackNavigation } from './hooks/useNativeAndBackNavigation';
import { MainRouterView } from './views/MainRouterView';
import { AppModalsLayer } from './views/AppModalsLayer';

// Minimal read-only placeholder used ONLY while browsing unauthenticated
// (guest mode). It is never written to Firestore, never included in the
// `users` list, and always has role 'reader' — it cannot be role-switched
// or used to access writer/advertiser/admin features.
const GUEST_USER: User = {
  id: 'guest',
  fullName: 'زائر',
  username: 'guest',
  email: '',
  avatarUrl: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300&auto=format&fit=crop&q=60',
  role: 'reader',
  rating: 0,
  followersCount: 0,
  followingCount: 0,
  articlesCount: 0,
  totalViews: 0,
  totalEarnings: 0,
  monthlyEarnings: 0,
  joinedDate: '',
  isVerified: false,
  isKycVerified: false
};

const LANGUAGE_CYCLE: LanguageCode[] = ['ar', 'en', 'fr', 'es', 'zh'];

export function App() {
  const {
    isLoggingOutRef,
    processingRequestIdsRef,
    users, setUsers,
    currentUserId, setCurrentUserId,
    articles, setArticles,
    articlesLoaded, setArticlesLoaded,
    campaigns, setCampaigns,
    comments, setComments,
    transactions, setTransactions,
    notifications, setNotifications,
    articleLikes, setArticleLikes,
    unlockedArticleIds, setUnlockedArticleIds,
    articleRatings, setArticleRatings,
    tweets, setTweets,
    tweetsLoaded, setTweetsLoaded,
    tweetComments, setTweetComments,
    tweetLikes, setTweetLikes,
    favoritedTweetIds, setFavoritedTweetIds,
    homeFeedMode, setHomeFeedMode,
    earningsRecords, setEarningsRecords,
    manualBalanceAdjustments, setManualBalanceAdjustments,
    guestIdentityUid, setGuestIdentityUid,
    rawConversations, setRawConversations,
    messages, setMessages,
    fraudFlags, setFraudFlags,
    theme, setTheme,
    language, setLanguage,
    bookmarkedArticleIds, setBookmarkedArticleIds,
    followedWriterIds, setFollowedWriterIds,
    activeTab, setActiveTab,
    selectedCategory, setSelectedCategory,
    searchQuery, setSearchQuery,
    isSearchExpanded, setIsSearchExpanded,
    isTweetSearchExpanded, setIsTweetSearchExpanded,
    tweetSearchQuery, setTweetSearchQuery,
    isRefreshing, setIsRefreshing,
    feedSeed, setFeedSeed,
    showScrollTop, setShowScrollTop,
    tweetComposeFocusTrigger, setTweetComposeFocusTrigger,
    touchStartPosRef,
    readingArticle, setReadingArticle,
    sharedArticleLinkHandledRef,
    viewedArticleIdsRef,
    viewingWriterProfile, setViewingWriterProfile,
    editingArticle, setEditingArticle,
    activeChatPartner, setActiveChatPartner,
    showLandingPage, setShowLandingPage,
    isNativeApp,
    authModalRole, setAuthModalRole,
    authModalMode, setAuthModalMode,
    isDrawerOpen, setIsDrawerOpen,
    isWalletOpen, setIsWalletOpen,
    isSubscriptionOpen, setIsSubscriptionOpen,
    isKycOpen, setIsKycOpen,
    isAiAssistantOpen, setIsAiAssistantOpen,
    isArticleEditorOpen, setIsArticleEditorOpen,
    promotingArticle, setPromotingArticle,
    promotions, setPromotions,
    legalSection, setLegalSection,
    moneyModalMode, setMoneyModalMode,
    depositRequests, setDepositRequests,
    payoutRequests, setPayoutRequests,
    followsData, setFollowsData,
    followListModal, setFollowListModal,
    purchaseRequests, setPurchaseRequests,
    adEvents, setAdEvents,
    isDirectMessagesOpen, setIsDirectMessagesOpen,
    isNotificationsOpen, setIsNotificationsOpen,
    isBeta20Open, setIsBeta20Open,
    isImageStudioOpen, setIsImageStudioOpen,
    isNotificationSettingsOpen, setIsNotificationSettingsOpen,
    imageStudioPrompt, setImageStudioPrompt,
    imageStudioSelectCallback, setImageStudioSelectCallback,
    isAuthOpen, setIsAuthOpen,
    passwordResetCode, setPasswordResetCode,
    isNewCampaignOpen, setIsNewCampaignOpen,
    showExitToast, setShowExitToast,
    adminActiveTab, setAdminActiveTab,
    writerActiveTab, setWriterActiveTab
  } = useAppCoreState();

  // المحادثات الفعلية المعروضة في نافذة الرسائل: تُشتق من rawConversations
  // بضم اسم/صورة/دور الطرف الآخر من users الحيّة — بدلاً من محاولة قراءة
  // partnerName/partnerAvatar من مستند Firestore الذي لا يخزّنها أصلاً
  // (وهو ما كان يجعل قائمة المحادثات تظهر فارغة/بلا اسم لكل من يفتحها).
  const conversations: Conversation[] = useMemo(
    () =>
      rawConversations.map((c) => {
        const partnerId = c.participantIds.find((id) => id !== currentUserId) || '';
        const partner = users.find((u) => u.id === partnerId);
        return {
          id: c.id,
          partnerId,
          partnerName: partner?.penName || partner?.companyName || partner?.fullName || 'مستخدم ليتيريوم',
          partnerAvatar:
            partner?.avatarUrl ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
          partnerRole: partner?.role || 'reader',
          lastMessage: c.lastMessage,
          lastMessageTime: c.lastMessageAt,
          unreadCount: 0,
          partnerTypingAt: c.typing?.[partnerId] || undefined,
          isHiddenForMe: Boolean(currentUserId && c.hiddenFor?.includes(currentUserId))
        };
      }),
    [rawConversations, users, currentUserId]
  );

  // Current User Object
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || GUEST_USER;
  }, [users, currentUserId]);

  const isAuthenticated = currentUser.id !== 'guest';

  // مقالات أعجب بها المستخدم الحالي فعلياً (من مجموعة likes في Firestore) —
  // سواء كان حساباً حقيقياً مسجّلاً أو زائراً معرَّفاً بهوية مجهولة.
  const likedArticleIds = useMemo(() => {
    const effectiveId = currentUserId || guestIdentityUid;
    if (!effectiveId) return [];
    return articleLikes.filter((l) => l.userId === effectiveId).map((l) => l.articleId);
  }, [articleLikes, currentUserId, guestIdentityUid]);

  // Central guard for any action that must not be usable while browsing as a
  // guest (follow, bookmark, like, comment, purchase, withdraw, AI usage...).
  // Returns true and lets the caller proceed only when a real account is
  // signed in; otherwise it opens the sign-in modal and blocks the action.
  const requireAuth = (): boolean => {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return false;
    }
    return true;
  };

  // Used by useEarlySubscriptionsAndAuth via reference wrapper or direct setter
  const authTriggerErrorSetterRef = React.useRef<React.Dispatch<React.SetStateAction<string | null>>>(() => {});

  useEarlySubscriptionsAndAuth({
    activeTab,
    isAuthenticated,
    currentUser,
    currentUserId,
    setCurrentUserId,
    setGuestIdentityUid,
    isLoggingOutRef,
    articles,
    setArticles,
    setArticlesLoaded,
    setCampaigns,
    setUsers,
    setFraudFlags,
    setTransactions,
    setEarningsRecords,
    setManualBalanceAdjustments,
    setShowLandingPage,
    setIsAuthOpen,
    setActiveTab,
    setAuthTriggerError: (val) => authTriggerErrorSetterRef.current(val),
    setPasswordResetCode,
    setLegalSection,
    sharedArticleLinkHandledRef,
    setReadingArticle,
    setPromotions,
    depositRequests,
    setDepositRequests,
    payoutRequests,
    setPayoutRequests,
    purchaseRequests,
    setPurchaseRequests,
    setAdEvents
  });

  useSocialAndContentSubscriptions({
    currentUserId,
    followsData,
    setFollowsData,
    setComments,
    setArticleLikes,
    setArticleRatings,
    setTweets,
    setTweetsLoaded,
    setTweetComments,
    setTweetLikes,
    setFavoritedTweetIds,
    setNotifications,
    setUnlockedArticleIds,
    setRawConversations,
    setMessages,
    setFollowedWriterIds,
    activeTab,
    readingArticle,
    viewingWriterProfile,
    legalSection
  });

  const {
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
  } = usePlatformSettings({
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
  });

  const {
    handleProcessAdEvents,
    handleProcessExternalAdRevenue,
    handleSaveSocialLinks,
    handleSaveProfile,
    handleSaveNotificationPrefs,
    handleUpdatePurchaseRequest,
    handleUpdateMoneyRequest,
    handleUpdatePromotionStatus
  } = useAdminAndUserActions({
    adEvents,
    campaigns,
    setCampaigns,
    users,
    setUsers,
    followsData,
    articles,
    externalAdsConfig,
    requireAuth,
    currentUser,
    purchaseRequests,
    depositRequests,
    payoutRequests,
    processingRequestIdsRef
  });

  // Categories list
  const categoryFilters = [
    { id: 'all', label: 'جميع المقالات' },
    { id: 'literature', label: 'الأدب والشعر' },
    { id: 'technology', label: 'التقنية والذكاء الاصطناعي' },
    { id: 'history', label: 'التاريخ والحضارات' },
    { id: 'philosophy', label: 'الفلسفة والفكر' },
    { id: 'business', label: 'ريادة الأعمال والمال' },
    { id: 'science', label: 'العلوم والفضاء' },
    { id: 'health', label: 'الصحة والرفاهية' },
    { id: 'arts', label: 'الفنون والنقد' },
    { id: 'politics', label: 'سياسي' },
    { id: 'education', label: 'تعليمي' },
    { id: 'beauty_fashion', label: 'مكياج وموضة وجمال' },
    { id: 'sports', label: 'رياضة' },
    { id: 'food', label: 'طبخ وأكلات' },
    { id: 'travel', label: 'سفر وسياحة' },
    { id: 'family', label: 'تربية وأسرة' }
  ];

  // Filtered Articles based on search & category
  const filteredArticles = useMemo(() => {
    const q = normalizeArabicSearch(searchQuery);
    const matched = articles.filter((art) => {
      const matchCategory = selectedCategory === 'all' || art.category === selectedCategory;
      if (!q) return matchCategory;

      const writerAccount = users.find((u) => u.id === art.writerId);
      const matchSearch =
        normalizeArabicSearch(art.title).includes(q) ||
        normalizeArabicSearch(art.description).includes(q) ||
        normalizeArabicSearch(art.writerName).includes(q) ||
        normalizeArabicSearch(writerAccount?.username || '').includes(q) ||
        (art.tags && art.tags.some((tg) => normalizeArabicSearch(tg).includes(q)));

      return matchCategory && matchSearch;
    });
    return q ? matched : rotateArticles(matched, feedSeed);
  }, [articles, users, selectedCategory, searchQuery, feedSeed]);

  const featuredArticles = useMemo(() => pickFeatured(articles, feedSeed), [articles, feedSeed]);
  const {
    visible: visibleArticles,
    hasMore: hasMoreArticles,
    sentinelRef: articlesSentinelRef
  } = useIncrementalList<Article>(filteredArticles, `${feedSeed}|${selectedCategory}|${searchQuery}`);

  const matchingUsers = useMemo(() => {
    const q = normalizeArabicSearch(searchQuery);
    if (!q) return [];
    return users
      .filter(
        (u) =>
          u.id !== 'guest' &&
          (normalizeArabicSearch(u.username || '').includes(q) ||
            normalizeArabicSearch(u.fullName || '').includes(q) ||
            normalizeArabicSearch(u.penName || '').includes(q) ||
            normalizeArabicSearch(u.companyName || '').includes(q))
      )
      .slice(0, 6);
  }, [users, searchQuery]);

  const {
    scrollToTop,
    pullIndicatorRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleRefreshFeed
  } = usePullToRefreshAndScroll({
    setShowScrollTop,
    touchStartPosRef,
    setIsRefreshing,
    setArticles,
    setTweets,
    setFeedSeed,
    currentUser,
    campaigns,
    setCampaigns
  });

  const {
    handleToggleFollow,
    handleShowFollowers,
    handleShowFollowing,
    handleToggleBookmark,
    handleLikeArticle,
    handlePostTweet,
    handleDeleteTweet,
    handleToggleTweetLike,
    handleToggleTweetFavorite,
    handleShareTweet,
    handlePostTweetComment,
    handleReplyToTweetComment,
    handleToggleTweetCommentLike,
    handleUnlockArticle,
    handleAddComment,
    handleLikeComment,
    handleShareArticle,
    myRatingsByArticleId,
    handleRateArticle,
    handleReactToArticle,
    handleSaveArticle,
    handleDeleteArticle,
    handleDeleteArticleAsAdmin,
    handleDeposit,
    handleWithdraw,
    handleConsumeAiQuota,
    handleUpgradeSuccess,
    handleCreateCampaign,
    handleReviewCampaign,
    handleToggleCampaignStatus,
    handleDeleteCampaign,
    handleSaveKyc,
    handleRejectKyc,
    handleSendMessage,
    handleHideConversation,
    handleToggleBlockUser,
    handleToggleMuteUser,
    handleReportUser,
    handleSetTyping,
    handleDeleteMessage,
    handleDeleteConversation,
    handleSwitchRole,
    handleLogout,
    authTriggerError,
    setAuthTriggerError,
    handleRealGoogleSignIn
  } = useContentAndSocialActions({
    requireAuth,
    currentUserId,
    setCurrentUserId,
    currentUser,
    isAuthenticated,
    followsData,
    setFollowedWriterIds,
    setFollowListModal,
    setBookmarkedArticleIds,
    guestIdentityUid,
    setGuestIdentityUid,
    articles,
    setArticles,
    likedArticleIds,
    setArticleLikes,
    tweets,
    setTweets,
    tweetLikes,
    setTweetLikes,
    favoritedTweetIds,
    setFavoritedTweetIds,
    tweetComments,
    setMoneyModalMode,
    comments,
    setComments,
    readingArticle,
    viewedArticleIdsRef,
    articleRatings,
    setArticleRatings,
    editingArticle,
    setEditingArticle,
    setIsArticleEditorOpen,
    setIsAuthOpen,
    users,
    setUsers,
    setIsSubscriptionOpen,
    campaigns,
    setCampaigns,
    messages,
    setMessages,
    setRawConversations,
    setActiveTab,
    isLoggingOutRef,
    setShowLandingPage
  });
  authTriggerErrorSetterRef.current = setAuthTriggerError;

  // List of Followed writers objects
  const followedWriters = useMemo(() => {
    return users.filter((u) => followedWriterIds.includes(u.id));
  }, [users, followedWriterIds]);

  const followersCountByUserId = useMemo(() => {
    const counts: Record<string, number> = {};
    followsData.forEach((f) => {
      counts[f.followingId] = (counts[f.followingId] || 0) + 1;
    });
    return counts;
  }, [followsData]);

  const t = useMemo(() => getTranslator(language), [language]);

  const pendingKycCount = users.filter((u: any) => u.kycDetails?.status === 'pending').length;
  const pendingMoneyCount = [...depositRequests, ...payoutRequests, ...purchaseRequests].filter(
    (r) => r.status === 'pending'
  ).length;
  const pendingFraudCount = fraudFlags.length;

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;
  const unreadMessagesCount = messages.filter((m) => m.recipientId === currentUser.id && !m.isRead).length;

  const currentUserIsMonetizationEligible = isEligibleForMonetization(
    currentUser,
    articles,
    followersCountByUserId[currentUser.id] || 0
  );
  const memberStatusLabel = getMemberStatusLabel(currentUser.role, currentUserIsMonetizationEligible);

  useNativeAndBackNavigation({
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
  });

  // الصفحات القانونية — متاحة للزوار غير المسجّلين أيضاً،
  // وبلا أي إعلانات (شرط من سياسات AdSense).
  if (legalSection) {
    return (
      <>
        <LegalPages
          section={legalSection}
          onChangeSection={(sec) => setLegalSection(sec)}
          onBack={() => setLegalSection(null)}
        />
        {showExitToast && (
          <div className="fixed bottom-6 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
            <div className="px-4 py-2.5 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl animate-fade-in">
              اضغط رجوع مرة أخرى للخروج
            </div>
          </div>
        )}
      </>
    );
  }

  // طلب صريح: من يثبّت التطبيق (APK) ويفتحه لأول مرة بلا جلسة محقَّقة يجب
  // ألا يرى صفحة الهبوط الدعائية إطلاقاً — بل شاشة تسجيل دخول/إنشاء حساب
  // إلزامية مباشرة (مع خيار نسيت كلمة السر، مبني بالفعل داخل AuthModal).
  if (showLandingPage && isNativeApp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-950 via-slate-950 to-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-3xl bg-brand-600/15 border border-brand-500/30 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-brand-300" />
          </div>
          <h1 className="text-xl font-black text-white">ليتيريوم</h1>
          <p className="text-xs text-slate-400 max-w-xs">
            سجّل الدخول أو أنشئ حساباً جديداً للمتابعة إلى المنصة
          </p>
        </div>

        <AuthModal
          isOpen={true}
          mandatory
          onClose={() => {}}
          initialRole={authModalRole}
          initialMode={authModalMode}
          onGoogleSignIn={(role) => handleRealGoogleSignIn(role)}
          externalError={authTriggerError}
        />

        {passwordResetCode && (
          <ResetPasswordModal
            oobCode={passwordResetCode}
            onClose={() => setPasswordResetCode(null)}
            onSuccess={() => {
              setPasswordResetCode(null);
              setAuthModalMode('login');
            }}
          />
        )}
      </div>
    );
  }

  // Show Landing Page for new visitors or when explicitly opened
  if (showLandingPage) {
    return (
      <div className="min-h-screen">
        <LandingPage
          articles={articles}
          currentUser={currentUser}
          isAuthenticated={isAuthenticated}
          onOpenLegal={(sec) => setLegalSection(sec)}
          onStartReading={() => {
            setShowLandingPage(false);
            setActiveTab('feed');
          }}
          onOpenRegister={(role) => {
            isLoggingOutRef.current = false;
            setAuthModalRole(role);
            setAuthModalMode('register');
            setIsAuthOpen(true);
          }}
          onOpenLogin={() => {
            isLoggingOutRef.current = false;
            setAuthModalRole('reader');
            setAuthModalMode('login');
            setIsAuthOpen(true);
          }}
          onSelectArticlePreview={(art) => {
            setReadingArticle(art);
            setShowLandingPage(false);
            setActiveTab('feed');
          }}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          language={language}
          onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
          onGoogleSignIn={(role: UserRole = 'reader') => {
            handleRealGoogleSignIn(role);
          }}
          campaigns={campaigns}
        />

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          initialRole={authModalRole}
          initialMode={authModalMode}
          onGoogleSignIn={(role) => handleRealGoogleSignIn(role)}
          externalError={authTriggerError}
        />

        {passwordResetCode && (
          <ResetPasswordModal
            oobCode={passwordResetCode}
            onClose={() => setPasswordResetCode(null)}
            onSuccess={() => {
              setPasswordResetCode(null);
              setAuthModalMode('login');
              setIsAuthOpen(true);
            }}
          />
        )}

        {showExitToast && (
          <div className="fixed bottom-6 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
            <div className="px-4 py-2.5 rounded-full bg-slate-900/95 text-white text-xs font-bold shadow-2xl animate-fade-in">
              اضغط رجوع مرة أخرى للخروج
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100 transition-colors font-sans antialiased">
      {/* Top Fixed Header */}
      <TopHeader
        currentUser={currentUser}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenAuth={() => {
          setAuthModalRole('reader');
          setAuthModalMode('login');
          setIsAuthOpen(true);
        }}
        onOpenProfile={() => {
          setViewingWriterProfile(null);
          setActiveTab('profile');
        }}
        onOpenLanding={() => setShowLandingPage(true)}
        unreadNotifsCount={unreadNotifsCount}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        language={language}
        onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
      />

      {/* Main Container with Pull-to-Refresh Gestures */}
      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-24 relative"
      >
        {/* مؤشر السحب للتحديث — دائرة أندرويد عائمة لا تدفع المحتوى */}
        <div
          ref={pullIndicatorRef}
          aria-hidden="true"
          className="pull-indicator fixed left-1/2 top-16 -ml-5 z-30 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black/5 flex items-center justify-center pointer-events-none"
          style={{ transform: 'translate3d(0, -56px, 0)', opacity: 0 }}
        >
          <RefreshCw className={`w-5 h-5 text-brand-600 dark:text-brand-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>

        <MainRouterView
          viewingWriterProfile={viewingWriterProfile}
          setViewingWriterProfile={setViewingWriterProfile}
          activeTab={activeTab}
          articles={articles}
          setArticles={setArticles}
          campaigns={campaigns}
          setCampaigns={setCampaigns}
          currentUserId={currentUserId}
          currentUser={currentUser}
          setReadingArticle={setReadingArticle}
          handleToggleFollow={handleToggleFollow}
          followsData={followsData}
          followedWriterIds={followedWriterIds}
          setActiveChatPartner={setActiveChatPartner}
          setIsDirectMessagesOpen={setIsDirectMessagesOpen}
          handleShowFollowers={handleShowFollowers}
          handleShowFollowing={handleShowFollowing}
          bookmarkedArticleIds={bookmarkedArticleIds}
          memberStatusLabel={memberStatusLabel}
          writerActiveTab={writerActiveTab}
          setWriterActiveTab={setWriterActiveTab}
          setIsNewCampaignOpen={setIsNewCampaignOpen}
          setIsWalletOpen={setIsWalletOpen}
          setIsKycOpen={setIsKycOpen}
          setIsBeta20Open={setIsBeta20Open}
          setLegalSection={setLegalSection}
          setEditingArticle={setEditingArticle}
          setIsArticleEditorOpen={setIsArticleEditorOpen}
          handleDeleteArticle={handleDeleteArticle}
          setPromotingArticle={setPromotingArticle}
          promotions={promotions}
          handleSaveSocialLinks={handleSaveSocialLinks}
          handleSaveProfile={handleSaveProfile}
          pendingKycCount={pendingKycCount}
          pendingMoneyCount={pendingMoneyCount}
          pendingFraudCount={pendingFraudCount}
          setIsSubscriptionOpen={setIsSubscriptionOpen}
          handleSwitchRole={handleSwitchRole}
          theme={theme}
          setTheme={setTheme}
          language={language}
          setLanguage={setLanguage}
          handleLogout={handleLogout}
          users={users}
          setUsers={setUsers}
          fraudFlags={fraudFlags}
          setFraudFlags={setFraudFlags}
          depositRequests={depositRequests}
          payoutRequests={payoutRequests}
          purchaseRequests={purchaseRequests}
          adEvents={adEvents}
          earningsRecords={earningsRecords}
          setEarningsRecords={setEarningsRecords}
          manualBalanceAdjustments={manualBalanceAdjustments}
          handleProcessAdEvents={handleProcessAdEvents}
          externalAdsConfig={externalAdsConfig}
          handleProcessExternalAdRevenue={handleProcessExternalAdRevenue}
          handleUpdatePurchaseRequest={handleUpdatePurchaseRequest}
          handleUpdateMoneyRequest={handleUpdateMoneyRequest}
          handleUpdatePromotionStatus={handleUpdatePromotionStatus}
          handleRejectKyc={handleRejectKyc}
          handleReviewCampaign={handleReviewCampaign}
          handleToggleCampaignStatus={handleToggleCampaignStatus}
          handleDeleteCampaign={handleDeleteCampaign}
          handleDeleteArticleAsAdmin={handleDeleteArticleAsAdmin}
          followersCountByUserId={followersCountByUserId}
          themePreset={themePreset}
          handleChangeThemePreset={handleChangeThemePreset}
          backgroundPreset={backgroundPreset}
          handleChangeBackgroundPreset={handleChangeBackgroundPreset}
          platformAdsEnabled={platformAdsEnabled}
          handleTogglePlatformAds={handleTogglePlatformAds}
          handleSaveExternalAdsConfig={handleSaveExternalAdsConfig}
          publishingBotsEnabled={publishingBotsEnabled}
          handleTogglePublishingBots={handleTogglePublishingBots}
          handleSeedBotAccounts={handleSeedBotAccounts}
          adminActiveTab={adminActiveTab}
          setAdminActiveTab={setAdminActiveTab}
          tweets={tweets}
          tweetComments={tweetComments}
          tweetLikes={tweetLikes}
          favoritedTweetIds={favoritedTweetIds}
          handleDeleteTweet={handleDeleteTweet}
          handleToggleTweetLike={handleToggleTweetLike}
          handleToggleTweetFavorite={handleToggleTweetFavorite}
          handleShareTweet={handleShareTweet}
          handlePostTweetComment={handlePostTweetComment}
          handleToggleTweetCommentLike={handleToggleTweetCommentLike}
          handleReplyToTweetComment={handleReplyToTweetComment}
          handleToggleBookmark={handleToggleBookmark}
          homeFeedMode={homeFeedMode}
          setHomeFeedMode={setHomeFeedMode}
          isTweetSearchExpanded={isTweetSearchExpanded}
          setIsTweetSearchExpanded={setIsTweetSearchExpanded}
          tweetSearchQuery={tweetSearchQuery}
          setTweetSearchQuery={setTweetSearchQuery}
          handleRefreshFeed={handleRefreshFeed}
          isRefreshing={isRefreshing}
          handlePostTweet={handlePostTweet}
          tweetComposeFocusTrigger={tweetComposeFocusTrigger}
          tweetsLoaded={tweetsLoaded}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          matchingUsers={matchingUsers}
          categoryFilters={categoryFilters}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          featuredArticles={featuredArticles}
          filteredArticles={filteredArticles}
          articlesLoaded={articlesLoaded}
          visibleArticles={visibleArticles}
          hasMoreArticles={hasMoreArticles}
          articlesSentinelRef={articlesSentinelRef}
        />

        {/* التذييل — روابط الصفحات القانونية مطلوبة في كل صفحة لقبول AdSense */}
        {!isNativeApp && <SiteFooter onOpenLegal={(sec) => setLegalSection(sec)} />}
      </main>

      {/* زر عائم لبدء الكتابة — في الجهة اليسرى، ويُخفى أثناء قراءة مقال لتجنب
          تضارب الواجهات. */}
      {!readingArticle &&
        !isArticleEditorOpen &&
        currentUser.id !== 'guest' &&
        activeTab === 'feed' &&
        !viewingWriterProfile && (
        <button
          id="btn-floating-write"
          type="button"
          onClick={() => {
            if (homeFeedMode === 'tweet') {
              setTweetComposeFocusTrigger((n) => n + 1);
              return;
            }
            setEditingArticle(null);
            setIsArticleEditorOpen(true);
          }}
          aria-label={homeFeedMode === 'tweet' ? 'كتابة تغريدة' : 'ابدأ الكتابة'}
          title={homeFeedMode === 'tweet' ? 'كتابة تغريدة' : 'ابدأ الكتابة'}
          className="fixed bottom-20 left-4 sm:bottom-24 sm:left-6 z-40 p-3.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl shadow-teal-600/30 transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/20 backdrop-blur-sm"
        >
          <PenTool className="w-5 h-5" />
        </button>
      )}

      {/* زر عائم للصعود للأعلى عند التمرير لأسفل — في الجهة المقابلة (اليمنى) */}
      {!readingArticle && !isArticleEditorOpen && showScrollTop && (
        <button
          id="btn-scroll-to-top"
          type="button"
          onClick={scrollToTop}
          aria-label="العودة لأعلى الصفحة"
          title="العودة لأعلى الصفحة"
          className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40 p-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl shadow-teal-600/30 transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/20 backdrop-blur-sm"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* تلميح "اضغط رجوع مرة أخرى للخروج" */}
      {showExitToast && (
        <div className="fixed bottom-20 sm:bottom-24 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
          <div className="px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-bold shadow-2xl animate-fade-in">
            اضغط رجوع مرة أخرى للخروج
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setViewingWriterProfile(null);
          setActiveTab(tab);
          if (tab === 'messages') {
            setIsDirectMessagesOpen(true);
          }
        }}
        userRole={currentUser.role}
        currentUser={currentUser}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenMessages={() => setIsDirectMessagesOpen(true)}
        adminActiveTab={adminActiveTab}
        onAdminNavigate={setAdminActiveTab}
        onOpenProfile={() => {
          setViewingWriterProfile(null);
          setActiveTab('profile');
        }}
        unreadCount={unreadNotifsCount}
        unreadMessagesCount={unreadMessagesCount}
        t={t}
      />

      {/* Slide-over Drawer Menu */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenKyc={() => setIsKycOpen(true)}
        onOpenBeta20={() => setIsBeta20Open(true)}
        onOpenPolicies={(tab) => setLegalSection(tab === 'restricted' ? 'terms' : (tab || 'privacy'))}
        onOpenLegal={(sec) => setLegalSection(sec)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onOpenProfile={() => {
          setViewingWriterProfile(null);
          setActiveTab('profile');
        }}
        onSwitchRole={handleSwitchRole}
        isMonetizationEligible={currentUserIsMonetizationEligible}
        memberStatusLabel={memberStatusLabel}
        onStartWriting={() => {
          setEditingArticle(null);
          setIsArticleEditorOpen(true);
        }}
        onOpenImageStudio={() => {
          setImageStudioPrompt('');
          setImageStudioSelectCallback(null);
          setIsImageStudioOpen(true);
        }}
        onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        currentLang={language}
        onChangeLanguage={(l) => setLanguage(l)}
        followedWriters={followedWriters}
        onSelectFollowedWriter={(w) => setViewingWriterProfile(w)}
        onOpenLogin={() => {
          setAuthModalRole('reader');
          setAuthModalMode('login');
          setIsAuthOpen(true);
        }}
        onNavigateTab={(tab) => {
          setIsDrawerOpen(false);
          switch (tab) {
            case 'admin_overview':
              setAdminActiveTab('overview');
              setActiveTab('profile');
              break;
            case 'admin_fraud':
              setAdminActiveTab('fraud');
              setActiveTab('profile');
              break;
            case 'admin_users':
              setAdminActiveTab('users');
              setActiveTab('profile');
              break;
            case 'admin_campaigns':
              setAdminActiveTab('campaigns');
              setActiveTab('profile');
              break;
            case 'admin_money':
              setAdminActiveTab('money');
              setActiveTab('profile');
              break;
            case 'writer_hub':
              setActiveTab('profile');
              break;
            case 'my_articles':
              setWriterActiveTab('articles' as any);
              setActiveTab('profile');
              break;
            case 'campaigns':
              setActiveTab('campaigns' as any);
              break;
            case 'billing':
              setIsWalletOpen(true);
              break;
            case 'explore':
              setActiveTab('explore');
              break;
            case 'saved':
              setActiveTab('profile');
              break;
            case 'messages':
              setIsDirectMessagesOpen(true);
              break;
            default:
              setActiveTab('feed');
          }
        }}
      />

      <AppModalsLayer
        readingArticle={readingArticle}
        setReadingArticle={setReadingArticle}
        campaigns={campaigns}
        isNativeApp={isNativeApp}
        handleLikeArticle={handleLikeArticle}
        likedArticleIds={likedArticleIds}
        handleToggleBookmark={handleToggleBookmark}
        bookmarkedArticleIds={bookmarkedArticleIds}
        handleToggleFollow={handleToggleFollow}
        followedWriterIds={followedWriterIds}
        handleUnlockArticle={handleUnlockArticle}
        unlockedArticleIds={unlockedArticleIds}
        comments={comments}
        handleAddComment={handleAddComment}
        handleLikeComment={handleLikeComment}
        handleShareArticle={handleShareArticle}
        handleRateArticle={handleRateArticle}
        myRatingsByArticleId={myRatingsByArticleId}
        handleReactToArticle={handleReactToArticle}
        currentUser={currentUser}
        currentUserId={currentUserId}
        users={users}
        setUsers={setUsers}
        articles={articles}
        followsData={followsData}
        setViewingWriterProfile={setViewingWriterProfile}
        isArticleEditorOpen={isArticleEditorOpen}
        setIsArticleEditorOpen={setIsArticleEditorOpen}
        editingArticle={editingArticle}
        setEditingArticle={setEditingArticle}
        handleSaveArticle={handleSaveArticle}
        setIsAuthOpen={setIsAuthOpen}
        setIsSubscriptionOpen={setIsSubscriptionOpen}
        handleConsumeAiQuota={handleConsumeAiQuota}
        imageStudioPrompt={imageStudioPrompt}
        setImageStudioPrompt={setImageStudioPrompt}
        imageStudioSelectCallback={imageStudioSelectCallback}
        setImageStudioSelectCallback={setImageStudioSelectCallback}
        isImageStudioOpen={isImageStudioOpen}
        setIsImageStudioOpen={setIsImageStudioOpen}
        setIsWalletOpen={setIsWalletOpen}
        isNotificationSettingsOpen={isNotificationSettingsOpen}
        setIsNotificationSettingsOpen={setIsNotificationSettingsOpen}
        handleSaveNotificationPrefs={handleSaveNotificationPrefs}
        isWalletOpen={isWalletOpen}
        transactions={transactions}
        handleDeposit={handleDeposit}
        handleWithdraw={handleWithdraw}
        setIsKycOpen={setIsKycOpen}
        moneyModalMode={moneyModalMode}
        setMoneyModalMode={setMoneyModalMode}
        depositRequests={depositRequests}
        payoutRequests={payoutRequests}
        promotingArticle={promotingArticle}
        setPromotingArticle={setPromotingArticle}
        isKycOpen={isKycOpen}
        handleSaveKyc={handleSaveKyc}
        isAiAssistantOpen={isAiAssistantOpen}
        setIsAiAssistantOpen={setIsAiAssistantOpen}
        guestIdentityUid={guestIdentityUid}
        isSubscriptionOpen={isSubscriptionOpen}
        handleUpgradeSuccess={handleUpgradeSuccess}
        isDirectMessagesOpen={isDirectMessagesOpen}
        setIsDirectMessagesOpen={setIsDirectMessagesOpen}
        conversations={conversations}
        messages={messages}
        setMessages={setMessages}
        handleSendMessage={handleSendMessage}
        handleDeleteMessage={handleDeleteMessage}
        handleDeleteConversation={handleDeleteConversation}
        handleHideConversation={handleHideConversation}
        handleToggleBlockUser={handleToggleBlockUser}
        handleToggleMuteUser={handleToggleMuteUser}
        handleReportUser={handleReportUser}
        handleSetTyping={handleSetTyping}
        activeChatPartner={activeChatPartner}
        followListModal={followListModal}
        setFollowListModal={setFollowListModal}
        setActiveTab={setActiveTab}
        isNotificationsOpen={isNotificationsOpen}
        setIsNotificationsOpen={setIsNotificationsOpen}
        notifications={notifications}
        isBeta20Open={isBeta20Open}
        setIsBeta20Open={setIsBeta20Open}
        isNewCampaignOpen={isNewCampaignOpen}
        setIsNewCampaignOpen={setIsNewCampaignOpen}
        handleCreateCampaign={handleCreateCampaign}
        isAuthOpen={isAuthOpen}
        authModalRole={authModalRole}
        authModalMode={authModalMode}
        setAuthModalMode={setAuthModalMode}
        handleRealGoogleSignIn={handleRealGoogleSignIn}
        authTriggerError={authTriggerError}
        passwordResetCode={passwordResetCode}
        setPasswordResetCode={setPasswordResetCode}
      />
    </div>
  );
}
export default App;
