import React from 'react';
import { User, Article, AdCampaign, FraudFlag } from '../types';
import { REVENUE_SHARES, WRITER_MONETIZATION_ENABLED } from '../constants/revenueShares';
import { isEligibleForMonetization } from '../utils/creatorEligibility';
import { applySubscriptionUpgrade } from '../utils/aiQuota';
import { evaluateAdEventBatch, calculateEventCost } from '../utils/fraudFilters';
import { SLOT_CONFIG, AdSlotId } from '../components/AdSlot';
import { ExternalAdsConfig } from '../utils/externalAdsStore';
import {
  adminAdjustUserBalance,
  incrementCampaignSpendInFirestore,
  adminLogEarning,
  markAdEventProcessed,
  logFraudFlagToFirestore,
  updateUserSocialLinks,
  updateUserProfileInFirestore,
  updateNotificationPrefs,
  updateUserAiQuotaInFirestore,
  createNotificationInFirestore,
  setMoneyRequestStatus,
  setPromotionStatusInFirestore
} from '../services/firestoreService';

export function useAdminAndUserActions(params: {
  adEvents: any[];
  campaigns: AdCampaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  followsData: { id: string; followerId: string; followingId: string }[];
  articles: Article[];
  externalAdsConfig: ExternalAdsConfig;
  requireAuth: () => boolean;
  currentUser: User;
  purchaseRequests: any[];
  depositRequests: any[];
  payoutRequests: any[];
  processingRequestIdsRef: React.MutableRefObject<Set<string>>;
  setFraudFlags?: React.Dispatch<React.SetStateAction<FraudFlag[]>>;
}) {
  const {
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
  } = params;

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
      // ⚠️ لم يكن أي شيء يكتب هذا لمستند الحملة نفسه سابقاً — totalSpent
      // الظاهر للمعلن في لوحته كان يبقى صفراً عملياً إلى الأبد رغم خصم
      // المبلغ فعلياً من محفظته هنا، ولم يكن هناك أي طريقة لتوقّف الحملة
      // تلقائياً عند استنفاد ميزانيتها.
      const campaignSpend: Record<string, number> = {};

      valid.forEach((ev: any) => {
        const camp: any = campaigns.find((c: any) => c.id === ev.campaignId);
        if (!camp) return;
        const cost = calculateEventCost(ev, camp);
        if (cost <= 0) return;

        if (camp.advertiserId) {
          advertiserSpend[camp.advertiserId] = (advertiserSpend[camp.advertiserId] || 0) + cost;
        }
        campaignSpend[camp.id] = (campaignSpend[camp.id] || 0) + cost;
        // ⚠️ لا تُحتسب حصة الكاتب إلا إذا استوفى شروط منشئ المحتوى (متابعون
        // + مشاهدات صالحة + عمر حساب + عدد مقالات) وتحقق هويته (KYC) معاً.
        // الإعلان نفسه يستمر بالعرض بشكل طبيعي — القيد هنا على "احتساب"
        // الأرباح فقط، تماماً كما لا نمنع الكتابة والنشر بأي حال.
        if (ev.writerId) {
          const writerUser = users.find((u) => u.id === ev.writerId);
          const writerFollowersCount = followsData.filter((f) => f.followingId === ev.writerId).length;
          if (WRITER_MONETIZATION_ENABLED && isEligibleForMonetization(writerUser, articles, writerFollowersCount)) {
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

      // 2.5) تحديث الإنفاق الفعلي على مستند كل حملة + إيقافها تلقائياً
      // ("مكتملة") فور استنفاد ميزانيتها بالكامل — بدون هذه الخطوة كان
      // totalSpent يبقى صفراً في قاعدة البيانات مهما بلغ الإنفاق الحقيقي،
      // ولا يوجد أي آلية توقف الحملة عند نفاد رصيدها.
      for (const [campId, spend] of Object.entries(campaignSpend)) {
        const camp: any = campaigns.find((c: any) => c.id === campId);
        if (!camp) continue;
        const roundedSpend = Number(spend.toFixed(4));
        const estimatedNewTotal = (camp.totalSpent || 0) + roundedSpend;
        const budgetExhausted = camp.totalBudget > 0 && estimatedNewTotal >= camp.totalBudget;
        try {
          await incrementCampaignSpendInFirestore(campId, roundedSpend, budgetExhausted);
          setCampaigns((prev) =>
            prev.map((c) =>
              c.id === campId
                ? { ...c, totalSpent: (c.totalSpent || 0) + roundedSpend, status: budgetExhausted ? 'completed' : c.status }
                : c
            )
          );
        } catch (err) {
          console.error(`تعذر تحديث إنفاق الحملة ${campId}:`, err);
        }
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
      // نفس فلاتر الاحتيال المطبقة على الحملات الداخلية — لم يكن هذا المسار يفحص
      // شيئاً إطلاقاً، فكانت مشاهدة الكاتب لإعلانات مقاله نفسه تُدفع له.
      const { suspicious } = evaluateAdEventBatch(sorted as any, {});
      const suspiciousIds = new Set(suspicious.map((e) => e.id));

      unprocessed.forEach((ev: any) => {
        if (suspiciousIds.has(ev.id)) {
          skippedEvents.push(ev);
          return;
        }
        const slotConfig = SLOT_CONFIG[ev.slotId as AdSlotId];
        const writerShare = slotConfig?.writerShare ?? 0;
        if (!ev.writerId || writerShare <= 0) {
          skippedEvents.push(ev);
          return;
        }
        const writerUser = users.find((u) => u.id === ev.writerId);
        const writerFollowersCount = followsData.filter((f) => f.followingId === ev.writerId).length;
        if (!WRITER_MONETIZATION_ENABLED || !isEligibleForMonetization(writerUser, articles, writerFollowersCount)) {
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
          (skippedEvents.length > 0 ? ` (${skippedEvents.length} مشاهدة لم تُحتسب: كاتب غير مؤهل بعد أو نشاط مشبوه أو مكرر)` : '') +
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

  const handleSaveNotificationPrefs = async (prefs: NonNullable<User['notificationPrefs']>) => {
    if (!requireAuth()) return;
    try {
      await updateNotificationPrefs(currentUser.id, prefs);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, notificationPrefs: prefs } : u)));
    } catch (err) {
      console.error('تعذر حفظ إعدادات الإشعارات:', err);
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
        if (WRITER_MONETIZATION_ENABLED && writer && isEligibleForMonetization(writer, articles, writerFollowersCount)) {
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

  return {
    handleProcessAdEvents,
    handleProcessExternalAdRevenue,
    handleSaveSocialLinks,
    handleSaveProfile,
    handleSaveNotificationPrefs,
    handleUpdatePurchaseRequest,
    handleUpdateMoneyRequest,
    handleUpdatePromotionStatus
  };
}
