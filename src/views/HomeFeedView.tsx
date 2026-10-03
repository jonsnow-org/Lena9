import React from 'react';
import { Search, RefreshCw, BookOpen, X } from 'lucide-react';
import { Article, User, AdCampaign, Tweet, TweetComment, FraudFlag } from '../types';
import { HomeFeedModeSwitcher, HomeFeedMode } from '../components/HomeFeedModeSwitcher';
import { TweetFeed } from '../components/TweetFeed';
import { FeaturedArticlesSection } from '../components/FeaturedArticlesSection';
import { TrendingArticlesSection } from '../components/TrendingArticlesSection';
import { SmartAdBanner } from '../components/SmartAdBanner';
import { ArticleCardSkeleton } from '../components/ArticleCardSkeleton';
import { ArticleCard } from '../components/ArticleCard';
import { AdSlot } from '../components/AdSlot';
import { logAdEvent } from '../services/firestoreService';

export function HomeFeedView(props: {
  homeFeedMode: HomeFeedMode;
  setHomeFeedMode: React.Dispatch<React.SetStateAction<HomeFeedMode>>;
  isTweetSearchExpanded: boolean;
  setIsTweetSearchExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  tweetSearchQuery: string;
  setTweetSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handleRefreshFeed: () => void;
  isRefreshing: boolean;
  currentUser: User;
  currentUserId: string;
  tweets: Tweet[];
  tweetComments: TweetComment[];
  tweetLikes: { id: string; tweetId: string; userId: string }[];
  favoritedTweetIds: string[];
  campaigns: AdCampaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
  users: User[];
  articles: Article[];
  followsData: { id: string; followerId: string; followingId: string }[];
  handlePostTweet: (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => Promise<void>;
  tweetComposeFocusTrigger: number;
  tweetsLoaded: boolean;
  handleToggleTweetLike: (tweetId: string) => Promise<void>;
  handleToggleTweetFavorite: (tweetId: string) => Promise<void>;
  handleShareTweet: (tweet: Tweet) => void;
  handleDeleteTweet: (tweetId: string) => Promise<void>;
  handlePostTweetComment: (tweetId: string, content: string, imageUrl?: string) => Promise<void>;
  handleToggleTweetCommentLike: (commentId: string, isLiking: boolean) => Promise<void>;
  handleReplyToTweetComment: (commentId: string, content: string) => Promise<void>;
  setViewingWriterProfile: React.Dispatch<React.SetStateAction<User | null>>;
  isSearchExpanded: boolean;
  setIsSearchExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  matchingUsers: User[];
  categoryFilters: { id: string; label: string }[];
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  featuredArticles: Article[];
  setReadingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  handleToggleBookmark: (articleId: string) => void;
  bookmarkedArticleIds: string[];
  platformAdsEnabled: boolean;
  setFraudFlags: React.Dispatch<React.SetStateAction<FraudFlag[]>>;
  filteredArticles: Article[];
  articlesLoaded: boolean;
  visibleArticles: Article[];
  handleToggleFollow: (writerId: string) => Promise<void>;
  followedWriterIds: string[];
  hasMoreArticles: boolean;
  articlesSentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    homeFeedMode,
    setHomeFeedMode,
    isTweetSearchExpanded,
    setIsTweetSearchExpanded,
    tweetSearchQuery,
    setTweetSearchQuery,
    handleRefreshFeed,
    isRefreshing,
    currentUser,
    currentUserId,
    tweets,
    tweetComments,
    tweetLikes,
    favoritedTweetIds,
    campaigns,
    setCampaigns,
    users,
    articles,
    followsData,
    handlePostTweet,
    tweetComposeFocusTrigger,
    tweetsLoaded,
    handleToggleTweetLike,
    handleToggleTweetFavorite,
    handleShareTweet,
    handleDeleteTweet,
    handlePostTweetComment,
    handleToggleTweetCommentLike,
    handleReplyToTweetComment,
    setViewingWriterProfile,
    isSearchExpanded,
    setIsSearchExpanded,
    searchQuery,
    setSearchQuery,
    matchingUsers,
    categoryFilters,
    selectedCategory,
    setSelectedCategory,
    featuredArticles,
    setReadingArticle,
    handleToggleBookmark,
    bookmarkedArticleIds,
    platformAdsEnabled,
    setFraudFlags,
    filteredArticles,
    articlesLoaded,
    visibleArticles,
    handleToggleFollow,
    followedWriterIds,
    hasMoreArticles,
    articlesSentinelRef
  } = props;

  return (
    /* Main Feed View: Available to all users/roles when on 'feed' */
    <div className="space-y-6 animate-android-in" data-btn-theme={homeFeedMode === 'tweet' ? 'blue' : 'green'}>
        {/* مبدّل المدونة/التغريد — "الستارة": القسم النشط يتمدد والآخر ينطوي بجانبه */}
        <HomeFeedModeSwitcher mode={homeFeedMode} onChange={setHomeFeedMode} />

        {homeFeedMode === 'tweet' && (
          <>
          {/* -mt-4 يعاكس فجوة space-y-6 الموروثة من الحاوية الأب —
              كان هذا الصف يترك فراغاً كبيراً واضحاً أعلى وأسفل زر
              وحيد صغير، فيبدو وكأن الشاشة فارغة. زر البحث الآن بجانب
              زر التحديث في نفس الصف مباشرة (كان شريط بحث منفصلاً أسفل
              مُنشئ التغريدة، بعيداً عن زر التحديث). */}
          <div className="flex flex-row items-center justify-between gap-2 -mt-4">
            {isTweetSearchExpanded ? (
              <div className="flex items-stretch flex-1 min-w-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all overflow-hidden">
                <div className="w-9 shrink-0 flex items-center justify-center text-slate-400 border-e border-slate-200 dark:border-slate-800">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  autoFocus
                  type="text"
                  value={tweetSearchQuery}
                  onChange={(e) => setTweetSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!tweetSearchQuery.trim()) setIsTweetSearchExpanded(false);
                  }}
                  placeholder="ابحث في التغريدات أو عن كاتب..."
                  className="w-full px-3 py-2 bg-transparent text-xs outline-hidden text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    setTweetSearchQuery('');
                    setIsTweetSearchExpanded(false);
                  }}
                  className="w-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                  title="إغلاق البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsTweetSearchExpanded(true)}
                className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all touch-manipulation active:scale-95"
                title="بحث في التغريدات"
                aria-label="بحث في التغريدات"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleRefreshFeed}
              disabled={isRefreshing}
              className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-all touch-manipulation active:scale-95 shrink-0"
              title="تحديث التغريدات"
              aria-label="تحديث التغريدات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-500' : ''}`} />
            </button>
          </div>
          <TweetFeed
            currentUser={currentUser}
            tweets={tweets}
            comments={tweetComments}
            likedTweetIds={tweetLikes.filter((l) => l.userId === currentUserId).map((l) => l.tweetId)}
            favoritedTweetIds={favoritedTweetIds}
            campaigns={campaigns}
            users={users}
            articles={articles}
            followsData={followsData}
            onPostTweet={handlePostTweet}
            focusComposeTrigger={tweetComposeFocusTrigger}
            searchQuery={tweetSearchQuery}
            isLoading={!tweetsLoaded}
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
            وليست أيقونة عائمة داخل الحقل، حتى يكون شكلها واضحاً كزر بحث حقيقي.
            -mt-4 يعاكس فجوة space-y-6 الموروثة من الحاوية الأب — نفس إصلاح
            صف تحديث التغريدات أعلاه بالضبط، كان هذا الصف يترك فراغاً واضحاً
            أعلى زرين صغيرين فقط فيبدو وكأن الشاشة فارغة. */}
        <div className="flex flex-row items-center justify-between gap-2 -mt-4">
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

        {/* Categories Scroll Filter — -mt-3 يقلّص فجوة space-y-6 الموروثة
            (24px) إلى ما يقارب النصف، فلا يبقى فراغ كبير مضاعف بين صف
            البحث/التحديث وشرائح التصنيفات أسفله. */}
        <div className="relative -mt-3">
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
            articles={featuredArticles}
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
          <AdSlot
            slotId="category_banner"
            campaigns={campaigns}
            viewerId={currentUserId || null}
            adFree={false}
            category={selectedCategory}
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
            {selectedCategory === 'all' ? 'مقالات مختارة لك' : categoryFilters.find((c) => c.id === selectedCategory)?.label}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filteredArticles.length} مقال متاح
          </span>
        </div>

        {/* Loading Skeletons when refreshing، أو عند التحميل الأول قبل
            وصول أي بيانات حقيقية (بدل رسالة "لا توجد مقالات" الفارغة
            التي كانت تومض للحظة على جهاز جديد بلا ذاكرة محلية) */}
        {!articlesLoaded ? (
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
            {visibleArticles.map((article, idx) => (
              <React.Fragment key={article.id}>
              {/* home_feed_1/2 لوضعية "كل الأقسام" فقط، وcategory_feed
                  عند تصفح قسم محدد — بدل عرض موضع الصفحة الرئيسية
                  بالخطأ داخل كل تصنيف.
                  ⚠️ كانت هذه المواضع مربوطة سابقاً بـ idx===6/12 —
                  أي تتطلب 7 مقالات فأكثر قبل أن يظهر أول موضع إعلاني
                  هنا إطلاقاً. لمنصة حديثة بعدد مقالات أقل من ذلك (وهو
                  الحال الفعلي)، كانت هذه المواضع (وبالتبعية أي إعلان
                  شبكة خارجية أولويتها هنا) لا تُركَّب في الصفحة أبداً،
                  بصرف النظر عن أي إعداد إداري صحيح. عتبات أخفض تضمن
                  ظهورها فعلياً حتى مع محتوى قليل. */}
              {selectedCategory === 'all' && (idx === 2 || idx === 8) && (
                <AdSlot
                  slotId={idx === 2 ? 'home_feed_1' : 'home_feed_2'}
                  campaigns={campaigns}
                  viewerId={currentUserId || null}
                  adFree={false}
                />
              )}
              {selectedCategory !== 'all' && idx === 2 && (
                <AdSlot
                  slotId="category_feed"
                  campaigns={campaigns}
                  viewerId={currentUserId || null}
                  adFree={false}
                />
              )}
              <ArticleCard
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
        {articlesLoaded && hasMoreArticles && (
          <div ref={articlesSentinelRef} className="flex justify-center py-6" aria-hidden="true">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
        )}
        </>
        )}
      </div>
  );
}
