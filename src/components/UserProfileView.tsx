import React, { useState, useEffect, useMemo } from 'react';
import {
  User as UserIcon,
  Rocket,
  Wallet,
  ShieldCheck,
  Award,
  BookOpen,
  Bookmark,
  Settings,
  Flame,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Bell,
  PenTool,
  Users,
  Megaphone,
  HelpCircle,
  LogOut,
  Crown,
  Zap,
  Sparkles,
  Clock,
  CheckCircle,
  Calendar,
  Layers,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Sliders,
  Plus,
  Trash2,
  Edit3,
  BarChart3,
  DollarSign,
  Eye,
  Heart,
  Share2,
  FileText,
  AlertCircle,
  ShieldAlert,
  Building,
  Target,
  MousePointerClick,
  Activity,
  Radio,
  UserPlus,
  MessageSquare,
  Star,
  Bot
} from 'lucide-react';
import { User, Article, UserRole, AdCampaign, LanguageCode, ArticlePromotion, FraudFlag, Tweet, TweetComment } from '../types';
import { SocialLinksEditor } from './SocialLinksEditor';
import { EditProfileModal } from './EditProfileModal';
import { TweetCard } from './TweetCard';
import { AdSlot } from './AdSlot';
import { auth, resendVerificationEmail, checkAndReloadEmailVerification, OWNER_ADMIN_EMAIL } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { MailWarning } from 'lucide-react';
import { getCreatorEligibility } from '../utils/creatorEligibility';
import { CreatorEligibilityCard } from './CreatorEligibilityCard';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { MIN_PAYOUT_USD, EARNINGS_HOLD_DAYS } from '../constants/payoutRules';
import {
  getRemainingAiUses,
  formatAiExpiryDate,
  getDaysRemaining,
  getPlanMeta
} from '../utils/aiQuota';
import { ThemePresetKey } from '../constants/themePresets';
import { BackgroundPresetKey } from '../constants/backgroundPresets';
import { ExternalAdsConfig } from '../utils/externalAdsStore';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminFinanceTab } from './admin/AdminFinanceTab';
import { AdminAdsTab } from './admin/AdminAdsTab';
import { AdvertiserDashboard } from './AdvertiserDashboard';
import { AdminContentTab } from './admin/AdminContentTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminFraudTab } from './admin/AdminFraudTab';
import { AdminSettingsTab } from './admin/AdminSettingsTab';
import { AdminAnalyticsTab } from './admin/AdminAnalyticsTab';
import { AdminChatsTab } from './admin/AdminChatsTab';
import { AdminBotsTab } from './admin/AdminBotsTab';
import { BalanceAdjustModal, AdjustableBalanceField } from './admin/BalanceAdjustModal';
import { KycReviewModal } from './admin/KycReviewModal';

type AdminSection =
  | 'overview'
  | 'analytics'
  | 'fraud'
  | 'campaigns'
  | 'moderation'
  | 'chats'
  | 'users'
  | 'promotions'
  | 'money'
  | 'accounting'
  | 'settings'
  | 'bots';

interface UserProfileViewProps {
  currentUser: User;
  articles: Article[];
  bookmarkedArticleIds: string[];
  campaigns?: AdCampaign[];
  onSelectArticle: (article: Article) => void;
  onOpenWallet: () => void;
  onOpenKyc: () => void;
  onOpenBeta20: () => void;
  onOpenPolicies: () => void;
  onOpenArticleEditor: () => void;
  onOpenSubscription?: () => void;
  onSwitchUserRole: (newRole: UserRole) => void;
  onDeleteArticle?: (articleId: string) => void;
  onEditArticle?: (article: Article) => void;
  onPromoteArticle?: (article: Article) => void;
  promotions?: ArticlePromotion[];
  onSaveSocialLinks?: (links: Record<string, string>) => Promise<void> | void;
  onSaveProfile?: (updates: { fullName?: string; penName?: string; companyName?: string; bio?: string; avatarUrl?: string }) => Promise<void> | void;
  onOpenNewCampaign?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  language: LanguageCode;
  onToggleLanguage: () => void;
  onLogout: () => void;
  users?: User[];
  // Lets a parent (the bottom nav) pick which writer sub-tab shows —
  // optional, falls back to internal state so this still works standalone.
  initialWriterTab?: 'blog' | 'tweet' | 'control_panel';
  onWriterTabChange?: (tab: 'blog' | 'tweet' | 'control_panel') => void;
  // ===== تبويبا "التغريد" و"المفضلة" في صفحة الملف الشخصي للكاتب =====
  /** تغريدات هذا المستخدم فقط (مُصفّاة مسبقاً من الأب حسب authorId). */
  tweets?: Tweet[];
  /** كل تعليقات التغريدات — تُصفّى محلياً هنا حسب tweetId عند العرض. */
  tweetComments?: TweetComment[];
  /** معرّفات التغريدات التي أعجب بها المستخدم الحالي (لأي تغريدة، وليس فقط تغريداته). */
  likedTweetIds?: string[];
  favoritedTweetIds?: string[];
  /** التغريدات المُميَّزة بنجمة (قد تكون لكتّاب آخرين) — لعرضها في تبويب "المفضلة". */
  favoritedTweets?: Tweet[];
  onDeleteTweet?: (tweetId: string) => void;
  onToggleTweetLike?: (tweetId: string) => void;
  onToggleTweetFavorite?: (tweetId: string) => void;
  onShareTweet?: (tweet: Tweet) => void;
  onAddTweetComment?: (tweetId: string, content: string, imageUrl?: string) => void;
  onLikeTweetComment?: (commentId: string, isLiking: boolean) => void;
  onReplyToTweetComment?: (commentId: string, content: string) => void;
  /** عدد الكتّاب الذين يتابعهم هذا المستخدم فعلياً (followedWriterIds.length)
   *  — بخلاف currentUser.followingCount المخزَّن الذي لا يُحدَّث أبداً. */
  followingCount?: number;
  /** عدد المتابعين الحقيقي المحسوب من مجموعة follows الفعلية — بخلاف
   *  currentUser.followersCount المخزَّن الذي لا يُحدَّث أبداً من أي مسار.
   *  كان هذا يُمرَّر سابقاً فقط لصفحة "استوديو الكاتب" المنفصلة (WriterDashboard)
   *  التي أُلغيت كوجهة قائمة بذاتها ودُمج محتواها هنا. */
  followersCount?: number;
  onShowFollowers?: () => void;
  onShowFollowing?: () => void;
  /** وسم الحالة الجاهز — نفس المصدر المستخدم في القائمة الجانبية، حتى لا
   *  يظهر الحساب بلقبين مختلفين في صفحتين. */
  memberStatusLabel?: string;
  /** عدّادات الإشعارات المعلَّقة لخانات لوحة الأدمن المجمَّعة في هذه
   *  الصفحة (أدوات المستخدمين/الدفع/الأمان) — اختيارية، تُخفى الشارة
   *  ببساطة إن لم تُمرَّر. */
  pendingKycCount?: number;
  pendingMoneyCount?: number;
  pendingFraudCount?: number;

  // ===================================================================
  // أقسام الإدارة (دور admin فقط) — كانت هذه كلها مبنية داخل مكوّن منفصل
  // AdminDashboard.tsx يُفتح كشاشة مستقلة عن الملف الشخصي (مركز واحد
  // يُعاد الوصول إليه من عدة نقاط دخول). حُذف ذلك المكوّن نهائياً، ونُقل
  // محتوى تبويباته الفعلي إلى قسم "أقسام الإدارة" أسفل هذه الصفحة مباشرة،
  // بنفس تجميع الأقسام المتشابهة (مثلاً القسم المالي يضم أيضاً محاسبة
  // الإعلانات، وقسم الإعلانات يضم أيضاً طلبات ترويج المقالات) — حتى لا
  // يبقى أي مكوّن "لوحة مركزية" منفصل يمكن أن يُعاد إدخاله لاحقاً بالخطأ
  // (كما حدث فعلياً أكثر من مرة عبر استيراد نسخ من AI Studio).
  fraudFlags?: FraudFlag[];
  depositRequests?: any[];
  payoutRequests?: any[];
  purchaseRequests?: any[];
  adEvents?: any[];
  earningsRecords?: {
    id: string;
    userId: string;
    amount: number;
    source: string;
    status: string;
    createdAt: string;
    releasableAt: string;
    description?: string;
  }[];
  /** سجلّ تدقيق كل تعديل رصيد يدوي قام به أي أدمن — يجيب على "من أين جاء
   *  هذا الرصيد؟" لأي حساب بدل أن يبقى الرقم بلا مصدر ظاهر في الواجهة. */
  manualBalanceAdjustments?: any[];
  onUpdateUserRole?: (userId: string, newRole: User['role']) => void;
  onToggleUserVerified?: (userId: string) => void;
  onApproveKyc?: (userId: string) => void;
  onRejectKyc?: (userId: string) => void;
  onBanUser?: (userId: string) => void;
  onUpdateCampaignStatus?: (campaignId: string, status: AdCampaign['status']) => void;
  onReviewCampaign?: (campaignId: string, decision: 'approve' | 'reject') => void;
  onToggleCampaignStatus?: (campaignId: string) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  onUpdateArticleStatus?: (articleId: string, status: Article['status']) => void;
  onResolveFraudFlag?: (flagId: string, action: 'resolved' | 'dismissed') => void;
  onSelectUser?: (user: User) => void;
  onUpdatePromotionStatus?: (promotionId: string, status: 'approved' | 'rejected') => void;
  onProcessAdEvents?: () => void;
  onAdjustBalance?: (
    userId: string,
    field: AdjustableBalanceField,
    amount: number,
    reason: string
  ) => void;
  onUpdatePurchaseRequest?: (requestId: string, status: 'approved' | 'rejected') => void;
  onUpdateMoneyRequest?: (
    collectionName: 'depositRequests' | 'payoutRequests',
    requestId: string,
    status: 'approved' | 'rejected' | 'paid'
  ) => void;
  onReleaseEarning?: (earning: { id: string; userId: string; amount: number }) => void;
  currentThemePreset?: ThemePresetKey;
  onChangeThemePreset?: (preset: ThemePresetKey) => void;
  currentBackgroundPreset?: BackgroundPresetKey;
  onChangeBackgroundPreset?: (preset: BackgroundPresetKey) => void;
  platformAdsEnabled?: boolean;
  onTogglePlatformAds?: (enabled: boolean) => void;
  externalAdsConfig?: ExternalAdsConfig;
  onSaveExternalAdsConfig?: (config: ExternalAdsConfig) => void | Promise<void>;
  publishingBotsEnabled?: boolean;
  onTogglePublishingBots?: (enabled: boolean) => void | Promise<void>;
  onSeedBotAccounts?: () => Promise<{ created: number; alreadyExisted: number; total: number }>;
  followersCountByUserId?: Record<string, number>;
  onBroadcastMessage?: (text: string) => Promise<{ sent: number; failed: number }>;
  // نفس نمط initialWriterTab/onWriterTabChange أعلاه، لكن لأقسام الإدارة —
  // يتحكم بها الشريط السفلي أو القائمة الجانبية لفتح قسم إداري محدد مباشرة.
  initialAdminSection?: AdminSection;
  onAdminSectionChange?: (section: AdminSection) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  articles = [],
  bookmarkedArticleIds = [],
  campaigns = [],
  onSelectArticle,
  onOpenWallet,
  onOpenKyc,
  onOpenBeta20,
  onOpenPolicies,
  onOpenArticleEditor,
  onOpenSubscription,
  onSwitchUserRole,
  onDeleteArticle,
  onEditArticle,
  onPromoteArticle,
  promotions = [],
  onSaveSocialLinks,
  onSaveProfile,
  onOpenNewCampaign,
  theme,
  onToggleTheme,
  language,
  onToggleLanguage,
  onLogout,
  users = [],
  initialWriterTab,
  onWriterTabChange,
  followingCount,
  followersCount,
  onShowFollowers,
  onShowFollowing,
  memberStatusLabel = 'قارئ مسجل',
  pendingKycCount = 0,
  pendingMoneyCount = 0,
  pendingFraudCount = 0,
  fraudFlags = [],
  depositRequests = [],
  payoutRequests = [],
  purchaseRequests = [],
  adEvents = [],
  earningsRecords = [],
  manualBalanceAdjustments = [],
  onUpdateUserRole,
  onToggleUserVerified,
  onApproveKyc,
  onRejectKyc,
  onBanUser,
  onUpdateCampaignStatus,
  onReviewCampaign,
  onToggleCampaignStatus,
  onDeleteCampaign,
  onUpdateArticleStatus,
  onResolveFraudFlag,
  onSelectUser,
  onUpdatePromotionStatus,
  onProcessAdEvents,
  onAdjustBalance,
  onUpdatePurchaseRequest,
  onUpdateMoneyRequest,
  onReleaseEarning,
  currentThemePreset,
  onChangeThemePreset,
  currentBackgroundPreset,
  onChangeBackgroundPreset,
  platformAdsEnabled,
  onTogglePlatformAds,
  publishingBotsEnabled,
  onTogglePublishingBots,
  onSeedBotAccounts,
  externalAdsConfig,
  onSaveExternalAdsConfig,
  followersCountByUserId,
  onBroadcastMessage,
  initialAdminSection,
  onAdminSectionChange,
  tweets = [],
  tweetComments = [],
  likedTweetIds = [],
  favoritedTweetIds = [],
  favoritedTweets = [],
  onDeleteTweet,
  onToggleTweetLike,
  onToggleTweetFavorite,
  onShareTweet,
  onAddTweetComment,
  onLikeTweetComment,
  onReplyToTweetComment
}) => {
  const safeArticles = Array.isArray(articles) ? articles : [];
  const safeBookmarkedIds = Array.isArray(bookmarkedArticleIds) ? bookmarkedArticleIds : [];
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  // حملات بحالة "pending" — تُموَّل تلقائياً فور إنشائها الآن، فهذا العدد
  // يعكس فعلياً حملات فشل تمويلها (رصيد المعلن غير كافٍ وقت الإنشاء) لا
  // حملات بانتظار اعتماد يدوي.
  const pendingCampaignsCount = safeCampaigns.filter((c) => c.status === 'pending').length;

  // Common Active Tab state
  const [internalWriterTab, setInternalWriterTab] = useState<'blog' | 'tweet' | 'control_panel'>('blog');
  // Controlled-if-provided: the bottom nav's "مقالاتي" / "الأرباح" buttons
  // drive this when a parent supplies initialWriterTab/onWriterTabChange;
  // otherwise this screen manages its own tab like before.
  const writerTab = initialWriterTab ?? internalWriterTab;
  const setWriterTab = onWriterTabChange ?? setInternalWriterTab;
  // اختصارات فرعية داخل كل قسم من الأقسام الثلاثة — "مدونة" تفتح افتراضياً
  // على مقالاتي مع اختصار للمحفوظة، "تغريد" على تغريداتي مع اختصار
  // للمفضلة، و"لوحة التحكم" تجمع الإعلانات والأرباح والإعدادات الأدبية
  // خلف زر واحد بدل تشتيتها كتبويبات منفصلة في الأعلى.
  const [blogSubView, setBlogSubView] = useState<'articles' | 'bookmarks'>('articles');
  const [tweetSubView, setTweetSubView] = useState<'mine' | 'favorites'>('mine');
  const [controlPanelSubView, setControlPanelSubView] = useState<'ads' | 'earnings' | 'literary'>('ads');

  // نفس نمط writerTab أعلاه، لأقسام الإدارة (دور admin) — كانت تُتحكَّم من
  // مكوّن AdminDashboard.tsx المنفصل والمحذوف الآن؛ منطقه (الحالة، الطي
  // بين money/accounting وcampaigns/promotions، حساب المقاييس) منقول هنا
  // بالكامل بلا تغيير وظيفي.
  const [internalAdminSection, setInternalAdminSection] = useState<AdminSection>('overview');
  const adminSection = initialAdminSection ?? internalAdminSection;
  const setAdminSection = onAdminSectionChange ?? setInternalAdminSection;
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<User | null>(null);
  const [selectedUserForKyc, setSelectedUserForKyc] = useState<User | null>(null);
  const [financeSubTab, setFinanceSubTab] = useState<
    'payouts' | 'deposits' | 'releasable' | 'locked_sales' | 'ad_accounting'
  >('payouts');
  const [adsSubTab, setAdsSubTab] = useState<'ad_campaigns' | 'promotions' | 'external_networks'>(
    'ad_campaigns'
  );

  const handleAdminNavigate = (tab: string, subTab?: string) => {
    if (tab === 'money') {
      if (subTab) setFinanceSubTab(subTab as any);
      setAdminSection('money');
    } else if (tab === 'accounting') {
      setFinanceSubTab('ad_accounting');
      setAdminSection('money');
    } else if (tab === 'campaigns') {
      if (subTab) setAdsSubTab(subTab as any);
      setAdminSection('campaigns');
    } else if (tab === 'promotions') {
      setAdsSubTab('promotions');
      setAdminSection('campaigns');
    } else {
      setAdminSection(tab as AdminSection);
    }
  };

  const effectiveAdminSection = useMemo(() => {
    if (adminSection === 'accounting') return 'money';
    if (adminSection === 'promotions') return 'campaigns';
    return adminSection;
  }, [adminSection]);

  const adminMetrics = useMemo(() => {
    const totalPlatformAdRevenue = safeCampaigns
      .filter((c) => c.placementType === 'platform' || c.type === 'fixed')
      .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

    const totalWriterAdRevenue = safeCampaigns
      .filter((c) => c.placementType === 'writer' || c.type === 'cpm' || c.type === 'cpc')
      .reduce((acc, c) => acc + (c.totalSpent || 0), 0);

    const platformAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM;
    const writersAdSenseCut = totalWriterAdRevenue * REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;

    const totalLockedArticlesSales = safeArticles
      .filter((a) => a.isLocked)
      .reduce((acc, a) => acc + (a.revenueFromSales || 0), 0);

    const platformSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM;
    const writersSalesCut = totalLockedArticlesSales * REVENUE_SHARES.LOCKED_ARTICLES.WRITER;

    const netPlatformRevenue = totalPlatformAdRevenue + platformAdSenseCut + platformSalesCut;

    const totalBlockedFraudRevenue = fraudFlags.reduce(
      (acc, f) => acc + (f.revenueBlocked || 0),
      0
    );

    return {
      totalPlatformAdRevenue,
      totalWriterAdRevenue,
      platformAdSenseCut,
      writersAdSenseCut,
      totalLockedArticlesSales,
      platformSalesCut,
      writersSalesCut,
      netPlatformRevenue,
      totalBlockedFraudRevenue
    };
  }, [safeCampaigns, safeArticles, fraudFlags]);

  const pendingAdsCount =
    safeCampaigns.filter((c) => c.status === 'pending').length +
    promotions.filter((p) => p.status === 'pending').length;

  const [writerArticleSubTab, setWriterArticleSubTab] = useState<'published' | 'drafts'>('published');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [verifyEmailStatus, setVerifyEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'verified'>('idle');
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(auth.currentUser?.emailVerified ?? false);

  // استبعاد مالك التطبيق (الأدمن) وحسابات الزوار من متطلبات تأكيد البريد
  const isOwnerOrAdmin = currentUser.role === 'admin' || currentUser.email === OWNER_ADMIN_EMAIL;

  useEffect(() => {
    let isMounted = true;
    const verifyCurrentStatus = async () => {
      if (auth.currentUser && currentUser.id !== 'guest' && !isOwnerOrAdmin) {
        const verified = await checkAndReloadEmailVerification();
        if (isMounted) {
          setIsEmailVerified(verified);
          if (verified) {
            setVerifyEmailStatus('verified');
          }
        }
      }
    };

    // كان الفحص الأولي يعتمد فقط على auth.currentUser عند أول تشغيل لهذا
    // الأثر — لكن currentUserId يُقرأ من localStorage فوراً عند إقلاع
    // التطبيق (قبل أن يُعيد Firebase Auth تأكيد الجلسة فعلياً)، فيُشغَّل هذا
    // الأثر مرة واحدة و auth.currentUser لا يزال null، فيبقى الشرط أعلاه
    // دائم الفشل ويظل شريط "لم يتم تأكيد بريدك" ظاهراً دائماً حتى لمستخدم
    // مؤكَّد فعلاً، إلى أن يبدّل نافذة المتصفح ويعود (focus) بمحض الصدفة.
    // الاشتراك في onAuthStateChanged يضمن إعادة الفحص فوراً بمجرد أن يصبح
    // auth.currentUser جاهزاً فعلياً، بلا انتظار أي حدث خارجي.
    const unsubscribeAuth = onAuthStateChanged(auth, () => {
      verifyCurrentStatus();
    });

    const onFocus = () => {
      verifyCurrentStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      isMounted = false;
      unsubscribeAuth();
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUser.id, isOwnerOrAdmin]);

  const needsEmailVerification =
    currentUser.id !== 'guest' &&
    !isOwnerOrAdmin &&
    !!auth.currentUser?.email &&
    !isEmailVerified;

  const handleResendVerification = async () => {
    setVerifyEmailStatus('sending');
    const ok = await resendVerificationEmail();
    setVerifyEmailStatus(ok ? 'sent' : 'idle');
  };

  const handleCheckVerification = async () => {
    setVerifyEmailStatus('checking');
    const verified = await checkAndReloadEmailVerification();
    setIsEmailVerified(verified);
    setVerifyEmailStatus(verified ? 'verified' : 'idle');
  };

  // Drafts stored locally
  const savedDraft = JSON.parse(localStorage.getItem('literium_article_editor_draft') || '{}');
  const hasDraft = Boolean(savedDraft.title || savedDraft.content);

  // AI Quota computation
  const quotaStats = getRemainingAiUses(currentUser.aiQuota);
  const planMeta = getPlanMeta(currentUser.aiQuota?.plan);
  const expiryFormatted = currentUser.aiQuota?.planExpiresAt
    ? formatAiExpiryDate(currentUser.aiQuota.planExpiresAt)
    : null;
  const daysRemaining = currentUser.aiQuota?.planExpiresAt
    ? getDaysRemaining(currentUser.aiQuota.planExpiresAt)
    : 0;

  // عدد متابعي هذا الحساب الفعلي + حالة الأهلية لاحتساب الأرباح — نفس
  // المصدر المستخدم سابقاً في صفحة "استوديو الكاتب" المستقلة قبل دمجها هنا.
  const realFollowersCount = followersCount ?? currentUser.followersCount ?? 0;
  const creatorEligibility = getCreatorEligibility(currentUser, articles, realFollowersCount);

  // Filter user's articles and bookmarks
  const myAllArticles = safeArticles.filter((a) => a.writerId === currentUser.id);
  const myPublishedArticles = myAllArticles.filter((a) => a.status === 'published' || !a.status);
  const myDraftArticles = myAllArticles.filter((a) => a.status === 'draft');
  const bookmarkedArticles = safeArticles.filter((a) => safeBookmarkedIds.includes(a.id));
  const totalMyViews = myPublishedArticles.reduce((sum, a) => sum + (a.viewsCount || 0), 0);
  const totalMyLikes = myAllArticles.reduce((sum, a) => sum + (a.likesCount || 0), 0);
  // تقييم حقيقي فقط: المقالات التي لم تُقيَّم بعد (ratingsCount = 0) لا تُحتسب
  // إطلاقاً في المتوسط — كانت تُحتسب سابقاً كأنها "5 نجوم" افتراضياً، وهو
  // رقم مختلق يُضخّم تقييم أي كاتب لم يحصل على أي تقييم حقيقي بعد.
  const ratedArticles = myPublishedArticles.filter((a) => (a.ratingsCount || 0) > 0);
  const totalRatingsCount = ratedArticles.reduce((sum, a) => sum + (a.ratingsCount || 0), 0);
  const weightedRatingSum = ratedArticles.reduce((sum, a) => sum + (a.rating || 0) * (a.ratingsCount || 0), 0);
  const avgRating = totalRatingsCount > 0
    ? (weightedRatingSum / totalRatingsCount).toFixed(1)
    : null; // null = لا يوجد أي تقييم حقيقي بعد؛ الواجهة تعرض "لا تقييمات بعد" بدل رقم وهمي

  // Advertiser specific metrics — لا تزال مستخدمة في قسم "إعلاناتي وترويجي"
  // بلوحة التحكم.
  const myCampaigns = safeCampaigns.filter((c) => c.advertiserId === currentUser.id || c.advertiserName.includes(currentUser.companyName || currentUser.fullName));

  return (
    <div className="space-y-6 animate-android-in pb-24 max-w-6xl mx-auto">
      {/* Top Main Identity Banner Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm relative overflow-hidden">
        {/* Ambient Gradient Glow depending on role */}
        <div
          className={`absolute top-0 end-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2 opacity-20 ${
            currentUser.role === 'writer'
              ? 'bg-teal-500'
              : currentUser.role === 'advertiser'
              ? 'bg-cyan-500'
              : 'bg-brand-500'
          }`}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5">
          {/* Avatar and Main Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-start">
            <div className="relative">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover shadow-md ring-4 ${
                  currentUser.role === 'writer'
                    ? 'ring-teal-500/20'
                    : currentUser.role === 'advertiser'
                    ? 'ring-cyan-500/20'
                    : 'ring-brand-500/20'
                }`}
              />
              {currentUser.isVerified && (
                <div className="absolute -bottom-1 -end-1 bg-teal-600 text-white rounded-full p-1 shadow-sm ring-2 ring-white dark:ring-slate-900">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              {quotaStats.isSubscriber && (
                <div className="absolute -top-2 -start-2 bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 rounded-full p-1.5 shadow-md ring-2 ring-white dark:ring-slate-900">
                  <Crown className="w-4 h-4 text-slate-950 stroke-[3]" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{currentUser.penName || currentUser.companyName || currentUser.fullName}</span>
                  {/* وسم حالة واحد فقط — نفس المصدر المستخدم في القائمة
                      الجانبية (memberStatusLabel من App.tsx)، بدل أربعة
                      أوسمة منفصلة كانت تتراكم هنا معاً (دور ثابت + أهلية
                      منشئ المحتوى + حالة زائر) وقد تتناقض مع ما تعرضه
                      القائمة الجانبية لنفس الحساب. */}
                  {currentUser.id === 'guest' ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300/50 dark:border-slate-700 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      <span>زائر</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-500/30 flex items-center gap-1">
                      {creatorEligibility.isEligible ? <Award className="w-3 h-3" /> : <PenTool className="w-3 h-3" />}
                      <span>{memberStatusLabel}</span>
                    </span>
                  )}
                  {/* تعديل الاسم/الصورة/النبذة — لم يكن هناك أي مدخل لهذا
                      بعد التسجيل الأولي رغم أن قواعد الأمان تسمح به دائماً
                      لصاحب الحساب. */}
                  {currentUser.id !== 'guest' && onSaveProfile && (
                    <button
                      type="button"
                      onClick={() => setIsEditProfileOpen(true)}
                      title="تعديل الملف الشخصي"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </h2>
              </div>

              <p className="text-xs text-slate-400 font-mono">
                @{currentUser.username} {currentUser.email && `• ${currentUser.email}`}
              </p>

              {needsEmailVerification && (
                <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300">
                  <MailWarning className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold">
                    {verifyEmailStatus === 'sent'
                      ? 'تم إرسال رابط تحقق جديد إلى بريدك الإلكتروني بنجاح.'
                      : 'لم يتم تأكيد بريدك الإلكتروني بعد.'}
                  </span>
                  <div className="flex items-center gap-2 ms-auto">
                    {verifyEmailStatus !== 'sent' && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={verifyEmailStatus === 'sending'}
                        className="text-xs font-bold text-amber-700 dark:text-amber-400 underline hover:text-amber-800 dark:hover:text-amber-200 transition-colors disabled:opacity-60"
                      >
                        {verifyEmailStatus === 'sending' ? 'جارٍ الإرسال...' : 'إعادة إرسال الرابط'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCheckVerification}
                      disabled={verifyEmailStatus === 'checking'}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors disabled:opacity-60"
                      title="فحص حالة التأكيد بعد الضغط على الرابط في بريدك"
                    >
                      <RefreshCw className={`w-3 h-3 ${verifyEmailStatus === 'checking' ? 'animate-spin' : ''}`} />
                      <span>{verifyEmailStatus === 'checking' ? 'جارٍ الفحص...' : 'فحص الحالة'}</span>
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                {currentUser.bio || 'مرحباً بك في ليتيريوم! استمتع بأفضل تجربة أدبية وثقافية متكاملة.'}
              </p>

              {/* Writer Specialties or Advertiser Category */}
              {currentUser.role === 'writer' && currentUser.specialties && currentUser.specialties.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  {currentUser.specialties.map((spec, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              )}

              {/* متابعون / يتابع — الآن زرّان حقيقيان يفتحان قائمة الأشخاص
                  الفعلية (FollowListModal)، وليسا مجرد عدّادين ثابتين كما
                  كانا سابقاً. */}
              {currentUser.id !== 'guest' && (
                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
                  <button
                    type="button"
                    onClick={onShowFollowers}
                    className="text-center sm:text-start hover:opacity-70 transition-opacity"
                  >
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{realFollowersCount.toLocaleString('ar-EG')}</span>
                    <span className="block text-[10px] text-slate-400 font-bold">متابعون</span>
                  </button>
                  <button
                    type="button"
                    onClick={onShowFollowing}
                    className="text-center sm:text-start hover:opacity-70 transition-opacity"
                  >
                    <span className="block text-sm font-black text-slate-900 dark:text-white">{(followingCount ?? currentUser.followingCount ?? 0).toLocaleString('ar-EG')}</span>
                    <span className="block text-[10px] text-slate-400 font-bold">يتابع</span>
                  </button>
                </div>
              )}

              {/* معلومات عن الكاتب — بطاقة موجزة للقراءة فقط (الاختصاص،
                  توثيق الهوية)، تفتح على التعديل الكامل عبر تبويب "إعدادات
                  الملف الأدبي" أسفل الصفحة. */}
              {currentUser.id !== 'guest' && (currentUser.specialties?.length || currentUser.isKycVerified) ? (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400">معلومات عن الكاتب:</span>
                  {currentUser.isKycVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      <span>هوية موثقة</span>
                    </span>
                  )}
                  {currentUser.specialties?.map((spec, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* أزرار الإجراءات — وسم الحالة (الدور/الأهلية) أصبح مصدره الوحيد
              الآن الشارة بجانب الاسم أعلاه، بدل تكراره هنا بصياغة مختلفة. */}
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 justify-center sm:justify-end flex-wrap">
              {/* متاح لأي عضو مسجَّل غير الأدمن — لا يوجد بعد الآن زر FAB
                  مخصص لإنشاء حملة في شريط تنقّل موحّد لا يفرّق بين الأدوار،
                  فهذا المدخل هو الطريق الوحيد لإنشاء إعلان بضغطة واحدة
                  من صفحة الملف الشخصي لأي حساب. */}
              {currentUser.id !== 'guest' && currentUser.role !== 'admin' && (
                <button
                  onClick={onOpenNewCampaign || onOpenWallet}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إنشاء إعلان جديد</span>
                </button>
              )}
              {/* زر "الذهاب إلى لوحة الإدارة" أُزيل من هنا — كان يكرر تماماً
                  زر "فتح لوحة الإدارة الكاملة" في البطاقة الخضراء أدناه
                  (نفس onNavigateToAdmin، نفس الوجهة). بقي مدخل واحد واضح
                  بدل مدخلين متجاورين لنفس الصفحة. */}
              {currentUser.role !== 'admin' && currentUser.id !== 'guest' && (
                <button
                  onClick={onOpenWallet}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5 text-brand-500" />
                  <span>المحفظة (${(currentUser.walletBalance ?? 0).toFixed(2)})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. المدونة والتغريد — متاحة لأي حساب مسجَّل (قارئ/كاتب/معلن)، وليست
          حكراً على دور "كاتب" فقط، تماشياً مع نموذج الحساب الموحّد الذي
          يتيح الكتابة والتغريد والإعلان لأي عضو دون قيد دور. كانت هذه
          القسمة محصورة سابقاً بـ role === 'writer' فقط، فكان القارئ
          والمعلن لا يريان هذا القسم إطلاقاً مهما نشروا من مقالات أو
          تغريدات. */}
      {/* ========================================================================= */}
      {currentUser.id !== 'guest' && currentUser.role !== 'admin' && (
        <div className="space-y-6">
          {/* مدونة / تغريد / لوحة التحكم — ثلاثة أزرار فقط أسفل المحفظة
              وإنشاء إعلان مباشرة، بدل شريط تبويبات مزدحم بسبعة أزرار.
              "مدونة" و"تغريد" هما المحتوى المنشور، و"لوحة التحكم" تجمع كل
              ما هو إدارة/مال/إعدادات (الإعلانات، الأرباح، التوثيق) خلف
              مدخل واحد. */}
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setWriterTab('blog')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
                writerTab === 'blog'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>مدونة</span>
            </button>

            <button
              onClick={() => setWriterTab('tweet')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
                writerTab === 'tweet'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>تغريد</span>
            </button>

            <button
              onClick={() => setWriterTab('control_panel')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
                writerTab === 'control_panel'
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>لوحة التحكم</span>
            </button>
          </div>

          {/* اختصار "مدونة": مقالاتي (افتراضي) أو المقالات المحفوظة */}
          {writerTab === 'blog' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBlogSubView('articles')}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  blogSubView === 'articles'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>مقالاتي</span>
              </button>
              <button
                onClick={() => setBlogSubView('bookmarks')}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  blogSubView === 'bookmarks'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>المقالات المحفوظة ({bookmarkedArticles.length})</span>
              </button>
            </div>
          )}

          {/* اختصار "تغريد": تغريداتي (افتراضي) أو المفضلة */}
          {writerTab === 'tweet' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTweetSubView('mine')}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  tweetSubView === 'mine'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>تغريداتي ({tweets.length})</span>
              </button>
              <button
                onClick={() => setTweetSubView('favorites')}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  tweetSubView === 'favorites'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
                <span>المفضلة ({favoritedTweets.length})</span>
              </button>
            </div>
          )}

          {/* لوحة التحكم: نظرة عامة (بطاقات الأداء) ثم 3 أقسام فرعية */}
          {writerTab === 'control_panel' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold">إجمالي المشاهدات</span>
                    <Eye className="w-4 h-4 text-teal-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {(totalMyViews || 0).toLocaleString()}
                  </h3>
                  <p className="text-[11px] text-teal-600 font-bold mt-1">
                    {myPublishedArticles.length > 0
                      ? `بمعدل ${Math.round(totalMyViews / myPublishedArticles.length)} قراءة لكل مقال`
                      : 'مشاهدات موثقة من القرّاء'}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold">الأرباح التراكمية</span>
                    <DollarSign className="w-4 h-4 text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    ${(currentUser.lifetimeEarnings || 0).toFixed(2)}
                  </h3>
                  <p className="text-[11px] text-amber-600 font-bold mt-1">
                    {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% إعلانات + {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% مبيعات
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold">متوسط التقييم</span>
                    <Award className="w-4 h-4 text-rose-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {avgRating ? `${avgRating} ★` : '—'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    {totalRatingsCount > 0 ? `من ${totalRatingsCount.toLocaleString()} تقييم موثق` : 'لا تقييمات حقيقية بعد'}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold">المقالات المنشورة</span>
                    <FileText className="w-4 h-4 text-amber-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {myPublishedArticles.length}
                  </h3>
                  <p className="text-[11px] text-amber-600 font-bold mt-1">
                    {myDraftArticles.length + (hasDraft ? 1 : 0) > 0 ? `${myDraftArticles.length + (hasDraft ? 1 : 0)} مسودة جاهزة للنشر` : 'جاهزة للجمهور'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setControlPanelSubView('ads')}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    controlPanelSubView === 'ads'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span>إعلاناتي وترويجي ({myCampaigns.length})</span>
                </button>
                <button
                  onClick={() => setControlPanelSubView('earnings')}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    controlPanelSubView === 'earnings'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>سحب الأرباح والتقارير المالية</span>
                </button>
                <button
                  onClick={() => setControlPanelSubView('literary')}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    controlPanelSubView === 'literary'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>إعدادات الملف الأدبي والتوثيق</span>
                </button>
              </div>
            </>
          )}

          {/* Writer Tab: المقالات المحفوظة */}
          {writerTab === 'blog' && blogSubView === 'bookmarks' && (
            <div className="space-y-4">
              {bookmarkedArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bookmarkedArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => onSelectArticle(art)}
                      className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-brand-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="aspect-16/9 rounded-2xl overflow-hidden bg-slate-950 relative">
                          <img
                            src={art.featuredImage}
                            alt={art.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-2 end-2 bg-brand-900/90 text-brand-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            محفوظ
                          </div>
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-2">
                          {art.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{art.description}</p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{art.writerName}</span>
                        <span className="text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                          <span>متابعة القراءة</span>
                          <span>←</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <Bookmark className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">لم تقم بحفظ أي مقالات بعد</h4>
                  <p className="text-xs text-slate-500 mt-1">اضغط على أيقونة الإشارة المرجعية في المقال لحفظه وقراءته لاحقاً.</p>
                </div>
              )}
            </div>
          )}

          {/* Writer Tab: إعلاناتي وترويجي — يعيد استخدام AdvertiserDashboard
              نفسه (نفس المكوّن الظاهر في تبويب "campaigns" العلوي للمعلنين)
              بدل نسخة مصغّرة مكرَّرة كانت تكرر نفس القائمة وزر "إنشاء حملة
              جديدة" بواجهة وسلوك مختلفين قليلاً عن الأصل. */}
          {writerTab === 'control_panel' && controlPanelSubView === 'ads' && (
            <AdvertiserDashboard
              campaigns={myCampaigns}
              onOpenNewCampaign={onOpenNewCampaign || onOpenWallet}
              onToggleCampaignStatus={onToggleCampaignStatus || (() => {})}
              onDeleteCampaign={onDeleteCampaign}
              advertiserBalance={currentUser.walletBalance || 0}
              onOpenDeposit={onOpenWallet}
              activeUsersCount={Math.max((users || []).length, 1)}
            />
          )}

          {/* Writer Tab 1: Articles & Drafts */}
          {writerTab === 'blog' && blogSubView === 'articles' && (
            <div className="space-y-4">
              {/* Sub-tabs for published vs drafts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWriterArticleSubTab('published')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      writerArticleSubTab === 'published'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    المقالات المنشورة ({myPublishedArticles.length})
                  </button>
                  <button
                    onClick={() => setWriterArticleSubTab('drafts')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      writerArticleSubTab === 'drafts'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>المسودات ({myDraftArticles.length + (hasDraft ? 1 : 0)})</span>
                    {hasDraft && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onOpenArticleEditor}
                  title="إنشاء مسودة مقال جديد"
                  aria-label="إنشاء مسودة مقال جديد"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>مقال جديد</span>
                </button>
              </div>

              {writerArticleSubTab === 'published' ? (
                <div className="space-y-3">
                  {myPublishedArticles.length === 0 ? (
                    <div className="text-center py-10 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-400 mb-2">لم تقم بنشر أي مقالات بعد.</p>
                      <button
                        onClick={onOpenArticleEditor}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold"
                      >
                        ابدأ كتابة أول مقال
                      </button>
                    </div>
                  ) : (
                    myPublishedArticles.map((art, artIdx) => (
                      <React.Fragment key={art.id}>
                      {/* موضع reader_profile — داخل قائمة المقالات نفسها كل 6
                          مقالات، وليس شريطاً ثابتاً أعلى الصفحة كما كان سابقاً.
                          مستبعد تماماً لملف مالك المنصة (أدمن) — لا يظهر أي
                          إعلان في ملفه الشخصي إطلاقاً بقرار صريح.
                          احتياط: منصة حديثة الإطلاق بمحتوى قليل قد لا تصل أي
                          قائمة أبداً لـ 7 عناصر (idx=6) — بلا هذا الاحتياط
                          يبقى هذا الموضع بلا أي ظهور فعلي شهوراً. نعرضه أيضاً
                          عند آخر عنصر لقائمة قصيرة (3-5 عناصر) بدل انتظار حد
                          لن يُبلغ قريباً، مع إبقاء موضع واحد فقط لكل صفحة. */}
                      {currentUser.role !== 'admin' &&
                        ((artIdx > 0 && artIdx % 6 === 0) ||
                          (artIdx === myPublishedArticles.length - 1 && myPublishedArticles.length >= 3 && myPublishedArticles.length < 7)) && (
                        <AdSlot slotId="reader_profile" campaigns={safeCampaigns} viewerId={currentUser.id} adFree={false} />
                      )}
                      <div
                        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img
                            src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                            alt={art.title}
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 rounded-xl object-cover shrink-0"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {art.category}
                              </span>
                              {art.isLocked && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                                  مقفول ({art.lockedPrice}$)
                                </span>
                              )}
                            </div>
                            <h4
                              onClick={() => onSelectArticle(art)}
                              className="font-bold text-sm text-slate-900 dark:text-white hover:text-teal-600 cursor-pointer line-clamp-1"
                            >
                              {art.title}
                            </h4>
                            <p className="text-xs text-slate-400">نُشر في: {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('ar-EG') : 'الآن'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                          <div className="text-xs text-slate-500 text-end">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{(art.viewsCount || 0).toLocaleString()}</span> مشاهدة
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const p = promotions.find((pr) => pr.articleId === art.id && pr.status !== 'rejected' && pr.status !== 'expired');
                              if (!p) return null;
                              return (
                                <span
                                  className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                    p.status === 'pending'
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {p.status === 'pending' ? 'ترويج بانتظار المراجعة' : 'ترويج معتمد'}
                                </span>
                              );
                            })()}
                            {onPromoteArticle && (
                              <button
                                onClick={() => onPromoteArticle(art)}
                                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500 hover:text-white text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors"
                                title="ترويج المقال في الصفحة الرئيسية"
                              >
                                <Rocket className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">ترويج</span>
                              </button>
                            )}
                            <button
                              onClick={() => onEditArticle ? onEditArticle(art) : onOpenArticleEditor()}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-500 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
                              title="تعديل المقال"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteArticle && onDeleteArticle(art.id)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {myDraftArticles.map((art) => (
                    <div
                      key={art.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={art.featuredImage || 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'}
                          alt={art.title}
                          className="w-14 h-14 rounded-xl object-cover"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                              مسودة في السحابة
                            </span>
                            <span className="text-xs text-slate-400">{art.category}</span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                            {art.title || 'مسودة بدون عنوان'}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{art.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onEditArticle ? onEditArticle(art) : onOpenArticleEditor()}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                        >
                          متابعة التحرير والنشر
                        </button>
                        {onDeleteArticle && (
                          <button
                            onClick={() => onDeleteArticle(art.id)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300"
                            title="حذف المسودة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {hasDraft && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          مسودة محلية غير محفوظة
                        </span>
                        <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1">
                          {savedDraft.title || 'مسودة مقال أدبي بدون عنوان'}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{savedDraft.description || 'اضغط لمتابعة التحرير والنشر'}</p>
                      </div>
                      <button
                        onClick={onOpenArticleEditor}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm active:scale-95"
                      >
                        متابعة الكتابة والنشر
                      </button>
                    </div>
                  )}

                  {myDraftArticles.length === 0 && !hasDraft && (
                    <div className="text-center py-10 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                      <p className="text-xs text-slate-400">لا توجد مسودات معلقة حالياً.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Writer Tab 2: Earnings & Withdrawals */}
          {writerTab === 'control_panel' && controlPanelSubView === 'earnings' && (
            <div className="space-y-5">
              {/* شروط تفعيل احتساب الأرباح — كانت سابقاً تظهر فقط في صفحة
                  "استوديو الكاتب" المنفصلة (WriterDashboard) التي أُلغيت
                  كوجهة تنقّل قائمة بذاتها؛ محتواها دُمج هنا كي لا يُفقد. */}
              {currentUser.role !== 'admin' && (
                <CreatorEligibilityCard eligibility={creatorEligibility} onOpenKyc={onOpenKyc} />
              )}

              {/* Overview KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[11px] font-bold">إجمالي القراءات</span>
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {myAllArticles.reduce((sum, a) => sum + (a.viewsCount || 0), 0).toLocaleString('ar-EG')}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[11px] font-bold">المتابعون</span>
                    <Heart className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {realFollowersCount.toLocaleString('ar-EG')}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 mb-1.5">
                    <span className="text-[11px] font-bold">المقالات المنشورة</span>
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {myPublishedArticles.length.toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-teal-400">الرصيد المتاح للسحب</span>
                  <h3 className="text-3xl font-black text-white mt-1">${(currentUser.availableBalance ?? 0).toFixed(2)}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    الحد الأدنى للسحب: ${MIN_PAYOUT_USD} • تُراجَع الطلبات يدوياً وتُصرف عبر USDT أو تحويل بنكي بعد فترة تجميد {EARNINGS_HOLD_DAYS} يوماً من تسجيل الأرباح
                  </p>
                </div>
                <button
                  onClick={onOpenWallet}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>طلب سحب الأرباح الآن</span>
                </button>
              </div>

              {/* Earnings breakdown table — computed from this writer's own
                  articles rather than fixed placeholder figures. */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">تفاصيل ومصادر الأرباح</h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">عائد الإعلانات داخل المقالات (حصة الكاتب)</span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      ${myAllArticles.reduce((sum, a) => sum + (a.revenueFromAds || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      مبيعات المقالات المقفولة (حصة الكاتب {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%)
                    </span>
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      ${myAllArticles.reduce((sum, a) => sum + (a.revenueFromSales || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Writer Tab 3: Literary Profile Settings */}
          {writerTab === 'control_panel' && controlPanelSubView === 'literary' && (
            <>
            {onSaveSocialLinks && (
              <SocialLinksEditor currentUser={currentUser} onSave={onSaveSocialLinks} />
            )}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">الملف الأدبي وتوثيق الهوية</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأدبي (Pen Name)</label>
                  <input
                    type="text"
                    defaultValue={currentUser.penName || currentUser.fullName}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">حالة توثيق الكاتب (KYC)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onOpenKyc}
                      className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold"
                    >
                      {currentUser.isKycVerified ? 'الهوية موثقة ✓' : 'تقديم وثائق التوثيق'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* Writer Tab 4: التغريد — تغريدات هذا الكاتب فقط */}
          {writerTab === 'tweet' && tweetSubView === 'mine' && (
            <div className="space-y-3">
              {tweets.length === 0 ? (
                <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">لا توجد تغريدات بعد</p>
                  <p className="text-xs text-slate-400">انشر أول تغريدة من الصفحة الرئيسية — قسم "تغريد".</p>
                </div>
              ) : (
                tweets.map((tweet) => (
                  <TweetCard
                    key={tweet.id}
                    tweet={tweet}
                    currentUser={currentUser}
                    isLiked={likedTweetIds.includes(tweet.id)}
                    isFavorited={favoritedTweetIds.includes(tweet.id)}
                    comments={tweetComments.filter((c) => c.tweetId === tweet.id)}
                    onToggleLike={onToggleTweetLike || (() => {})}
                    onToggleFavorite={onToggleTweetFavorite || (() => {})}
                    onShare={onShareTweet || (() => {})}
                    onDelete={onDeleteTweet}
                    onAddComment={onAddTweetComment || (() => {})}
                    onLikeComment={onLikeTweetComment || (() => {})}
                    onReplyToComment={onReplyToTweetComment || (() => {})}
                  />
                ))
              )}
            </div>
          )}

          {/* Writer Tab 5: المفضلة — تغريدات مُيِّزت بنجمة (قد تكون لكتّاب آخرين) */}
          {writerTab === 'tweet' && tweetSubView === 'favorites' && (
            <div className="space-y-3">
              {favoritedTweets.length === 0 ? (
                <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Star className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">لا توجد تغريدات مفضّلة بعد</p>
                  <p className="text-xs text-slate-400">اضغط على أيقونة النجمة داخل أي تغريدة لحفظها هنا.</p>
                </div>
              ) : (
                favoritedTweets.map((tweet) => (
                  <TweetCard
                    key={tweet.id}
                    tweet={tweet}
                    currentUser={currentUser}
                    isLiked={likedTweetIds.includes(tweet.id)}
                    isFavorited={favoritedTweetIds.includes(tweet.id)}
                    comments={tweetComments.filter((c) => c.tweetId === tweet.id)}
                    onToggleLike={onToggleTweetLike || (() => {})}
                    onToggleFavorite={onToggleTweetFavorite || (() => {})}
                    onShare={onShareTweet || (() => {})}
                    onDelete={onDeleteTweet}
                    onAddComment={onAddTweetComment || (() => {})}
                    onLikeComment={onLikeTweetComment || (() => {})}
                    onReplyToComment={onReplyToTweetComment || (() => {})}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN / OWNER SPECIFIC VIEW — كانت مفقودة تماماً من قبل، فتظهر هذه
          الصفحة لصاحب المنصة فارغة تماماً إلا من زر تسجيل الخروج، رغم أن
          كل بقية الأدوار (قارئ، كاتب، معلن) لها قسم مخصص هنا. */}
      {/* ========================================================================= */}
      {currentUser.role === 'admin' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 p-6 sm:p-8 text-white shadow-xl shadow-brand-600/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">حساب مالك المنصة</h3>
                <p className="text-xs text-brand-100">صلاحيات كاملة على إدارة ليتيريوم</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-brand-100 leading-relaxed mt-3">
              إدارة المستخدمين، مراجعة طلبات السحب والإيداع، اعتماد الحملات الإعلانية، ومتابعة
              التقارير المالية — كل ذلك من لوحة الإدارة المخصصة.
            </p>
            {/* زر "فتح لوحة الإدارة الكاملة" أُزيل من هذه البطاقة عمداً —
                زر "لوحة الإدارة" في الشريط السفلي (المرئي دائماً حتى في
                هذه الشاشة نفسها) هو المدخل الوحيد للوحة الإدارة العامة.
                بقيت المحفظة وحدها لأنها المدخل الوحيد المتاح للأدمن
                للوصول السريع لرصيده من هذه الصفحة تحديداً. */}
            <div className="mt-4">
              <button
                onClick={onOpenWallet}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white text-brand-700 font-extrabold text-xs sm:text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                <span>المحفظة (${(currentUser.availableBalance ?? currentUser.walletBalance ?? 0).toFixed(2)})</span>
              </button>
            </div>
          </div>

          {/* أقسام الإدارة المتخصصة — كل قسم هنا يعرض محتواه الفعلي مباشرة
              (وليس رابطاً لشاشة أخرى)، مجمَّعة حسب الاختصاص: القسم المالي
              يضم أيضاً محاسبة الإعلانات، وقسم الإعلانات يضم أيضاً طلبات
              ترويج المقالات — تماماً كما كانت مجمَّعة داخل AdminDashboard
              المحذوف، لكن بلا شاشة منفصلة له. */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
              أقسام الإدارة والتحكم المتخصصة:
            </h4>

            {/* شريط تبويبات الأقسام */}
            <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800 min-w-max">
                {[
                  { id: 'overview' as const, label: 'نظرة عامة', icon: TrendingUp, badge: 0 },
                  { id: 'analytics' as const, label: 'الإحصائيات والزوار', icon: Activity, badge: 0 },
                  { id: 'money' as const, label: 'العمليات المالية', icon: DollarSign, badge: pendingMoneyCount },
                  { id: 'campaigns' as const, label: 'الإعلانات والترويج', icon: Megaphone, badge: pendingAdsCount },
                  { id: 'moderation' as const, label: 'المحتوى والمقالات', icon: FileText, badge: 0 },
                  { id: 'chats' as const, label: 'مراقبة المحادثات', icon: Eye, badge: 0 },
                  { id: 'users' as const, label: 'المستخدمون وKYC', icon: Users, badge: pendingKycCount },
                  { id: 'fraud' as const, label: 'مكافحة الاحتيال', icon: ShieldAlert, badge: pendingFraudCount },
                  { id: 'bots' as const, label: 'بوتات النشر والتفاعل', icon: Bot, badge: 0 },
                  { id: 'settings' as const, label: 'إعدادات المنظومة', icon: Settings, badge: 0 }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = effectiveAdminSection === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleAdminNavigate(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      {tab.badge > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                            isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* محتوى القسم النشط */}
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-3 sm:p-4">
              {effectiveAdminSection === 'overview' && (
                <AdminOverviewTab
                  currentUser={currentUser}
                  users={users}
                  articles={safeArticles}
                  campaigns={safeCampaigns}
                  fraudFlags={fraudFlags}
                  promotions={promotions}
                  depositRequests={depositRequests}
                  payoutRequests={payoutRequests}
                  purchaseRequests={purchaseRequests}
                  adEvents={adEvents}
                  onNavigateTab={handleAdminNavigate}
                  metrics={adminMetrics}
                />
              )}

              {effectiveAdminSection === 'analytics' && (
                <AdminAnalyticsTab
                  users={users}
                  articles={safeArticles}
                  campaigns={safeCampaigns}
                  depositRequests={depositRequests}
                  payoutRequests={payoutRequests}
                  onSelectUser={onSelectUser}
                  onSelectArticle={onSelectArticle}
                />
              )}

              {effectiveAdminSection === 'money' && (
                <AdminFinanceTab
                  users={users}
                  campaigns={safeCampaigns}
                  depositRequests={depositRequests}
                  payoutRequests={payoutRequests}
                  purchaseRequests={purchaseRequests}
                  adEvents={adEvents}
                  earningsRecords={earningsRecords}
                  manualBalanceAdjustments={manualBalanceAdjustments}
                  initialSubTab={financeSubTab}
                  onUpdateMoneyRequest={onUpdateMoneyRequest}
                  onUpdatePurchaseRequest={onUpdatePurchaseRequest}
                  onReleaseEarning={onReleaseEarning}
                  onProcessAdEvents={onProcessAdEvents}
                  onOpenAdjustBalance={(u) => setSelectedUserForBalance(u)}
                />
              )}

              {effectiveAdminSection === 'campaigns' && (
                <AdminAdsTab
                  campaigns={safeCampaigns}
                  promotions={promotions}
                  users={users}
                  platformAdsEnabled={platformAdsEnabled}
                  onTogglePlatformAds={onTogglePlatformAds}
                  externalAdsConfig={externalAdsConfig}
                  onSaveExternalAdsConfig={onSaveExternalAdsConfig}
                  onUpdateCampaignStatus={onUpdateCampaignStatus}
                  onDeleteCampaign={onDeleteCampaign}
                  onReviewCampaign={onReviewCampaign}
                  onUpdatePromotionStatus={onUpdatePromotionStatus}
                  initialSubTab={adsSubTab}
                />
              )}

              {effectiveAdminSection === 'moderation' && (
                <AdminContentTab
                  articles={safeArticles}
                  users={users}
                  onSelectArticle={onSelectArticle}
                  onUpdateArticleStatus={onUpdateArticleStatus}
                />
              )}

              {effectiveAdminSection === 'chats' && <AdminChatsTab users={users} />}

              {effectiveAdminSection === 'users' && (
                <AdminUsersTab
                  users={users}
                  currentUser={currentUser}
                  onUpdateUserRole={onUpdateUserRole}
                  onToggleUserVerified={onToggleUserVerified}
                  onApproveKyc={onApproveKyc}
                  onRejectKyc={onRejectKyc}
                  onBanUser={onBanUser}
                  onSelectUser={onSelectUser}
                  onBroadcastMessage={onBroadcastMessage}
                  onOpenAdjustBalance={(u) => setSelectedUserForBalance(u)}
                  onOpenKycReview={(u) => setSelectedUserForKyc(u)}
                />
              )}

              {effectiveAdminSection === 'fraud' && (
                <AdminFraudTab
                  fraudFlags={fraudFlags}
                  users={users}
                  onResolveFraudFlag={onResolveFraudFlag}
                  onBanUser={onBanUser}
                  totalBlockedFraudRevenue={adminMetrics.totalBlockedFraudRevenue}
                />
              )}

              {effectiveAdminSection === 'bots' && (
                <AdminBotsTab
                  users={users}
                  publishingBotsEnabled={Boolean(publishingBotsEnabled)}
                  onTogglePublishingBots={onTogglePublishingBots || (() => {})}
                  onSeedBotAccounts={onSeedBotAccounts || (async () => ({ created: 0, alreadyExisted: 0, total: 8 }))}
                />
              )}

              {effectiveAdminSection === 'settings' && (
                <AdminSettingsTab
                  currentThemePreset={currentThemePreset}
                  onChangeThemePreset={onChangeThemePreset}
                  currentBackgroundPreset={currentBackgroundPreset}
                  onChangeBackgroundPreset={onChangeBackgroundPreset}
                />
              )}
            </div>
          </div>

          {/* تعديل رصيد مستخدم يدوياً / مراجعة KYC — نفس المودالين اللذين
              كانا يُفتحان من داخل AdminDashboard المحذوف. */}
          <BalanceAdjustModal
            isOpen={Boolean(selectedUserForBalance)}
            user={selectedUserForBalance}
            onClose={() => setSelectedUserForBalance(null)}
            onAdjustBalance={onAdjustBalance}
          />
          <KycReviewModal
            isOpen={Boolean(selectedUserForKyc)}
            user={selectedUserForKyc}
            onClose={() => setSelectedUserForKyc(null)}
            onApproveKyc={onApproveKyc}
            onRejectKyc={onRejectKyc}
          />
        </div>
      )}

      {/* Logout Row */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onLogout}
          className="px-6 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 border border-rose-200 dark:border-rose-900/40 transition-all active:scale-95"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>

      {onSaveProfile && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          currentUser={currentUser}
          onClose={() => setIsEditProfileOpen(false)}
          onSave={onSaveProfile}
        />
      )}
    </div>
  );
};
