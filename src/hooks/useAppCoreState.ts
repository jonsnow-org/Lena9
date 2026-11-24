import { useState, useRef } from 'react';
import { User, Article, AdCampaign, Comment, Transaction, AppNotification, Tweet, TweetComment, FraudFlag, UserRole, LanguageCode, DirectMessage, ArticlePromotion } from '../types';
import { HomeFeedMode } from '../components/HomeFeedModeSwitcher';
import { LegalSection } from '../components/LegalPages';
import { EarningRecord } from '../services/firestoreService';
import { isRunningAsInstalledApp } from '../utils/installState';

export function useAppCoreState() {
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
  // true فور توفر أي بيانات (سواء من ذاكرة التخزين المحلي أو من أول رد
  // فعلي من Firestore) — يميّز "لا نعرف بعد" (يستحق هياكل تحميل) عن "تحقّقنا
  // فعلاً ولا توجد مقالات" (يستحق رسالة فارغة حقيقية). بدونه، أول فتح على
  // جهاز جديد بلا ذاكرة محلية كان يُظهر رسالة "لا توجد مقالات" لجزء من
  // الثانية قبل وصول البيانات الحقيقية، بدل هيكل تحميل يوحي بأن شيئاً يجري.
  const [articlesLoaded, setArticlesLoaded] = useState(() => articles.length > 0);

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
  // بلا ذاكرة تخزين محلي للتغريدات (خلافاً للمقالات) — القائمة فارغة دائماً
  // عند كل فتح للتطبيق حتى وصول أول رد من Firestore، فتُعامَل كـ"تحميل" لا
  // "لا توجد تغريدات" إلى أن يصل ذلك الرد فعلياً (انظر articlesLoaded لنفس
  // المنطق تماماً في المقالات).
  const [tweetsLoaded, setTweetsLoaded] = useState(false);
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
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const [isTweetSearchExpanded, setIsTweetSearchExpanded] = useState<boolean>(false);
  const [tweetSearchQuery, setTweetSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedSeed, setFeedSeed] = useState(() => Date.now());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [tweetComposeFocusTrigger, setTweetComposeFocusTrigger] = useState(0);
  const touchStartPosRef = useRef(0);

  // Active Selected Entity States
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const sharedArticleLinkHandledRef = useRef(false);
  const viewedArticleIdsRef = useRef<Set<string>>(new Set());
  const [viewingWriterProfile, setViewingWriterProfile] = useState<User | null>(null);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [activeChatPartner, setActiveChatPartner] = useState<User | null>(null);

  // Modals visibility
  const [showLandingPage, setShowLandingPage] = useState<boolean>(() => {
    const hasRealSession = Boolean(localStorage.getItem('literium_current_user_id'));
    return !hasRealSession;
  });
  const [isNativeApp] = useState<boolean>(() => isRunningAsInstalledApp());
  const [authModalRole, setAuthModalRole] = useState<UserRole>('reader');
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isKycOpen, setIsKycOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isArticleEditorOpen, setIsArticleEditorOpen] = useState(false);
  const [promotingArticle, setPromotingArticle] = useState<Article | null>(null);
  const [promotions, setPromotions] = useState<ArticlePromotion[]>([]);
  const [legalSection, setLegalSection] = useState<LegalSection | null>(null);
  const [moneyModalMode, setMoneyModalMode] = useState<'deposit' | 'payout' | null>(null);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [followsData, setFollowsData] = useState<{ id: string; followerId: string; followingId: string }[]>([]);
  const [followListModal, setFollowListModal] = useState<{ title: string; userIds: string[] } | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [adEvents, setAdEvents] = useState<any[]>([]);
  const [isDirectMessagesOpen, setIsDirectMessagesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBeta20Open, setIsBeta20Open] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [imageStudioPrompt, setImageStudioPrompt] = useState('');
  const [imageStudioSelectCallback, setImageStudioSelectCallback] = useState<((url: string) => void) | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [passwordResetCode, setPasswordResetCode] = useState<string | null>(null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<
    'overview' | 'analytics' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings'
  >('overview');
  const [writerActiveTab, setWriterActiveTab] = useState<
    'blog' | 'tweet' | 'control_panel'
  >('blog');

  return {
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
  };
}
