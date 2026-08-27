import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  BookOpen,
  PenTool,
  Megaphone,
  TrendingUp,
  Bookmark,
  Heart,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  ChevronUp,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

import {
  Article,
  User,
  AdCampaign,
  Comment,
  CommentReply,
  Transaction,
  AppNotification,
  Conversation,
  DirectMessage,
  MessageReport,
  ArticleCategory,
  LanguageCode,
  UserRole,
  PaymentMethod,
  KycDetails,
  FraudFlag,
  PricingModel,
  ArticlePromotion,
  Tweet,
  TweetComment
} from './types';

import { REVENUE_SHARES } from './constants/revenueShares';
import { LandingPage } from './components/LandingPage';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { ArticleCard } from './components/ArticleCard';
import { ArticleCardSkeleton } from './components/ArticleCardSkeleton';
import { FeaturedArticlesSection } from './components/FeaturedArticlesSection';
import { TrendingArticlesSection } from './components/TrendingArticlesSection';
import { SmartAdBanner } from './components/SmartAdBanner';
import { ArticleReader } from './components/ArticleReader';
import { HomeFeedModeSwitcher, HomeFeedMode } from './components/HomeFeedModeSwitcher';
import { TweetFeed } from './components/TweetFeed';
import { ArticleEditorModal } from './components/ArticleEditorModal';
import { AdvertiserDashboard } from './components/AdvertiserDashboard';
import { WriterProfileView } from './components/WriterProfileView';
import { FollowListModal } from './components/FollowListModal';
import { ExploreView } from './components/ExploreView';
import { UserProfileView } from './components/UserProfileView';
import { WalletModal } from './components/WalletModal';
import { KycModal } from './components/KycModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { DirectMessagesModal } from './components/DirectMessagesModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BetaTesting20Modal } from './components/BetaTesting20Modal';
import { ImageStudioModal } from './components/ImageStudioModal';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { DrawerMenu } from './components/DrawerMenu';
import { SubscriptionModal } from './components/SubscriptionModal';
import { NewCampaignModal } from './components/NewCampaignModal';
import { consumeAiUsage, applySubscriptionUpgrade } from './utils/aiQuota';
import { rememberAccount } from './utils/savedAccounts';
import { isEligibleForMonetization, getMemberStatusLabel } from './utils/creatorEligibility';
import { normalizeArabicSearch } from './utils/arabicSearch';
import { getTranslator } from './data/translations';
import { applyThemePreset, applyBackgroundPreset, syncBackgroundOverlayMode } from './utils/themeEngine';
import { subscribePlatformAdsEnabled, getPlatformAdsEnabled } from './utils/platformAdsStore';
import { subscribeExternalAdsConfig, getExternalAdsConfig, ExternalAdsConfig } from './utils/externalAdsStore';
import { isValidThemePreset, DEFAULT_THEME_PRESET, ThemePresetKey } from './constants/themePresets';
import {
  isValidBackgroundPreset,
  DEFAULT_BACKGROUND_PRESET,
  BackgroundPresetKey
} from './constants/backgroundPresets';
import {
  subscribeToThemePreset,
  setThemePresetInFirestore,
  setBackgroundPresetInFirestore,
  setPlatformAdsEnabledInFirestore,
  setExternalAdsConfigInFirestore,
  subscribeToPublishingBotsEnabled,
  setPublishingBotsEnabledInFirestore
} from './services/firestoreService';
import { seedBotAccounts } from './services/botsApi';
import { PromoteArticleModal } from './components/PromoteArticleModal';
import { LegalPages, LegalSection } from './components/LegalPages';
import { SiteFooter } from './components/SiteFooter';
import { MoneyRequestModal } from './components/MoneyRequestModal';
import { AdSlot, resetAdSlotCounter, SLOT_CONFIG, AdSlotId } from './components/AdSlot';
import { evaluateAdEventBatch, calculateEventCost } from './utils/fraudFilters';
import {
  subscribeToPromotions,
  setPromotionStatusInFirestore,
  subscribeToMoneyRequests,
  setMoneyRequestStatus,
  subscribeToFollows,
  createDepositRequest,
  createPayoutRequest,
  ensureConversation,
  sendMessageToFirestore,
  broadcastMessageToAllUsers,
  subscribeToConversations,
  subscribeToMessages,
  markMessagesReadByIds,
  logAdEvent,
  createPurchaseRequest,
  updateUserSocialLinks,
  updateUserProfileInFirestore,
  subscribeToAdEvents,
  markAdEventProcessed,
  adminAdjustUserBalance,
  logManualBalanceAdjustment,
  adminLogEarning,
  followUser,
  unfollowUser,
  subscribeToComments,
  addCommentToFirestore,
  addReplyToCommentInFirestore,
  toggleCommentLikeInFirestore,
  subscribeToArticleLikes,
  subscribeToArticlePurchases,
  likeArticleInFirestore,
  unlikeArticleInFirestore,
  createNotificationInFirestore,
  subscribeToNotifications,
  markNotificationReadInFirestore,
  markAllNotificationsReadInFirestore,
  deleteNotificationInFirestore,
  clearAllNotificationsInFirestore,
  incrementArticleViewInFirestore,
  subscribeToArticleRatings,
  rateArticleInFirestore,
  syncArticleRatingSummary,
  setArticleReactionInFirestore,
  subscribeToTweets,
  addTweetToFirestore,
  deleteTweetInFirestore,
  incrementTweetSharesInFirestore,
  subscribeToTweetLikes,
  likeTweetInFirestore,
  unlikeTweetInFirestore,
  subscribeToTweetFavorites,
  favoriteTweetInFirestore,
  unfavoriteTweetInFirestore,
  subscribeToTweetComments,
  addTweetCommentToFirestore,
  addReplyToTweetCommentInFirestore,
  toggleTweetCommentLikeInFirestore,
  subscribeToAllEarningsAdmin,
  subscribeToManualBalanceAdjustments,
  deleteMessageInFirestore,
  deleteConversationInFirestore,
  hideConversationForMe,
  toggleBlockUser,
  toggleMuteUser,
  updateMyPresence,
  setTypingState,
  submitUserReport,
  markEarningReleasedInFirestore,
  updateUserAiQuotaInFirestore,
  adminReleaseEarnings,
  EarningRecord
} from './services/firestoreService';
import { unlockArticle as requestArticleUnlock, fundCampaign } from './services/paymentsApi';
import { trackVisit } from './services/analyticsApi';
import {
  auth,
  fetchUserFromFirestore,
  createOrUpdateUserDoc,
  signInWithGoogle,
  completeRedirectSignIn,
  getAndClearPendingRole,
  getAuthErrorMessage,
  logOut,
  ensureGuestIdentity,
  updateUserRoleInFirestore,
  updateWalletBalanceInFirestore,
  recordEarningInFirestore,
  handleEmailVerificationFromUrl,
  getPasswordResetCodeFromUrl
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  subscribeToArticles,
  subscribeToCampaigns,
  subscribeToUsers,
  subscribeToEarnings,
  subscribeToFraudFlags,
  saveArticleToFirestore,
  deleteArticleFromFirestore,
  saveCampaignToFirestore,
  updateArticleStatsInFirestore,
  logFraudFlagToFirestore,
  setUserVerifiedInFirestore,
  setUserKycApprovedInFirestore,
  submitKycRequestInFirestore,
  setUserBannedInFirestore,
  setCampaignStatusInFirestore,
  setArticleStatusInFirestore,
  resolveFraudFlagInFirestore
} from './services/firestoreService';

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
  // علامة مرجعية (لا تُعيد الرسم) تُستخدم لمنع سباق التوقيت بين ضغط زر
  // "تسجيل الخروج" وإشارة Firebase الداخلية المتأخرة أحياناً — بدونها كان
  // يحصل أن يُعاد تسجيل دخول المستخدم تلقائياً للحساب الذي خرج منه للتو.
  const isLoggingOutRef = useRef(false);

  // حماية من الاعتماد المزدوج (نقر مزدوج سريع على "اعتماد" قبل أن تُخفي
  // الواجهة الزر): معرّفات الطلبات المالية قيد المعالجة فعلياً الآن —
  // أي محاولة ثانية لنفس المعرّف تُرفض فوراً بدل تكرار خصم/إضافة الرصيد
  // أو تكرار تسجيل الأرباح في earnings.
  const processingRequestIdsRef = useRef<Set<string>>(new Set());

  // Persistence & State Initialization
  // Users state: starts EMPTY for real users. Demo/mock identities from
  // mockData are no longer loaded into live state — they were letting any
  // guest browsing the site get treated as an already-authenticated fake
  // writer account, with full dashboard + role-switch access.
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('literium_users');
    return saved ? JSON.parse(saved) : [];
  });

  // No default mock user. Empty string = guest / not authenticated.
  // This is populated only by the onAuthStateChanged listener once Firebase
  // confirms a real signed-in user.
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('literium_current_user_id') || '';
  });

  const [articles, setArticles] = useState<Article[]>(() => {
    const saved = localStorage.getItem('literium_articles');
    return saved ? JSON.parse(saved) : [];
  });

  const [campaigns, setCampaigns] = useState<AdCampaign[]>(() => {
    const saved = localStorage.getItem('literium_campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  // التعليقات: كانت تُحفظ محلياً فقط (خطأ جوهري — لا يراها أحد غير صاحب
  // الجهاز). الآن تأتي فعلياً من Firestore عبر الاشتراك الفوري أدناه؛
  // القيمة الابتدائية فارغة وتُملأ بمجرد وصول أول لقطة من الخادم.
  const [comments, setComments] = useState<Comment[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('literium_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // الإشعارات: تأتي فعلياً من Firestore الآن (مقيّدة بالمستخدم الحالي)،
  // بدل كونها محلية بحتة لا تصل لأي شخص آخر غير من نفّذ الحدث بنفسه.
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // إعجابات المقالات الحقيقية: كل عنصر = مقال أعجب به مستخدم معيّن فعلياً،
  // تُستخدم لمعرفة ما إذا كان المستخدم الحالي قد أعجب بمقال بعينه أم لا.
  const [articleLikes, setArticleLikes] = useState<{ id: string; articleId: string; userId: string }[]>([]);

  // معرّفات المقالات المقفولة التي اشتراها المستخدم الحالي فعلياً (يخصمها
  // السيرفر فوراً عبر /api/articles/unlock) — تُستخدم لإظهار المحتوى
  // مفتوحاً دون طلب دفع مكرر.
  const [unlockedArticleIds, setUnlockedArticleIds] = useState<string[]>([]);

  // تقييمات المقالات الحقيقية (1-5 نجوم) لكل مستخدم على كل مقال.
  const [articleRatings, setArticleRatings] = useState<
    { id: string; articleId: string; userId: string; stars: number }[]
  >([]);

  // التغريدات — محتوى قصير بجانب المدونة، بنفس نمط المقالات/الإعجابات/
  // التعليقات تماماً.
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [tweetComments, setTweetComments] = useState<TweetComment[]>([]);
  const [tweetLikes, setTweetLikes] = useState<{ id: string; tweetId: string; userId: string }[]>([]);
  const [favoritedTweetIds, setFavoritedTweetIds] = useState<string[]>([]);
  const [homeFeedMode, setHomeFeedMode] = useState<HomeFeedMode>('blog');

  // سجلات الأرباح الفردية (لكل مقال/حملة)، تحمل موعد استحقاق التحرير بعد
  // 30 يوماً من التجميد — تُقرأ فقط لحساب الأدمن (القواعد تمنع غيره).
  const [earningsRecords, setEarningsRecords] = useState<EarningRecord[]>([]);
  const [manualBalanceAdjustments, setManualBalanceAdjustments] = useState<any[]>([]);

  // هوية "الدخول المجهول" الخاصة بالزائر الحالي (إن وُجدت) — تُستخدم فقط
  // للسماح للزوار بالإعجاب الحقيقي دون تسجيل دخول فعلي. لا علاقة لها
  // بـ currentUserId ولا تُعامَل كحساب مسجّل بأي شكل.
  const [guestIdentityUid, setGuestIdentityUid] = useState<string>('');

  // بيانات المحادثة الخام من Firestore (معرّف المشارك الآخر فقط، بلا اسمه
  // أو صورته) — يُشتق منها `conversations` أدناه بضم بيانات كل مشارك من
  // قائمة `users` الحية، بدل تخزين partnerName/partnerAvatar بصيغة ثابتة
  // كانت تصل بالفعل undefined لكل محادثة (طابق conversations/{id} الفعلي
  // في Firestore لا يخزّن سوى participants/lastMessage/lastMessageAt).
  const [rawConversations, setRawConversations] = useState<
    {
      id: string;
      participantIds: string[];
      lastMessage: string;
      lastMessageAt: string;
      typing?: Record<string, string | null>;
      hiddenFor?: string[];
    }[]
  >(() => {
    const saved = localStorage.getItem('literium_conversations');
    return saved ? JSON.parse(saved) : [];
  });

  const [messages, setMessages] = useState<DirectMessage[]>(() => {
    const saved = localStorage.getItem('literium_messages');
    return saved ? JSON.parse(saved) : [];
  });

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

  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>(() => {
    const saved = localStorage.getItem('literium_fraud_flags');
    return saved ? JSON.parse(saved) : [];
  });

  // User Preferences
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('literium_theme') as 'light' | 'dark') || 'light';
  });

  const [language, setLanguage] = useState<LanguageCode>(() => {
    return (localStorage.getItem('literium_lang') as LanguageCode) || 'ar';
  });

  const [bookmarkedArticleIds, setBookmarkedArticleIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('literium_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });

  const [followedWriterIds, setFollowedWriterIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('literium_following');
    return saved ? JSON.parse(saved) : [];
  });

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'feed' | 'explore' | 'action' | 'ads' | 'profile' | 'dashboard' | 'messages'>('feed');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // شريط البحث ينطوي افتراضياً لأيقونة عدسة فقط، ويتمدد للكتابة عند الضغط عليها
  // بدل إشغال عرض الشاشة بحقل نص فارغ طوال الوقت.
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // ⚠️ ref لا state: تتبّع نقطة بداية اللمسة لا يحتاج إعادة رسم إطلاقاً
  const touchStartPosRef = useRef(0);

  // Active Selected Entity States
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  // يمنع فتح رابط المقال المُشارَك أكثر من مرة (مثلاً بعد إغلاق المستخدم
  // للمقال يدوياً ثم تحديث قائمة articles لأي سبب آخر).
  const sharedArticleLinkHandledRef = useRef(false);
  // معرّفات المقالات التي سُجِّلت مشاهدتها فعلياً بهذه الجلسة، لمنع احتساب
  // مشاهدة مكرَّرة لو أغلق القارئ المقال وأعاد فتحه مرات عدة بنفس الزيارة.
  const viewedArticleIdsRef = useRef<Set<string>>(new Set());
  const [viewingWriterProfile, setViewingWriterProfile] = useState<User | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [activeChatPartner, setActiveChatPartner] = useState<User | null>(null);

  // Modals visibility
  // Only skip the landing page automatically for a REAL logged-in session
  // (a real Firebase uid persisted below) — never based on the old
  // "has seen landing" flag alone, which used to also get set just from
  // guest browsing and could trap a signed-out visitor straight into guest
  // mode on every refresh.
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    const hasRealSession = Boolean(localStorage.getItem('literium_current_user_id'));
    return !hasRealSession;
  });
  const [authModalRole, setAuthModalRole] = useState<UserRole>('reader');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isKycOpen, setIsKycOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isArticleEditorOpen, setIsArticleEditorOpen] = useState(false);
  // المقال المطلوب ترويجه (null = النافذة مغلقة)
  const [promotingArticle, setPromotingArticle] = useState<Article | null>(null);
  const [promotions, setPromotions] = useState<ArticlePromotion[]>([]);
  // الصفحة القانونية المعروضة حالياً (null = غير معروضة)
  const [legalSection, setLegalSection] = useState<LegalSection | null>(null);
  // نافذة الإيداع/السحب
  const [moneyModalMode, setMoneyModalMode] = useState<'deposit' | 'payout' | null>(null);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [followsData, setFollowsData] = useState<{ id: string; followerId: string; followingId: string }[]>([]);
  // نافذة قائمة "متابِعون/يتابع" — كانت العدّادات في الملف الشخصي أرقاماً
  // غير قابلة للضغط فقط، بلا أي وسيلة لعرض القائمة الفعلية للأشخاص.
  const [followListModal, setFollowListModal] = useState<{ title: string; userIds: string[] } | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [adEvents, setAdEvents] = useState<any[]>([]);
  const [isDirectMessagesOpen, setIsDirectMessagesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBeta20Open, setIsBeta20Open] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [imageStudioPrompt, setImageStudioPrompt] = useState('');
  const [imageStudioSelectCallback, setImageStudioSelectCallback] = useState<((url: string) => void) | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  // oobCode من رابط إعادة تعيين كلمة المرور، إن فُتح التطبيق منه (انظر
  // useEffect بجانب handleEmailVerificationFromUrl أدناه). null = لا تُعرض
  // نافذة إعادة التعيين.
  const [passwordResetCode, setPasswordResetCode] = useState<string | null>(null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  // زر الرجوع الفعلي (أو زر الجوال) على المستوى الجذر: ضغطة واحدة تُغلق
  // أعلى نافذة/طبقة مفتوحة إن وُجدت، وإلا (لا شيء مفتوح) تُظهر تلميح تأكيد
  // الخروج، وضغطة ثانية خلال 2.5 ثانية تسمح بالخروج الفعلي من التطبيق.
  const [showExitToast, setShowExitToast] = useState(false);
  // Which admin section UserProfileView shows — lifted here so the bottom
  // nav's admin buttons (money/campaigns/users) and the drawer menu can
  // pick a specific section directly, same lifting pattern as
  // writerActiveTab below. Used to control a separate AdminDashboard
  // screen; that component is gone now (its tab content was moved inline
  // into UserProfileView's own admin section) so this now targets the
  // 'profile' tab with a pre-selected section instead.
  const [adminActiveTab, setAdminActiveTab] = useState<
    'overview' | 'analytics' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings'
  >('overview');
  // Same lifting pattern for the writer's profile sub-tabs (مقالاتي /
  // الأرباح), which live inside UserProfileView's own tab system.
  const [writerActiveTab, setWriterActiveTab] = useState<
    'blog' | 'tweet' | 'control_panel'
  >('blog');

  // Current User Object
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || GUEST_USER;
  }, [users, currentUserId]);

  const isAuthenticated = currentUser.id !== 'guest';

  // تسجيل زيارات حقيقية لكل تنقّل فعلي بين الأقسام الرئيسية (وليس بيانات
  // وهمية محلية) — يغذي قسم "إحصاءات عامة" في لوحة الأدمن. لا يوقف أي شيء
  // إن فشل (fire-and-forget داخل trackVisit نفسها).
  useEffect(() => {
    trackVisit(`/${activeTab}`, `Literium - ${activeTab}`, isAuthenticated ? currentUser.id : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated]);

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

  // Realtime Firestore Collections Subscriptions
  useEffect(() => {
    const unsubArticles = subscribeToArticles((firestoreArticles) => {
      if (firestoreArticles && firestoreArticles.length > 0) {
        setArticles(firestoreArticles);
      }
    });

    const unsubCampaigns = subscribeToCampaigns((firestoreCampaigns) => {
      if (firestoreCampaigns && firestoreCampaigns.length > 0) {
        setCampaigns(firestoreCampaigns);
      }
    });

    const unsubUsers = subscribeToUsers((firestoreUsers) => {
      if (firestoreUsers && firestoreUsers.length > 0) {
        setUsers(firestoreUsers);
      }
    });

    // fraudFlags و earnings الشخصية تتطلبان مستخدماً مسجّلاً دخول، بينما
    // earnings الإدارية الكاملة (لتحرير الأرباح المجمّدة) تتطلب دور admin
    // تحديداً — الاشتراك غير المشروط بهذه الشروط يُسبّب رفض إذن فوري.
    let unsubFraud = () => {};
    let unsubEarnings = () => {};
    let unsubAllEarnings = () => {};
    let unsubManualAdjustments = () => {};

    if (currentUserId) {
      unsubFraud = subscribeToFraudFlags((flags) => {
        if (flags && flags.length > 0) {
          setFraudFlags(flags);
        }
      });

      unsubEarnings = subscribeToEarnings(currentUserId, (earningTxs) => {
        if (earningTxs && earningTxs.length > 0) {
          setTransactions((prev) => {
            const combined = [...earningTxs, ...prev.filter((t) => !earningTxs.some((e) => e.id === t.id))];
            return combined;
          });
        }
      });
    }

    if (currentUser?.role === 'admin') {
      unsubAllEarnings = subscribeToAllEarningsAdmin(
        setEarningsRecords,
        (e) => console.error('Admin earnings subscription error:', e)
      );
      unsubManualAdjustments = subscribeToManualBalanceAdjustments(
        setManualBalanceAdjustments,
        (e) => console.error('Manual balance adjustments subscription error:', e)
      );
    }

    return () => {
      unsubArticles();
      unsubCampaigns();
      unsubUsers();
      unsubFraud();
      unsubEarnings();
      unsubAllEarnings();
      unsubManualAdjustments();
    };
  }, [currentUserId, currentUser?.role]);

  // Firebase Auth Listener — SINGLE SOURCE OF TRUTH for authentication state.
  // الاستماع لتغيّر حالة تسجيل الدخول في Firebase — المصدر الوحيد الموثوق.
  // Every sign-in path (Google popup, Google redirect, Email/Password) ends up
  // here exactly once. No other function in this app should set currentUserId,
  // showLandingPage, or activeTab in response to a login — that avoids the
  // race conditions between multiple competing handlers we had before.
  //
  // ⚠️ مشكلة كانت موجودة: عند تسجيل الخروج، أحياناً يصل استدعاء متأخر من
  // Firebase لهذا المستمع بنفس المستخدم القديم (سباق توقيت بين لحظة نداء
  // signOut() فعلياً ولحظة استقرار حالة المصادقة الداخلية)، فيُعيد هذا
  // المستمع تسجيل الدخول للحساب الذي خرج منه المستخدم للتو دون علمه —
  // وهذا هو سبب "الحساب العالق" الذي كان يمنع الدخول بحساب مختلف.
  // العلامة أدناه تمنع أي استدعاء دخول من هذا النوع خلال ثانيتين بعد ضغط
  // زر تسجيل الخروج تحديداً.
  useEffect(() => {
    // Finish a Google signInWithRedirect flow (mobile). No-op if there was none.
    completeRedirectSignIn();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // حساب "الدخول المجهول" (لإعجاب الزوار الحقيقي) — لا يُعامَل كحساب
      // مسجّل إطلاقاً: لا يُنشأ له ملف مستخدم، ولا يُغيَّر currentUserId،
      // فيبقى الشخص زائراً بنظر واجهة التطبيق تماماً كما هو متوقّع.
      if (fbUser && fbUser.isAnonymous) {
        setGuestIdentityUid(fbUser.uid);
        return;
      }
      if (fbUser) {
        if (isLoggingOutRef.current) {
          // تجاهل أي إشارة "لسه مسجّل دخول" متأخرة تصل بعد ضغط زر الخروج
          // مباشرة — المستخدم اتخذ قراره بالخروج ولن نلغيه تلقائياً.
          return;
        }
        try {
          let user = await fetchUserFromFirestore(fbUser.uid);

          // First time we see this Firebase user: create their Firestore profile.
          // The intended role (reader/writer/advertiser) was stashed before the
          // sign-in attempt, since a redirect reloads the page and loses any
          // in-memory state.
          if (!user) {
            const pendingRole = getAndClearPendingRole() || 'reader';
            user = await createOrUpdateUserDoc(fbUser, pendingRole);
          } else {
            getAndClearPendingRole(); // clear stale value, existing users keep their stored role
          }

          if (user) {
            setUsers((prev) => {
              const exists = prev.find((u) => u.id === user!.id);
              if (exists) {
                return prev.map((u) => (u.id === user!.id ? { ...u, ...user! } : u));
              }
              return [user!, ...prev];
            });
            setCurrentUserId(user.id);
            // حفظ الحساب في قائمة الحسابات المحفوظة على هذا الجهاز،
            // دون حذف أي حساب آخر محفوظ مسبقاً (لا تُحفظ كلمة المرور).
            rememberAccount({
              uid: user.id,
              email: user.email,
              fullName: user.fullName,
              avatarUrl: user.avatarUrl,
              role: user.role
            });
            localStorage.setItem('literium_current_user_id', user.id);
            localStorage.setItem('literium_has_seen_landing', 'true');
            setShowLandingPage(false);
            setIsAuthOpen(false);
            // الشاشة الرئيسية (الخلاصة) هي وجهة الدخول الافتراضية دائماً —
            // بغض النظر عن الدور — بدل القفز مباشرة لملف الكاتب/الأدمن في
            // كل فتحة للتطبيق، حتى لو لم يفعل المستخدم شيئاً سوى فتحه.
            setActiveTab('feed');
          }
        } catch (authDocError) {
          console.error('Error synchronizing authenticated user with Firestore:', authDocError);
          // كان هذا الخطأ يُسجَّل بصمت فقط دون أي رد فعل مرئي للمستخدم،
          // فيبقى عالقاً بلا تفسير (شاشة الدخول لا تُغلق ولا تظهر أي رسالة).
          // الآن نعرض له رسالة واضحة قابلة لإعادة المحاولة.
          setAuthTriggerError(
            'تعذّر تحميل بيانات حسابك من قاعدة البيانات. تحقق من اتصالك بالإنترنت ثم حاول تسجيل الدخول مرة أخرى.'
          );
          setIsAuthOpen(true);
        }
      } else {
        setCurrentUserId('');
        localStorage.removeItem('literium_current_user_id');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // معالجة روابط تأكيد البريد الإلكتروني والعودة من بوابات الدفع
  useEffect(() => {
    // التحقق من كود تأكيد البريد إذا فُتح الرابط مباشرة في التطبيق
    handleEmailVerificationFromUrl().then((res) => {
      if (res.handled && res.message) {
        alert(res.message);
      }
    });

    const resetCode = getPasswordResetCodeFromUrl();
    if (resetCode) setPasswordResetCode(resetCode);

    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const payoutConnect = params.get('payoutConnect');
    if (!payment && !payoutConnect) return;

    if (payment === 'success') {
      alert('تم الدفع بنجاح! سيظهر الرصيد في محفظتك خلال لحظات.');
    } else if (payment === 'cancelled') {
      alert('تم إلغاء عملية الدفع.');
    } else if (payoutConnect === 'done') {
      alert('تم إتمام ربط حساب استلام الأموال. افتح المحفظة لمتابعة السحب.');
    } else if (payoutConnect === 'refresh') {
      alert('انتهت صلاحية رابط الربط. افتح المحفظة وحاول ربط الحساب مرة أخرى.');
    }

    params.delete('payment');
    params.delete('payoutConnect');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }, []);

  // فتح المقال تلقائياً عند الدخول من رابط مُشارَك (?article=ID، يُنشئه
  // getShareUrl في ArticleReader.tsx عند نسخ/مشاركة الرابط) — كان هذا
  // الرابط يُشارَك فعلياً لكن لا شيء يقرأ هذا المعامل عند فتح الصفحة، فيصل
  // الزائر إلى الخلاصة العادية بدل المقال المقصود.
  useEffect(() => {
    if (sharedArticleLinkHandledRef.current) return;
    if (articles.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    if (!articleId) {
      sharedArticleLinkHandledRef.current = true;
      return;
    }
    const target = articles.find((a) => a.id === articleId);
    if (target) {
      setReadingArticle(target);
      sharedArticleLinkHandledRef.current = true;
    }
    // إن لم يُوجَد المقال بعد (القائمة لا تزال جزئية)، تبقى المحاولة
    // متاحة عند التحديث التالي لـ articles بدل الاستسلام فوراً.
  }, [articles]);

  // الاستماع لطلبات الترويج.
  // قواعد الأمان تسمح للكاتب بقراءة طلباته فقط، وللأدمن بقراءة الكل،
  // لذا يُقيَّد الاستعلام حسب الدور — الاستماع للمجموعة كاملة سيُرفض.
  useEffect(() => {
    if (!currentUserId) {
      setPromotions([]);
      return;
    }
    const isAdminUser = currentUser.role === 'admin';
    const unsub = subscribeToPromotions(
      currentUserId,
      isAdminUser,
      (list) => setPromotions(list),
      (err) => console.error('Promotions subscription error:', err)
    );
    return () => unsub();
  }, [currentUserId, currentUser.role]);

  // الاستماع لطلبات الإيداع والسحب حسب الدور
  useEffect(() => {
    if (!currentUserId) {
      setDepositRequests([]);
      setPayoutRequests([]);
      return;
    }
    const isAdminUser = currentUser.role === 'admin';
    const unsubDeposits = subscribeToMoneyRequests(
      'depositRequests',
      currentUserId,
      isAdminUser,
      setDepositRequests,
      (e) => console.error('Deposit requests error:', e)
    );
    const unsubPayouts = subscribeToMoneyRequests(
      'payoutRequests',
      currentUserId,
      isAdminUser,
      setPayoutRequests,
      (e) => console.error('Payout requests error:', e)
    );
    return () => {
      unsubDeposits();
      unsubPayouts();
    };
  }, [currentUserId, currentUser.role]);

  // طلبات الشراء وأحداث الإعلانات
  useEffect(() => {
    if (!currentUserId) {
      setPurchaseRequests([]);
      setAdEvents([]);
      return;
    }
    const isAdminUser = currentUser.role === 'admin';
    const unsubPurchases = subscribeToMoneyRequests(
      'purchaseRequests' as any,
      currentUserId,
      isAdminUser,
      setPurchaseRequests,
      (e) => console.error('Purchase requests error:', e)
    );
    // أحداث الإعلانات للأدمن فقط (القراءة محصورة به في قواعد الأمان)
    let unsubEvents: () => void = () => {};
    if (isAdminUser) {
      unsubEvents = subscribeToAdEvents(setAdEvents, (e) =>
        console.error('Ad events error:', e)
      );
    }
    return () => {
      unsubPurchases();
      unsubEvents();
    };
  }, [currentUserId, currentUser.role]);

  // تنبيه فوري للأدمن عند وصول طلب مالي جديد — كان الأدمن يعتمد كلياً على
  // فتح اللوحة يدوياً ورؤية شارة العدد على التبويبات، بلا أي تنبيه استباقي.
  // لا يطلب إذن الإشعارات تلقائياً (تجربة سيئة)؛ يستخدمه فقط إن كان
  // ممنوحاً مسبقاً للموقع، ويعتمد أساساً على وميض عنوان التبويب (لا يحتاج
  // أي إذن) لجذب الانتباه إن كان الأدمن في تبويب آخر.
  const prevPendingCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (currentUser.role !== 'admin') {
      prevPendingCountRef.current = null;
      return;
    }
    const pendingCount =
      depositRequests.filter((r: any) => r.status === 'pending').length +
      payoutRequests.filter((r: any) => r.status === 'pending').length +
      purchaseRequests.filter((r: any) => r.status === 'pending').length;

    const prev = prevPendingCountRef.current;
    prevPendingCountRef.current = pendingCount;

    // أول قراءة فقط تهيّئ المرجع — لا تنبيه عند فتح اللوحة لأول مرة على
    // طلبات موجودة أصلاً، فقط عند وصول طلب جديد فعلياً بعدها.
    if (prev === null || pendingCount <= prev) return;

    const originalTitle = document.title;
    document.title = '🔔 طلب مالي جديد — ليتيريوم';
    setTimeout(() => {
      if (document.title.startsWith('🔔')) document.title = originalTitle;
    }, 5000);

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('طلب مالي جديد بانتظار المراجعة', {
          body: 'وصل طلب إيداع/سحب/شراء جديد في لوحة الإدارة.'
        });
      } catch {}
    }
  }, [depositRequests, payoutRequests, purchaseRequests, currentUser.role]);

  /**
   * احتساب أحداث الإعلانات: يخصم من المعلن ويضيف حصة الكاتب إلى أرباحه
   * المجمّدة، ثم يعلّم كل الأحداث كمعالَجة.
   * الأحداث المشبوهة تُعلَّم كغير صالحة ولا تُحتسب لأي طرف.
   */
  // حد أقصى للدفعة الواحدة — معالجة آلاف الأحداث دفعة واحدة من المتصفح
  // (كتابات Firestore متسلسلة عبر for...await) تُبطئ العملية وتزيد خطر
  // انقطاعها في المنتصف (فقدان اتصال) قبل اكتمالها. تقسيمها لدفعات أصغر
  // يقلّل هذا الخطر؛ الأحداث المتبقية تبقى بانتظار ضغطة تالية للزر.
  const AD_EVENTS_BATCH_SIZE = 100;

  const handleProcessAdEvents = async () => {
    const allUnprocessed = adEvents.filter((e) => !e.processed);
    if (allUnprocessed.length === 0) return;

    const sorted = [...allUnprocessed].sort((a: any, b: any) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
    const unprocessed = sorted.slice(0, AD_EVENTS_BATCH_SIZE);
    const remainingAfterBatch = sorted.length - unprocessed.length;

    const advertiserByCampaign: Record<string, string> = {};
    campaigns.forEach((c: any) => {
      if (c.id && c.advertiserId) advertiserByCampaign[c.id] = c.advertiserId;
    });

    const { valid, suspicious } = evaluateAdEventBatch(unprocessed as any, advertiserByCampaign);

    try {
      // 1) حساب المستحقات من الأحداث الصالحة فقط
      const writerEarnings: Record<string, number> = {};
      const advertiserSpend: Record<string, number> = {};

      valid.forEach((ev: any) => {
        const camp: any = campaigns.find((c: any) => c.id === ev.campaignId);
        if (!camp) return;
        const cost = calculateEventCost(ev, camp);
        if (cost <= 0) return;

        if (camp.advertiserId) {
          advertiserSpend[camp.advertiserId] = (advertiserSpend[camp.advertiserId] || 0) + cost;
        }
        // ⚠️ لا تُحتسب حصة الكاتب إلا إذا استوفى شروط منشئ المحتوى (متابعون
        // + مشاهدات صالحة + عمر حساب + عدد مقالات) وتحقق هويته (KYC) معاً.
        // الإعلان نفسه يستمر بالعرض بشكل طبيعي — القيد هنا على "احتساب"
        // الأرباح فقط، تماماً كما لا نمنع الكتابة والنشر بأي حال.
        if (ev.writerId) {
          const writerUser = users.find((u) => u.id === ev.writerId);
          const writerFollowersCount = followsData.filter((f) => f.followingId === ev.writerId).length;
          if (isEligibleForMonetization(writerUser, articles, writerFollowersCount)) {
            const share = String(ev.slotId || '').startsWith('writer_profile')
              ? REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER
              : REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
            writerEarnings[ev.writerId] = (writerEarnings[ev.writerId] || 0) + cost * share;
          }
        }
      });

      // 2) خصم التكلفة من محافظ المعلنين
      for (const [advId, spend] of Object.entries(advertiserSpend)) {
        const adv: any = users.find((u) => u.id === advId);
        if (!adv) continue;
        const current = adv.walletBalance ?? 0;
        await adminAdjustUserBalance(advId, {
          walletBalance: Number(Math.max(0, current - spend).toFixed(2))
        });
      }

      // 3) إضافة حصص الكتّاب إلى الأرباح المجمّدة + تسجيلها
      for (const [wId, amount] of Object.entries(writerEarnings)) {
        const w: any = users.find((u) => u.id === wId);
        if (!w) continue;
        const currentPending = w.pendingEarnings ?? 0;
        const currentLifetime = w.lifetimeEarnings ?? 0;
        await adminAdjustUserBalance(wId, {
          pendingEarnings: Number((currentPending + amount).toFixed(2)),
          lifetimeEarnings: Number((currentLifetime + amount).toFixed(2))
        });
        await adminLogEarning({
          userId: wId,
          amount: Number(amount.toFixed(4)),
          source: 'ad_revenue',
          description: 'حصة الكاتب من عوائد الإعلانات'
        });
      }

      // 4) تعليم كل الأحداث كمعالَجة
      for (const ev of valid) {
        await markAdEventProcessed(ev.id, true);
      }
      for (const ev of suspicious) {
        await markAdEventProcessed(ev.id, false);
        await logFraudFlagToFirestore({
          triggerType: 'suspicious_ad_event',
          severity: 'medium',
          description: ev.reasons.join(' • '),
          campaignId: ev.campaignId,
          status: 'reviewed'
        } as any);
      }

      alert(
        `تم الاحتساب: ${valid.length} حدث صالح، و${suspicious.length} حدث مشبوه لم يُحتسب لأي طرف.` +
          (remainingAfterBatch > 0
            ? ` تبقّى ${remainingAfterBatch} حدث آخر — اضغط الزر مجدداً لمعالجة الدفعة التالية.`
            : '')
      );
    } catch (err) {
      console.error('تعذر احتساب أحداث الإعلانات:', err);
      alert('تعذر إكمال الاحتساب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    }
  };

  /**
   * احتساب عائد الكُتّاب من مشاهدات إعلانات الشبكات الخارجية (Monetag/
   * PropellerAds/Adsterra) في مواضعهم — منفصل تماماً عن أحداث الحملات
   * الداخلية أعلاه (لا campaignId ولا سعر حقيقي معروف لكل حدث)، ويستخدم
   * سعراً تقديرياً ثابتاً بالدولار لكل 1000 مشاهدة يحدّده الأدمن
   * (settings/externalAds.estimatedCpmUsd)، مضروباً بحصة الكاتب الثابتة
   * لموضعه (55% داخل المقال، 50% في ملفه الشخصي). نفس شرط أهلية احتساب
   * الأرباح المطبَّق على الحملات الداخلية بالضبط (متابعون + KYC + إلخ).
   */
  const handleProcessExternalAdRevenue = async () => {
    const allUnprocessed = adEvents.filter((e: any) => e.isExternalAdView && !e.processed);
    if (allUnprocessed.length === 0) return;

    const sorted = [...allUnprocessed].sort((a: any, b: any) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    );
    const unprocessed = sorted.slice(0, AD_EVENTS_BATCH_SIZE);
    const remainingAfterBatch = sorted.length - unprocessed.length;

    try {
      const writerEarnings: Record<string, number> = {};
      const validEvents: any[] = [];
      const skippedEvents: any[] = [];

      unprocessed.forEach((ev: any) => {
        const slotConfig = SLOT_CONFIG[ev.slotId as AdSlotId];
        const writerShare = slotConfig?.writerShare ?? 0;
        if (!ev.writerId || writerShare <= 0) {
          skippedEvents.push(ev);
          return;
        }
        const writerUser = users.find((u) => u.id === ev.writerId);
        const writerFollowersCount = followsData.filter((f) => f.followingId === ev.writerId).length;
        if (!isEligibleForMonetization(writerUser, articles, writerFollowersCount)) {
          skippedEvents.push(ev);
          return;
        }
        validEvents.push(ev);
        const amount = (externalAdsConfig.estimatedCpmUsd / 1000) * writerShare;
        writerEarnings[ev.writerId] = (writerEarnings[ev.writerId] || 0) + amount;
      });

      for (const [wId, amount] of Object.entries(writerEarnings)) {
        const w: any = users.find((u) => u.id === wId);
        if (!w) continue;
        const currentPending = w.pendingEarnings ?? 0;
        const currentLifetime = w.lifetimeEarnings ?? 0;
        await adminAdjustUserBalance(wId, {
          pendingEarnings: Number((currentPending + amount).toFixed(4)),
          lifetimeEarnings: Number((currentLifetime + amount).toFixed(4))
        });
        await adminLogEarning({
          userId: wId,
          amount: Number(amount.toFixed(4)),
          source: 'external_ad_revenue',
          description: `حصة من مشاهدات إعلانات شبكة خارجية (سعر تقديري $${externalAdsConfig.estimatedCpmUsd.toFixed(2)}/1000 مشاهدة)`
        });
      }

      for (const ev of validEvents) {
        await markAdEventProcessed(ev.id, true);
      }
      for (const ev of skippedEvents) {
        await markAdEventProcessed(ev.id, false);
      }

      alert(
        `تم احتساب ${validEvents.length} مشاهدة إعلان خارجي وإيداع حصص الكُتّاب` +
          (skippedEvents.length > 0 ? ` (${skippedEvents.length} مشاهدة لم تُحتسب لعدم أهلية الكاتب بعد)` : '') +
          '.' +
          (remainingAfterBatch > 0
            ? ` تبقّى ${remainingAfterBatch} مشاهدة أخرى — اضغط الزر مجدداً لمعالجة الدفعة التالية.`
            : '')
      );
    } catch (err) {
      console.error('تعذر احتساب عائد الإعلانات الخارجية:', err);
      alert('تعذر إكمال الاحتساب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    }
  };

  /**
   * اعتماد طلب شراء مقال: يخصم من محفظة المشتري ويضيف حصة الكاتب.
   */
  const handleSaveSocialLinks = async (links: Record<string, string>) => {
    if (!requireAuth()) return;
    try {
      await updateUserSocialLinks(currentUser.id, links);
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, socialLinks: links as any } : u))
      );
    } catch (err) {
      console.error('تعذر حفظ الروابط:', err);
      throw err;
    }
  };

  const handleSaveProfile = async (updates: {
    fullName?: string; penName?: string; companyName?: string; bio?: string; avatarUrl?: string;
  }) => {
    if (!requireAuth()) return;
    try {
      await updateUserProfileInFirestore(currentUser.id, updates);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, ...updates } : u)));
    } catch (err) {
      console.error('تعذر حفظ الملف الشخصي:', err);
      throw err;
    }
  };

  const handleUpdatePurchaseRequest = async (
    requestId: string,
    status: 'approved' | 'rejected'
  ) => {
    const req = purchaseRequests.find((r) => r.id === requestId);
    if (!req) return;

    // ⚠️ حماية من الاعتماد المزدوج: نقرتان سريعتان على نفس الطلب (قبل أن
    // تُخفي الواجهة الزر) كانتا تُكرّران خصم/إضافة الرصيد وتسجيل الربح في
    // earnings مرتين لنفس البيع فعلياً.
    if (req.status !== 'pending' || processingRequestIdsRef.current.has(requestId)) {
      return;
    }
    processingRequestIdsRef.current.add(requestId);

    // اشتراكات الذكاء الاصطناعي طُلبت بمعرّف يبدأ بـ "subscription_" (انظر
    // handleUpgradeSuccess) — تحتاج معالجة مختلفة تماماً عن بيع مقال:
    // ترقية حصة الذكاء الاصطناعي بدل تحويل رصيد لكاتب.
    const isSubscriptionRequest =
      typeof req.articleId === 'string' && req.articleId.startsWith('subscription_');

    try {
      if (status === 'approved' && isSubscriptionRequest) {
        const buyer: any = users.find((u) => u.id === (req.buyerId || req.userId));
        const price = req.amount || 0;
        const plan: 'monthly' | 'annual' = req.articleId.includes('_annual_') ? 'annual' : 'monthly';

        if (!buyer) {
          alert('تعذر إيجاد صاحب طلب الاشتراك.');
          return;
        }

        const isWalletPay = (req.articleTitle || '').includes('محفظة');
        if (isWalletPay) {
          const bal = buyer.walletBalance ?? 0;
          if (bal < price) {
            alert('رصيد المشترك لا يكفي حالياً. تحقق قبل الاعتماد.');
            return;
          }
          await adminAdjustUserBalance(buyer.id, {
            walletBalance: Number((bal - price).toFixed(2))
          });
        }

        const updatedQuota = applySubscriptionUpgrade(buyer.aiQuota, plan);
        setUsers((prev) =>
          prev.map((u) => (u.id === buyer.id ? { ...u, aiQuota: updatedQuota } : u))
        );
        await updateUserAiQuotaInFirestore(buyer.id, updatedQuota);

        createNotificationInFirestore({
          userId: buyer.id,
          type: 'system',
          title: '👑 تم تفعيل اشتراك الذكاء الاصطناعي',
          message: `تمت مراجعة إثبات دفعك واعتماد اشتراكك (${plan === 'monthly' ? 'الباقة الشهرية' : 'الباقة السنوية'}) فعلياً. يمكنك الآن استخدام كل أدوات الذكاء الاصطناعي.`
        });
      } else if (status === 'approved' && !isSubscriptionRequest) {
        const buyer: any = users.find((u) => u.id === (req.buyerId || req.userId));
        const writer: any = users.find((u) => u.id === req.writerId);
        const price = req.amount || 0;

        if (buyer) {
          const bal = buyer.walletBalance ?? 0;
          if (bal < price) {
            alert('رصيد المشتري لا يكفي. لا يمكن اعتماد الطلب.');
            return;
          }
          await adminAdjustUserBalance(buyer.id, {
            walletBalance: Number((bal - price).toFixed(2))
          });
        }

        // ⚠️ نفس شرط الأهلية المطبَّق على أرباح الإعلانات: البيع نفسه يُعتمد
        // بشكل طبيعي (المشتري دفع فعلاً)، لكن حصة الكاتب لا تُحتسب لرصيده
        // إلا إذا استوفى شروط منشئ المحتوى + تحقق الهوية (KYC).
        const writerFollowersCount = writer ? followsData.filter((f) => f.followingId === writer.id).length : 0;
        if (writer && isEligibleForMonetization(writer, articles, writerFollowersCount)) {
          const share = Number((price * REVENUE_SHARES.LOCKED_ARTICLES.WRITER).toFixed(2));
          await adminAdjustUserBalance(writer.id, {
            pendingEarnings: Number(((writer.pendingEarnings ?? 0) + share).toFixed(2)),
            lifetimeEarnings: Number(((writer.lifetimeEarnings ?? 0) + share).toFixed(2))
          });
          await adminLogEarning({
            userId: writer.id,
            amount: share,
            source: 'article_sale',
            articleId: req.articleId,
            description: `مبيعات مقال: ${req.articleTitle || req.articleId}`
          });
        }
      }

      await setMoneyRequestStatus('purchaseRequests' as any, requestId, status as any);
    } catch (err) {
      console.error('تعذر اعتماد طلب الشراء:', err);
      alert('تعذر اعتماد الطلب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    } finally {
      processingRequestIdsRef.current.delete(requestId);
    }
  };

  // الاستماع لعلاقات المتابعة (القراءة عامة حسب قواعد الأمان)
  useEffect(() => {
    const unsub = subscribeToFollows(
      setFollowsData,
      (e) => console.error('Follows subscription error:', e)
    );
    return () => unsub();
  }, []);

  // الاستماع للتعليقات وإعجابات المقالات (قراءة عامة، لا تشترط تسجيل الدخول)
  useEffect(() => {
    const unsubComments = subscribeToComments(
      setComments,
      (e) => console.error('Comments subscription error:', e)
    );
    const unsubLikes = subscribeToArticleLikes(
      setArticleLikes,
      (e) => console.error('Article likes subscription error:', e)
    );
    const unsubRatings = subscribeToArticleRatings(
      setArticleRatings,
      (e) => console.error('Article ratings subscription error:', e)
    );
    return () => {
      unsubComments();
      unsubLikes();
      unsubRatings();
    };
  }, []);

  // الاستماع للتغريدات وتعليقاتها وإعجاباتها (قراءة عامة، نفس منطق المقالات)
  useEffect(() => {
    const unsubTweets = subscribeToTweets(
      setTweets,
      (e) => console.error('Tweets subscription error:', e)
    );
    const unsubTweetComments = subscribeToTweetComments(
      setTweetComments,
      (e) => console.error('Tweet comments subscription error:', e)
    );
    const unsubTweetLikes = subscribeToTweetLikes(
      setTweetLikes,
      (e) => console.error('Tweet likes subscription error:', e)
    );
    return () => {
      unsubTweets();
      unsubTweetComments();
      unsubTweetLikes();
    };
  }, []);

  // مفضلة التغريدات الخاصة بالمستخدم الحالي فقط
  useEffect(() => {
    if (!currentUserId) {
      setFavoritedTweetIds([]);
      return;
    }
    const unsub = subscribeToTweetFavorites(
      currentUserId,
      setFavoritedTweetIds,
      (e) => console.error('Tweet favorites subscription error:', e)
    );
    return () => unsub();
  }, [currentUserId]);

  // الاستماع لإشعارات المستخدم الحالي فقط (قواعد الأمان تمنع قراءة إشعارات الغير)
  useEffect(() => {
    if (!currentUserId) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeToNotifications(
      currentUserId,
      setNotifications,
      (e) => console.error('Notifications subscription error:', e)
    );
    return () => unsub();
  }, [currentUserId]);

  // الاستماع للمقالات المقفولة التي اشتراها المستخدم الحالي فعلياً فقط
  useEffect(() => {
    if (!currentUserId) {
      setUnlockedArticleIds([]);
      return;
    }
    const unsub = subscribeToArticlePurchases(
      currentUserId,
      setUnlockedArticleIds,
      (e) => console.error('Article purchases subscription error:', e)
    );
    return () => unsub();
  }, [currentUserId]);

  // الاستماع للمحادثات والرسائل الخاصة بالمستخدم الحالي فقط
  useEffect(() => {
    if (!currentUserId) {
      setRawConversations([]);
      setMessages([]);
      return;
    }
    const unsubConvs = subscribeToConversations(
      currentUserId,
      (list) => {
        setRawConversations(
          list.map((c: any) => ({
            id: c.id,
            participantIds: c.participants || [],
            lastMessage: c.lastMessage || '',
            lastMessageAt: c.lastMessageAt || '',
            typing: c.typing || {},
            hiddenFor: c.hiddenFor || []
          }))
        );
      },
      (e) => console.error('Conversations error:', e)
    );
    const unsubMsgs = subscribeToMessages(
      currentUserId,
      (list) => {
        setMessages(
          list.map((m: any) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: '',
            senderAvatar: '',
            recipientId: (m.participants || []).find((p: string) => p !== m.senderId) || '',
            content: m.text || '',
            mediaUrl: m.mediaUrl,
            mediaType: m.mediaType,
            createdAt: m.createdAt || '',
            isRead: Boolean(m.isRead)
          })) as any
        );
      },
      (e) => console.error('Messages error:', e)
    );
    return () => {
      unsubConvs();
      unsubMsgs();
    };
  }, [currentUserId]);

  // نبضة حضور دورية (متصل/غير متصل) — تُكتب فقط من الجلسة/المتصفح الحالي،
  // وتُقرأ من أي طرف آخر عبر presence.lastHeartbeatAt (حديث = متصل الآن).
  // إخفاء التبويب أو إغلاق النافذة يكتب 'offline' فوراً (خير جهد؛ الحد
  // الفاصل 60 ثانية في واجهة المحادثة يغطي حالة الإغلاق المفاجئ الذي لا
  // يُطلق أي حدث أصلاً).
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const heartbeat = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        updateMyPresence(currentUserId, 'online').catch(() => {});
      }
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, 25000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') heartbeat();
      else updateMyPresence(currentUserId, 'offline').catch(() => {});
    };
    const handleBeforeUnload = () => {
      updateMyPresence(currentUserId, 'offline').catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateMyPresence(currentUserId, 'offline').catch(() => {});
    };
  }, [currentUserId]);

  // مزامنة قائمة المتابَعين من Firestore
  useEffect(() => {
    if (!currentUserId) return;
    setFollowedWriterIds(
      followsData.filter((f) => f.followerId === currentUserId).map((f) => f.followingId)
    );
  }, [followsData, currentUserId]);

  // إعادة تصفير عدّاد الإعلانات عند كل انتقال بين الشاشات،
  // حتى يُحترم الحد الأقصى (3 وحدات) في كل صفحة على حدة.
  useEffect(() => {
    resetAdSlotCounter();
  }, [activeTab, readingArticle, viewingWriterProfile, legalSection]);

  const handleUpdateMoneyRequest = async (
    collectionName: 'depositRequests' | 'payoutRequests',
    requestId: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => {
    const requestsList = collectionName === 'depositRequests' ? depositRequests : payoutRequests;
    const currentReq = requestsList.find((r) => r.id === requestId);
    // ⚠️ حماية من الاعتماد المزدوج: نقرتان سريعتان على نفس الطلب.
    if (!currentReq || currentReq.status !== 'pending' || processingRequestIdsRef.current.has(requestId)) {
      return;
    }
    processingRequestIdsRef.current.add(requestId);
    try {
      await setMoneyRequestStatus(collectionName, requestId, status);

      // تحديث الرصيد الفعلي تلقائياً عند الاعتماد النهائي — كان هذا خطوة
      // يدوية منفصلة يجب أن يتذكرها الأدمن بنفسه من تبويب آخر (عرضة
      // للنسيان أو الخطأ البشري)، أصبح الآن تلقائياً ومضموناً.
      const shouldApplyBalance =
        (collectionName === 'depositRequests' && status === 'approved') ||
        (collectionName === 'payoutRequests' && status === 'paid');

      if (shouldApplyBalance) {
        const req = currentReq;
        const targetUser = users.find((u) => u.id === req.userId);
        if (!targetUser) {
          console.error('تعذر إيجاد صاحب الطلب المالي لتحديث الرصيد:', req.userId);
          return;
        }

        if (collectionName === 'depositRequests') {
          const newWallet = ((targetUser as any).walletBalance || 0) + (req.amount || 0);
          setUsers((prev) =>
            prev.map((u) => (u.id === req.userId ? ({ ...u, walletBalance: newWallet } as any) : u))
          );
          await adminAdjustUserBalance(req.userId, { walletBalance: newWallet });
        } else {
          const newAvailable = Math.max(0, ((targetUser as any).availableBalance || 0) - (req.amount || 0));
          setUsers((prev) =>
            prev.map((u) => (u.id === req.userId ? ({ ...u, availableBalance: newAvailable } as any) : u))
          );
          await adminAdjustUserBalance(req.userId, { availableBalance: newAvailable });
        }
      }

      // إشعار صاحب الطلب بنتيجة المراجعة — يشمل الاعتماد والرفض معاً، حتى
      // لا يبقى المستخدم بلا أي علم بمصير طلبه المالي إلا بالدخول يدوياً
      // للتحقق من رصيده كل مرة.
      const isDeposit = collectionName === 'depositRequests';
      const notifTitleMap: Record<string, string> = {
        approved: isDeposit ? '💰 تم إيداع رصيدك' : '✅ تم اعتماد طلب السحب',
        paid: '✅ تم تنفيذ عملية السحب',
        rejected: isDeposit ? '❌ تم رفض طلب الإيداع' : '❌ تم رفض طلب السحب'
      };
      const notifMessageMap: Record<string, string> = {
        approved: isDeposit
          ? `تم إضافة ${currentReq.amount}$ إلى محفظتك بعد تأكيد إدارة المنصة لوصول المبلغ.`
          : `تمت الموافقة على طلب سحب ${currentReq.amount}$، وسيُحوَّل المبلغ خلال 24-48 ساعة.`,
        paid: `تم تحويل ${currentReq.amount}$ إلى حسابك بنجاح.`,
        rejected: isDeposit
          ? `تعذر اعتماد طلب إيداع ${currentReq.amount}$. تواصل مع الدعم لمعرفة السبب.`
          : `تعذر اعتماد طلب سحب ${currentReq.amount}$. تواصل مع الدعم لمعرفة السبب.`
      };
      createNotificationInFirestore({
        userId: currentReq.userId,
        type: isDeposit ? 'system' : 'withdrawal',
        title: notifTitleMap[status],
        message: notifMessageMap[status]
      });
    } catch (err) {
      console.error('تعذر تحديث حالة الطلب المالي:', err);
      alert('تعذر تحديث حالة الطلب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    } finally {
      processingRequestIdsRef.current.delete(requestId);
    }
  };

  const handleUpdatePromotionStatus = async (
    promotionId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await setPromotionStatusInFirestore(promotionId, status);
    } catch (err) {
      console.error('تعذر تحديث حالة طلب الترويج:', err);
      alert('تعذر تحديث حالة الطلب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    }
  };

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
  // البحث الحقيقي: يطابق عنوان المقال، وصفه، الوسوم، اسم الكاتب الظاهري،
  // وأيضاً اسم المستخدم الفعلي (username) لصاحب المقال — حتى يستطيع أي
  // شخص إيجاد مقالات كاتب معين بالبحث عن معرّفه (username) وليس فقط اسمه.
  const filteredArticles = useMemo(() => {
    // تطبيع النص العربي قبل المطابقة — بدونه كانت مطابقة .includes() الحرفية
    // تفشل بصمت لأي فرق شكلي شائع (أ/إ/آ/ا، ى/ي، ة/ه، تشكيل، مسافات
    // زائدة) بين ما يكتبه المستخدم والحقل الفعلي، فيبدو البحث معطّلاً.
    const q = normalizeArabicSearch(searchQuery);
    return articles.filter((art) => {
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
  }, [articles, users, selectedCategory, searchQuery]);

  // نتائج البحث عن حسابات المستخدمين مباشرة (بالاسم أو معرّف المستخدم)،
  // تُعرض فوق نتائج المقالات عند وجود نص بحث فعلي.
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

  // Listen to scroll position for Scroll-to-Top floating button
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          setShowScrollTop(scrollY > 350);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    touchStartPosRef.current = scrollY <= 1 ? e.touches[0].clientY : 0;
  };

  const pullRafRef = useRef<number | null>(null);
  const handleTouchMove = (e: React.TouchEvent) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (touchStartPosRef.current > 0 && scrollY <= 1) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartPosRef.current;
      if (diff > 0) {
        // سحب لأسفل عند قمة الصفحة لتحديث الخلاصة
        const dampened = Math.min(diff * 0.45, 90);
        if (pullRafRef.current === null) {
          pullRafRef.current = requestAnimationFrame(() => {
            pullRafRef.current = null;
            setPullDistance(dampened);
          });
        }
      } else if (diff < -5) {
        // سحب لأعلى للتمرير العادي — يتم فك التعليق فوراً ليتحكم المتصفح بالتمرير
        touchStartPosRef.current = 0;
        if (pullDistance > 0) {
          setPullDistance(0);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 55) {
      handleRefreshFeed();
    }
    setPullDistance(0);
    touchStartPosRef.current = 0;
  };

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 750);
  };

  // Follow / Unfollow Writer
  // المتابعة: تُحفظ الآن في Firestore (مجموعة follows) بدلاً من الحالة
  // المحلية فقط، فتبقى محفوظة عبر الأجهزة والجلسات.
  // عدد المتابِعين يُحسب من البيانات الفعلية ولا يُعدَّل يدوياً.
  const handleToggleFollow = async (writerId: string) => {
    if (!requireAuth()) return;
    if (writerId === currentUserId) return;

    const isAlready = followsData.some(
      (f) => f.followerId === currentUserId && f.followingId === writerId
    );

    // تحديث تفاؤلي للواجهة حتى تستجيب فوراً
    setFollowedWriterIds((prev) =>
      isAlready ? prev.filter((id) => id !== writerId) : [...prev, writerId]
    );

    try {
      if (isAlready) {
        await unfollowUser(currentUserId, writerId);
      } else {
        await followUser(currentUserId, writerId);
        // إشعار حقيقي لصاحب الحساب عند متابعته
        createNotificationInFirestore({
          userId: writerId,
          type: 'follow',
          title: 'متابع جديد',
          message: `بدأ ${currentUser.fullName} بمتابعتك`,
          actorId: currentUserId
        });
      }
    } catch (err) {
      console.error('تعذر تحديث المتابعة:', err);
      // التراجع عن التحديث التفاؤلي عند الفشل
      setFollowedWriterIds((prev) =>
        isAlready ? [...prev, writerId] : prev.filter((id) => id !== writerId)
      );
      alert('تعذر تحديث المتابعة. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  const handleShowFollowers = (userId: string) => {
    setFollowListModal({
      title: 'المتابعون',
      userIds: followsData.filter((f) => f.followingId === userId).map((f) => f.followerId)
    });
  };

  const handleShowFollowing = (userId: string) => {
    setFollowListModal({
      title: 'يتابع',
      userIds: followsData.filter((f) => f.followerId === userId).map((f) => f.followingId)
    });
  };

  // Bookmark Toggle
  const handleToggleBookmark = (articleId: string) => {
    if (!requireAuth()) return;
    setBookmarkedArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  // Like Article — إعجاب حقيقي قابل للتبديل (إعجاب/إلغاء إعجاب)، متزامن
  // في Firestore، مع إشعار فعلي يصل لصاحب المقال (إن لم يكن هو نفسه).
  // مسموح للزائر أيضاً (بهوية مجهولة حقيقية)، خلافاً لبقية التفاعلات
  // (تعليق، متابعة، شراء) التي تبقى تتطلب حساباً حقيقياً مسجّلاً.
  const handleLikeArticle = async (articleId: string) => {
    let effectiveUserId = currentUserId || guestIdentityUid;

    if (!effectiveUserId) {
      // أول إعجاب من هذا الزائر بالجهاز — أنشئ له هوية حقيقية الآن فقط
      const uid = await ensureGuestIdentity();
      if (!uid) {
        alert('تعذر تسجيل إعجابك حالياً. تحقق من اتصالك بالإنترنت ثم حاول مجدداً.');
        return;
      }
      setGuestIdentityUid(uid);
      effectiveUserId = uid;
    }

    const article = articles.find((a) => a.id === articleId);
    const alreadyLiked = likedArticleIds.includes(articleId);

    // تحديث تفاؤلي فوري للواجهة
    setArticles((prev) =>
      prev.map((art) =>
        art.id === articleId
          ? { ...art, likesCount: Math.max(0, art.likesCount + (alreadyLiked ? -1 : 1)) }
          : art
      )
    );
    setArticleLikes((prev) =>
      alreadyLiked
        ? prev.filter((l) => !(l.articleId === articleId && l.userId === effectiveUserId))
        : [...prev, { id: `${articleId}_${effectiveUserId}`, articleId, userId: effectiveUserId! }]
    );

    try {
      if (alreadyLiked) {
        await unlikeArticleInFirestore(articleId, effectiveUserId);
      } else {
        await likeArticleInFirestore(articleId, effectiveUserId);
        // إشعار حقيقي لصاحب المقال، إلا إذا كان هو من أعجب بمقاله نفسه
        if (article && article.writerId && article.writerId !== effectiveUserId) {
          createNotificationInFirestore({
            userId: article.writerId,
            type: 'like',
            title: 'إعجاب جديد بمقالك',
            message: `أعجب ${currentUser.fullName} بمقالك "${article.title}"`,
            articleId: article.id,
            actorId: effectiveUserId
          });
        }
      }
    } catch (err) {
      console.error('تعذر تحديث الإعجاب:', err);
      // تراجع عن التحديث التفاؤلي عند الفشل
      setArticles((prev) =>
        prev.map((art) =>
          art.id === articleId
            ? { ...art, likesCount: Math.max(0, art.likesCount + (alreadyLiked ? 1 : -1)) }
            : art
        )
      );
      setArticleLikes((prev) =>
        alreadyLiked
          ? [...prev, { id: `${articleId}_${effectiveUserId}`, articleId, userId: effectiveUserId! }]
          : prev.filter((l) => !(l.articleId === articleId && l.userId === effectiveUserId))
      );
      alert('تعذر تحديث الإعجاب. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // ===== التغريدات =====
  // نشر تغريد جديد. النشر متاح لأي عضو مسجّل (قارئ/كاتب/معلن)، وليس
  // للكتّاب فقط، تماشياً مع نموذج "الحساب الموحّد" في المنصة.
  const handlePostTweet = async (content: string) => {
    if (!requireAuth()) return;
    try {
      const newTweet: Tweet = {
        id: `tw_${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.fullName,
        authorUsername: currentUser.username,
        authorAvatar: currentUser.avatarUrl,
        authorRole: currentUser.role,
        content,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date().toISOString()
      };
      await addTweetToFirestore(newTweet);
    } catch (err) {
      console.error('تعذر نشر التغريدة:', err);
      alert(`تعذر نشر التغريدة.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleDeleteTweet = async (tweetId: string) => {
    if (!requireAuth()) return;
    try {
      await deleteTweetInFirestore(tweetId);
    } catch (err) {
      console.error('تعذر حذف التغريدة:', err);
      alert(`تعذر حذف التغريدة.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleToggleTweetLike = async (tweetId: string) => {
    if (!requireAuth()) return;
    const alreadyLiked = tweetLikes.some((l) => l.tweetId === tweetId && l.userId === currentUser.id);

    setTweets((prev) =>
      prev.map((t) => (t.id === tweetId ? { ...t, likesCount: Math.max(0, t.likesCount + (alreadyLiked ? -1 : 1)) } : t))
    );
    setTweetLikes((prev) =>
      alreadyLiked
        ? prev.filter((l) => !(l.tweetId === tweetId && l.userId === currentUser.id))
        : [...prev, { id: `${tweetId}_${currentUser.id}`, tweetId, userId: currentUser.id }]
    );

    try {
      if (alreadyLiked) {
        await unlikeTweetInFirestore(tweetId, currentUser.id);
      } else {
        await likeTweetInFirestore(tweetId, currentUser.id);
        const tweet = tweets.find((t) => t.id === tweetId);
        if (tweet && tweet.authorId !== currentUser.id) {
          createNotificationInFirestore({
            userId: tweet.authorId,
            type: 'like',
            title: 'إعجاب جديد بتغريدتك',
            message: `أعجب ${currentUser.fullName} بتغريدتك`,
            actorId: currentUser.id
          });
        }
      }
    } catch (err) {
      console.error('تعذر تحديث الإعجاب بالتغريدة:', err);
      setTweets((prev) =>
        prev.map((t) => (t.id === tweetId ? { ...t, likesCount: Math.max(0, t.likesCount + (alreadyLiked ? 1 : -1)) } : t))
      );
      setTweetLikes((prev) =>
        alreadyLiked
          ? [...prev, { id: `${tweetId}_${currentUser.id}`, tweetId, userId: currentUser.id }]
          : prev.filter((l) => !(l.tweetId === tweetId && l.userId === currentUser.id))
      );
      alert(`تعذر تحديث الإعجاب.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleToggleTweetFavorite = async (tweetId: string) => {
    if (!requireAuth()) return;
    const alreadyFavorited = favoritedTweetIds.includes(tweetId);

    setFavoritedTweetIds((prev) =>
      alreadyFavorited ? prev.filter((id) => id !== tweetId) : [...prev, tweetId]
    );

    try {
      if (alreadyFavorited) {
        await unfavoriteTweetInFirestore(tweetId, currentUser.id);
      } else {
        await favoriteTweetInFirestore(tweetId, currentUser.id);
      }
    } catch (err) {
      console.error('تعذر تحديث المفضلة:', err);
      setFavoritedTweetIds((prev) =>
        alreadyFavorited ? [...prev, tweetId] : prev.filter((id) => id !== tweetId)
      );
      alert(`تعذر تحديث المفضلة.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleShareTweet = async (tweet: Tweet) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?tweet=${tweet.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: tweet.content, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('تم نسخ رابط التغريدة.');
      }
      incrementTweetSharesInFirestore(tweet.id).catch((err) => console.error('تعذر تحديث عدد المشاركات:', err));
    } catch {
      // المستخدم ألغى نافذة المشاركة — لا حاجة لأي إجراء.
    }
  };

  const handlePostTweetComment = async (tweetId: string, content: string) => {
    if (!requireAuth()) return;
    try {
      const newComment: TweetComment = {
        id: `twcomm_${Date.now()}`,
        tweetId,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        userRole: currentUser.role,
        content,
        likesCount: 0,
        likedBy: [],
        createdAt: new Date().toISOString(),
        replies: []
      };
      await addTweetCommentToFirestore(newComment);
      const tweet = tweets.find((t) => t.id === tweetId);
      if (tweet && tweet.authorId !== currentUser.id) {
        createNotificationInFirestore({
          userId: tweet.authorId,
          type: 'comment',
          title: 'تعليق جديد على تغريدتك',
          message: `علّق ${currentUser.fullName} على تغريدتك`,
          actorId: currentUser.id
        });
      }
    } catch (err) {
      console.error('تعذر إضافة التعليق:', err);
      alert(`تعذر إضافة التعليق.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleReplyToTweetComment = async (commentId: string, content: string) => {
    if (!requireAuth()) return;
    try {
      const newReply: CommentReply = {
        id: `twrep_${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        userRole: currentUser.role,
        content,
        likesCount: 0,
        isLiked: false,
        likedBy: [],
        createdAt: new Date().toISOString()
      };
      await addReplyToTweetCommentInFirestore(commentId, newReply);
      const comment = tweetComments.find((c) => c.id === commentId);
      if (comment && comment.userId !== currentUser.id) {
        createNotificationInFirestore({
          userId: comment.userId,
          type: 'comment',
          title: 'رد جديد على تعليقك',
          message: `رد ${currentUser.fullName} على تعليقك على تغريدة`,
          actorId: currentUser.id
        });
      }
    } catch (err) {
      console.error('تعذر إضافة الرد:', err);
      alert(`تعذر إضافة الرد.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  const handleToggleTweetCommentLike = async (commentId: string, isLiking: boolean) => {
    if (!requireAuth()) return;
    try {
      await toggleTweetCommentLikeInFirestore(commentId, currentUser.id, isLiking);
    } catch (err) {
      console.error('تعذر تحديث إعجاب التعليق:', err);
      alert(`تعذر تحديث الإعجاب.\n${(err as any)?.code || (err as any)?.message || 'تحقق من اتصالك ثم حاول مجدداً.'}`);
    }
  };

  // Unlock Article (One-time purchase)
  // Credits a writer's wallet with their share of ad revenue when a
  // 'writer'-placement campaign is shown inside one of their articles.
  // Platform-only campaigns (placementType 'platform', e.g. a flat-fee
  // homepage package) never call this — the owner keeps 100% of those by
  // design, matching how other publishing platforms separate direct-sold
  // site-wide inventory from in-content/creator-attributed placements.
  /**
   * عائد إعلانات الكاتب.
   *
   * ⚠️ تغيير جوهري: كان هذا يحسب الأرباح ويضيفها للرصيد في المتصفح مباشرة،
   * وهو أمران خاطئان معاً:
   *   1. قواعد أمان Firestore تمنع كتابة الحقول المالية من العميل، فكانت
   *      العملية تفشل صامتة أو تُرفض.
   *   2. أي حساب مالي في المتصفح قابل للتزوير من أدوات المطوّر.
   *
   * الآن: يُسجَّل الحدث فقط في adEvents بحالة غير محتسبة، ويتولى المالك
   * مراجعته واحتسابه من لوحة الإدارة بعد تصفية الاحتيال.
   * كما صُحّحت النسب لتقرأ من المصدر المركزي بدلاً من أرقام مكتوبة يدوياً.
   */
  /**
   * شراء مقال مقفول — فوري.
   *
   * كان هذا يُنشئ طلب شراء pending ينتظر اعتماداً يدوياً من المالك خلال
   * 24-48 ساعة (لأن قواعد أمان Firestore تمنع خصم الرصيد مباشرة من
   * المتصفح). الآن /api/articles/unlock على الخادم يتحقق من هوية المشتري
   * عبر توكن Firebase الحقيقي، ويخصم الرصيد ويفتح المقال فوراً ضمن معاملة
   * Firestore ذرية واحدة — بنفس نمط خصم توليد الصور بالذكاء الاصطناعي.
   */
  const handleUnlockArticle = async (article: Article) => {
    if (!requireAuth()) return;

    const price = article.lockedPrice || 2.99;
    const buyerBalance = (currentUser as any).walletBalance ?? 0;

    if (buyerBalance < price) {
      alert(
        `رصيد محفظتك ($${buyerBalance.toFixed(2)}) لا يكفي لشراء هذا المقال ($${price.toFixed(2)}). اشحن محفظتك أولاً.`
      );
      setMoneyModalMode('deposit');
      return;
    }

    try {
      const result = await requestArticleUnlock(article.id);
      if (!result.alreadyUnlocked) {
        alert(`تم فتح المقال بنجاح! خُصم $${result.price.toFixed(2)} من رصيدك.`);
      }
    } catch (err: any) {
      console.error('تعذر إتمام شراء المقال:', err);
      alert(err?.message || 'تعذر إتمام عملية الشراء. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Add Comment / Reply — تعليقات حقيقية متزامنة في Firestore (بدل
  // localStorage فقط)، بتوقيت فعلي حقيقي (بدل نص ثابت "الآن" لا يتحرك أبداً)،
  // مع إشعار حقيقي لصاحب المقال (عند تعليق) أو لصاحب التعليق الأصلي (عند رد).
  const handleAddComment = async (articleId: string, content: string, parentCommentId?: string) => {
    if (!requireAuth()) return;
    const nowIso = new Date().toISOString();
    const article = articles.find((a) => a.id === articleId);

    try {
      if (parentCommentId) {
        // رد على تعليق موجود
        const parentComment = comments.find((c) => c.id === parentCommentId);
        const newReply = {
          id: `rep_${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.avatarUrl,
          userRole: currentUser.role,
          content,
          likesCount: 0,
          isLiked: false,
          likedBy: [],
          createdAt: nowIso
        };

        // تحديث تفاؤلي فوري
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentCommentId ? { ...c, replies: [...(c.replies || []), newReply] } : c
          )
        );

        await addReplyToCommentInFirestore(parentCommentId, newReply);

        if (parentComment && parentComment.userId !== currentUserId) {
          createNotificationInFirestore({
            userId: parentComment.userId,
            type: 'reply',
            title: 'رد جديد على تعليقك',
            message: `ردّ ${currentUser.fullName} على تعليقك: "${content.slice(0, 60)}"`,
            articleId,
            actorId: currentUserId
          });
        }
      } else {
        // تعليق جذري جديد
        const newComment: Comment = {
          id: `comm_${Date.now()}`,
          articleId,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.avatarUrl,
          userRole: currentUser.role,
          content,
          likesCount: 0,
          isLiked: false,
          likedBy: [],
          createdAt: nowIso,
          replies: []
        };

        // تحديث تفاؤلي فوري
        setComments((prev) => [newComment, ...prev]);

        await addCommentToFirestore(newComment);

        if (article && article.writerId && article.writerId !== currentUserId) {
          createNotificationInFirestore({
            userId: article.writerId,
            type: 'comment',
            title: 'تعليق جديد على مقالك',
            message: `علّق ${currentUser.fullName} على مقالك "${article.title}": "${content.slice(0, 60)}"`,
            articleId,
            actorId: currentUserId
          });
        }
      }

      // تحديث عدد التعليقات على المقال — محلياً وفي Firestore معاً
      const newCount = (article?.commentsCount || 0) + 1;
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, commentsCount: newCount } : a))
      );
      updateArticleStatsInFirestore(articleId, { commentsCount: newCount }).catch((err) =>
        console.error('تعذر تحديث عدد التعليقات:', err)
      );
    } catch (err) {
      console.error('تعذر إضافة التعليق:', err);
      alert('تعذر نشر التعليق. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // إعجاب/إلغاء إعجاب حقيقي بتعليق — يتتبّع مَن أعجب فعلياً بدل تثبيت
  // isLiked=true للجميع وزيادة الرقم إلى ما لا نهاية كما كان سابقاً.
  const handleLikeComment = async (commentId: string) => {
    if (!requireAuth()) return;
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;

    const alreadyLiked = (comment.likedBy || []).includes(currentUserId);

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likesCount: Math.max(0, c.likesCount + (alreadyLiked ? -1 : 1)),
              likedBy: alreadyLiked
                ? (c.likedBy || []).filter((id) => id !== currentUserId)
                : [...(c.likedBy || []), currentUserId]
            }
          : c
      )
    );

    try {
      await toggleCommentLikeInFirestore(commentId, currentUserId, !alreadyLiked);
      if (!alreadyLiked && comment.userId !== currentUserId) {
        createNotificationInFirestore({
          userId: comment.userId,
          type: 'like',
          title: 'إعجاب بتعليقك',
          message: `أعجب ${currentUser.fullName} بتعليقك`,
          articleId: comment.articleId,
          actorId: currentUserId
        });
      }
    } catch (err) {
      console.error('تعذر تحديث إعجاب التعليق:', err);
      // تراجع عند الفشل
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? {
                ...c,
                likesCount: Math.max(0, c.likesCount + (alreadyLiked ? 1 : -1)),
                likedBy: alreadyLiked
                  ? [...(c.likedBy || []), currentUserId]
                  : (c.likedBy || []).filter((id) => id !== currentUserId)
              }
            : c
        )
      );
    }
  };

  // إشعار حقيقي عند مشاركة مقال — يصل لصاحب المقال عند مشاركته من قِبل
  // شخص آخر، مع تحديث عداد المشاركات (متزامن في Firestore).
  const handleShareArticle = (article: Article) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, sharesCount: (a.sharesCount || 0) + 1 } : a))
    );
    updateArticleStatsInFirestore(article.id, { sharesCount: (article.sharesCount || 0) + 1 }).catch(
      (err) => console.error('تعذر تحديث عدد المشاركات:', err)
    );
    if (article.writerId && article.writerId !== currentUserId && isAuthenticated) {
      createNotificationInFirestore({
        userId: article.writerId,
        type: 'share',
        title: 'تمت مشاركة مقالك',
        message: `شارك ${currentUser.fullName} مقالك "${article.title}"`,
        articleId: article.id,
        actorId: currentUserId
      });
    }
  };

  // تسجيل مشاهدة حقيقية مرة واحدة لكل مقال بكل جلسة تصفح — لم يكن هناك
  // أي تسجيل مشاهدات إطلاقاً من قبل رغم عرض الرقم بالواجهة.
  useEffect(() => {
    if (!readingArticle) return;
    if (viewedArticleIdsRef.current.has(readingArticle.id)) return;
    viewedArticleIdsRef.current.add(readingArticle.id);

    const newCount = (readingArticle.viewsCount || 0) + 1;
    setArticles((prev) =>
      prev.map((a) => (a.id === readingArticle.id ? { ...a, viewsCount: newCount } : a))
    );

    const articleId = readingArticle.id;
    (async () => {
      // الكتابة تتطلب جلسة موقّعة (ولو مجهولة) حسب قواعد الأمان. الزائر
      // الذي فتح مقالاً دون أن يُعجب أو يُقيّم من قبل ليس لديه أي جلسة
      // بعد، فكانت الكتابة تُرفض بصمت (permission-denied مُلتقط بـ catch)
      // ولا تُحتسب مشاهدته أبداً. نُنشئ له هوية مجهولة هنا أيضاً، بنفس
      // أسلوب handleLikeArticle، بدل ترك زوار الموقع بلا أي مشاهدات محسوبة.
      let uid = currentUserId || guestIdentityUid;
      if (!uid) {
        uid = (await ensureGuestIdentity()) || '';
        if (uid) setGuestIdentityUid(uid);
      }
      if (!uid) return;
      await incrementArticleViewInFirestore(articleId);
    })().catch((err) => console.error('تعذر تسجيل المشاهدة:', err));
  }, [readingArticle?.id]);

  // تقييمات المستخدم الحالي بالنجوم لكل مقال (لمعرفة تقييمه الحالي وعرضه
  // كنجوم مضيئة بدل تركه دائماً فارغاً).
  const myRatingsByArticleId = useMemo(() => {
    const effectiveId = currentUserId || guestIdentityUid;
    const map: Record<string, number> = {};
    if (!effectiveId) return map;
    articleRatings.forEach((r) => {
      if (r.userId === effectiveId) map[r.articleId] = r.stars;
    });
    return map;
  }, [articleRatings, currentUserId, guestIdentityUid]);

  // تقييم حقيقي بالنجوم (1-5)، قابل للتعديل لاحقاً من نفس المستخدم، مع
  // إعادة حساب متوسط دقيق مبني على المجموع الفعلي بدل رقم مخترع. يتطلب
  // حساباً حقيقياً مسجّلاً (بخلاف الإعجاب المسموح للزائر).
  const handleRateArticle = async (articleId: string, stars: number) => {
    if (!requireAuth()) return;
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;

    const previousStars = myRatingsByArticleId[articleId] || 0;
    const isNewRating = previousStars === 0;

    const currentSum = article.ratingsSum ?? article.rating * (article.ratingsCount || 0);
    const newSum = currentSum - previousStars + stars;
    const newCount = isNewRating ? (article.ratingsCount || 0) + 1 : article.ratingsCount || 0;
    const newAverage = newCount > 0 ? Number((newSum / newCount).toFixed(2)) : 0;

    // تحديث تفاؤلي فوري
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId
          ? { ...a, rating: newAverage, ratingsCount: newCount, ratingsSum: newSum }
          : a
      )
    );
    setArticleRatings((prev) => {
      const others = prev.filter((r) => !(r.articleId === articleId && r.userId === currentUserId));
      return [...others, { id: `${articleId}_${currentUserId}`, articleId, userId: currentUserId, stars }];
    });

    try {
      await rateArticleInFirestore(articleId, currentUserId, stars);
      await syncArticleRatingSummary(articleId, newSum, newCount);
    } catch (err) {
      console.error('تعذر حفظ التقييم:', err);
      alert('تعذر حفظ تقييمك. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  const handleReactToArticle = async (articleId: string, type: string) => {
    if (!requireAuth()) return;
    try {
      await setArticleReactionInFirestore(articleId, currentUserId, type);
    } catch (err) {
      console.error('تعذر حفظ الانطباع:', err);
    }
  };

  // Save / Publish Article
  const handleSaveArticle = async (
    articleData: Partial<Article>,
    status: 'published' | 'draft' = 'published'
  ) => {
    // Auth validation
    const currentUid =
      auth.currentUser?.uid ||
      (currentUser.id && !currentUser.id.startsWith('usr_temp_') ? currentUser.id : null);
    if (!currentUid) {
      setIsAuthOpen(true);
      throw new Error('يجب تسجيل الدخول بحساب كاتب أولاً لتتمكن من حفظ أو نشر المقالات.');
    }

    if (editingArticle && editingArticle.id && !editingArticle.id.startsWith('art_temp_')) {
      // Edit existing
      const updated: Article = {
        ...editingArticle,
        ...articleData,
        status,
        publishedAt:
          status === 'published'
            ? editingArticle.publishedAt || new Date().toISOString()
            : editingArticle.publishedAt || '',
        writerId: editingArticle.writerId || currentUid,
        writerName: editingArticle.writerName || currentUser.fullName,
        writerUsername: editingArticle.writerUsername || currentUser.username,
        writerAvatar: editingArticle.writerAvatar || currentUser.avatarUrl,
        writerIsVerified: !!(editingArticle.writerIsVerified ?? currentUser.isVerified)
      };

      try {
        await saveArticleToFirestore(updated, false);
        setArticles((prev) =>
          prev.map((a) => (a.id === editingArticle.id ? updated : a))
        );
      } catch (err: any) {
        console.error('Error updating article in Firestore:', err);
        throw new Error(err?.message || 'تعذر تحديث المقال في قاعدة البيانات Firestore.');
      }
    } else {
      // Create new
      const nowIso = new Date().toISOString();
      const newArtData: Partial<Article> = {
        writerId: currentUid,
        writerName: currentUser.fullName || currentUser.penName || 'كاتب',
        writerUsername: currentUser.username || 'writer',
        writerAvatar:
          currentUser.avatarUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
        writerIsVerified: !!currentUser.isVerified,
        title: articleData.title || '',
        slug:
          (articleData.title || '')
            .toLowerCase()
            .replace(/[^\w\u0621-\u064A\s-]/g, '')
            .replace(/\s+/g, '-') || `art-${Date.now()}`,
        description: articleData.description || (articleData.title || '').slice(0, 150),
        content: articleData.content || '',
        featuredImage:
          articleData.featuredImage ||
          'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80',
        category: articleData.category || 'literature',
        subCategory: articleData.subCategory || '',
        videoUrl: articleData.videoUrl || undefined,
        uploadedVideoUrl: articleData.uploadedVideoUrl || undefined,
        sourceUrl: articleData.sourceUrl || undefined,
        isLocked: !!articleData.isLocked,
        lockedPrice: articleData.isLocked ? articleData.lockedPrice || 3.0 : 0,
        readingTimeMinutes:
          articleData.readingTimeMinutes ||
          Math.max(1, Math.ceil((articleData.content || '').split(/\s+/).length / 180)),
        status,
        viewsCount: 0,
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        purchasesCount: 0,
        rating: 0,
        ratingsCount: 0,
        revenueFromAds: 0,
        revenueFromSales: 0,
        totalRevenue: 0,
        publishedAt: status === 'published' ? nowIso : '',
        tags:
          articleData.tags && articleData.tags.length > 0
            ? articleData.tags
            : ['أدب', 'ثقافة']
      };

      try {
        const docId = await saveArticleToFirestore(newArtData, true);
        const completeArt: Article = {
          ...(newArtData as Article),
          id: docId
        };

        setArticles((prev) => [
          completeArt,
          ...prev.filter((a) => a.id !== docId)
        ]);

        // Update writer stats
        setUsers((prev) =>
          prev.map((u) =>
            u.id === currentUid ? { ...u, articlesCount: (u.articlesCount || 0) + 1 } : u
          )
        );
      } catch (err: any) {
        console.error('Error saving new article to Firestore:', err);
        throw new Error(err?.message || 'تعذر نشر المقال في Firestore. تحقق من الاتصال.');
      }
    }

    setEditingArticle(null);
    setIsArticleEditorOpen(false);
  };

  // Delete Article
  const handleDeleteArticle = async (articleId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المقال نهائياً؟')) {
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, articlesCount: Math.max(0, (u.articlesCount || 1) - 1) }
            : u
        )
      );
      try {
        await deleteArticleFromFirestore(articleId);
      } catch (err: any) {
        console.error('Error deleting article in Firestore:', err);
        alert('حدث خطأ أثناء حذف المقال من Firestore: ' + (err?.message || 'خطأ غير معروف'));
      }
    }
  };

  // Deposit Funds
  // الإيداع: لم يعد يعدّل الرصيد محلياً.
  // قواعد أمان Firestore تمنع كتابة الحقول المالية من المتصفح، لذا يُنشأ
  // طلب إيداع بحالة pending، ويعتمده المالك يدوياً بعد تأكيد وصول المال.
  const handleDeposit = async (amount: number, method: PaymentMethod, ref: string) => {
    if (!requireAuth()) return;
    try {
      await createDepositRequest({
        userId: currentUser.id,
        amount,
        method: String(method),
        reference: ref
      });
      // ⚠️ لا تُغلق WalletModal ولا تعرض alert() هنا — WalletModal يعرض
      // شاشة نجاح مدمجة خاصة به (depositSuccess) فور استدعاء onDeposit،
      // ويعود تلقائياً لتبويب النظرة العامة بعد ثوانٍ قليلة. إغلاق
      // النافذة فوراً من هنا كان يُخفي تلك الشاشة قبل أن يراها المستخدم
      // إطلاقاً، ويستبدلها بنافذة alert() جافة تابعة للمتصفح.
    } catch (err) {
      console.error('تعذر إنشاء طلب الإيداع:', err);
      alert('تعذر إرسال طلب الإيداع. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // السحب: يُنشئ طلب سحب بحالة pending فقط.
  // المبلغ لا يُخصم من المتصفح — يعتمده المالك بعد التحويل الفعلي.
  const handleWithdraw = async (amount: number, method: PaymentMethod, accountDetail: string) => {
    if (!requireAuth()) return;
    // ⚠️ دفاع إضافي هنا أيضاً (بجانب بوابة WalletModal نفسها) — لم يكن أي
    // مكان يتحقق فعلياً من التوثيق قبل قبول طلب سحب، رغم أن شاشة KYC
    // تشرح أنها "لضمان أمان المعاملات المالية".
    const isKycVerified = currentUser.isKycVerified || currentUser.kycDetails?.status === 'verified';
    if (!isKycVerified) {
      alert('يجب إتمام التحقق من الهوية (KYC) قبل تقديم طلب سحب.');
      return;
    }
    const available = (currentUser as any).availableBalance ?? 0;
    if (amount > available) {
      alert('المبلغ المطلوب يتجاوز رصيدك المتاح للسحب.');
      return;
    }
    if (amount < 50) {
      alert('الحد الأدنى للسحب هو 50 دولاراً.');
      return;
    }
    try {
      await createPayoutRequest({
        userId: currentUser.id,
        amount,
        method: String(method),
        destination: accountDetail
      });
      // ⚠️ نفس السبب تماماً كحالة الإيداع أعلاه — اترك WalletModal يعرض
      // شاشة نجاحه المدمجة (withdrawSuccess) ويعود للنظرة العامة بنفسه.
    } catch (err) {
      console.error('تعذر إنشاء طلب السحب:', err);
      alert('تعذر إرسال طلب السحب. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Consume AI Quota with automatic modal triggers
  const handleConsumeAiQuota = (): boolean => {
    // الزائر بلا حساب حقيقي ليس له مستند Firestore دائم لتتبّع حصته محلياً
    // هنا، فيُسمح له بالمرور دائماً على المستوى المحلي — الحارس الفعلي
    // لحصته اليومية هو تحقّق الخادم في /api/ai/chat (مفتاحه معرّف الزائر
    // الثابت guestIdentityUid لكل متصفح، وليس سلسلة "guest" المشتركة بين
    // كل الزوار، التي كانت تُفرغ حصة الجميع بمجرد استخدام أول زائر لها).
    if (currentUser.id === 'guest') return true;
    if (!requireAuth()) return false;
    const { allowed, updatedQuota } = consumeAiUsage(currentUser.aiQuota);
    if (!allowed) {
      setIsSubscriptionOpen(true);
      return false;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, aiQuota: updatedQuota } : u))
    );
    updateUserAiQuotaInFirestore(currentUser.id, updatedQuota).catch((err) =>
      console.error('تعذر حفظ حصة استخدام الذكاء الاصطناعي:', err)
    );
    return true;
  };

  // Upgrade AI Subscription
  // ترقية اشتراك الذكاء الاصطناعي — يجب أن تمر دائماً عبر مراجعة الأدمن
  // اليدوية (بلا استثناء لأي طريقة دفع)، تطبيقاً لقرار "الدفع بوساطة
  // الأدمن" المعتمد: لا يوجد اتصال حقيقي ببوابة Stripe/PayPal فعلياً،
  // فمنح الاشتراك فوراً عند اختيار هذه الطرق كان يعني أن أي شخص يقدر
  // "يدفع" وهمياً ويحصل على اشتراك حقيقي مجاناً بدون أي تحقق فعلي.
  /**
   * لا تُغلق النافذة هنا ولا تعرض alert() — كانت النافذة تُغلق فوراً هنا
   * بينما تملك SubscriptionModal شاشة "نجاح" جاهزة بالكامل لم تكن تُعرض
   * أبداً بسببه. الآن تُعاد النتيجة للنافذة لتقرر بنفسها: تعرض شاشة
   * "تم استلام الطلب — قيد المراجعة" عند النجاح، أو رسالة خطأ داخلية عند
   * عدم كفاية الرصيد، دون إغلاق مفاجئ ودون رسالة متصفح افتراضية.
   */
  const handleUpgradeSuccess = (
    plan: 'monthly' | 'annual',
    paymentMethod: PaymentMethod
  ): { ok: boolean; error?: string } => {
    const planPrice = plan === 'monthly' ? 9.99 : 79.99;

    const isWalletPay =
      paymentMethod === 'wallet' ||
      paymentMethod === 'محفظة ليتيريوم' ||
      paymentMethod === 'محفظة التطبيق' ||
      (typeof paymentMethod === 'string' && paymentMethod.includes('محفظة'));

    if (isWalletPay) {
      const bal = (currentUser as any).walletBalance ?? 0;
      if (bal < planPrice) {
        setMoneyModalMode('deposit');
        return {
          ok: false,
          error: `رصيد محفظتك ($${bal.toFixed(2)}) لا يكفي لهذا الاشتراك ($${planPrice.toFixed(2)}). اشحن محفظتك أولاً.`
        };
      }
    }

    // طلب معلّق بانتظار مراجعة الأدمن — لا يُفعَّل الاشتراك ولا يُخصم أي
    // رصيد إلا بعد الاعتماد الفعلي (انظر handleUpdatePurchaseRequest).
    createPurchaseRequest({
      buyerId: currentUser.id,
      articleId: `subscription_${plan}_${Date.now()}`,
      articleTitle: `اشتراك المساعد الذكي (${plan === 'monthly' ? 'شهري' : 'سنوي'}) عبر ${paymentMethod}`,
      writerId: '',
      price: planPrice
    }).catch((err) => console.error('تعذر إنشاء طلب الاشتراك:', err));

    return { ok: true };
  };

  // Advertiser Create Campaign
  /**
   * إنشاء حملة إعلانية — فورية التمويل.
   *
   * كانت تُنشأ بحالة 'draft' بلا أي مسار فعلي لاعتمادها لاحقاً (لوحة
   * التحكم لا تعرض للاعتماد إلا حملات بحالة 'pending'، فتبقى كل حملة
   * عالقة للأبد بميزانية صفر — خلل حقيقي مكتشف). الآن: تُنشأ بحالة
   * 'pending' (تطابق النوع المُعرَّف فعلياً)، ثم تُموَّل فوراً عبر
   * /api/campaigns/fund الذي يخصم المعلن نفسه ويُفعِّلها ضمن معاملة واحدة
   * ذرية — بنفس نمط فتح المقالات المقفلة، بدل انتظار اعتماد يدوي.
   */
  const handleCreateCampaign = async (campData: Partial<AdCampaign>) => {
    if (!requireAuth()) return;

    const pricingModel = (campData.pricingModel ||
      (campData.type === 'impression' ? 'cpm' : campData.type) ||
      'fixed') as PricingModel;

    const requested = (campData as any).requestedBudget || 0;
    const balance = (currentUser as any).walletBalance ?? 0;

    if (requested > balance) {
      alert(
        `تكلفة الحملة ($${requested.toFixed(2)}) تتجاوز رصيد محفظتك ($${balance.toFixed(2)}). اشحن محفظتك أولاً.`
      );
      setMoneyModalMode('deposit');
      return;
    }

    const newCamp: any = {
      advertiserId: currentUser.id,
      advertiserName: currentUser.fullName,
      campaignName: campData.campaignName || '',
      description: campData.description || '',
      imageUrl: campData.imageUrl || '',
      destinationUrl: campData.destinationUrl || '',
      type: campData.type || pricingModel,
      pricingModel,
      placementType: campData.placementType || 'platform',
      adText: campData.adText || '',
      // كل ما يلي إلزامي بصفر حسب قواعد الأمان
      status: 'pending',
      totalBudget: 0,
      totalSpent: 0,
      impressionsCount: 0,
      validImpressionsCount: 0,
      clicksCount: 0,
      validClicksCount: 0,
      conversionsCount: 0,
      blockedFraudClicks: 0,
      // الميزانية المطلوبة — يعتمدها الأدمن ويحوّلها إلى totalBudget
      requestedBudget: requested,
      durationHours: campData.durationHours,
      cpcRate: campData.cpcRate,
      cpmRate: campData.cpmRate,
      startDate: new Date().toISOString().split('T')[0],
      fraudShieldScore: 100,
      targetCategories: campData.targetCategories || ['all'],
      targetCountries: ['ALL'],
      antiFraudLevel:
        pricingModel === 'cpc'
          ? 'maximum_cpc_shield'
          : pricingModel === 'cpm'
          ? 'enhanced_viewability'
          : 'basic'
    };

    // إزالة أي حقل بقيمة undefined قبل الإرسال إلى Firestore
    Object.keys(newCamp).forEach((k) => {
      if (newCamp[k] === undefined) delete newCamp[k];
    });

    try {
      const campaignId = await saveCampaignToFirestore(newCamp);
      const result = await fundCampaign(campaignId);
      if (result.alreadyFunded) {
        alert('تم إنشاء الحملة.');
      } else {
        alert(`تم إطلاق حملتك الإعلانية فوراً! خُصم $${result.budget.toFixed(2)} من رصيدك.`);
      }
    } catch (err: any) {
      console.error('تعذر حفظ/تمويل الحملة:', err);
      alert(err?.message || 'تعذر حفظ الحملة. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Toggle Campaign Status (Active / Paused)
  const handleToggleCampaignStatus = async (campaignId: string) => {
    const target = campaigns.find((c) => c.id === campaignId);
    if (!target) return;

    // قواعد الأمان تمنع المعلن من تغيير حالة حملته بنفسه — الاعتماد
    // والإيقاف من الأدمن حصراً، منعاً لتفعيل حملة بلا رصيد.
    if (currentUser.role !== 'admin') {
      alert('تغيير حالة الحملة يتم من إدارة المنصة فقط.');
      return;
    }

    const newStatus = target.status === 'active' ? 'paused' : 'active';
    try {
      await setCampaignStatusInFirestore(campaignId, newStatus);
    } catch (err) {
      console.error('تعذر تغيير حالة الحملة:', err);
      alert('تعذر تغيير حالة الحملة.');
    }
  };

  // KYC Save
  // ⚠️ كان هذا يمنح "isKycVerified: true" فوراً بمجرد الضغط على إرسال،
  // محلياً فقط وبدون أي حفظ حقيقي في Firestore أو مراجعة فعلية من الأدمن
  // — أي مستخدم كان "يوثّق" نفسه بنفسه بصورة وهمية. الآن يُرسَل الطلب
  // فعلياً بحالة "قيد المراجعة" فقط، ولا يتحقق الحساب إلا بعد اعتماد
  // حقيقي من الأدمن (onApproveKyc → setUserKycApprovedInFirestore).
  const handleSaveKyc = async (kyc: KycDetails) => {
    if (!requireAuth()) return;
    const submittedAt = new Date().toISOString();

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? { ...u, kycDetails: { idType: kyc.idType, idNumber: kyc.idNumber, status: 'pending', submittedAt } }
          : u
      )
    );

    try {
      await submitKycRequestInFirestore(currentUser.id, {
        idType: kyc.idType,
        idNumber: kyc.idNumber,
        submittedAt
      });
    } catch (err) {
      console.error('تعذر إرسال طلب توثيق الهوية:', err);
      alert('تعذر إرسال طلب التوثيق. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Send Direct Message
  // إرسال رسالة عبر Firestore.
  // حقل participants إلزامي في المستندين — بدونه ترفض قواعد الأمان العملية.
  const handleSendMessage = async (
    recipientId: string,
    content: string,
    media?: { url?: string; type: 'image' | 'video' | 'sticker' }
  ) => {
    if (!requireAuth()) return;
    if (recipientId === currentUserId) return;
    if (!content.trim() && !media) return;

    try {
      const convId = await ensureConversation(currentUserId, recipientId);
      await sendMessageToFirestore({
        conversationId: convId,
        senderId: currentUserId,
        participants: [currentUserId, recipientId],
        text: content.trim(),
        mediaUrl: media?.url,
        mediaType: media?.type
      });
    } catch (err) {
      console.error('تعذر إرسال الرسالة:', err);
      alert('تعذر إرسال الرسالة. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // إغلاق محادثة من قائمتي فقط (بلا حذف فعلي) — متاح لأي مستخدم، بخلاف
  // الحذف النهائي المقصور على الأدمن أعلاه.
  const handleHideConversation = async (conversationId: string) => {
    try {
      await hideConversationForMe(conversationId, currentUserId);
    } catch (err) {
      console.error('تعذر إغلاق المحادثة:', err);
    }
  };

  const handleToggleBlockUser = async (targetId: string, block: boolean) => {
    try {
      await toggleBlockUser(currentUserId, targetId, block);
    } catch (err) {
      console.error('تعذر تحديث حالة الحظر:', err);
      alert('تعذر تنفيذ العملية. حاول مجدداً.');
    }
  };

  const handleToggleMuteUser = async (targetId: string, mute: boolean) => {
    try {
      await toggleMuteUser(currentUserId, targetId, mute);
    } catch (err) {
      console.error('تعذر تحديث حالة الكتم:', err);
    }
  };

  const handleReportUser = async (
    targetId: string,
    conversationId: string | undefined,
    reason: MessageReport['reason'],
    details: string
  ) => {
    try {
      await submitUserReport({
        reporterId: currentUserId,
        reportedUserId: targetId,
        conversationId,
        reason,
        details
      });
    } catch (err) {
      console.error('تعذر إرسال البلاغ:', err);
      alert('تعذر إرسال البلاغ. حاول مجدداً.');
    }
  };

  const handleSetTyping = (conversationId: string, isTyping: boolean) => {
    setTypingState(conversationId, currentUserId, isTyping).catch(() => {});
  };

  // حذف رسالة واحدة — متاح لصاحب الرسالة نفسه أو الأدمن (تطابق قواعد
  // الأمان تماماً)، كانت الوظيفة غائبة تماماً عن الواجهة رغم دعمها في
  // Firestore منذ البداية.
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessageInFirestore(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('تعذر حذف الرسالة:', err);
      alert('تعذر حذف الرسالة. حاول مجدداً.');
    }
  };

  // حذف محادثة كاملة — للأدمن فقط (قواعد الأمان تقصر حذف مستند المحادثة
  // على isAdmin()، بخلاف حذف رسالة فردية المتاح لصاحبها أيضاً).
  const handleDeleteConversation = async (conversationId: string, partnerId: string) => {
    try {
      const messageIds = messages
        .filter(
          (m) =>
            (m.senderId === currentUserId && m.recipientId === partnerId) ||
            (m.senderId === partnerId && m.recipientId === currentUserId)
        )
        .map((m) => m.id);
      await deleteConversationInFirestore(conversationId, messageIds);
      setMessages((prev) => prev.filter((m) => !messageIds.includes(m.id)));
      setRawConversations((prev) => prev.filter((c) => c.id !== conversationId));
    } catch (err) {
      console.error('تعذر حذف المحادثة:', err);
      alert('تعذر حذف المحادثة. حاول مجدداً.');
    }
  };

  // Kept for any future "upgrade my account" flow, but hardened: this can
  // never assign 'admin' — that only happens via the owner-email bootstrap
  // in firebase.ts, enforced server-side by firestore.rules.
  const handleSwitchRole = async (role: UserRole) => {
    if (role === 'admin') {
      console.warn('Blocked attempt to self-assign admin role from the client.');
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, role } : u))
    );
    try {
      await updateUserRoleInFirestore(currentUser.id, role);
    } catch (err) {
      console.warn('Role Firestore sync notice:', err);
    }
    if (role === 'writer') {
      setActiveTab('profile');
    } else if (role === 'advertiser') {
      setActiveTab('campaigns');
    } else {
      setActiveTab('feed');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    // فعّل العلامة فوراً قبل أي شيء آخر، حتى نغلق الباب أمام أي إشارة
    // دخول متأخرة من Firebase تصل خلال عملية الخروج نفسها.
    isLoggingOutRef.current = true;
    try {
      await logOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentUserId('');
    localStorage.removeItem('literium_current_user_id');
    setShowLandingPage(true);
    setActiveTab('feed');

    // بعد ثانيتين نرفع العلامة — وقت كافٍ لاستقرار حالة Firebase الداخلية
    // بعد الخروج، مع السماح لاحقاً بتسجيل دخول طبيعي بحساب جديد أو مختلف.
    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 2000);
  };

  // Google Sign-In trigger. This only STARTS the flow (popup on desktop,
  // redirect on mobile). It intentionally does not touch currentUserId,
  // showLandingPage, or activeTab — the onAuthStateChanged listener above is
  // the single place that reacts once Firebase confirms the sign-in.
  const [authTriggerError, setAuthTriggerError] = useState<string | null>(null);
  const handleRealGoogleSignIn = async (role: UserRole = 'reader') => {
    setAuthTriggerError(null);
    try {
      await signInWithGoogle(role);
      // Desktop popup case resolves here and the listener picks it up.
      // Mobile redirect case: the page navigates away, so nothing else runs.
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setAuthTriggerError(getAuthErrorMessage(err));
      setIsAuthOpen(true); // AuthModal is the only place this error is currently rendered
    }
  };
  // List of Followed writers objects
  const followedWriters = useMemo(() => {
    return users.filter((u) => followedWriterIds.includes(u.id));
  }, [users, followedWriterIds]);

  // عدد المتابعين الحقيقي لكل مستخدم، محسوب من مجموعة follows الفعلية —
  // مصدر واحد يُعاد استخدامه في كل مكان يحتاج رقم متابعين دقيق (لوحة
  // الإدارة، أهلية منشئي المحتوى، لوحة الكاتب...) بدل حقل المستخدم
  // المخزَّن الذي لا يُحدَّث من أي مسار ويبقى صفراً دائماً.
  const followersCountByUserId = useMemo(() => {
    const counts: Record<string, number> = {};
    followsData.forEach((f) => {
      counts[f.followingId] = (counts[f.followingId] || 0) + 1;
    });
    return counts;
  }, [followsData]);

  // دالة الترجمة الحالية — تُعاد بناؤها فقط عند تغيّر اللغة المختارة.
  const t = useMemo(() => getTranslator(language), [language]);

  // عدّادات المعلَّق لخانات لوحة الأدمن المجمَّعة في صفحة "ملفي" — نفس
  // تعريف كل عدّاد المستخدَم في شارات AdminDashboard نفسها تماماً، حتى
  // لا يعرض الرقمان (هنا وهناك) قيمتين مختلفتين لنفس المعنى.
  const pendingKycCount = users.filter((u: any) => u.kycDetails?.status === 'pending').length;
  const pendingMoneyCount = [...depositRequests, ...payoutRequests, ...purchaseRequests].filter(
    (r) => r.status === 'pending'
  ).length;
  const pendingFraudCount = fraudFlags.length;

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;
  // عدد الرسائل الخاصة غير المقروءة الواردة للمستخدم الحالي فعلياً — كان
  // هذا الرقم يُمرَّر دائماً كصفر ثابت لعدم اشتقاقه من بيانات الرسائل
  // الحقيقية، فتبقى شارة "الرسائل" في شريط التنقل معطَّلة رغم وجود رسائل
  // فعلية لم تُقرأ بعد.
  const unreadMessagesCount = messages.filter((m) => m.recipientId === currentUser.id && !m.isRead).length;

  // حساب أهلية احتساب الأرباح بالمتابعين الحقيقيين (من مجموعة follows
  // الفعلية)، لا بحقل currentUser.followersCount المخزَّن الذي لا يتحدّث
  // أبداً — كان هذا يجعل شرط "100 متابع" مستحيل التحقق دائماً في القائمة
  // الجانبية تحديداً، فتظهر "قارئ مسجل" حتى لكاتب مستوفٍ فعلياً كل الشروط.
  const currentUserIsMonetizationEligible = isEligibleForMonetization(
    currentUser,
    articles,
    followersCountByUserId[currentUser.id] || 0
  );
  // وسم حالة واحد فقط يُستخدم في كل مكان (الملف الشخصي + القائمة الجانبية)
  // بدل أوسمة متضاربة لكل صفحة على حدة.
  const memberStatusLabel = getMemberStatusLabel(currentUser.role, currentUserIsMonetizationEligible);

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
    return false;
  };

  useEffect(() => {
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
            // Deliberately NOT persisting "has seen landing" here — that
            // flag should only stick for a real logged-in session (set in
            // the auth listener below). If it stuck for guest browsing too,
            // refreshing while browsing as a guest would skip the landing
            // page (and its login options) on every future visit, trapping
            // the person in guest mode until they found the logout button.
            setActiveTab('feed');
          }}
          onOpenRegister={(role) => {
            // فتح شاشة الدخول/التسجيل يعني نية واضحة وصريحة من المستخدم
            // بتسجيل الدخول الآن — يجب ألا تمنعه علامة "خرجت للتو" من ذلك.
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
        />

        {/* Auth Modal Triggered on Landing.
            AuthModal only triggers real Firebase calls (Google / Email-Password).
            The onAuthStateChanged listener above is what actually updates
            currentUserId, navigation, etc. once Firebase confirms sign-in. */}
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
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-24 relative"
      >
        {/* Pull to Refresh Android Visual Pill */}
        {(pullDistance > 0 || isRefreshing) && (
          <div className="flex justify-center mb-4 animate-android-in">
            <div className="px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 shadow-md flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
              <RefreshCw
                className={`w-4 h-4 ${
                  isRefreshing ? 'animate-spin text-teal-600' : ''
                }`}
                style={{
                  transform: !isRefreshing ? `rotate(${pullDistance * 4}deg)` : undefined
                }}
              />
              <span>{isRefreshing ? 'جاري تحديث المقالات...' : pullDistance > 55 ? 'أفلت للتحديث' : 'اسحب للتحديث'}</span>
            </div>
          </div>
        )}

        {/* Unified Role & Tab Based View Router */}
        {viewingWriterProfile ? (
          <WriterProfileView
            writer={viewingWriterProfile}
            articles={articles}
            campaigns={campaigns}
            currentUserId={currentUserId || null}
            onBack={() => setViewingWriterProfile(null)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onFollowWriter={handleToggleFollow}
            followersCount={followsData.filter((f) => f.followingId === viewingWriterProfile.id).length}
            followingCount={followsData.filter((f) => f.followerId === viewingWriterProfile.id).length}
            isFollowing={followedWriterIds.includes(viewingWriterProfile.id)}
            isFollowingMe={followsData.some(
              (f) => f.followerId === viewingWriterProfile.id && f.followingId === currentUserId
            )}
            onOpenDirectMessage={(w) => {
              setActiveChatPartner(w);
              setIsDirectMessagesOpen(true);
            }}
            onShowFollowers={() => handleShowFollowers(viewingWriterProfile.id)}
            onShowFollowing={() => handleShowFollowing(viewingWriterProfile.id)}
          />
        ) : activeTab === 'profile' ? (
          <UserProfileView
            currentUser={currentUser}
            articles={articles}
            bookmarkedArticleIds={bookmarkedArticleIds}
            followingCount={followedWriterIds.length}
            followersCount={followsData.filter((f) => f.followingId === currentUser.id).length}
            memberStatusLabel={memberStatusLabel}
            campaigns={campaigns}
            initialWriterTab={writerActiveTab}
            onWriterTabChange={setWriterActiveTab}
            onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenKyc={() => setIsKycOpen(true)}
            onOpenBeta20={() => setIsBeta20Open(true)}
            onOpenPolicies={() => setLegalSection('privacy')}
            onOpenArticleEditor={(art) => {
              setEditingArticle(art || null);
              setIsArticleEditorOpen(true);
            }}
            onEditArticle={(art) => {
              setEditingArticle(art);
              setIsArticleEditorOpen(true);
            }}
            onDeleteArticle={handleDeleteArticle}
            onPromoteArticle={(art) => setPromotingArticle(art)}
            promotions={promotions}
            onSaveSocialLinks={handleSaveSocialLinks}
            onSaveProfile={handleSaveProfile}
            pendingKycCount={pendingKycCount}
            pendingMoneyCount={pendingMoneyCount}
            pendingFraudCount={pendingFraudCount}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
            onSwitchUserRole={handleSwitchRole}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            language={language}
            onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
            onLogout={handleLogout}
            users={users}
            fraudFlags={fraudFlags}
            depositRequests={depositRequests}
            payoutRequests={payoutRequests}
            purchaseRequests={purchaseRequests}
            adEvents={adEvents}
            earningsRecords={earningsRecords}
            manualBalanceAdjustments={manualBalanceAdjustments}
            onProcessAdEvents={handleProcessAdEvents}
            estimatedExternalCpmUsd={externalAdsConfig.estimatedCpmUsd}
            onProcessExternalAdRevenue={handleProcessExternalAdRevenue}
            onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
            onUpdateMoneyRequest={handleUpdateMoneyRequest}
            onUpdatePromotionStatus={handleUpdatePromotionStatus}
            onBroadcastMessage={(text) =>
              broadcastMessageToAllUsers(
                currentUser.id,
                users.map((u) => u.id),
                text
              )
            }
            onUpdateUserRole={async (userId, newRole) => {
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
              );
              await updateUserRoleInFirestore(userId, newRole);
            }}
            onToggleUserVerified={async (userId) => {
              const target = users.find((u) => u.id === userId);
              const nextVerified = !(target?.isVerified);
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, isVerified: nextVerified } : u))
              );
              await setUserVerifiedInFirestore(userId, nextVerified);
            }}
            onApproveKyc={async (userId) => {
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === userId
                    ? {
                        ...u,
                        isKycVerified: true,
                        kycDetails: u.kycDetails ? { ...u.kycDetails, status: 'verified' } : undefined
                      }
                    : u
                )
              );
              await setUserKycApprovedInFirestore(userId);
            }}
            onBanUser={async (userId) => {
              const target = users.find((u) => u.id === userId);
              const nextBanned = !(target?.isBanned);
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, isBanned: nextBanned } : u))
              );
              await setUserBannedInFirestore(userId, nextBanned);
            }}
            onUpdateCampaignStatus={async (campaignId, status) => {
              setCampaigns((prev) =>
                prev.map((c) => (c.id === campaignId ? { ...c, status } : c))
              );
              await setCampaignStatusInFirestore(campaignId, status);
            }}
            onUpdateArticleStatus={async (articleId, status) => {
              setArticles((prev) =>
                prev.map((a) => (a.id === articleId ? { ...a, status } : a))
              );
              await setArticleStatusInFirestore(articleId, status);
            }}
            onResolveFraudFlag={async (flagId, action) => {
              setFraudFlags((prev) =>
                prev.map((f) =>
                  f.id === flagId
                    ? {
                        ...f,
                        status: action === 'resolved' ? 'reviewed' : 'dismissed'
                      }
                    : f
                )
              );
              await resolveFraudFlagInFirestore(flagId, action);
            }}
            /* تعديل رصيد مستخدم يدوياً من الأدمن — amount هنا فرق يُضاف
               لقيمة الحقل الحالية (موجب = إضافة، سالب = خصم)، وليس رقماً
               مطلقاً. */
            onAdjustBalance={async (userId, field, amount, reason) => {
              const target = users.find((u) => u.id === userId);
              if (!target) return;
              const current = Number((target as any)[field] ?? 0);
              const next = Number((current + amount).toFixed(2));
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? ({ ...u, [field]: next } as any) : u))
              );
              try {
                await adminAdjustUserBalance(userId, { [field]: next } as any);
                // سجلّ تدقيق دائم — من عدّل، لمَن، أي حقل، بأي مبلغ، ولماذا.
                await logManualBalanceAdjustment({
                  userId,
                  field,
                  amount,
                  newValue: next,
                  reason,
                  adjustedBy: currentUser.id
                });
              } catch (err) {
                console.error('تعذر حفظ تعديل الرصيد:', err);
                alert('تعذر حفظ تعديل الرصيد. حاول مجدداً.');
              }
            }}
            onReleaseEarning={async (earning) => {
              const targetUser = users.find((u) => u.id === earning.userId);
              if (!targetUser) {
                alert('تعذر إيجاد بيانات هذا المستخدم لتحرير أرباحه.');
                return;
              }
              const currentPending = (targetUser as any).pendingEarnings || 0;
              const currentAvailable = (targetUser as any).availableBalance || 0;
              try {
                await adminReleaseEarnings(earning.userId, currentPending, currentAvailable, earning.amount);
                await markEarningReleasedInFirestore(earning.id);
                setEarningsRecords((prev) =>
                  prev.map((e) => (e.id === earning.id ? { ...e, status: 'released' } : e))
                );
              } catch (err) {
                console.error('تعذر تحرير الربح:', err);
                alert('تعذر تحرير هذا الربح. تحقق من اتصالك ثم حاول مجدداً.');
              }
            }}
            onSelectUser={(u) => setViewingWriterProfile(u)}
            followersCountByUserId={followersCountByUserId}
            currentThemePreset={themePreset}
            onChangeThemePreset={handleChangeThemePreset}
            currentBackgroundPreset={backgroundPreset}
            onChangeBackgroundPreset={handleChangeBackgroundPreset}
            platformAdsEnabled={platformAdsEnabled}
            onTogglePlatformAds={handleTogglePlatformAds}
            externalAdsConfig={externalAdsConfig}
            onSaveExternalAdsConfig={handleSaveExternalAdsConfig}
            publishingBotsEnabled={publishingBotsEnabled}
            onTogglePublishingBots={handleTogglePublishingBots}
            onSeedBotAccounts={handleSeedBotAccounts}
            initialAdminSection={adminActiveTab}
            onAdminSectionChange={setAdminActiveTab}
            tweets={tweets.filter((t) => t.authorId === currentUser.id)}
            tweetComments={tweetComments}
            likedTweetIds={tweetLikes.filter((l) => l.userId === currentUser.id).map((l) => l.tweetId)}
            favoritedTweetIds={favoritedTweetIds}
            favoritedTweets={tweets.filter((t) => favoritedTweetIds.includes(t.id))}
            onDeleteTweet={handleDeleteTweet}
            onToggleTweetLike={handleToggleTweetLike}
            onToggleTweetFavorite={handleToggleTweetFavorite}
            onShareTweet={handleShareTweet}
            onAddTweetComment={handlePostTweetComment}
            onLikeTweetComment={handleToggleTweetCommentLike}
            onReplyToTweetComment={handleReplyToTweetComment}
            onShowFollowers={() => handleShowFollowers(currentUser.id)}
            onShowFollowing={() => handleShowFollowing(currentUser.id)}
          />
        ) : activeTab === 'explore' ? (
          <ExploreView
            articles={articles}
            writers={users}
            onSelectArticle={(art) => setReadingArticle(art)}
            onSelectWriter={(w) => setViewingWriterProfile(w)}
            onFollowWriter={handleToggleFollow}
            followedWriterIds={followedWriterIds}
            onToggleBookmark={handleToggleBookmark}
            bookmarkedArticleIds={bookmarkedArticleIds}
          />
        ) : (activeTab === 'articles' || activeTab === 'saved') && currentUser.id !== 'guest' ? (
          <UserProfileView
            currentUser={currentUser}
            articles={articles}
            bookmarkedArticleIds={bookmarkedArticleIds}
            followingCount={followedWriterIds.length}
            followersCount={followsData.filter((f) => f.followingId === currentUser.id).length}
            memberStatusLabel={memberStatusLabel}
            campaigns={campaigns}
            initialWriterTab="blog"
            onWriterTabChange={setWriterActiveTab}
            onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenKyc={() => setIsKycOpen(true)}
            onOpenBeta20={() => setIsBeta20Open(true)}
            onOpenPolicies={() => setLegalSection('privacy')}
            onOpenArticleEditor={(art) => {
              setEditingArticle(art || null);
              setIsArticleEditorOpen(true);
            }}
            onEditArticle={(art) => {
              setEditingArticle(art);
              setIsArticleEditorOpen(true);
            }}
            onDeleteArticle={handleDeleteArticle}
            onPromoteArticle={(art) => setPromotingArticle(art)}
            promotions={promotions}
            onSaveSocialLinks={handleSaveSocialLinks}
            onSaveProfile={handleSaveProfile}
            pendingKycCount={pendingKycCount}
            pendingMoneyCount={pendingMoneyCount}
            pendingFraudCount={pendingFraudCount}
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
            onSwitchUserRole={handleSwitchRole}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            language={language}
            onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
            onLogout={handleLogout}
            users={users}
            fraudFlags={fraudFlags}
            depositRequests={depositRequests}
            payoutRequests={payoutRequests}
            purchaseRequests={purchaseRequests}
            adEvents={adEvents}
            earningsRecords={earningsRecords}
            manualBalanceAdjustments={manualBalanceAdjustments}
            onProcessAdEvents={handleProcessAdEvents}
            estimatedExternalCpmUsd={externalAdsConfig.estimatedCpmUsd}
            onProcessExternalAdRevenue={handleProcessExternalAdRevenue}
            onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
            onUpdateMoneyRequest={handleUpdateMoneyRequest}
            onUpdatePromotionStatus={handleUpdatePromotionStatus}
            onBroadcastMessage={(text) =>
              broadcastMessageToAllUsers(
                currentUser.id,
                users.map((u) => u.id),
                text
              )
            }
            onUpdateUserRole={async (userId, newRole) => {
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
              );
              await updateUserRoleInFirestore(userId, newRole);
            }}
            onToggleUserVerified={async (userId) => {
              const target = users.find((u) => u.id === userId);
              const nextVerified = !(target?.isVerified);
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, isVerified: nextVerified } : u))
              );
              await setUserVerifiedInFirestore(userId, nextVerified);
            }}
            onApproveKyc={async (userId) => {
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === userId
                    ? {
                        ...u,
                        isKycVerified: true,
                        kycDetails: u.kycDetails ? { ...u.kycDetails, status: 'verified' } : undefined
                      }
                    : u
                )
              );
              await setUserKycApprovedInFirestore(userId);
            }}
            onBanUser={async (userId) => {
              const target = users.find((u) => u.id === userId);
              const nextBanned = !(target?.isBanned);
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, isBanned: nextBanned } : u))
              );
              await setUserBannedInFirestore(userId, nextBanned);
            }}
            onUpdateCampaignStatus={async (campaignId, status) => {
              setCampaigns((prev) =>
                prev.map((c) => (c.id === campaignId ? { ...c, status } : c))
              );
              await setCampaignStatusInFirestore(campaignId, status);
            }}
            onUpdateArticleStatus={async (articleId, status) => {
              setArticles((prev) =>
                prev.map((a) => (a.id === articleId ? { ...a, status } : a))
              );
              await setArticleStatusInFirestore(articleId, status);
            }}
            onResolveFraudFlag={async (flagId, action) => {
              setFraudFlags((prev) =>
                prev.map((f) =>
                  f.id === flagId
                    ? {
                        ...f,
                        status: action === 'resolved' ? 'reviewed' : 'dismissed'
                      }
                    : f
                )
              );
              await resolveFraudFlagInFirestore(flagId, action);
            }}
            onAdjustBalance={async (userId, field, amount, reason) => {
              const target = users.find((u) => u.id === userId);
              if (!target) return;
              const current = Number((target as any)[field] ?? 0);
              const next = Number((current + amount).toFixed(2));
              setUsers((prev) =>
                prev.map((u) => (u.id === userId ? ({ ...u, [field]: next } as any) : u))
              );
              try {
                await adminAdjustUserBalance(userId, { [field]: next } as any);
                await logManualBalanceAdjustment({
                  userId,
                  field,
                  amount,
                  newValue: next,
                  reason,
                  adjustedBy: currentUser.id
                });
              } catch (err) {
                console.error('تعذر حفظ تعديل الرصيد:', err);
                alert('تعذر حفظ تعديل الرصيد. حاول مجدداً.');
              }
            }}
            onReleaseEarning={async (earning) => {
              const targetUser = users.find((u) => u.id === earning.userId);
              if (!targetUser) {
                alert('تعذر إيجاد بيانات هذا المستخدم لتحرير أرباحه.');
                return;
              }
              const currentPending = (targetUser as any).pendingEarnings || 0;
              const currentAvailable = (targetUser as any).availableBalance || 0;
              try {
                await adminReleaseEarnings(earning.userId, currentPending, currentAvailable, earning.amount);
                await markEarningReleasedInFirestore(earning.id);
                setEarningsRecords((prev) =>
                  prev.map((e) => (e.id === earning.id ? { ...e, status: 'released' } : e))
                );
              } catch (err) {
                console.error('تعذر تحرير الربح:', err);
                alert('تعذر تحرير هذا الربح. تحقق من اتصالك ثم حاول مجدداً.');
              }
            }}
            onSelectUser={(u) => setViewingWriterProfile(u)}
            followersCountByUserId={followersCountByUserId}
            currentThemePreset={themePreset}
            onChangeThemePreset={handleChangeThemePreset}
            currentBackgroundPreset={backgroundPreset}
            onChangeBackgroundPreset={handleChangeBackgroundPreset}
            platformAdsEnabled={platformAdsEnabled}
            onTogglePlatformAds={handleTogglePlatformAds}
            externalAdsConfig={externalAdsConfig}
            onSaveExternalAdsConfig={handleSaveExternalAdsConfig}
            publishingBotsEnabled={publishingBotsEnabled}
            onTogglePublishingBots={handleTogglePublishingBots}
            onSeedBotAccounts={handleSeedBotAccounts}
            initialAdminSection={adminActiveTab}
            onAdminSectionChange={setAdminActiveTab}
            tweets={tweets.filter((t) => t.authorId === currentUser.id)}
            tweetComments={tweetComments}
            likedTweetIds={tweetLikes.filter((l) => l.userId === currentUser.id).map((l) => l.tweetId)}
            favoritedTweetIds={favoritedTweetIds}
            favoritedTweets={tweets.filter((t) => favoritedTweetIds.includes(t.id))}
            onDeleteTweet={handleDeleteTweet}
            onToggleTweetLike={handleToggleTweetLike}
            onToggleTweetFavorite={handleToggleTweetFavorite}
            onShareTweet={handleShareTweet}
            onAddTweetComment={handlePostTweetComment}
            onLikeTweetComment={handleToggleTweetCommentLike}
            onReplyToTweetComment={handleReplyToTweetComment}
            onShowFollowers={() => handleShowFollowers(currentUser.id)}
            onShowFollowing={() => handleShowFollowing(currentUser.id)}
          />
        ) : activeTab === 'campaigns' && currentUser.id !== 'guest' ? (
          <AdvertiserDashboard
            campaigns={campaigns.filter((c) => c.advertiserId === currentUser.id)}
            onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
            onToggleCampaignStatus={handleToggleCampaignStatus}
            advertiserBalance={currentUser.walletBalance || 0}
            onOpenDeposit={() => setIsWalletOpen(true)}
            activeUsersCount={Math.max(users.length, 1)}
          />
        ) : (
          /* Main Feed View: Available to all users/roles when on 'feed' */
          <div className="space-y-6 animate-android-in">
              {/* مبدّل المدونة/التغريد — "الستارة": القسم النشط يتمدد والآخر ينطوي بجانبه */}
              <HomeFeedModeSwitcher mode={homeFeedMode} onChange={setHomeFeedMode} />

              {homeFeedMode === 'tweet' && (
                <>
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleRefreshFeed}
                    disabled={isRefreshing}
                    className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs transition-all touch-manipulation active:scale-95"
                    title="تحديث التغريدات"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-500' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>
                <TweetFeed
                  currentUser={currentUser}
                  tweets={tweets}
                  comments={tweetComments}
                  likedTweetIds={tweetLikes.filter((l) => l.userId === currentUserId).map((l) => l.tweetId)}
                  favoritedTweetIds={favoritedTweetIds}
                  campaigns={campaigns}
                  onPostTweet={handlePostTweet}
                  onToggleLike={handleToggleTweetLike}
                  onToggleFavorite={handleToggleTweetFavorite}
                  onShare={handleShareTweet}
                  onDeleteTweet={handleDeleteTweet}
                  onAddComment={handlePostTweetComment}
                  onLikeComment={handleToggleTweetCommentLike}
                  onReplyToComment={handleReplyToTweetComment}
                  onSelectAuthor={(wId) => {
                    const w = users.find((u) => u.id === wId);
                    if (w) setViewingWriterProfile(w);
                  }}
                />
                </>
              )}

              {homeFeedMode === 'blog' && (
              <>
              {/* Search Bar — عدسة البحث عنصر منفصل تماماً عن حقل الكتابة،
                  وليست أيقونة عائمة داخل الحقل، حتى يكون شكلها واضحاً كزر بحث حقيقي */}
              <div className="flex flex-row items-center justify-between gap-2">
                {isSearchExpanded ? (
                  <div className="flex items-stretch flex-1 min-w-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all overflow-hidden">
                    <div className="w-11 shrink-0 flex items-center justify-center text-slate-400 border-e border-slate-200 dark:border-slate-800">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => {
                        if (!searchQuery.trim()) setIsSearchExpanded(false);
                      }}
                      placeholder="ابحث عن مقال، جملة من محتواه، أو اسم مستخدم..."
                      className="w-full px-4 py-3 bg-transparent text-xs sm:text-sm outline-hidden text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchExpanded(false);
                      }}
                      className="w-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                      title="إغلاق البحث"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsSearchExpanded(true)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-brand-400 dark:hover:border-brand-600 transition-all text-slate-400 shrink-0 touch-manipulation active:scale-95"
                    title="بحث"
                  >
                    <Search className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">بحث...</span>
                  </button>
                )}

                <button
                  onClick={handleRefreshFeed}
                  disabled={isRefreshing}
                  className="px-3 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs transition-all shrink-0 touch-manipulation active:scale-95"
                  title="تحديث قائمة المقالات"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-500' : ''}`} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>
              </div>

              {/* نتائج حسابات المستخدمين المطابقة للبحث */}
              {searchQuery.trim() && matchingUsers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    حسابات مطابقة لبحثك:
                  </h3>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {matchingUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setViewingWriterProfile(u)}
                        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 shrink-0 transition-all active:scale-95"
                      >
                        <img
                          src={u.avatarUrl}
                          alt={u.fullName}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {u.fullName}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">@{u.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories Scroll Filter */}
              <div className="relative">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
                  {categoryFilters.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[42px] px-4.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25 ring-2 ring-brand-500/20'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. Featured Articles Carousel */}
              {selectedCategory === 'all' && !searchQuery && (
                <FeaturedArticlesSection
                  articles={articles}
                  onSelectArticle={(art) => setReadingArticle(art)}
                  onBookmark={handleToggleBookmark}
                  bookmarkedIds={bookmarkedArticleIds}
                />
              )}

              {/* موضع home_hero — أسفل البانر المميز مباشرة، ملك المنصة
                  بالكامل (100%)، حسب خريطة المواضع الإعلانية المعتمدة. */}
              {selectedCategory === 'all' && !searchQuery && (
                <AdSlot slotId="home_hero" campaigns={campaigns} viewerId={currentUserId || null} adFree={false} />
              )}

              {/* موضع category_banner — أعلى قسم تصنيف محدد، حصري لراعي
                  القسم فقط (sponsorOnly)، لا يشاركه أحد. */}
              {selectedCategory !== 'all' && (
                <AdSlot slotId="category_banner" campaigns={campaigns} viewerId={currentUserId || null} adFree={false} />
              )}

              {/* 2. Trending Articles Ranking */}
              {selectedCategory === 'all' && !searchQuery && (
                <TrendingArticlesSection
                  articles={articles}
                  onSelectArticle={(art) => setReadingArticle(art)}
                />
              )}

              {/* In-Feed Smart Platform Ad Banner — only shows campaigns the
                  advertiser actually configured as platform-wide placements
                  (e.g. a flat-fee homepage package); in-article placements
                  are shown inside ArticleReader instead. */}
              {platformAdsEnabled && campaigns.find((c) => c.status === 'active' && c.placementType === 'platform') && (
                <SmartAdBanner
                  campaign={campaigns.find((c) => c.status === 'active' && c.placementType === 'platform')!}
                  placementType="platform"
                  currentUserId={currentUser.id}
                  variant="banner"
                  onAdClick={(camp, isValid) => {
                    if (isValid) {
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === camp.id
                            ? {
                                ...c,
                                clicksCount: c.clicksCount + 1,
                                totalSpent: c.totalSpent + (c.cpcRate || 0.08)
                              }
                            : c
                        )
                      );
                      // ⚠️ كان هذا التحديث محلياً فقط (يُفقد عند إعادة التحميل)
                      // بلا أي تسجيل فعلي في adEvents — على عكس إعلانات صفحة
                      // الكاتب المجاورة التي تستدعي logAdEvent بشكل صحيح. هذا
                      // يعني أن أداء حملات "المنصة" (الصفحة الرئيسية) لم يكن
                      // يُحتسب أو يُحتسب له عائد إطلاقاً.
                      logAdEvent({
                        campaignId: camp.id,
                        slotId: 'platform_banner',
                        viewerId: currentUserId || null,
                        eventType: 'click'
                      }).catch(() => {});
                    }
                  }}
                  onAdImpression={(camp, isValid) => {
                    if (isValid) {
                      setCampaigns((prev) =>
                        prev.map((c) =>
                          c.id === camp.id
                            ? {
                                ...c,
                                impressionsCount: c.impressionsCount + 1,
                                totalSpent: c.pricingModel === 'cpm' ? c.totalSpent + ((c.cpmRate || 1.0) / 1000) : c.totalSpent
                              }
                            : c
                        )
                      );
                      logAdEvent({
                        campaignId: camp.id,
                        slotId: 'platform_banner',
                        viewerId: currentUserId || null,
                        eventType: 'impression'
                      }).catch(() => {});
                    }
                  }}
                  onFraudDetected={(flag) => {
                    const newFlag: FraudFlag = {
                      id: `ff_${Date.now()}`,
                      detectedAt: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                      ...flag
                    };
                    setFraudFlags((prev) => [newFlag, ...prev]);
                  }}
                />
              )}

              {/* Main Articles Heading */}
              <div className="flex items-center justify-between px-1">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  {selectedCategory === 'all' ? 'أحدث المقالات المنشورة' : categoryFilters.find((c) => c.id === selectedCategory)?.label}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {filteredArticles.length} مقال متاح
                </span>
              </div>

              {/* Loading Skeletons when refreshing */}
              {isRefreshing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <ArticleCardSkeleton key={n} />
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">
                    لم يتم العثور على مقالات تطابق هذا البحث
                  </h3>
                  <p className="text-xs text-slate-400">
                    جرّب تغيير كلمات البحث أو استعراض قسم آخر من الأقسام.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold active:scale-95 shadow-sm"
                  >
                    عرض جميع المقالات
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredArticles.map((article, idx) => (
                    <React.Fragment key={article.id}>
                    {/* home_feed_1/2 لوضعية "كل الأقسام" فقط، وcategory_feed
                        عند تصفح قسم محدد — بدل عرض موضع الصفحة الرئيسية
                        بالخطأ داخل كل تصنيف. */}
                    {selectedCategory === 'all' && (idx === 6 || idx === 12) && (
                      <AdSlot
                        slotId={idx === 6 ? 'home_feed_1' : 'home_feed_2'}
                        campaigns={campaigns}
                        viewerId={currentUserId || null}
                        adFree={false}
                      />
                    )}
                    {selectedCategory !== 'all' && idx === 6 && (
                      <AdSlot
                        slotId="category_feed"
                        campaigns={campaigns}
                        viewerId={currentUserId || null}
                        adFree={false}
                      />
                    )}
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onSelect={(art) => setReadingArticle(art)}
                      onFollowAuthor={handleToggleFollow}
                      isFollowing={followedWriterIds.includes(article.writerId)}
                      onSaveBookmark={handleToggleBookmark}
                      isSaved={bookmarkedArticleIds.includes(article.id)}
                      onWriterProfileClick={(wId) => {
                        const w = users.find((u) => u.id === wId);
                        if (w) setViewingWriterProfile(w);
                      }}
                    />
                    </React.Fragment>
                  ))}
                </div>
              )}
              </>
              )}
            </div>
          )
        }

        {/* التذييل — روابط الصفحات القانونية مطلوبة في كل صفحة لقبول AdSense */}
        <SiteFooter onOpenLegal={(sec) => setLegalSection(sec)} />
      </main>

      {/* زر عائم لكتابة مقال جديد (ابدأ الكتابة) — في الجهة اليسرى (يُخفى أثناء قراءة مقال لتجنب تضارب الواجهات) */}
      {!readingArticle && !isArticleEditorOpen && currentUser.id !== 'guest' && (
        <button
          id="btn-floating-write"
          type="button"
          onClick={() => {
            setEditingArticle(null);
            setIsArticleEditorOpen(true);
          }}
          aria-label="ابدأ الكتابة"
          title="ابدأ الكتابة"
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

      {/* تلميح "اضغط رجوع مرة أخرى للخروج" — يظهر لثانيتين ونصف فقط عند أول
          ضغطة رجوع لا يوجد بعدها أي نافذة/طبقة لإغلاقها. */}
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
          // كانت هذه الدالة غير ممرّرة إطلاقاً، فكانت كل روابط القائمة
          // الجانبية بلا وظيفة. هنا تُترجم كل قيمة إلى التبويب المقابل.
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
              setWriterActiveTab('articles');
              setActiveTab('profile');
              break;
            case 'campaigns':
              setActiveTab('campaigns');
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
              // الرسائل ليست تبويباً في activeTab أصلاً — إنها نافذة منبثقة
              // مستقلة (DirectMessagesModal) تُفتَح عبر isDirectMessagesOpen،
              // تماماً كما يفعل زر الرسائل في الشريط السفلي (onOpenMessages).
              // ضبط activeTab إلى 'messages' هنا كان لا يفتح شيئاً فعلياً.
              setIsDirectMessagesOpen(true);
              break;
            default:
              setActiveTab('feed');
          }
        }}
      />

      {/* Full Article Reader Modal */}
      {readingArticle && (
        <ArticleReader
          article={readingArticle}
          campaigns={campaigns}
          onClose={() => setReadingArticle(null)}
          onLike={handleLikeArticle}
          isLiked={likedArticleIds.includes(readingArticle.id)}
          onBookmark={handleToggleBookmark}
          isBookmarked={bookmarkedArticleIds.includes(readingArticle.id)}
          onFollowWriter={handleToggleFollow}
          isFollowingWriter={followedWriterIds.includes(readingArticle.writerId)}
          onUnlockArticle={handleUnlockArticle}
          isUnlockedByCurrentUser={unlockedArticleIds.includes(readingArticle.id)}
          comments={comments.filter((c) => c.articleId === readingArticle.id)}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
          onShare={() => handleShareArticle(readingArticle)}
          onRate={(stars) => handleRateArticle(readingArticle.id, stars)}
          myRating={myRatingsByArticleId[readingArticle.id] || 0}
          onReact={(type) => handleReactToArticle(readingArticle.id, type)}
          sponsoredCampaign={campaigns.find((c) => c.status === 'active' && c.placementType === 'writer')}
          currentUserId={currentUser.id}
          onWriterProfileClick={(wId) => {
            const w = users.find((u) => u.id === wId);
            if (w) {
              setReadingArticle(null);
              setViewingWriterProfile(w);
            }
          }}
        />
      )}

      {/* Writer Article Editor Modal */}
      <ArticleEditorModal
        isOpen={isArticleEditorOpen}
        onClose={() => {
          setIsArticleEditorOpen(false);
          setEditingArticle(null);
        }}
        onSaveArticle={handleSaveArticle}
        initialArticle={editingArticle}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onConsumeAiQuota={handleConsumeAiQuota}
        onOpenImageStudio={(suggestedPrompt, onSelect) => {
          setImageStudioPrompt(suggestedPrompt || '');
          setImageStudioSelectCallback(() => onSelect || null);
          setIsImageStudioOpen(true);
        }}
      />

      {/* AI Image Generation Studio Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => {
          setIsImageStudioOpen(false);
          setImageStudioSelectCallback(null);
        }}
        currentUser={currentUser}
        initialPrompt={imageStudioPrompt}
        onSelectImage={(url) => {
          if (imageStudioSelectCallback) {
            imageStudioSelectCallback(url);
          }
        }}
        onOpenWallet={() => {
          setIsImageStudioOpen(false);
          setIsWalletOpen(true);
        }}
        onOpenAuth={() => {
          setIsImageStudioOpen(false);
          setIsAuthOpen(true);
        }}
        onBalanceUpdated={(newBal) => {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === currentUser.id
                ? { ...u, walletBalance: newBal, availableBalance: newBal }
                : u
            )
          );
        }}
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        balance={currentUser.availableBalance || 0}
        pendingBalance={currentUser.pendingEarnings || 0}
        transactions={transactions}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        userRole={currentUser.role}
        isKycVerified={currentUser.isKycVerified || currentUser.kycDetails?.status === 'verified'}
        onOpenKyc={() => {
          setIsWalletOpen(false);
          setIsKycOpen(true);
        }}
      />

      {/* نافذة الإيداع والسحب */}
      <MoneyRequestModal
        isOpen={moneyModalMode !== null}
        onClose={() => setMoneyModalMode(null)}
        mode={moneyModalMode || 'deposit'}
        currentUser={currentUser}
        requests={moneyModalMode === 'deposit' ? depositRequests : payoutRequests}
      />

      {/* نافذة ترويج المقال */}
      <PromoteArticleModal
        isOpen={promotingArticle !== null}
        onClose={() => setPromotingArticle(null)}
        article={promotingArticle}
        currentUser={currentUser}
      />

      {/* KYC Modal */}
      <KycModal
        isOpen={isKycOpen}
        onClose={() => setIsKycOpen(false)}
        currentKyc={currentUser.kycDetails}
        onSaveKyc={handleSaveKyc}
        userRole={currentUser.role}
      />

      {/* AI Assistant Chat Modal */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        userRole={currentUser.role}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onConsumeAiQuota={handleConsumeAiQuota}
        guestIdentityUid={guestIdentityUid}
      />

      {/* AI Pro Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        currentUser={currentUser}
        onUpgradeSuccess={handleUpgradeSuccess}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
      />

      {/* Direct Messages Chat Modal */}
      <DirectMessagesModal
        isOpen={isDirectMessagesOpen}
        onClose={() => setIsDirectMessagesOpen(false)}
        currentUser={currentUser}
        users={users}
        conversations={conversations}
        messages={messages}
        campaigns={campaigns}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onDeleteConversation={handleDeleteConversation}
        onHideConversation={handleHideConversation}
        onToggleBlock={handleToggleBlockUser}
        onToggleMute={handleToggleMuteUser}
        onReportUser={handleReportUser}
        onSetTyping={handleSetTyping}
        activeChatPartner={activeChatPartner}
        onOpenConversation={(partnerId) => {
          // معرّفات الرسائل غير المقروءة الواردة من هذا الطرف — من القائمة
          // المُشترَك بها أصلاً محلياً، بدل استعلام Firestore جديد (كان
          // مرفوضاً بصلاحيات لأي حساب غير أدمن — انظر شرح markMessagesReadByIds).
          const unreadIds = messages
            .filter((m) => m.senderId === partnerId && m.recipientId === currentUser.id && !m.isRead)
            .map((m) => m.id);
          if (unreadIds.length === 0) return;

          // تحديث محلي فوري أولاً — لا ننتظر جولة Firestore كاملة قبل
          // اختفاء الشارة، فيبقى المستخدم يرى "غير مقروء" لثوانٍ رغم أنه
          // يقرأ الرسالة أمامه فعلياً على شبكة بطيئة.
          setMessages((prev) =>
            prev.map((m) => (unreadIds.includes(m.id) ? { ...m, isRead: true } : m))
          );
          markMessagesReadByIds(unreadIds).catch((err) =>
            console.error('تعذر تعليم الرسائل كمقروءة:', err)
          );
        }}
        onOpenProfile={(userId) => {
          const u = users.find((usr) => usr.id === userId);
          if (u) setViewingWriterProfile(u);
        }}
      />

      {/* نافذة قائمة متابِعون/يتابع — كانت الأعداد في الملف الشخصي أرقاماً
          غير قابلة للضغط فقط، دون أي وسيلة لعرض القائمة الفعلية للأشخاص. */}
      {followListModal && (
        <FollowListModal
          title={followListModal.title}
          users={followListModal.userIds
            .map((id) => users.find((u) => u.id === id))
            .filter((u): u is User => Boolean(u))}
          currentUserId={currentUserId || null}
          followedWriterIds={followedWriterIds}
          onToggleFollow={handleToggleFollow}
          onSelectUser={(u) => {
            if (u.id === currentUserId) {
              setActiveTab('profile');
            } else {
              setViewingWriterProfile(u);
            }
          }}
          onClose={() => setFollowListModal(null)}
        />
      )}

      {/* Notifications Modal — التحديد كمقروء والحذف كانا يعدّلان الحالة
          المحلية فقط دون أي كتابة فعلية إلى Firestore، فيعود كل شيء
          "غير مقروء" فور تحديث الصفحة (subscribeToNotifications يعيد
          القيم الحقيقية من الخادم). أصبحت الآن كتابات فعلية. */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          markAllNotificationsReadInFirestore(notifications).catch((err) =>
            console.error('تعذر تحديد كل الإشعارات كمقروءة:', err)
          );
        }}
        onMarkOneAsRead={(id) => {
          markNotificationReadInFirestore(id).catch((err) =>
            console.error('تعذر تحديد الإشعار كمقروء:', err)
          );
        }}
        onDeleteOne={(id) => {
          deleteNotificationInFirestore(id).catch((err) =>
            console.error('تعذر حذف الإشعار:', err)
          );
        }}
        onClearAll={() => {
          clearAllNotificationsInFirestore(notifications).catch((err) =>
            console.error('تعذر مسح الإشعارات:', err)
          );
        }}
        onNotificationClick={(notif) => {
          // مقال (إعجاب/تعليق/رد/مشاركة على مقال) → فتح المقال نفسه.
          if (notif.articleId) {
            const art = articles.find((a) => a.id === notif.articleId);
            if (art) {
              setIsNotificationsOpen(false);
              setReadingArticle(art);
              return;
            }
          }
          // متابعة، أو تفاعل على تغريدة (لا صفحة مستقلة للتغريدة نفسها) →
          // فتح الملف الشخصي لصاحب الحدث.
          if (notif.actorId) {
            const actor = users.find((u) => u.id === notif.actorId);
            if (actor) {
              setIsNotificationsOpen(false);
              setViewingWriterProfile(actor);
            }
          }
        }}
      />

      {/* Google Play 20-Tester Beta Modal */}
      <BetaTesting20Modal
        isOpen={isBeta20Open}
        onClose={() => setIsBeta20Open(false)}
      />

      {/* Reader & Advertiser Campaign Creation Modal */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onCreateCampaign={handleCreateCampaign}
        userBalance={currentUser.walletBalance || 0}
        onOpenDeposit={() => {
          setIsNewCampaignOpen(false);
          setIsWalletOpen(true);
        }}
      />

      {/* Authentication Modal */}
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
    </div>
  );
}
export default App;
