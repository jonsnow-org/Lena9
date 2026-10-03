import React, { useState, useEffect, useMemo } from 'react';
import {
  Article,
  User,
  AdCampaign,
  Comment,
  CommentReply,
  Tweet,
  TweetComment,
  PaymentMethod,
  PricingModel,
  KycDetails,
  MessageReport,
  UserRole
} from '../types';
import {
  auth,
  ensureGuestIdentity,
  signInWithGoogle,
  getAuthErrorMessage,
  logOut,
  updateUserRoleInFirestore
} from '../firebase';
import { consumeAiUsage } from '../utils/aiQuota';
import { sendPushNotification } from '../services/pushNotificationsApi';
import { unlockArticle as requestArticleUnlock, reviewCampaign } from '../services/paymentsApi';
import {
  followUser,
  unfollowUser,
  createNotificationInFirestore,
  likeArticleInFirestore,
  unlikeArticleInFirestore,
  addTweetToFirestore,
  deleteTweetInFirestore,
  likeTweetInFirestore,
  unlikeTweetInFirestore,
  favoriteTweetInFirestore,
  unfavoriteTweetInFirestore,
  incrementTweetSharesInFirestore,
  addTweetCommentToFirestore,
  addReplyToTweetCommentInFirestore,
  toggleTweetCommentLikeInFirestore,
  addReplyToCommentInFirestore,
  addCommentToFirestore,
  incrementArticleCounterInFirestore,
  toggleCommentLikeInFirestore,
  incrementArticleViewInFirestore,
  rateArticleInFirestore,
  syncArticleRatingSummary,
  setArticleReactionInFirestore,
  saveArticleToFirestore,
  deleteArticleFromFirestore,
  createDepositRequest,
  createPayoutRequest,
  updateUserAiQuotaInFirestore,
  createPurchaseRequest,
  saveCampaignToFirestore,
  setCampaignStatusInFirestore,
  deleteCampaignInFirestore,
  setUserKycRejectedInFirestore,
  markKycDocumentReviewed,
  ensureConversation,
  sendMessageToFirestore,
  hideConversationForMe,
  toggleBlockUser,
  toggleMuteUser,
  submitUserReport,
  setTypingState,
  deleteMessageInFirestore,
  deleteConversationInFirestore
} from '../services/firestoreService';

export function useContentAndSocialActions(params: {
  requireAuth: () => boolean;
  currentUserId: string;
  setCurrentUserId: React.Dispatch<React.SetStateAction<string>>;
  currentUser: User;
  isAuthenticated: boolean;
  followsData: { id: string; followerId: string; followingId: string }[];
  setFollowedWriterIds: React.Dispatch<React.SetStateAction<string[]>>;
  setFollowListModal: React.Dispatch<React.SetStateAction<{ title: string; userIds: string[] } | null>>;
  setBookmarkedArticleIds: React.Dispatch<React.SetStateAction<string[]>>;
  guestIdentityUid: string;
  setGuestIdentityUid: React.Dispatch<React.SetStateAction<string>>;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  likedArticleIds: string[];
  setArticleLikes: React.Dispatch<React.SetStateAction<{ id: string; articleId: string; userId: string }[]>>;
  tweets: Tweet[];
  setTweets: React.Dispatch<React.SetStateAction<Tweet[]>>;
  tweetLikes: { id: string; tweetId: string; userId: string }[];
  setTweetLikes: React.Dispatch<React.SetStateAction<{ id: string; tweetId: string; userId: string }[]>>;
  favoritedTweetIds: string[];
  setFavoritedTweetIds: React.Dispatch<React.SetStateAction<string[]>>;
  tweetComments: TweetComment[];
  setMoneyModalMode: React.Dispatch<React.SetStateAction<'deposit' | 'payout' | null>>;
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  readingArticle: Article | null;
  viewedArticleIdsRef: React.MutableRefObject<Set<string>>;
  articleRatings: { id: string; articleId: string; userId: string; stars: number }[];
  setArticleRatings: React.Dispatch<React.SetStateAction<{ id: string; articleId: string; userId: string; stars: number }[]>>;
  editingArticle: Article | null;
  setEditingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  setIsArticleEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setIsSubscriptionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  campaigns: AdCampaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setRawConversations: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  isLoggingOutRef: React.MutableRefObject<boolean>;
  setShowLandingPage: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
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
  } = params;

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
        sendPushNotification(writerId, 'follows', 'متابع جديد', `بدأ ${currentUser.fullName} بمتابعتك`);
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
  const handlePostTweet = async (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => {
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
        ...(imageUrl ? { imageUrl, mediaType: mediaType || 'image' } : {}),
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

  // الإجراء الفعلي (مشاركة نظام حقيقية أو بطاقة معاينة بديلة) أصبح في
  // TweetCard نفسه (نفس أسلوب handleShareArticle/ArticleReader) — هذه
  // الدالة تسجّل الإحصائية فقط بصرف النظر عن نجاح إتمام المشاركة فعلياً،
  // تماماً كما يعمل عدّاد مشاركة المقالات.
  const handleShareTweet = (tweet: Tweet) => {
    incrementTweetSharesInFirestore(tweet.id).catch((err) => console.error('تعذر تحديث عدد المشاركات:', err));
  };

  const handlePostTweetComment = async (tweetId: string, content: string, imageUrl?: string) => {
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
        ...(imageUrl ? { imageUrl } : {}),
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
        sendPushNotification(comment.userId, 'replies', 'رد جديد على تعليقك', `رد ${currentUser.fullName} على تعليقك على تغريدة`);
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
          sendPushNotification(
            parentComment.userId,
            'replies',
            'رد جديد على تعليقك',
            `ردّ ${currentUser.fullName} على تعليقك: "${content.slice(0, 60)}"`
          );
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
      incrementArticleCounterInFirestore(articleId, 'commentsCount');
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
    incrementArticleCounterInFirestore(article.id, 'sharesCount');
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
  // مكافحة تضخيم المشاهدات: لا تُحتسب مشاهدة الكاتب لمقاله، ولا فتح عابر
  // أقل من 5 ثوانٍ، ولا تكرار من نفس الجهاز لنفس المقال خلال 12 ساعة
  // (إعادة تحميل الصفحة كانت تحتسب مشاهدة جديدة في كل مرة).
  useEffect(() => {
    if (!readingArticle) return;
    if (viewedArticleIdsRef.current.has(readingArticle.id)) return;
    if (readingArticle.writerId && readingArticle.writerId === currentUserId) return;

    const articleId = readingArticle.id;
    const storageKey = `literium_viewed_${articleId}`;
    try {
      const last = Number(localStorage.getItem(storageKey) || 0);
      if (last && Date.now() - last < 12 * 60 * 60 * 1000) {
        viewedArticleIdsRef.current.add(articleId);
        return;
      }
    } catch {
      // التخزين محجوب — نكتفي بمنع التكرار داخل الجلسة
    }

    const timer = window.setTimeout(() => {
    viewedArticleIdsRef.current.add(articleId);
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // تجاهل
    }
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, viewsCount: (a.viewsCount || 0) + 1 } : a))
    );

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
    }, 5000);
    return () => window.clearTimeout(timer);
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

  // حذف نهائي من لوحة تحكم الأدمن لمقال أي مستخدم آخر — كانت لوحة "حوكمة
  // المحتوى" (AdminContentTab) تعرض فقط زر "أرشفة/حجب" (يُبقي المقال في
  // قاعدة البيانات بحالة archived) بلا أي زر حذف نهائي فعلي. بخلاف
  // handleDeleteArticle أعلاه (مصمَّم لحذف الكاتب مقاله الخاص، فيُنقص
  // articlesCount لدى currentUser نفسه)، هذه الدالة تبحث عن الكاتب
  // الحقيقي صاحب المقال (قد يكون أي مستخدم آخر غير الأدمن) لتُنقص عدّاده
  // هو بالتحديد.
  const handleDeleteArticleAsAdmin = async (articleId: string) => {
    if (!window.confirm('سيُحذف هذا المقال نهائياً لكل الزوار ولا يمكن التراجع. هل تريد المتابعة؟')) {
      return;
    }
    const target = articles.find((a) => a.id === articleId);
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    if (target) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === target.writerId
            ? { ...u, articlesCount: Math.max(0, (u.articlesCount || 1) - 1) }
            : u
        )
      );
    }
    try {
      await deleteArticleFromFirestore(articleId);
    } catch (err: any) {
      console.error('Error deleting article as admin in Firestore:', err);
      alert('حدث خطأ أثناء حذف المقال من Firestore: ' + (err?.message || 'خطأ غير معروف'));
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
   * إنشاء حملة إعلانية — بحالة 'pending' بانتظار مراجعة الأدمن (تطابق قاعدة
   * الأمان في firestore.rules التي كانت تشترط خطأً 'draft' فترفض كل عملية
   * إنشاء بصمت). لا تُموَّل ولا تُفعَّل هنا إطلاقاً — الأدمن وحده يقرر
   * الموافقة/الرفض عبر /api/campaigns/:id/review (انظر AdminAdsTab).
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
      // كانت هذه الحقول الثلاثة تُملأ في نموذج الإنشاء (NewCampaignModal)
      // ثم تُهمَل هنا كلياً عند إعادة بناء newCamp من الصفر — فيُحفظ فيديو
      // الإعلان دائماً فارغاً، وأهم من ذلك: نوع "ترويج قناة/حساب اجتماعي"
      // بأكمله (promotionKind) يضيع فتُحفظ الحملة كإعلان موقع عادي، رغم أن
      // AdSlot.tsx وSocialPromoCta.tsx يعتمدان عليه فعلياً لعرض واجهة الترويج
      // الصحيحة.
      videoUrl: campData.videoUrl,
      uploadedVideoUrl: campData.uploadedVideoUrl,
      promotionKind: campData.promotionKind,
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
      await saveCampaignToFirestore(newCamp);
      alert('تم إرسال حملتك الإعلانية إلى الإدارة للمراجعة، وستصلك رسالة فور الموافقة عليها أو رفضها.');

      // إخطار كل حسابات الأدمن بطلب حملة جديدة بانتظار المراجعة — بلا هذا
      // الإشعار كانت الحملة تصل لقاعدة البيانات دون أن يعلم الأدمن إطلاقاً
      // إلا بفتح لوحة الإعلانات يدوياً كل مرة.
      users
        .filter((u) => u.role === 'admin')
        .forEach((admin) => {
          createNotificationInFirestore({
            userId: admin.id,
            actorId: currentUser.id,
            type: 'campaign',
            title: 'حملة إعلانية جديدة بانتظار المراجعة',
            message: `أرسل ${currentUser.fullName} حملة إعلانية جديدة "${newCamp.campaignName}" بانتظار موافقتك.`
          }).catch((err) => console.error('تعذر إخطار الأدمن بالحملة الجديدة:', err));
        });
    } catch (err: any) {
      console.error('تعذر حفظ الحملة:', err);
      alert(err?.message || 'تعذر حفظ الحملة. تحقق من اتصالك ثم حاول مجدداً.');
    }
  };

  // Admin Approve/Reject Pending Campaign
  const handleReviewCampaign = async (campaignId: string, decision: 'approve' | 'reject') => {
    try {
      const result = await reviewCampaign(campaignId, decision);
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId ? { ...c, status: result.decision === 'approve' ? 'active' : 'rejected' } : c
        )
      );
    } catch (err: any) {
      console.error('تعذر معالجة قرار مراجعة الحملة:', err);
      alert(err?.message || 'تعذر معالجة القرار. حاول مجدداً.');
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

  // حذف حملة إعلانية — متاح لصاحبها (المعلن) أو الأدمن فقط، مطابقةً
  // لقواعد Firestore (allow delete: advertiserId == uid || isAdmin()).
  const handleDeleteCampaign = async (campaignId: string) => {
    const target = campaigns.find((c) => c.id === campaignId);
    if (!target) return;
    const isOwner = target.advertiserId === currentUser.id;
    if (!isOwner && currentUser.role !== 'admin') {
      alert('يمكن حذف الحملة من صاحبها أو إدارة المنصة فقط.');
      return;
    }
    if (!window.confirm(`هل تريد حذف حملة "${target.campaignName}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    try {
      await deleteCampaignInFirestore(campaignId);
    } catch (err) {
      console.error('تعذر حذف الحملة:', err);
      alert('تعذر حذف الحملة. حاول مجدداً.');
      // استرجاع محلي عند فشل الحذف الفعلي
      setCampaigns((prev) => (prev.some((c) => c.id === campaignId) ? prev : [...prev, target]));
    }
  };

  // KYC Save
  // إرسال الطلب نفسه (رفع صورة الوثيقة + التحليل الآلي بمطابقة الاسم) يتم
  // بالكامل داخل KycModal عبر POST /api/kyc/submit — يحتاج معالجة ملف
  // ورفعه واستدعاء Gemini، لا يمكن تنفيذها من هنا. هذه الدالة تُستدعى بعد
  // نجاح ذلك الطلب فقط، بالحالة الفعلية التي أعادها السيرفر (قد تكون
  // "verified" فوراً إن طابقت الوثيقة اسم الحساب بثقة عالية، أو "pending"
  // بانتظار مراجعة بشرية) — لتحديث الحالة محلياً فقط دون أي كتابة إضافية.
  const handleSaveKyc = (kyc: KycDetails) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              kycDetails: kyc,
              isKycVerified: kyc.status === 'verified' ? true : u.isKycVerified
            }
          : u
      )
    );
  };

  // KYC Reject — رفض يدوي من الأدمن بعد مراجعة صورة الوثيقة فعلياً.
  const handleRejectKyc = async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isKycVerified: false, kycDetails: u.kycDetails ? { ...u.kycDetails, status: 'rejected' } : u.kycDetails } : u))
    );
    try {
      await setUserKycRejectedInFirestore(userId);
      await markKycDocumentReviewed(userId, 'rejected', currentUser.id);
    } catch (err) {
      console.error('تعذر رفض طلب توثيق الهوية:', err);
      alert('تعذر تسجيل قرار الرفض.');
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
      sendPushNotification(
        recipientId,
        'messages',
        currentUser.fullName,
        media && !content.trim() ? (media.type === 'sticker' ? '📎 ملصق' : '📎 وسائط') : content.trim()
      );
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

  return {
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
  };
}
