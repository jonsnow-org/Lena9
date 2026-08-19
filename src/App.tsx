import React, { useState, useEffect, useMemo } from 'react';
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
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

import {
  Article,
  User,
  AdCampaign,
  Comment,
  Transaction,
  AppNotification,
  Conversation,
  DirectMessage,
  ArticleCategory,
  LanguageCode,
  UserRole,
  PaymentMethod,
  KycDetails,
  FraudFlag,
  PricingModel,
  ArticlePromotion
} from './types';

import { REVENUE_SHARES } from './constants/revenueShares';
import { translations } from './data/translations';
import { LandingPage } from './components/LandingPage';
import { TopHeader } from './components/TopHeader';
import { BottomNav } from './components/BottomNav';
import { ArticleCard } from './components/ArticleCard';
import { ArticleCardSkeleton } from './components/ArticleCardSkeleton';
import { FeaturedArticlesSection } from './components/FeaturedArticlesSection';
import { TrendingArticlesSection } from './components/TrendingArticlesSection';
import { SmartAdBanner } from './components/SmartAdBanner';
import { ArticleReader } from './components/ArticleReader';
import { ArticleEditorModal } from './components/ArticleEditorModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdvertiserDashboard } from './components/AdvertiserDashboard';
import { WriterDashboard } from './components/WriterDashboard';
import { WriterProfileView } from './components/WriterProfileView';
import { ExploreView } from './components/ExploreView';
import { AdsRevenueView } from './components/AdsRevenueView';
import { UserProfileView } from './components/UserProfileView';
import { WalletModal } from './components/WalletModal';
import { KycModal } from './components/KycModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { DirectMessagesModal } from './components/DirectMessagesModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BetaTesting20Modal } from './components/BetaTesting20Modal';
import { PoliciesModal } from './components/PoliciesModal';
import { AuthModal } from './components/AuthModal';
import { DrawerMenu } from './components/DrawerMenu';
import { SubscriptionModal } from './components/SubscriptionModal';
import { NewCampaignModal } from './components/NewCampaignModal';
import { consumeAiUsage, applySubscriptionUpgrade } from './utils/aiQuota';
import { rememberAccount } from './utils/savedAccounts';
import { PromoteArticleModal } from './components/PromoteArticleModal';
import { LegalPages, LegalSection } from './components/LegalPages';
import { SiteFooter } from './components/SiteFooter';
import { MoneyRequestModal } from './components/MoneyRequestModal';
import { AdSlot, resetAdSlotCounter } from './components/AdSlot';
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
  subscribeToConversations,
  subscribeToMessages,
  logAdEvent,
  createPurchaseRequest,
  updateUserSocialLinks,
  subscribeToAdEvents,
  markAdEventProcessed,
  adminAdjustUserBalance,
  adminLogEarning,
  followUser,
  unfollowUser
} from './services/firestoreService';
import {
  auth,
  fetchUserFromFirestore,
  createOrUpdateUserDoc,
  signInWithGoogle,
  completeRedirectSignIn,
  getAndClearPendingRole,
  getAuthErrorMessage,
  logOut,
  updateUserRoleInFirestore,
  updateWalletBalanceInFirestore,
  recordEarningInFirestore
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
  setUserBannedInFirestore,
  setCampaignStatusInFirestore,
  setArticleStatusInFirestore,
  resolveFraudFlagInFirestore,
  approvePayoutInFirestore
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

  const [comments, setComments] = useState<Comment[]>(() => {
    const saved = localStorage.getItem('literium_comments');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('literium_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('literium_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStartPos, setTouchStartPos] = useState(0);

  // Active Selected Entity States
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
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
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [adEvents, setAdEvents] = useState<any[]>([]);
  const [isDirectMessagesOpen, setIsDirectMessagesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBeta20Open, setIsBeta20Open] = useState(false);
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(false);
  const [policiesInitialTab, setPoliciesInitialTab] = useState<'privacy' | 'terms' | 'restricted'>('privacy');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  // Which internal tab the AdminDashboard shows — lifted here so the
  // bottom nav's admin buttons (overview/fraud/campaigns/moderation/users)
  // can actually control it; AdminDashboard has its own separate tab
  // system from the top-level `activeTab` above.
  const [adminActiveTab, setAdminActiveTab] = useState<
    'overview' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'finance' | 'promotions' | 'settings'
  >('overview');
  // Same lifting pattern for the writer's profile sub-tabs (مقالاتي /
  // الأرباح), which live inside UserProfileView's own tab system.
  const [writerActiveTab, setWriterActiveTab] = useState<
    'articles' | 'stats_earnings' | 'literary_profile' | 'ai_tools'
  >('articles');

  // Current User Object
  const currentUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || GUEST_USER;
  }, [users, currentUserId]);

  const isAuthenticated = currentUser.id !== 'guest';

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

    // fraudFlags and earnings both require a signed-in user per Firestore
    // rules — subscribing unconditionally on every page load (including
    // guest browsing) throws a permission-denied error on each visit.
    let unsubFraud = () => {};
    let unsubEarnings = () => {};

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

    return () => {
      unsubArticles();
      unsubCampaigns();
      unsubUsers();
      unsubFraud();
      unsubEarnings();
    };
  }, [currentUserId]);

  // Firebase Auth Listener — SINGLE SOURCE OF TRUTH for authentication state.
  // Every sign-in path (Google popup, Google redirect, Email/Password) ends up
  // here exactly once. No other function in this app should set currentUserId,
  // showLandingPage, or activeTab in response to a login — that avoids the
  // race conditions between multiple competing handlers we had before.
  useEffect(() => {
    // Finish a Google signInWithRedirect flow (mobile). No-op if there was none.
    completeRedirectSignIn();

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
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
            setActiveTab(user.role === 'writer' || user.role === 'admin' ? 'dashboard' : 'feed');
          }
        } catch (authDocError) {
          console.error('Error synchronizing authenticated user with Firestore:', authDocError);
        }
      } else {
        setCurrentUserId('');
        localStorage.removeItem('literium_current_user_id');
      }
    });

    return () => unsubscribeAuth();
  }, []);

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

  /**
   * احتساب أحداث الإعلانات: يخصم من المعلن ويضيف حصة الكاتب إلى أرباحه
   * المجمّدة، ثم يعلّم كل الأحداث كمعالَجة.
   * الأحداث المشبوهة تُعلَّم كغير صالحة ولا تُحتسب لأي طرف.
   */
  const handleProcessAdEvents = async () => {
    const unprocessed = adEvents.filter((e) => !e.processed);
    if (unprocessed.length === 0) return;

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
        if (ev.writerId) {
          const share = String(ev.slotId || '').startsWith('writer_profile')
            ? REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER
            : REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
          writerEarnings[ev.writerId] = (writerEarnings[ev.writerId] || 0) + cost * share;
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
        `تم الاحتساب: ${valid.length} حدث صالح، و${suspicious.length} حدث مشبوه لم يُحتسب لأي طرف.`
      );
    } catch (err) {
      console.error('تعذر احتساب أحداث الإعلانات:', err);
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

  const handleUpdatePurchaseRequest = async (
    requestId: string,
    status: 'approved' | 'rejected'
  ) => {
    const req = purchaseRequests.find((r) => r.id === requestId);
    if (!req) return;

    try {
      if (status === 'approved') {
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

        if (writer) {
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

  // الاستماع للمحادثات والرسائل الخاصة بالمستخدم الحالي فقط
  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setMessages([]);
      return;
    }
    const unsubConvs = subscribeToConversations(
      currentUserId,
      (list) => {
        setConversations(
          list.map((c: any) => ({
            id: c.id,
            participantIds: c.participants || [],
            lastMessage: c.lastMessage || '',
            lastMessageAt: c.lastMessageAt || '',
            unreadCount: 0
          })) as any
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
    try {
      await setMoneyRequestStatus(collectionName, requestId, status);
    } catch (err) {
      console.error('تعذر تحديث حالة الطلب المالي:', err);
      alert('تعذر تحديث حالة الطلب. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
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
  useEffect(() => {
    localStorage.setItem('literium_comments', JSON.stringify(comments));
  }, [comments]);
  useEffect(() => {
    localStorage.setItem('literium_transactions', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem('literium_notifications', JSON.stringify(notifications));
  }, [notifications]);
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
  }, [theme]);
  useEffect(() => {
    localStorage.setItem('literium_lang', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Translations helper
  const t = translations[language] || translations.ar;

  // Categories list
  const categoryFilters = [
    { id: 'all', label: 'جميع المقالات' },
    { id: 'literature', label: 'الأدب والشعر' },
    { id: 'technology', label: 'التقنية والذكاء الاصطناعي' },
    { id: 'history', label: 'التاريخ والحضارات' },
    { id: 'philosophy', label: 'الفلسفة والفكر' },
    { id: 'business', label: 'ريادة الأعمال والمال' },
    { id: 'science', label: 'العلوم والفضاء' },
    { id: 'health', label: 'الصحة والرفاهية' }
  ];

  // Filtered Articles based on search & category
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchCategory = selectedCategory === 'all' || art.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        art.title.toLowerCase().includes(q) ||
        art.description.toLowerCase().includes(q) ||
        art.writerName.toLowerCase().includes(q) ||
        (art.tags && art.tags.some((tg) => tg.toLowerCase().includes(q)));

      return matchCategory && matchSearch;
    });
  }, [articles, selectedCategory, searchQuery]);

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartPos(e.touches[0].clientY);
    } else {
      setTouchStartPos(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPos > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartPos;
      if (diff > 0) {
        // Apply dampening / logarithmic resistance
        const dampened = Math.min(diff * 0.45, 90);
        setPullDistance(dampened);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 55) {
      handleRefreshFeed();
    }
    setPullDistance(0);
    setTouchStartPos(0);
  };

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      // Give haptic-like visual feedback
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

  // Bookmark Toggle
  const handleToggleBookmark = (articleId: string) => {
    if (!requireAuth()) return;
    setBookmarkedArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  // Like Article & revenue calculation
  const handleLikeArticle = (articleId: string) => {
    if (!requireAuth()) return;
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id === articleId) {
          return {
            ...art,
            likesCount: art.likesCount + 1
          };
        }
        return art;
      })
    );
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
  const handleWriterAdRevenue = (
    campaign: AdCampaign,
    article: Article,
    eventType: 'click' | 'impression'
  ) => {
    logAdEvent({
      campaignId: campaign.id,
      slotId: 'article_top',
      articleId: article.id,
      writerId: article.writerId,
      viewerId: currentUserId || null,
      eventType
    }).catch(() => {
      /* تسجيل الحدث ليس جزءاً من تجربة المستخدم */
    });
  };

  /**
   * شراء مقال مقفول.
   *
   * ⚠️ تغيير جوهري: كان هذا يخصم ويضيف الأرباح في المتصفح مباشرة، وهو
   * ما ترفضه قواعد أمان Firestore ويمكن تزويره من أدوات المطوّر.
   *
   * الآن: يُنشأ طلب شراء بحالة pending، ويعتمده المالك من لوحة الإدارة
   * فيُخصم من محفظة القارئ وتُضاف حصة الكاتب إلى أرباحه المجمّدة.
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
      await createPurchaseRequest({
        buyerId: currentUser.id,
        articleId: article.id,
        articleTitle: article.title,
        writerId: article.writerId,
        price
      });
      alert(
        'تم إرسال طلب الشراء. سيُفتح المقال فور اعتماد الطلب من إدارة المنصة خلال 24 إلى 48 ساعة.'
      );
    } catch (err) {
      console.error('تعذر إنشاء طلب الشراء:', err);
      alert('تعذر إتمام عملية الشراء. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Add Comment / Reply
  const handleAddComment = (articleId: string, content: string, parentCommentId?: string) => {
    if (!requireAuth()) return;
    if (parentCommentId) {
      // Add nested reply
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentCommentId) {
            const newReply = {
              id: `rep_${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.fullName,
              userAvatar: currentUser.avatarUrl,
              userRole: currentUser.role,
              content,
              likesCount: 0,
              isLiked: false,
              createdAt: 'الآن'
            };
            return {
              ...c,
              replies: [...(c.replies || []), newReply]
            };
          }
          return c;
        })
      );
    } else {
      // Add new root comment
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
        createdAt: 'الآن',
        replies: []
      };
      setComments((prev) => [newComment, ...prev]);
    }

    // Increment article comments count
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, commentsCount: a.commentsCount + 1 } : a))
    );
  };

  const handleLikeComment = (commentId: string) => {
    if (!requireAuth()) return;
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, likesCount: c.likesCount + 1, isLiked: true } : c))
    );
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
        rating: 5.0,
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
      setIsWalletOpen(false);
      alert('تم إرسال طلب الإيداع. سيُضاف الرصيد بعد تأكيد وصول المبلغ من إدارة المنصة.');
    } catch (err) {
      console.error('تعذر إنشاء طلب الإيداع:', err);
      alert('تعذر إرسال طلب الإيداع. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // السحب: يُنشئ طلب سحب بحالة pending فقط.
  // المبلغ لا يُخصم من المتصفح — يعتمده المالك بعد التحويل الفعلي.
  const handleWithdraw = async (amount: number, method: PaymentMethod, accountDetail: string) => {
    if (!requireAuth()) return;
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
      setIsWalletOpen(false);
      alert('تم إرسال طلب السحب. تتم المراجعة يدوياً خلال 24 إلى 48 ساعة.');
    } catch (err) {
      console.error('تعذر إنشاء طلب السحب:', err);
      alert('تعذر إرسال طلب السحب. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Consume AI Quota with automatic modal triggers
  const handleConsumeAiQuota = (): boolean => {
    if (!requireAuth()) return false;
    const { allowed, updatedQuota } = consumeAiUsage(currentUser.aiQuota);
    if (!allowed) {
      setIsSubscriptionOpen(true);
      return false;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, aiQuota: updatedQuota } : u))
    );
    return true;
  };

  // Upgrade AI Subscription
  const handleUpgradeSuccess = (plan: 'monthly' | 'annual', paymentMethod: PaymentMethod) => {
    const planPrice = plan === 'monthly' ? 9.99 : 79.99;
    const updatedQuota = applySubscriptionUpgrade(currentUser.aiQuota, plan, paymentMethod);

    const isWalletPay =
      paymentMethod === 'wallet' ||
      paymentMethod === 'محفظة ليتيريوم' ||
      paymentMethod === 'محفظة التطبيق' ||
      (typeof paymentMethod === 'string' && paymentMethod.includes('محفظة'));

    // ⚠️ لا يُخصم أي مبلغ من المتصفح — قواعد الأمان تمنع تعديل الأرصدة.
    // يُنشأ طلب اشتراك يعتمده الأدمن فيخصم المبلغ من محفظة المستخدم.
    if (isWalletPay) {
      const bal = (currentUser as any).walletBalance ?? 0;
      if (bal < planPrice) {
        alert(
          `رصيد محفظتك ($${bal.toFixed(2)}) لا يكفي لهذا الاشتراك ($${planPrice.toFixed(2)}). اشحن محفظتك أولاً.`
        );
        setMoneyModalMode('deposit');
        return;
      }
      createPurchaseRequest({
        buyerId: currentUser.id,
        articleId: `subscription_${plan}`,
        articleTitle: `اشتراك المساعد الذكي (${plan === 'monthly' ? 'شهري' : 'سنوي'})`,
        writerId: '',
        price: planPrice
      }).catch((err) => console.error('تعذر إنشاء طلب الاشتراك:', err));
    }

    // حصة الاستخدام محلية فقط ولا تمثل قيمة مالية
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, aiQuota: updatedQuota } : u))
    );

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'ai_subscription',
      amount: planPrice,
      currency: 'USD',
      status: 'completed',
      paymentMethod,
      referenceId: `SUB-${Date.now().toString().slice(-6)}`,
      description: `اشتراك في باقة الذكاء الاصطناعي (${plan === 'monthly' ? 'باقة Pro الشهرية' : 'باقة Unlimited السنوية VIP'})`,
      createdAt: 'الآن'
    };
    setTransactions((prev) => [newTx, ...prev]);

    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      userId: currentUser.id,
      type: 'system',
      title: '👑 تم تفعيل اشتراك الذكاء الاصطناعي بنجاح!',
      message: `تهانينا! تم ترقية حسابك إلى ${plan === 'monthly' ? 'باقة Pro الشهرية (200 استعلام)' : 'باقة Unlimited السنوية VIP (غير محدود)'}. يمكنك الآن الاستفادة من جميع أدوات Gemini 3.7 Pro فوراً.`,
      isRead: false,
      createdAt: 'الآن'
    };
    setNotifications((prev) => [newNotif, ...prev]);

    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 }
      });
    } catch {}
  };

  // Advertiser Create Campaign
  /**
   * إنشاء حملة إعلانية.
   *
   * ⚠️ تغيير جوهري: كانت الحملة تُنشأ بحالة active وتُخصم تكلفتها من
   * الرصيد في المتصفح مباشرة. قواعد أمان Firestore ترفض ذلك: الحملة يجب
   * أن تبدأ بميزانية صفر وحالة draft، والاعتماد والخصم من الأدمن حصراً.
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
      status: 'draft',
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
      await saveCampaignToFirestore(newCamp);
      alert(
        'تم حفظ الحملة كمسودة. ستُراجع وتُفعّل من إدارة المنصة بعد التحقق من رصيدك خلال 24 إلى 48 ساعة.'
      );
    } catch (err) {
      console.error('تعذر حفظ الحملة:', err);
      alert('تعذر حفظ الحملة. تحقق من اتصالك ثم حاول مجدداً.');
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
  const handleSaveKyc = (kyc: KycDetails) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              isKycVerified: true,
              kycDetails: kyc
            }
          : u
      )
    );
  };

  // Send Direct Message
  // إرسال رسالة عبر Firestore.
  // حقل participants إلزامي في المستندين — بدونه ترفض قواعد الأمان العملية.
  const handleSendMessage = async (recipientId: string, content: string) => {
    if (!requireAuth()) return;
    if (recipientId === currentUserId) return;
    if (!content.trim()) return;

    try {
      const convId = await ensureConversation(currentUserId, recipientId);
      await sendMessageToFirestore({
        conversationId: convId,
        senderId: currentUserId,
        participants: [currentUserId, recipientId],
        text: content.trim()
      });
    } catch (err) {
      console.error('تعذر إرسال الرسالة:', err);
      alert('تعذر إرسال الرسالة. تحقق من اتصالك ثم حاول مجدداً.');
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
    if (role === 'writer' || role === 'advertiser') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('feed');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentUserId('');
    localStorage.removeItem('literium_current_user_id');
    setShowLandingPage(true);
    setActiveTab('feed');
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

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

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
            setActiveTab(currentUser.role === 'writer' || currentUser.role === 'admin' ? 'dashboard' : 'feed');
          }}
          onOpenRegister={(role) => {
            setAuthModalRole(role);
            setAuthModalMode('register');
            setIsAuthOpen(true);
          }}
          onOpenLogin={() => {
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
      </div>
    );
  }

  // الصفحات القانونية — متاحة للزوار غير المسجّلين أيضاً،
  // وبلا أي إعلانات (شرط من سياسات AdSense).
  if (legalSection) {
    return (
      <LegalPages
        section={legalSection}
        onChangeSection={(sec) => setLegalSection(sec)}
        onBack={() => setLegalSection(null)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans antialiased">
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
        onOpenProfile={() => setViewingWriterProfile(currentUser)}
        onOpenLanding={() => setShowLandingPage(true)}
        unreadNotifsCount={unreadNotifsCount}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
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
            onBack={() => setViewingWriterProfile(null)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onFollowWriter={handleToggleFollow}
            followersCount={followsData.filter((f) => f.followingId === viewingWriterProfile.id).length}
            followingCount={followsData.filter((f) => f.followerId === viewingWriterProfile.id).length}
            isFollowing={followedWriterIds.includes(viewingWriterProfile.id)}
            onOpenDirectMessage={(w) => {
              setActiveChatPartner(w);
              setIsDirectMessagesOpen(true);
            }}
          />
        ) : activeTab === 'profile' ? (
          <UserProfileView
            currentUser={currentUser}
            articles={articles}
            bookmarkedArticleIds={bookmarkedArticleIds}
            campaigns={campaigns}
            initialWriterTab={writerActiveTab}
            onWriterTabChange={setWriterActiveTab}
            onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenKyc={() => setIsKycOpen(true)}
            onOpenBeta20={() => setIsBeta20Open(true)}
            onOpenPolicies={() => {
              setPoliciesInitialTab('privacy');
              setIsPoliciesOpen(true);
            }}
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
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
            onSwitchUserRole={handleSwitchRole}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            language={language}
            onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
            onLogout={() => {
              setShowLandingPage(true);
            }}
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
        ) : (activeTab === 'articles' || activeTab === 'saved') && currentUser.role === 'writer' ? (
          <UserProfileView
            currentUser={currentUser}
            articles={articles}
            bookmarkedArticleIds={bookmarkedArticleIds}
            campaigns={campaigns}
            initialWriterTab="articles"
            onWriterTabChange={setWriterActiveTab}
            onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onOpenWallet={() => setIsWalletOpen(true)}
            onOpenKyc={() => setIsKycOpen(true)}
            onOpenBeta20={() => setIsBeta20Open(true)}
            onOpenPolicies={() => {
              setPoliciesInitialTab('privacy');
              setIsPoliciesOpen(true);
            }}
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
            onOpenSubscription={() => setIsSubscriptionOpen(true)}
            onSwitchUserRole={handleSwitchRole}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            language={language}
            onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
            onLogout={() => {
              setShowLandingPage(true);
            }}
          />
        ) : activeTab === 'dashboard' && currentUser.role === 'writer' ? (
          <WriterDashboard
            writer={currentUser}
            articles={articles}
            onOpenArticleEditor={(art) => {
              setEditingArticle(art || null);
              setIsArticleEditorOpen(true);
            }}
            onOpenWallet={() => setIsWalletOpen(true)}
            onSelectArticle={(art) => setReadingArticle(art)}
            onDeleteArticle={handleDeleteArticle}
            onPromoteArticle={(art) => setPromotingArticle(art)}
            promotions={promotions}
            onSaveSocialLinks={handleSaveSocialLinks}
          />
        ) : activeTab === 'campaigns' && currentUser.role === 'advertiser' ? (
          <AdvertiserDashboard
            campaigns={campaigns.filter((c) => c.advertiserId === currentUser.id)}
            onCreateCampaign={handleCreateCampaign}
            onToggleCampaignStatus={handleToggleCampaignStatus}
            advertiserBalance={currentUser.totalEarnings || 0}
            onOpenDeposit={() => setIsWalletOpen(true)}
            activeUsersCount={Math.max(users.length, 1)}
          />
        ) : (activeTab === 'admin' || activeTab.startsWith('admin_')) && currentUser.role === 'admin' ? (
          <AdminDashboard
            currentUser={currentUser}
            users={users}
            articles={articles}
            campaigns={campaigns}
            fraudFlags={fraudFlags}
            transactions={transactions}
            platformBalance={campaigns.reduce((sum, c) => sum + (c.totalSpent || 0), 0)}
            promotions={promotions}
            onSaveSocialLinks={handleSaveSocialLinks}
            onUpdatePromotionStatus={handleUpdatePromotionStatus}
            depositRequests={depositRequests}
            payoutRequests={payoutRequests}
            onUpdateMoneyRequest={handleUpdateMoneyRequest}
            purchaseRequests={purchaseRequests}
            adEvents={adEvents}
            onProcessAdEvents={handleProcessAdEvents}
            onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
            activeTab={adminActiveTab}
            onActiveTabChange={setAdminActiveTab}
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
            onApprovePayout={async (txId) => {
              setTransactions((prev) =>
                prev.map((tx) => (tx.id === txId ? { ...tx, status: 'completed' } : tx))
              );
              await approvePayoutInFirestore(txId);
            }}
            onSelectArticle={(art) => setReadingArticle(art)}
            onSelectUser={(u) => setViewingWriterProfile(u)}
          />
        ) : (
          /* Main Feed View: Available to all users/roles when on 'feed' */
          <div className="space-y-6 animate-android-in">
              {/* Search Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في المقالات، الكُتّاب، الفلسفة، الأدب، التكنولوجيا..."
                    className="w-full ps-10 pe-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 shadow-2xs transition-all text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshFeed}
                    disabled={isRefreshing}
                    className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs transition-all touch-manipulation active:scale-95"
                    title="تحديث قائمة المقالات"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-500' : ''}`} />
                    <span>تحديث</span>
                  </button>
                </div>
              </div>

              {/* Categories Scroll Filter */}
              <div className="relative">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
                  {categoryFilters.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`min-h-[42px] px-4.5 py-2 rounded-2xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
                        selectedCategory === cat.id
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600'
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
              {campaigns.find((c) => c.status === 'active' && c.placementType === 'platform') && (
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
                                totalSpent: c.totalSpent + (c.cpcRate || 0.2)
                              }
                            : c
                        )
                      );
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
                                totalSpent: c.pricingModel === 'cpm' ? c.totalSpent + ((c.cpmRate || 2.5) / 1000) : c.totalSpent
                              }
                            : c
                        )
                      );
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
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold active:scale-95 shadow-sm"
                  >
                    عرض جميع المقالات
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredArticles.map((article, idx) => (
                    <React.Fragment key={article.id}>
                    {/* موضع إعلاني بعد البطاقة السادسة والثانية عشرة */}
                    {(idx === 6 || idx === 12) && (
                      <AdSlot
                        slotId={idx === 6 ? 'home_feed_1' : 'home_feed_2'}
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
            </div>
          )
        }

        {/* التذييل — روابط الصفحات القانونية مطلوبة في كل صفحة لقبول AdSense */}
        <SiteFooter onOpenLegal={(sec) => setLegalSection(sec)} />
      </main>

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
        onOpenWriteAction={() => {
          if (currentUser.role === 'writer') {
            setEditingArticle(null);
            setIsArticleEditorOpen(true);
          } else {
            setIsNewCampaignOpen(true);
          }
        }}
        onOpenCreateCampaign={() => setIsNewCampaignOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenMessages={() => setIsDirectMessagesOpen(true)}
        adminActiveTab={adminActiveTab}
        onAdminNavigate={setAdminActiveTab}
        writerActiveTab={writerActiveTab}
        onWriterNavigate={setWriterActiveTab}
        onOpenProfile={() => {
          setViewingWriterProfile(null);
          setActiveTab('profile');
        }}
        unreadCount={unreadNotifsCount}
      />

      {/* Slide-over Drawer Menu */}
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenKyc={() => setIsKycOpen(true)}
        onOpenBeta20={() => setIsBeta20Open(true)}
        onOpenPolicies={(tab) => {
          setPoliciesInitialTab(tab || 'privacy');
          setIsPoliciesOpen(true);
        }}
        onOpenLegal={(sec) => setLegalSection(sec)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onOpenProfile={() => setViewingWriterProfile(currentUser)}
        onSwitchRole={handleSwitchRole}
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
              setActiveTab('dashboard');
              break;
            case 'admin_fraud':
              setAdminActiveTab('fraud');
              setActiveTab('dashboard');
              break;
            case 'writer_hub':
              setActiveTab('dashboard');
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
          isLiked={false}
          onBookmark={handleToggleBookmark}
          isBookmarked={bookmarkedArticleIds.includes(readingArticle.id)}
          onFollowWriter={handleToggleFollow}
          isFollowingWriter={followedWriterIds.includes(readingArticle.writerId)}
          onUnlockArticle={handleUnlockArticle}
          comments={comments.filter((c) => c.articleId === readingArticle.id)}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
          sponsoredCampaign={campaigns.find((c) => c.status === 'active' && c.placementType === 'writer')}
          currentUserId={currentUser.id}
          onAdClick={(camp, isValid) => {
            if (isValid) {
              setCampaigns((prev) =>
                prev.map((c) =>
                  c.id === camp.id
                    ? { ...c, clicksCount: c.clicksCount + 1, totalSpent: c.totalSpent + (c.cpcRate || 0.2) }
                    : c
                )
              );
              handleWriterAdRevenue(camp, readingArticle, 'click');
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
                        totalSpent: c.pricingModel === 'cpm' ? c.totalSpent + ((c.cpmRate || 2.5) / 1000) : c.totalSpent
                      }
                    : c
                )
              );
              handleWriterAdRevenue(camp, readingArticle, 'impression');
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
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        balance={currentUser.totalEarnings || 0}
        pendingBalance={currentUser.monthlyEarnings || 0}
        transactions={transactions}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        userRole={currentUser.role}
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
        conversations={conversations}
        messages={messages}
        onSendMessage={handleSendMessage}
        activeChatPartner={activeChatPartner}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        }}
      />

      {/* Google Play 20-Tester Beta Modal */}
      <BetaTesting20Modal
        isOpen={isBeta20Open}
        onClose={() => setIsBeta20Open(false)}
      />

      {/* Policies & Terms Modal */}
      <PoliciesModal
        isOpen={isPoliciesOpen}
        onClose={() => setIsPoliciesOpen(false)}
        initialTab={policiesInitialTab}
      />

      {/* Reader & Advertiser Campaign Creation Modal */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onCreateCampaign={handleCreateCampaign}
        userBalance={currentUser.totalEarnings || 0}
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
    </div>
  );
}
export default App;
