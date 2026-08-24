import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Article, AdCampaign, Transaction, FraudFlag, User, UserRole, Comment, CommentReply, AppNotification, ArticlePromotion, Tweet, TweetComment } from '../types';
import { DEFAULT_FREE_DAILY_LIMIT } from '../utils/aiQuota';

// -------------------------------------------------------------------
// Realtime Subscriptions & CRUD
// -------------------------------------------------------------------

// 1. Articles Collection
export function subscribeToArticles(
  onArticles: (articles: Article[]) => void,
  onError?: (err: any) => void
) {
  const articlesCol = collection(db, 'articles');
  return onSnapshot(
    articlesCol,
    (snapshot) => {
      if (snapshot.empty) {
        // Collection is empty — report an empty list rather than writing
        // demo/mock content into the live database. Any placeholder content
        // shown while empty is handled client-side only (see App.tsx).
        onArticles([]);
        return;
      }
      const list: Article[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data
        } as Article);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
      onArticles(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'articles');
      if (onError) onError(error);
    }
  );
}

export async function saveArticleToFirestore(
  article: Partial<Article>,
  isNew: boolean = false
): Promise<string> {
  try {
    // Strip any undefined keys so Firestore doesn't reject the payload
    const cleanData: Record<string, any> = {};
    Object.entries(article).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanData[key] = val;
      }
    });

    const isExistingDoc =
      !isNew &&
      article.id &&
      !article.id.startsWith('art_temp_') &&
      !article.id.startsWith('draft_temp_') &&
      !article.id.startsWith('art_mock_');

    if (isExistingDoc && article.id) {
      const artRef = doc(db, 'articles', article.id);
      await setDoc(
        artRef,
        {
          ...cleanData,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      return article.id;
    } else {
      const colRef = collection(db, 'articles');
      const nowIso = new Date().toISOString();
      const payload = {
        ...cleanData,
        viewsCount: cleanData.viewsCount ?? 0,
        likesCount: cleanData.likesCount ?? 0,
        sharesCount: cleanData.sharesCount ?? 0,
        commentsCount: cleanData.commentsCount ?? 0,
        purchasesCount: cleanData.purchasesCount ?? 0,
        rating: cleanData.rating ?? 5.0,
        ratingsCount: cleanData.ratingsCount ?? 0,
        revenueFromAds: cleanData.revenueFromAds ?? 0,
        revenueFromSales: cleanData.revenueFromSales ?? 0,
        totalRevenue: cleanData.totalRevenue ?? 0,
        status: cleanData.status || 'published',
        publishedAt: cleanData.status === 'draft' ? '' : (cleanData.publishedAt || nowIso),
        createdAt: nowIso,
        updatedAt: nowIso
      };
      const docRef = await addDoc(colRef, payload);
      // Sync document's internal id field to match the Firestore auto-generated ID
      await updateDoc(docRef, { id: docRef.id });
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'articles');
    throw error;
  }
}

export async function updateArticleStatsInFirestore(
  articleId: string,
  stats: Partial<Pick<Article, 'viewsCount' | 'likesCount' | 'sharesCount' | 'commentsCount' | 'revenueFromAds' | 'revenueFromSales' | 'totalRevenue' | 'purchasesCount'>>
) {
  try {
    const cleanStats: Record<string, any> = {};
    Object.entries(stats).forEach(([k, v]) => {
      if (v !== undefined) cleanStats[k] = v;
    });
    const artRef = doc(db, 'articles', articleId);
    await updateDoc(artRef, cleanStats);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `articles/${articleId}`);
    throw error;
  }
}

export async function deleteArticleFromFirestore(articleId: string) {
  try {
    const artRef = doc(db, 'articles', articleId);
    await deleteDoc(artRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `articles/${articleId}`);
    throw error;
  }
}

// 2. Campaigns Collection
export function subscribeToCampaigns(
  onCampaigns: (campaigns: AdCampaign[]) => void,
  onError?: (err: any) => void
) {
  const campaignsCol = collection(db, 'campaigns');
  return onSnapshot(
    campaignsCol,
    (snapshot) => {
      if (snapshot.empty) {
        onCampaigns([]);
        return;
      }
      const list: AdCampaign[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as AdCampaign);
      });
      onCampaigns(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'campaigns');
      if (onError) onError(error);
    }
  );
}

export async function saveCampaignToFirestore(campaign: Partial<AdCampaign>): Promise<string> {
  try {
    if (campaign.id && !campaign.id.startsWith('camp_temp_')) {
      const campRef = doc(db, 'campaigns', campaign.id);
      await setDoc(campRef, campaign, { merge: true });
      return campaign.id;
    } else {
      const colRef = collection(db, 'campaigns');
      // Firestore يرفض أي حقل بقيمة undefined صراحة (مثل cpmRate/durationHours
      // حين لا ينطبق نموذج التسعير المختار) — نحذفها قبل الإرسال بدل تركها
      // تُفشل addDoc بأكمله.
      const cleanCampaign: Record<string, any> = {};
      Object.entries(campaign).forEach(([k, v]) => {
        if (v !== undefined) cleanCampaign[k] = v;
      });
      const docRef = await addDoc(colRef, {
        ...cleanCampaign,
        impressionsCount: campaign.impressionsCount || 0,
        validImpressionsCount: campaign.validImpressionsCount || 0,
        clicksCount: campaign.clicksCount || 0,
        validClicksCount: campaign.validClicksCount || 0,
        conversionsCount: campaign.conversionsCount || 0,
        totalSpent: campaign.totalSpent || 0,
        fraudShieldScore: campaign.fraudShieldScore || 100,
        blockedFraudClicks: campaign.blockedFraudClicks || 0,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'campaigns');
    throw error;
  }
}

export async function updateCampaignStatsInFirestore(
  campaignId: string,
  stats: Partial<AdCampaign>
) {
  try {
    const cleanStats: Record<string, any> = {};
    Object.entries(stats).forEach(([k, v]) => {
      if (v !== undefined) cleanStats[k] = v;
    });
    const campRef = doc(db, 'campaigns', campaignId);
    await updateDoc(campRef, cleanStats);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `campaigns/${campaignId}`);
    throw error;
  }
}

// 3. Ads Collection (Ad units / creative placements)
export function subscribeToAds(
  onAds: (ads: any[]) => void,
  onError?: (err: any) => void
) {
  const adsCol = collection(db, 'ads');
  return onSnapshot(
    adsCol,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      onAds(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ads');
      if (onError) onError(error);
    }
  );
}

// 4. Earnings / Transactions Collection
export function subscribeToEarnings(
  userId: string,
  onEarnings: (transactions: Transaction[]) => void,
  onError?: (err: any) => void
) {
  if (!userId) {
    onEarnings([]);
    return () => {};
  }
  const earningsCol = collection(db, 'earnings');
  // For security rule compliance, query by userId
  const q = query(earningsCol, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          type: data.type || 'earning_adsense',
          amount: data.amount || 0,
          currency: data.currency || 'USD',
          status: data.status || 'completed',
          paymentMethod: data.paymentMethod || 'محفظة ليتيريوم الداخلية',
          referenceId: data.referenceId || docSnap.id,
          description: data.description || data.source || 'أرباح مشاهدات ونقرات',
          // لا يوجد نص "الآن" افتراضي بعد الآن — إن لم يوجد تاريخ حقيقي
          // فهذا يعني بيانات ناقصة يجب أن تظهر فارغة لا مزيّفة.
          createdAt: data.createdAt || ''
        } as Transaction);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onEarnings(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'earnings');
      if (onError) onError(error);
    }
  );
}

// 5. Users List (for Admin Management & Writer Directory)
export function subscribeToUsers(
  onUsers: (users: User[]) => void,
  onError?: (err: any) => void
) {
  const usersCol = collection(db, 'users');
  return onSnapshot(
    usersCol,
    (snapshot) => {
      if (snapshot.empty) {
        onUsers([]);
        return;
      }
      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const email = (data.email || '').toLowerCase();
        const isOwner = email === 'brnardtsho@gmail.com';
        const role: UserRole = isOwner ? 'admin' : (data.role || 'reader');

        list.push({
          id: docSnap.id,
          email: data.email || '',
          fullName: data.fullName || data.displayName || data.name || 'مستخدم ليتيريوم',
          username: data.username || (data.email ? data.email.split('@')[0] : `user_${docSnap.id.slice(0, 5)}`),
          avatarUrl: data.avatarUrl || data.photoURL || data.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
          coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200',
          role,
          bio: data.bio || '',
          penName: data.penName,
          companyName: data.companyName,
          companyIndustry: data.companyIndustry,
          companyWebsite: data.companyWebsite,
          specialties: Array.isArray(data.specialties) ? data.specialties : undefined,
          isVerified: data.isVerified ?? (role === 'admin'),
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          articlesCount: data.articlesCount || 0,
          totalViews: data.totalViews || 0,
          totalEarnings: Number(data.totalEarnings ?? (data.walletBalance ?? 0)),
          monthlyEarnings: data.monthlyEarnings || 0,
          // ⚠️ هذا المستمع يُعيد بناء مصفوفة المستخدمين بالكامل (setUsers
          // استبدال، لا دمج) عند أي تغيّر في مجموعة users كاملة — لأي مستخدم
          // كان. إسقاط هذه الحقول هنا كان يعني تصفير رصيد كل المستخدمين
          // ظاهرياً بمجرد أي تحديث عابر (متابعة، تعديل سيرة ذاتية، ...).
          walletBalance: Number(data.walletBalance ?? 0),
          availableBalance: Number(data.availableBalance ?? 0),
          pendingEarnings: Number(data.pendingEarnings ?? 0),
          lifetimeEarnings: Number(data.lifetimeEarnings ?? (data.totalEarnings ?? 0)),
          joinedDate: data.createdAt ? new Date(data.createdAt).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) : 'حديثاً',
          createdAt: data.createdAt || undefined,
          aiQuota: data.aiQuota || {
            freeDailyLimit: DEFAULT_FREE_DAILY_LIMIT,
            usedToday: 0,
            lastResetTime: new Date().toISOString(),
            isSubscriber: false,
            plan: 'none'
          },
          // ⚠️ كانت هذه الحقول الثلاثة غائبة تماماً عن هذا الإسقاط اليدوي —
          // فتُكتب فعلياً في Firestore (نبضة الحضور، الحظر، الكتم) لكنها
          // تختفي فوراً بمجرد مرورها من هنا، فيظهر أي طرف "غير متصل" دائماً
          // مهما كان متصلاً فعلاً، ويبقى الحظر/الكتم بلا أثر يُقرأ في الواجهة.
          presence: data.presence,
          blockedUserIds: Array.isArray(data.blockedUserIds) ? data.blockedUserIds : undefined,
          mutedUserIds: Array.isArray(data.mutedUserIds) ? data.mutedUserIds : undefined
        });
      });
      onUsers(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      if (onError) onError(error);
    }
  );
}

export async function updateUserWalletBalance(userId: string, newBalance: number) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { walletBalance: newBalance, totalEarnings: newBalance });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    throw err;
  }
}

export async function logTransactionToFirestore(tx: Partial<Transaction>, userId: string) {
  try {
    const cleanTx: Record<string, any> = {};
    Object.entries(tx).forEach(([k, v]) => {
      if (v !== undefined) cleanTx[k] = v;
    });
    const earningsCol = collection(db, 'earnings');
    await addDoc(earningsCol, {
      ...cleanTx,
      userId,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'earnings');
    throw err;
  }
}

// 6. Fraud Flags Collection
export function subscribeToFraudFlags(
  onFlags: (flags: FraudFlag[]) => void,
  onError?: (err: any) => void
) {
  const flagsCol = collection(db, 'fraudFlags');
  return onSnapshot(
    flagsCol,
    (snapshot) => {
      if (snapshot.empty) {
        onFlags([]);
        return;
      }
      const list: FraudFlag[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as FraudFlag);
      });
      onFlags(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'fraudFlags');
      if (onError) onError(error);
    }
  );
}

export async function logFraudFlagToFirestore(flag: Partial<FraudFlag>) {
  try {
    const cleanFlag: Record<string, any> = {};
    Object.entries(flag).forEach(([k, v]) => {
      if (v !== undefined) cleanFlag[k] = v;
    });
    const colRef = collection(db, 'fraudFlags');
    await addDoc(colRef, {
      ...cleanFlag,
      detectedAt: new Date().toISOString().split('T')[0] + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'fraudFlags');
    throw error;
  }
}

export async function setUserVerifiedInFirestore(userId: string, isVerified: boolean) {
  try {
    await updateDoc(doc(db, 'users', userId), { isVerified });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    throw e;
  }
}

/**
 * حفظ طلب توثيق هوية (KYC) بحالة "قيد المراجعة" فعلياً في Firestore —
 * لا يُصادَق عليه أبداً من جانب المستخدم نفسه (isVerified/isKycVerified
 * محميان بقواعد الأمان، لا يقدر أي مستخدم عادي تغييرهما بنفسه)، وينتظر
 * اعتماداً حقيقياً من الأدمن عبر setUserKycApprovedInFirestore.
 */
export async function submitKycRequestInFirestore(
  userId: string,
  kycDetails: { idType: string; idNumber: string; submittedAt: string }
) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      kycDetails: { ...kycDetails, status: 'pending' }
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    throw e;
  }
}

export async function setUserKycApprovedInFirestore(userId: string) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      isKycVerified: true,
      'kycDetails.status': 'verified'
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    throw e;
  }
}

export async function setUserBannedInFirestore(userId: string, isBanned: boolean) {
  try {
    await updateDoc(doc(db, 'users', userId), { isBanned });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    throw e;
  }
}

export async function setCampaignStatusInFirestore(campaignId: string, status: string) {
  try {
    await updateDoc(doc(db, 'campaigns', campaignId), { status });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `campaigns/${campaignId}`);
    throw e;
  }
}

export async function setArticleStatusInFirestore(articleId: string, status: string) {
  try {
    await updateDoc(doc(db, 'articles', articleId), { status });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `articles/${articleId}`);
    throw e;
  }
}

export async function resolveFraudFlagInFirestore(flagId: string, action: 'resolved' | 'dismissed') {
  try {
    await updateDoc(doc(db, 'fraudFlags', flagId), {
      status: action === 'resolved' ? 'reviewed' : 'dismissed'
    });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `fraudFlags/${flagId}`);
    throw e;
  }
}

export async function approvePayoutInFirestore(transactionId: string) {
  try {
    await updateDoc(doc(db, 'earnings', transactionId), { status: 'completed' });
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, `earnings/${transactionId}`);
    throw e;
  }
}

// -------------------------------------------------------------------
// طلبات ترويج المقالات (promotions)
//
// قواعد أمان Firestore تفرض على الكاتب:
//   - أن يكون writerId مساوياً لمعرّفه
//   - أن تبدأ status بالقيمة 'pending'
//   - أن يبدأ العدّادان بصفر
// وتمنعه من تعديل المستند بعد الإنشاء. الاعتماد والرفض للأدمن حصراً،
// والخصم المالي يتم يدوياً من لوحة الإدارة.
// -------------------------------------------------------------------

export async function requestArticlePromotion(
  promotion: Omit<ArticlePromotion, 'id' | 'status' | 'createdAt' | 'impressionsCount' | 'clicksCount'>
): Promise<string> {
  try {
    const payload: Record<string, any> = {
      articleId: promotion.articleId,
      writerId: promotion.writerId,
      durationHours: promotion.durationHours,
      pricingModel: promotion.pricingModel,
      cost: promotion.cost,
      status: 'pending',
      createdAt: new Date().toISOString(),
      impressionsCount: 0,
      clicksCount: 0
    };
    // الحقول الاختيارية تُضاف فقط إذا كانت لها قيمة فعلية،
    // لأن Firestore يرفض أي حقل بقيمة undefined.
    if (promotion.articleTitle) payload.articleTitle = promotion.articleTitle;
    if (promotion.writerName) payload.writerName = promotion.writerName;

    const docRef = await addDoc(collection(db, 'promotions'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'promotions');
    throw error;
  }
}

export function subscribeToPromotions(
  writerId: string | null,
  isAdmin: boolean,
  onPromotions: (promotions: ArticlePromotion[]) => void,
  onError?: (err: any) => void
) {
  // قواعد الأمان تسمح للكاتب بقراءة طلباته فقط، لذا يجب تقييد الاستعلام
  // بشرط writerId — الاستماع للمجموعة كاملة سيُرفض من الخادم.
  if (!isAdmin && !writerId) {
    onPromotions([]);
    return () => {};
  }

  const colRef = collection(db, 'promotions');
  const q = isAdmin ? query(colRef) : query(colRef, where('writerId', '==', writerId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ArticlePromotion[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...(data as Omit<ArticlePromotion, 'id'>) });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onPromotions(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'promotions');
      if (onError) onError(error);
    }
  );
}

export async function setPromotionStatusInFirestore(
  promotionId: string,
  status: 'approved' | 'rejected' | 'expired',
  adminNote?: string
) {
  try {
    const payload: Record<string, any> = { status, reviewedAt: new Date().toISOString() };
    if (adminNote) payload.adminNote = adminNote;
    await updateDoc(doc(db, 'promotions', promotionId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `promotions/${promotionId}`);
    throw error;
  }
}

export async function cancelPromotionRequest(promotionId: string) {
  try {
    await deleteDoc(doc(db, 'promotions', promotionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `promotions/${promotionId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// أحداث الإعلانات (adEvents)
//
// كل ظهور أو نقرة يُسجَّل هنا فوراً بحالة processed = false، بدون أي
// احتساب مالي. الاحتساب يتم لاحقاً بمراجعة الأدمن من لوحة الإدارة.
//
// قواعد الأمان تفرض:
//   - eventType ضمن ['impression', 'click']
//   - processed === false
//   - viewerId إمّا null أو مطابق للمستخدم الحالي
// -------------------------------------------------------------------

export async function logAdEvent(event: {
  campaignId?: string;
  promotionId?: string;
  slotId: string;
  articleId?: string;
  writerId?: string;
  viewerId?: string | null;
  eventType: 'impression' | 'click';
  /** true = مشاهدة موثّقة (نفس شرط الرؤية 50%/ثانية) لإعلان شبكة خارجية
   *  في موضع كاتب — أساس حساب عائد الكاتب من هذه الشبكات بسعر تقديري
   *  ثابت، منفصل تماماً عن أحداث الحملات الداخلية (campaignId). */
  isExternalAdView?: boolean;
}): Promise<void> {
  try {
    const payload: Record<string, any> = {
      slotId: event.slotId,
      eventType: event.eventType,
      viewerId: event.viewerId ?? null,
      processed: false,
      createdAt: new Date().toISOString()
    };
    if (event.campaignId) payload.campaignId = event.campaignId;
    if (event.promotionId) payload.promotionId = event.promotionId;
    if (event.articleId) payload.articleId = event.articleId;
    if (event.writerId) payload.writerId = event.writerId;
    if (event.isExternalAdView) payload.isExternalAdView = true;

    await addDoc(collection(db, 'adEvents'), payload);
  } catch (error) {
    // لا نعرض خطأً للمستخدم — تسجيل الحدث ليس جزءاً من تجربته
    console.warn('تعذر تسجيل حدث إعلاني:', error);
  }
}

export function subscribeToAdEvents(
  onEvents: (events: any[]) => void,
  onError?: (err: any) => void
) {
  // القراءة للأدمن فقط حسب قواعد الأمان
  const q = query(collection(db, 'adEvents'), where('processed', '==', false));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onEvents(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adEvents');
      if (onError) onError(error);
    }
  );
}

export async function markAdEventProcessed(eventId: string, isValid: boolean) {
  try {
    await updateDoc(doc(db, 'adEvents', eventId), { processed: true, isValid });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `adEvents/${eventId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// طلبات الإيداع (depositRequests) وطلبات السحب (payoutRequests)
//
// كل عملية مالية تمر بثلاث خطوات:
//   1. المستخدم يطلب (status = 'pending')
//   2. المالك يتحقق خارج المنصة من وصول/إرسال المال
//   3. المالك يعتمد من لوحة الإدارة، فيتغيّر الرصيد
//
// لا يستطيع أي مستخدم تعديل رصيده بنفسه — قواعد الأمان تمنع ذلك.
// -------------------------------------------------------------------

export async function createDepositRequest(req: {
  userId: string;
  amount: number;
  method: string;
  reference?: string;
}): Promise<string> {
  try {
    const payload: Record<string, any> = {
      userId: req.userId,
      amount: req.amount,
      method: req.method,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    if (req.reference) payload.reference = req.reference;
    const docRef = await addDoc(collection(db, 'depositRequests'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'depositRequests');
    throw error;
  }
}

export async function createPayoutRequest(req: {
  userId: string;
  amount: number;
  method: string;
  destination?: string;
}): Promise<string> {
  try {
    const payload: Record<string, any> = {
      userId: req.userId,
      amount: req.amount,
      method: req.method,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    if (req.destination) payload.destination = req.destination;
    const docRef = await addDoc(collection(db, 'payoutRequests'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'payoutRequests');
    throw error;
  }
}

export function subscribeToMoneyRequests(
  collectionName: 'depositRequests' | 'payoutRequests',
  userId: string | null,
  isAdmin: boolean,
  onRequests: (requests: any[]) => void,
  onError?: (err: any) => void
) {
  if (!isAdmin && !userId) {
    onRequests([]);
    return () => {};
  }
  const colRef = collection(db, collectionName);
  const q = isAdmin ? query(colRef) : query(colRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onRequests(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      if (onError) onError(error);
    }
  );
}

export async function setMoneyRequestStatus(
  collectionName: 'depositRequests' | 'payoutRequests',
  requestId: string,
  status: 'approved' | 'rejected' | 'paid',
  adminNote?: string
) {
  try {
    const payload: Record<string, any> = { status, reviewedAt: new Date().toISOString() };
    if (adminNote) payload.adminNote = adminNote;
    await updateDoc(doc(db, collectionName, requestId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${requestId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// المتابعة (follows)
// معرّف المستند إلزامياً بالصيغة: {followerId}_{followingId}
// -------------------------------------------------------------------

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw new Error('لا يمكنك متابعة نفسك.');
  }
  try {
    const followId = `${followerId}_${followingId}`;
    await setDoc(doc(db, 'follows', followId), {
      followerId,
      followingId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'follows');
    throw error;
  }
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'follows', `${followerId}_${followingId}`));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'follows');
    throw error;
  }
}

export function subscribeToFollows(
  onFollows: (follows: { id: string; followerId: string; followingId: string }[]) => void,
  onError?: (err: any) => void
) {
  // القراءة عامة حسب قواعد الأمان (لعرض أعداد المتابِعين)
  return onSnapshot(
    collection(db, 'follows'),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onFollows(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'follows');
      if (onError) onError(error);
    }
  );
}

// -------------------------------------------------------------------
// المحادثات والرسائل
//
// ⚠️ قواعد الأمان تشترط وجود حقل participants (مصفوفة معرّفات) في
// المجموعتين معاً. بدونه تفشل كل عمليات القراءة والكتابة.
// والاستعلام يجب أن يستخدم array-contains — الاستماع للمجموعة كاملة
// سيُرفض من الخادم لأن القواعد ليست فلاتر.
// -------------------------------------------------------------------

function conversationIdFor(userA: string, userB: string): string {
  return [userA, userB].sort().join('_');
}

export async function ensureConversation(
  currentUserId: string,
  otherUserId: string
): Promise<string> {
  if (currentUserId === otherUserId) {
    throw new Error('لا يمكنك مراسلة نفسك.');
  }
  const convId = conversationIdFor(currentUserId, otherUserId);
  try {
    const ref = doc(db, 'conversations', convId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants: [currentUserId, otherUserId],
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }
    return convId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'conversations');
    throw error;
  }
}

export async function sendMessageToFirestore(msg: {
  conversationId: string;
  senderId: string;
  participants: string[];
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'sticker';
}): Promise<void> {
  try {
    const recipientId = msg.participants.find((p) => p !== msg.senderId) || '';
    await addDoc(collection(db, 'messages'), {
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      participants: msg.participants,
      text: msg.text,
      ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl } : {}),
      ...(msg.mediaType ? { mediaType: msg.mediaType } : {}),
      isRead: false,
      createdAt: new Date().toISOString()
    });

    // تحديث ملخص المحادثة + إعادة إظهارها تلقائياً لدى المستلم لو كان قد
    // أغلقها سابقاً (hiddenFor)، ومسح مؤشر "يكتب الآن" لصاحب الرسالة نفسه
    // فور إرسال رسالته الفعلية.
    await setDoc(
      doc(db, 'conversations', msg.conversationId),
      {
        participants: msg.participants,
        lastMessage: msg.mediaType === 'sticker' ? '📎 ملصق' : msg.mediaType ? '📎 وسائط' : msg.text.slice(0, 120),
        lastMessageAt: new Date().toISOString(),
        ...(recipientId ? { hiddenFor: arrayRemove(recipientId) } : {}),
        typing: { [msg.senderId]: null }
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'messages');
    throw error;
  }
}

/** يكتب/يمسح مؤشر "يكتب الآن" لمستخدم في محادثة — يُقرَأ من كل الأطراف
 *  عبر subscribeToConversations نفسها (لا حاجة لاشتراك منفصل)، ويُعتبر
 *  الطرف الآخر "يكتب" فقط لو الطابع الزمني حديث (أقل من ~4 ثوانٍ) —
 *  تفادياً لبقاء المؤشر عالقاً لو أُغلق المتصفح فجأة أثناء الكتابة. */
export async function setTypingState(conversationId: string, userId: string, isTyping: boolean): Promise<void> {
  try {
    await setDoc(
      doc(db, 'conversations', conversationId),
      { typing: { [userId]: isTyping ? new Date().toISOString() : null } },
      { merge: true }
    );
  } catch {
    // مؤشر الكتابة غير حرج — تجاهل أي فشل بصمت دون إزعاج المستخدم
  }
}

/** إغلاق محادثة من قائمتي فقط (بلا حذف فعلي) — يراها الطرف الآخر كما هي،
 *  وتعود للظهور لدي تلقائياً فور وصول رسالة جديدة منه (انظر sendMessageToFirestore). */
export async function hideConversationForMe(conversationId: string, myUserId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'conversations', conversationId),
      { hiddenFor: arrayUnion(myUserId) },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'conversations');
    throw error;
  }
}

/** حظر/رفع حظر مستخدم — يمنعه فعلياً من إرسال أي رسالة جديدة (مفروض في
 *  قواعد الأمان أيضاً، وليس فقط في الواجهة). */
export async function toggleBlockUser(currentUserId: string, targetUserId: string, block: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      blockedUserIds: block ? arrayUnion(targetUserId) : arrayRemove(targetUserId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}`);
    throw error;
  }
}

/** كتم مستخدم — لا يمنع استلام رسائله، فقط يُخفي شارة غير مقروء/التنبيه محلياً. */
export async function toggleMuteUser(currentUserId: string, targetUserId: string, mute: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      mutedUserIds: mute ? arrayUnion(targetUserId) : arrayRemove(targetUserId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}`);
    throw error;
  }
}

/** نبضة حضور دورية — تُكتب من كل جلسة/متصفح مسجَّل دخول كل ~25 ثانية طالما
 *  التبويب مرئي، وعند الإخفاء/الإغلاق تُكتب 'offline' + lastSeenAt فوراً
 *  (خير جهد؛ الحد الفاصل 60 ثانية على lastHeartbeatAt في الواجهة يغطي حالة
 *  إغلاق المتصفح المفاجئ الذي لا يُطلق أي حدث). */
export async function updateMyPresence(
  userId: string,
  state: 'online' | 'offline'
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      presence: state === 'online' ? { state, lastHeartbeatAt: now } : { state, lastSeenAt: now }
    });
  } catch {
    // الحضور غير حرج — لا نزعج المستخدم بخطأ لو فشلت كتابة نبضة واحدة
  }
}

/** إرسال بلاغ إساءة/إزعاج بحق مستخدم آخر — يراجعه الأدمن فقط من لوحة التحكم. */
export async function submitUserReport(report: {
  reporterId: string;
  reportedUserId: string;
  conversationId?: string;
  reason: 'abusive' | 'harassment' | 'spam' | 'other';
  details?: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'reports'), {
      ...report,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reports');
    throw error;
  }
}

/** اشتراك الأدمن في كل محادثات المنصة (وليس محادثاته الشخصية فقط) — لعرضها
 *  في جدول مراقبة الجودة. قواعد الأمان تسمح بهذا لأن isAdmin() يتجاوز شرط
 *  participants على كل مستند تُعيده Firestore، فلا حاجة لأي فلتر إضافي. */
export function subscribeToAllConversationsForAdmin(
  onConversations: (conversations: any[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onConversations(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations/admin');
      if (onError) onError(error);
    }
  );
}

/** قراءة رسائل محادثة معيّنة بصلاحية إشراف الأدمن — للقراءة فقط، بلا أي
 *  كتابة (لا isRead ولا typing) حتى لا يشعر أي من الطرفين بدخول الأدمن. */
export function subscribeToConversationMessagesForAdmin(
  conversationId: string,
  onMessages: (messages: any[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'messages'), where('conversationId', '==', conversationId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      onMessages(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages/admin');
      if (onError) onError(error);
    }
  );
}

/**
 * رسالة جماعية من الأدمن لكل المستخدمين دفعة واحدة — تظهر لكل مستلم في
 * نفس صندوق الرسائل المعتاد (زر "رسائل")، بشارة غير مقروء واسم الأدمن
 * كمُرسل، عبر نفس مسار conversations/messages المستخدم للرسائل الفردية.
 *
 * مقسّمة لدفعات (writeBatch) بحد 200 مستلم لكل دفعة (400 عملية كتابة،
 * هامش أمان تحت حد الـ500 عملية لكل دفعة في Firestore).
 */
export async function broadcastMessageToAllUsers(
  adminId: string,
  recipientIds: string[],
  text: string
): Promise<{ sent: number; failed: number }> {
  const targets = recipientIds.filter((id) => id && id !== adminId);
  let sent = 0;
  let failed = 0;
  const nowIso = new Date().toISOString();
  const CHUNK_SIZE = 200;

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const recipientId of chunk) {
      const convId = conversationIdFor(adminId, recipientId);
      batch.set(
        doc(db, 'conversations', convId),
        {
          participants: [adminId, recipientId],
          lastMessage: text.slice(0, 120),
          lastMessageAt: nowIso
        },
        { merge: true }
      );
      batch.set(doc(collection(db, 'messages')), {
        conversationId: convId,
        senderId: adminId,
        participants: [adminId, recipientId],
        text,
        isRead: false,
        createdAt: nowIso
      });
    }
    try {
      await batch.commit();
      sent += chunk.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages/broadcast');
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

export function subscribeToConversations(
  userId: string | null,
  onConversations: (conversations: any[]) => void,
  onError?: (err: any) => void
) {
  if (!userId) {
    onConversations([]);
    return () => {};
  }
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
      onConversations(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
      if (onError) onError(error);
    }
  );
}

export function subscribeToMessages(
  userId: string | null,
  onMessages: (messages: any[]) => void,
  onError?: (err: any) => void
) {
  if (!userId) {
    onMessages([]);
    return () => {};
  }
  const q = query(collection(db, 'messages'), where('participants', 'array-contains', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      onMessages(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
      if (onError) onError(error);
    }
  );
}

/** يُعلِّم كل رسائل محادثة معيّنة الواردة من الطرف الآخر كمقروءة — يُستدعى
 *  عند فتح المستخدم لهذه المحادثة، بدل ترك عدّاد "غير مقروء" عالقاً على 0
 *  دائماً أو غير دقيق. */
export async function markConversationMessagesRead(currentUserId: string, otherUserId: string): Promise<void> {
  if (!currentUserId || !otherUserId) return;
  try {
    const convId = conversationIdFor(currentUserId, otherUserId);
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', convId),
      where('senderId', '==', otherUserId),
      where('isRead', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { isRead: true })));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'messages');
  }
}

/**
 * حذف رسالة واحدة — يسمح بها فقط مُرسِل الرسالة أو الأدمن (حسب قواعد
 * الأمان). كانت هذه الوظيفة غائبة تماماً عن الواجهة رغم أن قواعد الأمان
 * تدعمها منذ البداية (allow delete على مجموعة messages).
 */
export async function deleteMessageInFirestore(messageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}`);
    throw error;
  }
}

/**
 * حذف محادثة كاملة (مستند المحادثة + كل رسائلها) — للأدمن فقط (قواعد
 * الأمان تقصر حذف مستند conversations على isAdmin()، بخلاف حذف رسالة
 * فردية المتاح لصاحبها أيضاً). يُمرَّر معرّفات الرسائل من الحالة المحلية
 * أصلاً (مُصفّاة سلفاً) لتفادي استعلام إضافي.
 */
export async function deleteConversationInFirestore(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
      const chunk = messageIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((id) => batch.delete(doc(db, 'messages', id)));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'conversations', conversationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `conversations/${conversationId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// القالب اللوني العام وخلفية التطبيق (settings/theme)
// -------------------------------------------------------------------
// مستند واحد عام، قراءته متاحة للجميع (بما فيهم الزوار غير المسجَّلين،
// حتى تظهر صفحة الهبوط باللون والخلفية الصحيحة)، وكتابته مقصورة على الأدمن
// فقط عبر قواعد أمان Firestore. يسمح هذا لأي تغيير يجريه المالك بالوصول
// لحظياً لكل المستخدمين المتصلين حالياً عبر onSnapshot، دون أي حاجة
// لإعادة نشر أو تحديث التطبيق.
const THEME_DOC_REF = () => doc(db, 'settings', 'theme');

export interface ThemeSettingsData {
  preset: string | null;
  backgroundPreset: string | null;
}

export function subscribeToThemePreset(
  onSettings: (settings: ThemeSettingsData) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    THEME_DOC_REF(),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onSettings({
          preset: (data.preset as string) || null,
          backgroundPreset: (data.backgroundPreset as string) || null
        });
      } else {
        onSettings({ preset: null, backgroundPreset: null });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'settings/theme');
      if (onError) onError(error);
    }
  );
}

export async function setThemePresetInFirestore(preset: string, updatedByUserId: string): Promise<void> {
  try {
    await setDoc(
      THEME_DOC_REF(),
      { preset, updatedAt: new Date().toISOString(), updatedBy: updatedByUserId },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/theme');
    throw error;
  }
}

/** يشغّل/يوقف إعلانات المنصة العامة (Platform Ads) لكل المستخدمين فوراً.
 *  مستند مستقل عن settings/theme لأنه مفهوم مختلف تماماً (تحكم تشغيلي
 *  بالإعلانات، لا علاقة له بالمظهر). */
export async function setPlatformAdsEnabledInFirestore(enabled: boolean, updatedByUserId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'settings', 'platformAds'),
      { enabled, updatedAt: new Date().toISOString(), updatedBy: updatedByUserId },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/platformAds');
    throw error;
  }
}

/** يحفظ إعدادات الشبكات الإعلانية الخارجية الاحتياطية (PropellerAds/
 *  Adsterra) — كود HTML/JS خام لكل شبكة مع مفتاح تفعيل مستقل. */
export async function setExternalAdsConfigInFirestore(
  config: {
    propellerAds: { enabled: boolean; snippet: string };
    adsterra: { enabled: boolean; snippet: string };
    estimatedCpmUsd?: number;
  },
  updatedByUserId: string
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'settings', 'externalAds'),
      { ...config, updatedAt: new Date().toISOString(), updatedBy: updatedByUserId },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/externalAds');
    throw error;
  }
}

export async function setBackgroundPresetInFirestore(backgroundPreset: string, updatedByUserId: string): Promise<void> {
  try {
    await setDoc(
      THEME_DOC_REF(),
      { backgroundPreset, updatedAt: new Date().toISOString(), updatedBy: updatedByUserId },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/theme');
    throw error;
  }
}

// -------------------------------------------------------------------
// عمليات مشتريات المقالات المقفولة (للأدمن حصراً)
//
// شراء المقال يُسجَّل كطلب في purchaseRequests، ويعتمده الأدمن فيُخصم
// من محفظة القارئ ويُضاف إلى أرباح الكاتب المجمّدة.
// -------------------------------------------------------------------

export async function createPurchaseRequest(req: {
  buyerId: string;
  articleId: string;
  articleTitle?: string;
  writerId: string;
  price: number;
}): Promise<string> {
  try {
    const payload: Record<string, any> = {
      userId: req.buyerId,
      buyerId: req.buyerId,
      articleId: req.articleId,
      writerId: req.writerId,
      amount: req.price,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    if (req.articleTitle) payload.articleTitle = req.articleTitle;
    const docRef = await addDoc(collection(db, 'purchaseRequests'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'purchaseRequests');
    throw error;
  }
}

// -------------------------------------------------------------------
// تعديل أرصدة المستخدمين — للأدمن حصراً
//
// هذه الدالة هي الطريق الوحيد المشروع لتغيير أي رصيد. تُستدعى فقط من
// لوحة الإدارة بعد أن يتحقق المالك يدوياً من العملية.
// -------------------------------------------------------------------

export async function adminAdjustUserBalance(
  userId: string,
  changes: {
    walletBalance?: number;
    availableBalance?: number;
    pendingEarnings?: number;
    lifetimeEarnings?: number;
  }
) {
  try {
    const clean: Record<string, any> = {};
    Object.entries(changes).forEach(([k, v]) => {
      if (typeof v === 'number' && !Number.isNaN(v)) clean[k] = v;
    });
    if (Object.keys(clean).length === 0) return;
    await updateDoc(doc(db, 'users', userId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

/**
 * سجلّ تدقيق دائم لكل تعديل رصيد يدوي من الأدمن — من عدّل، لمَن، أي حقل،
 * بأي مبلغ، ولماذا. كانت أداة "تعديل الرصيد يدوياً" تكتب الرقم الجديد
 * مباشرة دون أي أثر يوثّق العملية، فلا وسيلة لمراجعتها لاحقاً عند الحاجة.
 * تُكتب في مجموعة transactions الموجودة أصلاً (إنشاء للأدمن حصراً حسب
 * قواعد الأمان)، فيراها صاحب الحساب المتأثر أيضاً عند قراءة سجله.
 */
export async function logManualBalanceAdjustment(entry: {
  userId: string;
  field: 'walletBalance' | 'availableBalance' | 'pendingEarnings' | 'lifetimeEarnings';
  amount: number;
  newValue: number;
  reason: string;
  adjustedBy: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'transactions'), {
      userId: entry.userId,
      type: 'manual_adjustment',
      amount: entry.amount,
      currency: 'USD',
      status: 'completed',
      paymentMethod: 'تعديل يدوي من الإدارة',
      referenceId: `ADJ-${Date.now().toString().slice(-8)}`,
      description: `تعديل يدوي (${entry.field}): ${entry.amount >= 0 ? '+' : ''}${entry.amount.toFixed(2)}$ ← الرصيد الجديد ${entry.newValue.toFixed(2)}$. السبب: ${entry.reason || 'غير مُحدَّد'}`,
      field: entry.field,
      newValue: entry.newValue,
      reason: entry.reason || '',
      adjustedBy: entry.adjustedBy,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    // فشل تسجيل التدقيق لا يجب أن يُفشل العملية المالية نفسها (التي
    // نجحت فعلاً) — فقط نُسجّله محلياً حتى لا يضيع بصمت.
    console.error('تعذر تسجيل سجل تدقيق تعديل الرصيد:', error);
  }
}

/**
 * تحرير الأرباح المجمّدة بعد انقضاء 30 يوماً:
 * نقل المبلغ من pendingEarnings إلى availableBalance.
 */
export async function adminReleaseEarnings(
  userId: string,
  currentPending: number,
  currentAvailable: number,
  amountToRelease: number
) {
  const release = Math.min(amountToRelease, currentPending);
  if (release <= 0) return;
  await adminAdjustUserBalance(userId, {
    pendingEarnings: Number((currentPending - release).toFixed(2)),
    availableBalance: Number((currentAvailable + release).toFixed(2))
  });
}

/**
 * تسجيل ربح للكاتب في مجموعة earnings (للأدمن حصراً).
 */
export async function adminLogEarning(earning: {
  userId: string;
  amount: number;
  source: string;
  articleId?: string;
  campaignId?: string;
  description?: string;
}) {
  try {
    const payload: Record<string, any> = {
      userId: earning.userId,
      amount: earning.amount,
      source: earning.source,
      status: 'pending_hold',
      createdAt: new Date().toISOString(),
      // تصبح قابلة للسحب بعد 30 يوماً من التسجيل
      releasableAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    if (earning.articleId) payload.articleId = earning.articleId;
    if (earning.campaignId) payload.campaignId = earning.campaignId;
    if (earning.description) payload.description = earning.description;
    await addDoc(collection(db, 'earnings'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'earnings');
    throw error;
  }
}

/**
 * حفظ الروابط الخارجية للمستخدم في ملفه الشخصي.
 * socialLinks حقل غير مالي، فيسمح به تعديل صاحب الحساب في قواعد الأمان.
 */
export async function updateUserSocialLinks(
  userId: string,
  socialLinks: Record<string, string>
) {
  try {
    const clean: Record<string, string> = {};
    Object.entries(socialLinks).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim()) clean[k] = v.trim();
    });
    await updateDoc(doc(db, 'users', userId), { socialLinks: clean });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

/**
 * حفظ بيانات الملف الشخصي الأساسية (الاسم/الاسم المستعار/اسم الجهة،
 * السيرة الذاتية، صورة الحساب) — كانت هذه الحقول قابلة للتعديل حسب
 * قواعد الأمان دائماً، لكن لا توجد أي واجهة فعلية تتيح للمستخدم تعديلها
 * بنفسه بعد التسجيل الأولي (بما في ذلك حساب المالك نفسه).
 */
export async function updateUserProfileInFirestore(
  userId: string,
  updates: { fullName?: string; penName?: string; companyName?: string; bio?: string; avatarUrl?: string }
): Promise<void> {
  try {
    const clean: Record<string, string> = {};
    if (typeof updates.fullName === 'string' && updates.fullName.trim()) clean.fullName = updates.fullName.trim();
    if (typeof updates.penName === 'string') clean.penName = updates.penName.trim();
    if (typeof updates.companyName === 'string') clean.companyName = updates.companyName.trim();
    if (typeof updates.bio === 'string') clean.bio = updates.bio.trim();
    if (typeof updates.avatarUrl === 'string' && updates.avatarUrl.trim()) clean.avatarUrl = updates.avatarUrl.trim();
    await updateDoc(doc(db, 'users', userId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// التعليقات — مخزّنة في Firestore ومتزامنة فعلياً بين كل المستخدمين
// (كانت سابقاً تُحفظ في localStorage فقط، فلا يراها أحد غير صاحب الجهاز).
// -------------------------------------------------------------------

export function subscribeToComments(
  onComments: (comments: Comment[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'comments'),
    (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as Comment));
      // الأحدث أولاً
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onComments(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
      if (onError) onError(error);
    }
  );
}

export async function addCommentToFirestore(comment: Comment): Promise<void> {
  try {
    await setDoc(doc(db, 'comments', comment.id), comment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'comments');
    throw error;
  }
}

export async function addReplyToCommentInFirestore(
  commentId: string,
  reply: CommentReply
): Promise<void> {
  try {
    await updateDoc(doc(db, 'comments', commentId), {
      replies: arrayUnion(reply)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    throw error;
  }
}

/**
 * إعجاب/إلغاء إعجاب حقيقي بتعليق جذري (وليس رداً)، مع تتبّع مَن أعجب
 * فعلياً عبر مصفوفة likedBy — بدل تثبيت isLiked=true للجميع كما كان سابقاً.
 */
export async function toggleCommentLikeInFirestore(
  commentId: string,
  userId: string,
  isLiking: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'comments', commentId), {
      likesCount: increment(isLiking ? 1 : -1),
      likedBy: isLiking ? arrayUnion(userId) : arrayRemove(userId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// إعجابات المقالات — تُحفظ كمستند مستقل لكل (مقال + مستخدم) في مجموعة
// "likes"، بنفس أسلوب مجموعة "follows" الموجودة، حتى نعرف بدقة هل
// المستخدم الحالي أعجب بمقال معيّن أم لا (بدل رقم يزيد فقط بلا توقف).
// -------------------------------------------------------------------

export function subscribeToArticleLikes(
  onLikes: (likes: { id: string; articleId: string; userId: string }[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'likes'),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onLikes(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'likes');
      if (onError) onError(error);
    }
  );
}

// -------------------------------------------------------------------
// مقالات مقفولة اشتراها المستخدم الحالي فعلياً — تُكتب فقط من السيرفر
// (نقطة /api/articles/unlock عبر Admin SDK) بعد خصم الرصيد فوراً، ولذلك
// يُستعلَم عنها هنا مقتصرة على buyerId الحالي فقط (بيانات مالية، ليست
// عامة كالإعجابات).
// -------------------------------------------------------------------

export function subscribeToArticlePurchases(
  buyerId: string,
  onPurchases: (articleIds: string[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    query(collection(db, 'articlePurchases'), where('buyerId', '==', buyerId)),
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((d) => ids.push((d.data() as any).articleId));
      onPurchases(ids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'articlePurchases');
      if (onError) onError(error);
    }
  );
}

export async function likeArticleInFirestore(articleId: string, userId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'likes', `${articleId}_${userId}`), {
      articleId,
      userId,
      createdAt: new Date().toISOString()
    });
    await updateDoc(doc(db, 'articles', articleId), { likesCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'likes');
    throw error;
  }
}

export async function unlikeArticleInFirestore(articleId: string, userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'likes', `${articleId}_${userId}`));
    await updateDoc(doc(db, 'articles', articleId), { likesCount: increment(-1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'likes');
    throw error;
  }
}

// -------------------------------------------------------------------
// انطباعات القارئ العاطفية (❤️ أحببته / 💡 ملهم / 😂 طريف ...) — نفس
// نمط "likes"/"ratings" تماماً (مستند واحد لكل مقال+مستخدم). كانت
// تُحفظ محلياً فقط في ArticleReader وتختفي عند تحديث الصفحة رغم أنها
// تبدو للقارئ وكأنها سُجِّلت — الآن تُخزَّن فعلياً.
// -------------------------------------------------------------------
export async function setArticleReactionInFirestore(
  articleId: string,
  userId: string,
  type: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'reactions', `${articleId}_${userId}`), {
      articleId,
      userId,
      type,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reactions');
    throw error;
  }
}

export async function removeArticleReactionInFirestore(articleId: string, userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reactions', `${articleId}_${userId}`));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'reactions');
    throw error;
  }
}

// -------------------------------------------------------------------
// التغريدات — محتوى قصير (٢٨٠ حرفاً) بجانب المدونة، بنفس نمط المقالات
// تماماً: مستند واحد لكل تغريدة في مجموعة tweets، وإعجاب/مفضلة كمستند
// مستقل لكل (تغريدة+مستخدم) في مجموعتي tweetLikes/tweetFavorites (نفس
// أسلوب مجموعة likes الحقيقي، وليس مصفوفة محلية تختفي عند التحديث).
// -------------------------------------------------------------------

export function subscribeToTweets(
  onTweets: (tweets: Tweet[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'tweets'),
    (snapshot) => {
      const list: Tweet[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as Tweet));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onTweets(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tweets');
      if (onError) onError(error);
    }
  );
}

export async function addTweetToFirestore(tweet: Tweet): Promise<void> {
  try {
    await setDoc(doc(db, 'tweets', tweet.id), tweet);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tweets');
    throw error;
  }
}

export async function deleteTweetInFirestore(tweetId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tweets', tweetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tweets/${tweetId}`);
    throw error;
  }
}

export async function incrementTweetSharesInFirestore(tweetId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'tweets', tweetId), { sharesCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tweets/${tweetId}`);
  }
}

export function subscribeToTweetLikes(
  onLikes: (likes: { id: string; tweetId: string; userId: string }[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'tweetLikes'),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onLikes(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tweetLikes');
      if (onError) onError(error);
    }
  );
}

export async function likeTweetInFirestore(tweetId: string, userId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'tweetLikes', `${tweetId}_${userId}`), {
      tweetId,
      userId,
      createdAt: new Date().toISOString()
    });
    await updateDoc(doc(db, 'tweets', tweetId), { likesCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tweetLikes');
    throw error;
  }
}

export async function unlikeTweetInFirestore(tweetId: string, userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tweetLikes', `${tweetId}_${userId}`));
    await updateDoc(doc(db, 'tweets', tweetId), { likesCount: increment(-1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'tweetLikes');
    throw error;
  }
}

// المفضلة (تمييز بنجمة) — نفس نمط الإعجاب تماماً، مستند مستقل لكل
// (تغريدة+مستخدم)، تُقرأ لاحقاً في قسم "المفضلة" بالملف الشخصي مُصفّاة
// على userId الحالي فقط (وليس مصفوفة محلية في localStorage تختفي بين
// الأجهزة كما كانت حالة تحديد المقالات المحفوظة سابقاً).
export function subscribeToTweetFavorites(
  userId: string | null,
  onFavorites: (tweetIds: string[]) => void,
  onError?: (err: any) => void
) {
  if (!userId) {
    onFavorites([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'tweetFavorites'), where('userId', '==', userId)),
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((d) => ids.push((d.data() as any).tweetId));
      onFavorites(ids);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tweetFavorites');
      if (onError) onError(error);
    }
  );
}

export async function favoriteTweetInFirestore(tweetId: string, userId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'tweetFavorites', `${tweetId}_${userId}`), {
      tweetId,
      userId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tweetFavorites');
    throw error;
  }
}

export async function unfavoriteTweetInFirestore(tweetId: string, userId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tweetFavorites', `${tweetId}_${userId}`));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'tweetFavorites');
    throw error;
  }
}

export function subscribeToTweetComments(
  onComments: (comments: TweetComment[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'tweetComments'),
    (snapshot) => {
      const list: TweetComment[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as TweetComment));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onComments(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tweetComments');
      if (onError) onError(error);
    }
  );
}

export async function addTweetCommentToFirestore(comment: TweetComment): Promise<void> {
  try {
    await setDoc(doc(db, 'tweetComments', comment.id), comment);
    await updateDoc(doc(db, 'tweets', comment.tweetId), { commentsCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tweetComments');
    throw error;
  }
}

export async function addReplyToTweetCommentInFirestore(
  commentId: string,
  reply: CommentReply
): Promise<void> {
  try {
    await updateDoc(doc(db, 'tweetComments', commentId), {
      replies: arrayUnion(reply)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tweetComments/${commentId}`);
    throw error;
  }
}

export async function toggleTweetCommentLikeInFirestore(
  commentId: string,
  userId: string,
  isLiking: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'tweetComments', commentId), {
      likesCount: increment(isLiking ? 1 : -1),
      likedBy: isLiking ? arrayUnion(userId) : arrayRemove(userId)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tweetComments/${commentId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// الإشعارات — تُكتب في Firestore فعلياً لصاحب الحساب المعني (وليس فقط
// لنفس المستخدم الذي نفّذ الحدث)، حتى تصل إشعارات المتابعة/الإعجاب/
// التعليق/الرد/المشاركة لكل مستخدم آخر بشكل حقيقي.
// -------------------------------------------------------------------

export async function createNotificationInFirestore(
  notification: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    // إشعار فاشل لا يجب أن يمنع إتمام الفعل الأساسي (إعجاب/تعليق/متابعة)
    console.error('تعذر إنشاء إشعار:', error);
  }
}

export function subscribeToNotifications(
  userId: string,
  onNotifications: (notifications: AppNotification[]) => void,
  onError?: (err: any) => void
) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as AppNotification));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onNotifications(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
      if (onError) onError(error);
    }
  );
}

export async function markNotificationReadInFirestore(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsReadInFirestore(
  notifications: AppNotification[]
): Promise<void> {
  try {
    await Promise.all(
      notifications
        .filter((n) => !n.isRead)
        .map((n) => updateDoc(doc(db, 'notifications', n.id), { isRead: true }))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

/** حذف إشعار واحد — قواعد الأمان تسمح لصاحب الإشعار فقط بحذفه. */
export async function deleteNotificationInFirestore(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}

/** مسح كل إشعارات المستخدم دفعة واحدة — زر "مسح الكل" لم يكن موجوداً إطلاقاً من قبل. */
export async function clearAllNotificationsInFirestore(notifications: AppNotification[]): Promise<void> {
  try {
    await Promise.all(notifications.map((n) => deleteDoc(doc(db, 'notifications', n.id))));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'notifications');
  }
}

// -------------------------------------------------------------------
// المشاهدات — تُسجَّل مرة واحدة فعلياً لكل مقال في كل جلسة تصفح، بدل
// عدم وجود أي تسجيل مشاهدات إطلاقاً كما كان الحال سابقاً.
// -------------------------------------------------------------------

export async function incrementArticleViewInFirestore(articleId: string): Promise<void> {
  try {
    // increment() الذَّرّي بدل حساب رقم مطلق على العميل: حساب newCount
    // محلياً من قيمة قد تكون قديمة يسبب فقدان مشاهدات فعلية عند دخول
    // قارئين لنفس المقال في نفس اللحظة تقريباً (كلاهما يكتب نفس الرقم).
    await updateDoc(doc(db, 'articles', articleId), { viewsCount: increment(1) });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `articles/${articleId}`);
  }
}

// -------------------------------------------------------------------
// تقييمات المقالات — تقييم حقيقي (1-5 نجوم) بمستند مستقل لكل (مقال +
// مستخدم)، بدل رقم "5.0" وهمي كان يُعرض بلا أي تقييم فعلي من أحد.
// -------------------------------------------------------------------

export function subscribeToArticleRatings(
  onRatings: (ratings: { id: string; articleId: string; userId: string; stars: number }[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'ratings'),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onRatings(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ratings');
      if (onError) onError(error);
    }
  );
}

export async function rateArticleInFirestore(
  articleId: string,
  userId: string,
  stars: number
): Promise<void> {
  try {
    await setDoc(doc(db, 'ratings', `${articleId}_${userId}`), {
      articleId,
      userId,
      stars,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'ratings');
    throw error;
  }
}

/**
 * يحدّث متوسط تقييم المقال (rating) وعدد التقييمات ومجموعها الخام بعد
 * أي إضافة أو تعديل تقييم — بحساب دقيق مبني على المجموع الحقيقي، لا رقم
 * مخترع.
 */
export async function syncArticleRatingSummary(
  articleId: string,
  ratingsSum: number,
  ratingsCount: number
): Promise<void> {
  try {
    await updateDoc(doc(db, 'articles', articleId), {
      ratingsSum,
      ratingsCount,
      rating: ratingsCount > 0 ? Number((ratingsSum / ratingsCount).toFixed(2)) : 0
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `articles/${articleId}`);
    throw error;
  }
}

// -------------------------------------------------------------------
// الأرباح المجمَّدة — لم تكن تُقرأ إطلاقاً من قبل رغم أن نظام تجميد 30
// يوماً كان يُحسب ويُخزَّن فعلياً عند كل ربح جديد (releasableAt)، فلا
// توجد أي وسيلة للأدمن لرؤية أو تحرير الأرباح المستحقة بعد انقضاء المدة.
// -------------------------------------------------------------------

export interface EarningRecord {
  id: string;
  userId: string;
  amount: number;
  source: string;
  status: string;
  createdAt: string;
  releasableAt: string;
  articleId?: string;
  campaignId?: string;
  description?: string;
}

export function subscribeToAllEarningsAdmin(
  onEarnings: (earnings: EarningRecord[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    collection(db, 'earnings'),
    (snapshot) => {
      const list: EarningRecord[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as EarningRecord));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onEarnings(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'earnings');
      if (onError) onError(error);
    }
  );
}

/**
 * سجلّ تدقيق كل تعديل رصيد يدوي قام به أي أدمن — يجيب فعلياً على سؤال "من
 * أين جاء هذا الرصيد؟" لأي حساب (بما فيه حساب المالك نفسه) بدل أن يبقى
 * الرصيد رقماً غامضاً بلا مصدر ظاهر في الواجهة. تُقرأ من مجموعة transactions
 * نفسها المستخدمة لكل الحركات المالية، مُصفّاة على type == 'manual_adjustment'.
 */
export function subscribeToManualBalanceAdjustments(
  onAdjustments: (records: any[]) => void,
  onError?: (err: any) => void
) {
  return onSnapshot(
    query(collection(db, 'transactions'), where('type', '==', 'manual_adjustment')),
    (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onAdjustments(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      if (onError) onError(error);
    }
  );
}

export async function markEarningReleasedInFirestore(earningId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'earnings', earningId), { status: 'released' });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `earnings/${earningId}`);
    throw error;
  }
}

/**
 * تحديث حصة استخدام الذكاء الاصطناعي لمستخدم بعد اعتماد اشتراكه فعلياً
 * من الأدمن — الحقل غير مالي فتسمح به قواعد الأمان لصاحب الحساب، لكن
 * الاعتماد هنا يأتي من الأدمن نيابة عن المستخدم عبر صلاحياته الشاملة.
 */
export async function updateUserAiQuotaInFirestore(userId: string, aiQuota: any): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), { aiQuota });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    throw error;
  }
}
