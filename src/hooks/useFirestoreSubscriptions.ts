import React, { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  fetchUserFromFirestore,
  createOrUpdateUserDoc,
  completeRedirectSignIn,
  getAndClearPendingRole,
  handleEmailVerificationFromUrl,
  getPasswordResetCodeFromUrl
} from '../firebase';
import { rememberAccount } from '../utils/savedAccounts';
import { trackVisit } from '../services/analyticsApi';
import { resetAdSlotCounter } from '../components/AdSlot';
import {
  subscribeToArticles,
  subscribeToCampaigns,
  subscribeToUsers,
  subscribeToFraudFlags,
  subscribeToEarnings,
  subscribeToAllEarningsAdmin,
  subscribeToManualBalanceAdjustments,
  subscribeToPromotions,
  subscribeToMoneyRequests,
  subscribeToAdEvents,
  subscribeToFollows,
  subscribeToComments,
  subscribeToArticleLikes,
  subscribeToArticleRatings,
  subscribeToTweets,
  subscribeToTweetComments,
  subscribeToTweetLikes,
  subscribeToTweetFavorites,
  subscribeToNotifications,
  subscribeToArticlePurchases,
  subscribeToConversations,
  subscribeToMessages,
  updateMyPresence,
  saveFcmToken,
  EarningRecord
} from '../services/firestoreService';
import { User, Article, AdCampaign, FraudFlag, Transaction, Comment, Tweet, TweetComment, AppNotification } from '../types';
import { LegalSection } from '../components/LegalPages';

export function useEarlySubscriptionsAndAuth(params: {
  activeTab: string;
  isAuthenticated: boolean;
  currentUser: User;
  currentUserId: string;
  setCurrentUserId: React.Dispatch<React.SetStateAction<string>>;
  setGuestIdentityUid: React.Dispatch<React.SetStateAction<string>>;
  isLoggingOutRef: React.MutableRefObject<boolean>;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  setArticlesLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setFraudFlags: React.Dispatch<React.SetStateAction<FraudFlag[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setEarningsRecords: React.Dispatch<React.SetStateAction<EarningRecord[]>>;
  setManualBalanceAdjustments: React.Dispatch<React.SetStateAction<any[]>>;
  setShowLandingPage: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  setAuthTriggerError: React.Dispatch<React.SetStateAction<string | null>>;
  setPasswordResetCode: React.Dispatch<React.SetStateAction<string | null>>;
  setLegalSection: React.Dispatch<React.SetStateAction<LegalSection | null>>;
  sharedArticleLinkHandledRef: React.MutableRefObject<boolean>;
  setReadingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  setPromotions: React.Dispatch<React.SetStateAction<any[]>>;
  depositRequests: any[];
  setDepositRequests: React.Dispatch<React.SetStateAction<any[]>>;
  payoutRequests: any[];
  setPayoutRequests: React.Dispatch<React.SetStateAction<any[]>>;
  purchaseRequests: any[];
  setPurchaseRequests: React.Dispatch<React.SetStateAction<any[]>>;
  setAdEvents: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const {
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
    setAuthTriggerError,
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
  } = params;

  // تسجيل زيارات حقيقية لكل تنقّل فعلي بين الأقسام الرئيسية (وليس بيانات
  // وهمية محلية) — يغذي قسم "إحصاءات عامة" في لوحة الأدمن. لا يوقف أي شيء
  // إن فشل (fire-and-forget داخل trackVisit نفسها).
  useEffect(() => {
    trackVisit(`/${activeTab}`, `Literium - ${activeTab}`, isAuthenticated ? currentUser.id : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated]);

  // نبضة إبقاء الخادم مستيقظاً من كل جلسة متصفح حقيقية مفتوحة — احتياط
  // ضروري بعد اكتشاف أن جدولة GitHub Actions (health-check.yml) لا تعمل
  // فعلياً بالفاصل الزمني المضبوط في ملفها إطلاقاً: سجل التشغيل الفعلي أظهر
  // تشغيلاً كل 2-5 ساعات بدل كل 10-30 دقيقة كما يقول ملف السير — قيد معروف
  // في جدولة GitHub نفسها ("best effort"، لا ضمان لالتزامها بفاصل زمني دقيق)
  // لا علاقة له بصحة الملف. بما أن مهلة سبات استضافة Render المجانية نحو 15
  // دقيقة خمول فقط، أي جدولة خارجية غير موثوقة الفاصل الزمني لا تكفي وحدها.
  // نبضة من المتصفح نفسه (كل 5 دقائق طالما التطبيق مفتوحاً فعلياً عند أي
  // مستخدم حقيقي) مستقلة تماماً عن موثوقية GitHub، ولا تتطلب أي بنية تحتية
  // إضافية. ⚠️ هذا يقلّل تكرار السبات لا يُلغيه كلياً بالضرورة (لو مرّت فترة
  // طويلة بلا أي زائر على الإطلاق سينام الخادم فعلياً بلا بديل) — الإلغاء
  // الكامل والمضمون 100% يتطلب فقط خطة استضافة لا تُنيم الخدمة أصلاً.
  useEffect(() => {
    const HEARTBEAT_MS = 5 * 60 * 1000;
    const ping = () => {
      fetch('/api/health').catch(() => {
        // فشل النبضة نفسها ليس حرجاً — مجرد محاولة إبقاء إضافية، لا وظيفة أساسية
      });
    };
    ping();
    const interval = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  // Realtime Firestore Collections Subscriptions
  useEffect(() => {
    const unsubArticles = subscribeToArticles((firestoreArticles) => {
      if (firestoreArticles && firestoreArticles.length > 0) {
        setArticles(firestoreArticles);
      }
      setArticlesLoaded(true);
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

    // رابط مباشر لصفحة قانونية (?legal=privacy مثلاً) — مطلوب فعلياً لأول
    // مرة هنا: نماذج نشر التطبيق على متاجر أندرويد البديلة (Samsung Galaxy
    // Store، Amazon Appstore، Uptodown...) تطلب رابط "Privacy Policy URL"
    // عاماً يعمل مباشرة بلا تسجيل دخول ولا فتح تطبيق أولاً — قبل هذا لم يكن
    // هناك أي رابط مباشر إطلاقاً لهذه الصفحات، فقط حالة داخلية تُفتح بالتنقل
    // اليدوي من تذييل الصفحة.
    const legalParam = new URLSearchParams(window.location.search).get('legal');
    if (legalParam === 'privacy' || legalParam === 'terms' || legalParam === 'about' || legalParam === 'contact') {
      setLegalSection(legalParam);
    }

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

  // جسر رمز إشعارات FCM: غلاف WebView الأصيل (MainActivity.kt) يستدعي
  // window.__literiumFcmToken('...') بعد كل تحميل صفحة حقيقي — هو من يملك
  // رمز الجهاز (عبر Firebase Android SDK)، لكنه لا يملك أي سياق مصادقة خاص
  // به (كل تسجيل الدخول يحدث هنا في جافاسكربت الموقع). لو وصل الرمز قبل
  // اكتمال تسجيل الدخول (سباق محتمل عند إقلاع بارد)، يُحفَظ مؤقتاً في
  // pendingFcmTokenRef ويُرسَل فور توفر currentUserId الحقيقي.
  const pendingFcmTokenRef = useRef<string | null>(null);
  useEffect(() => {
    window.__literiumFcmToken = (token: string) => {
      if (currentUserId) {
        saveFcmToken(currentUserId, token);
      } else {
        pendingFcmTokenRef.current = token;
      }
    };
    if (currentUserId && pendingFcmTokenRef.current) {
      saveFcmToken(currentUserId, pendingFcmTokenRef.current);
      pendingFcmTokenRef.current = null;
    }
    return () => {
      delete window.__literiumFcmToken;
    };
  }, [currentUserId]);

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
}

export function useSocialAndContentSubscriptions(params: {
  currentUserId: string;
  followsData: { id: string; followerId: string; followingId: string }[];
  setFollowsData: React.Dispatch<React.SetStateAction<{ id: string; followerId: string; followingId: string }[]>>;
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  setArticleLikes: React.Dispatch<React.SetStateAction<{ id: string; articleId: string; userId: string }[]>>;
  setArticleRatings: React.Dispatch<React.SetStateAction<{ id: string; articleId: string; userId: string; stars: number }[]>>;
  setTweets: React.Dispatch<React.SetStateAction<Tweet[]>>;
  setTweetsLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  setTweetComments: React.Dispatch<React.SetStateAction<TweetComment[]>>;
  setTweetLikes: React.Dispatch<React.SetStateAction<{ id: string; tweetId: string; userId: string }[]>>;
  setFavoritedTweetIds: React.Dispatch<React.SetStateAction<string[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setUnlockedArticleIds: React.Dispatch<React.SetStateAction<string[]>>;
  setRawConversations: React.Dispatch<React.SetStateAction<any[]>>;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setFollowedWriterIds: React.Dispatch<React.SetStateAction<string[]>>;
  activeTab: string;
  readingArticle: Article | null;
  viewingWriterProfile: User | null;
  legalSection: LegalSection | null;
}) {
  const {
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
  } = params;

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
      (firestoreTweets) => {
        setTweets(firestoreTweets);
        setTweetsLoaded(true);
      },
      (e) => {
        console.error('Tweets subscription error:', e);
        setTweetsLoaded(true);
      }
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
}
