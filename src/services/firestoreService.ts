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
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Article, AdCampaign, Transaction, FraudFlag, User, UserRole, Comment, CommentReply, AppNotification, ArticlePromotion } from '../types';
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
      const docRef = await addDoc(colRef, {
        ...campaign,
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
          fullName: data.displayName || data.name || data.fullName || 'مستخدم ليتيريوم',
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
          }
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
}): Promise<void> {
  try {
    await addDoc(collection(db, 'messages'), {
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      participants: msg.participants,
      text: msg.text,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    // تحديث ملخص المحادثة
    await setDoc(
      doc(db, 'conversations', msg.conversationId),
      {
        participants: msg.participants,
        lastMessage: msg.text.slice(0, 120),
        lastMessageAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'messages');
    throw error;
  }
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
