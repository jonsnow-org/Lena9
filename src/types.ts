export type UserRole = 'reader' | 'writer' | 'advertiser' | 'admin';

export type LanguageCode = 'ar' | 'en' | 'fr' | 'es' | 'zh';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type PaymentMethod =
  | 'USDT (TRC20 / BEP20)'
  | 'تحويل بنكي مباشر (Wire Transfer)'
  | 'Stripe / بطاقة ائتمانية'
  | 'PayPal'
  | 'Google Pay / Apple Pay'
  | string;

export interface KycDetails {
  idType: string;
  idNumber: string;
  selfieUrl?: string;
  status: 'none' | 'pending' | 'verified' | 'rejected';
  submittedAt?: string;
}

export type AiPlanType = 'none' | 'monthly' | 'annual';

export interface AiQuota {
  freeDailyLimit: number; // default 10
  usedToday: number;
  lastResetTime: string; // ISO string
  isSubscriber: boolean;
  plan: AiPlanType;
  planLimit?: number; // -1 for unlimited or custom number
  planExpiresAt?: string;
}

export interface SubscriptionPlan {
  id: 'monthly' | 'annual';
  name: string;
  nameEn: string;
  price: number; // USD
  periodLabel: string;
  badge?: string;
  aiLimitLabel: string;
  features: string[];
  popular?: boolean;
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  username: string;
  avatarUrl: string;
  coverUrl?: string;
  role: UserRole;
  bio?: string;
  isVerified?: boolean;
  isKycVerified?: boolean;
  isBanned?: boolean;
  kycDetails?: KycDetails;
  aiQuota?: AiQuota;
  socialLinks?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    facebook?: string;
    youtube?: string;
    whatsapp?: string;
    telegram?: string;
  };
  specialties?: string[];
  badges?: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
  }>;
  rating?: number;
  followersCount: number;
  followingCount: number;
  articlesCount?: number;
  totalViews?: number;
  totalEarnings?: number;
  monthlyEarnings?: number;
  /** رصيد المحفظة القابل للإنفاق فعلياً (شراء مقالات، حملات، اشتراكات) — يُودَع عبر مراجعة الأدمن اليدوية */
  walletBalance?: number;
  /** أرباح تجاوزت فترة التجميد (30 يوماً) وأصبحت قابلة لطلب السحب */
  availableBalance?: number;
  /** أرباح لا تزال ضمن فترة التجميد، لم تصبح قابلة للسحب بعد */
  pendingEarnings?: number;
  /** إجمالي كل الأرباح منذ إنشاء الحساب (إحصائية تراكمية، ليست رصيداً قابلاً للإنفاق) */
  lifetimeEarnings?: number;
  joinedDate?: string;
  twoFactorEnabled?: boolean;
  notificationsEnabled?: boolean;
  penName?: string;
  companyName?: string;
  companyIndustry?: string;
  companyWebsite?: string;
  advertisingGoal?: string;
}

export interface ReadingHistoryItem {
  id: string;
  articleId: string;
  articleTitle: string;
  articleCategory: string;
  featuredImage: string;
  writerName: string;
  writerAvatar: string;
  progressPercentage: number;
  lastReadAt: string;
}

export type ArticleCategory =
  | 'literature'
  | 'technology'
  | 'history'
  | 'philosophy'
  | 'business'
  | 'science'
  | 'health'
  | 'arts'
  | 'general';

export interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole: UserRole;
  content: string;
  likesCount: number;
  isLiked?: boolean;
  likedBy?: string[];
  createdAt: string;
}

export interface Comment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userRole: UserRole;
  isWriter?: boolean;
  content: string;
  likesCount: number;
  isLiked?: boolean;
  likedBy?: string[];
  isPinned?: boolean;
  createdAt: string;
  replies: CommentReply[];
}

export type ReactionType = 'love' | 'funny' | 'surprised' | 'sad' | 'insightful';

export interface ArticleReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number; // 1-5
  reaction: ReactionType;
  comment?: string;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  authorId?: string;
  authorAvatar?: string;
  coverImage: string;
  category: string;
  rating: number;
  reviewsCount: number;
  pages: number;
  description: string;
  isFree?: boolean;
  price?: number;
  readsCount: number;
  publishedYear: string;
  tags: string[];
  pdfUrl?: string;
  sampleExcerpt?: string;
}

export interface Article {
  id: string;
  writerId: string;
  writerName: string;
  writerUsername: string;
  writerAvatar: string;
  writerIsVerified: boolean;
  title: string;
  slug: string;
  description: string;
  content: string;
  featuredImage: string;
  category: ArticleCategory;
  subCategory?: string;
  isLocked: boolean;
  lockedPrice?: number; // USD
  isUnlockedByCurrentUser?: boolean;
  readingTimeMinutes: number;
  status: 'draft' | 'pending' | 'published' | 'rejected' | 'archived';
  viewsCount: number;
  likesCount: number;
  sharesCount: number;
  commentsCount: number;
  purchasesCount: number;
  rating: number;
  ratingsCount: number;
  // مجموع كل تقييمات النجوم الخام (وليس المتوسط) — يُستخدم لحساب المتوسط
  // (rating) بدقة عند إضافة أو تعديل تقييم أي مستخدم، بدل تخمين رقم ثابت.
  ratingsSum?: number;
  revenueFromAds: number;
  revenueFromSales: number;
  totalRevenue: number;
  publishedAt: string;
  tags: string[];
  /** رابط فيديو مضمّن (يوتيوب أو Vimeo) — لا يُرفع ملف */
  videoUrl?: string;
}

export type PricingModel = 'fixed' | 'cpm' | 'cpc';
export type AdPlacementType = 'platform' | 'writer' | 'category_sponsor';

export interface FraudFlag {
  id: string;
  campaignId?: string;
  campaignName?: string;
  articleId?: string;
  articleTitle?: string;
  writerId?: string;
  writerName?: string;
  userId?: string;
  userIp: string;
  pricingModel: PricingModel;
  triggerType: 'self_click' | 'rapid_refresh' | 'insufficient_dwell' | 'bot_pattern' | 'click_throttle' | 'abnormal_ctr';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'flagged' | 'auto_blocked' | 'reviewed' | 'dismissed';
  detectedAt: string;
  details: string;
  mitigationAction: string;
  revenueBlocked: number;
}

export type CampaignType = 'fixed' | 'cpm' | 'cpc' | 'impression';

export interface AdCampaign {
  id: string;
  advertiserId: string;
  advertiserName: string;
  campaignName: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
  type: CampaignType;
  pricingModel: PricingModel;
  placementType?: AdPlacementType;
  adText: string;
  status: 'active' | 'pending' | 'paused' | 'completed' | 'rejected';
  durationHours?: number; // 24, 48, 72, 168 (7 days)
  startDate: string;
  endDate: string;
  impressionsCount: number;
  validImpressionsCount?: number;
  clicksCount: number;
  validClicksCount?: number;
  conversionsCount: number;
  totalSpent: number;
  totalBudget: number;
  cpcRate?: number;
  cpmRate?: number;
  fixedRate?: number;
  fraudShieldScore?: number; // 0-100%
  blockedFraudClicks?: number;
  targetCategories: string[];
  targetCountries: string[];
  antiFraudLevel?: 'basic' | 'enhanced_viewability' | 'maximum_cpc_shield';
  /** رابط فيديو إعلاني مضمّن — يُنصح ألا يتجاوز دقيقة */
  videoUrl?: string;
}

export interface Wallet {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: string;
}

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'earning_adsense'
  | 'earning_admob'
  | 'earning_locked'
  | 'earning_campaign'
  | 'campaign_spent'
  | 'ai_subscription'
  | 'platform_fee'
  | 'manual_adjustment';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  paymentMethod: string;
  referenceId: string;
  description: string;
  relatedArticleTitle?: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId: string;
  content: string;
  mediaUrl?: string;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string;
  partnerRole: UserRole;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'earning' | 'withdrawal' | 'campaign' | 'system' | 'share' | 'reply';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  // معرّف المقال المرتبط بالإشعار (إن وُجد)، يُستخدم لفتح المقال مباشرة
  // عند الضغط على الإشعار بدل تركه بلا وجهة.
  articleId?: string;
  // معرّف صاحب الحدث (من أعجب/علّق/تابع/شارك) لعرض صورته إن رغبنا لاحقاً.
  actorId?: string;
}

export interface PlatformStats {
  totalUsers: number;
  activeReaders: number;
  activeWriters: number;
  activeAdvertisers: number;
  totalArticles: number;
  totalViews: number;
  totalPlatformRevenue: number;
  adsenseCpmBase: number;
  admobCpmBase?: number;
  dynamicAdInflationFactor: number;
}

// -------------------------------------------------------------------
// طلبات ترويج المقالات
// الكاتب يطلب، والأدمن يعتمد. لا يُخصم أي مبلغ من المتصفح — قواعد أمان
// Firestore تمنع ذلك، والخصم يتم يدوياً من لوحة الإدارة.
// -------------------------------------------------------------------
export type PromotionPricingModel = 'fixed' | 'cpc';
export type PromotionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ArticlePromotion {
  id: string;
  articleId: string;
  articleTitle?: string;
  writerId: string;
  writerName?: string;
  durationHours: number;
  pricingModel: PromotionPricingModel;
  cost: number;
  status: PromotionStatus;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  impressionsCount: number;
  clicksCount: number;
}
