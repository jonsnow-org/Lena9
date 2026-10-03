import React from 'react';
import {
  Article,
  User,
  AdCampaign,
  LanguageCode,
  UserRole,
  FraudFlag,
  Tweet,
  TweetComment
} from '../types';
import { HomeFeedMode } from '../components/HomeFeedModeSwitcher';
import { WriterProfileView } from '../components/WriterProfileView';
import { UserProfileView } from '../components/UserProfileView';
import { ExploreView } from '../components/ExploreView';
import { AdvertiserDashboard } from '../components/AdvertiserDashboard';
import { HomeFeedView } from './HomeFeedView';
import { LegalSection } from '../components/LegalPages';
import { ThemePresetKey } from '../constants/themePresets';
import { BackgroundPresetKey } from '../constants/backgroundPresets';
import { ExternalAdsConfig } from '../utils/externalAdsStore';
import {
  broadcastMessageToAllUsers,
  adminAdjustUserBalance,
  logManualBalanceAdjustment,
  markEarningReleasedInFirestore,
  adminReleaseEarnings,
  setUserVerifiedInFirestore,
  setUserKycApprovedInFirestore,
  markKycDocumentReviewed,
  setUserBannedInFirestore,
  setCampaignStatusInFirestore,
  setArticleStatusInFirestore,
  resolveFraudFlagInFirestore,
  EarningRecord
} from '../services/firestoreService';
import { updateUserRoleInFirestore } from '../firebase';

const LANGUAGE_CYCLE: LanguageCode[] = ['ar', 'en', 'fr', 'es', 'zh'];

export function MainRouterView(props: {
  viewingWriterProfile: User | null;
  setViewingWriterProfile: React.Dispatch<React.SetStateAction<User | null>>;
  activeTab: string;
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  campaigns: AdCampaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
  currentUserId: string;
  currentUser: User;
  setReadingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  handleToggleFollow: (writerId: string) => Promise<void>;
  followsData: { id: string; followerId: string; followingId: string }[];
  followedWriterIds: string[];
  setActiveChatPartner: React.Dispatch<React.SetStateAction<User | null>>;
  setIsDirectMessagesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleShowFollowers: (userId: string) => void;
  handleShowFollowing: (userId: string) => void;
  bookmarkedArticleIds: string[];
  memberStatusLabel: string;
  writerActiveTab: 'blog' | 'tweet' | 'control_panel';
  setWriterActiveTab: React.Dispatch<React.SetStateAction<'blog' | 'tweet' | 'control_panel'>>;
  setIsNewCampaignOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsWalletOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsKycOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsBeta20Open: React.Dispatch<React.SetStateAction<boolean>>;
  setLegalSection: React.Dispatch<React.SetStateAction<LegalSection | null>>;
  setEditingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  setIsArticleEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteArticle: (articleId: string) => Promise<void>;
  setPromotingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  promotions: any[];
  handleSaveSocialLinks: (links: Record<string, string>) => Promise<void>;
  handleSaveProfile: (updates: { fullName?: string; penName?: string; companyName?: string; bio?: string; avatarUrl?: string }) => Promise<void>;
  pendingKycCount: number;
  pendingMoneyCount: number;
  pendingFraudCount: number;
  setIsSubscriptionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSwitchRole: (role: UserRole) => Promise<void>;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  language: LanguageCode;
  setLanguage: React.Dispatch<React.SetStateAction<LanguageCode>>;
  handleLogout: () => Promise<void>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  fraudFlags: FraudFlag[];
  setFraudFlags: React.Dispatch<React.SetStateAction<FraudFlag[]>>;
  depositRequests: any[];
  payoutRequests: any[];
  purchaseRequests: any[];
  adEvents: any[];
  earningsRecords: EarningRecord[];
  setEarningsRecords: React.Dispatch<React.SetStateAction<EarningRecord[]>>;
  manualBalanceAdjustments: any[];
  handleProcessAdEvents: () => Promise<void>;
  externalAdsConfig: ExternalAdsConfig;
  handleProcessExternalAdRevenue: () => Promise<void>;
  handleUpdatePurchaseRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>;
  handleUpdateMoneyRequest: (collectionName: 'depositRequests' | 'payoutRequests', requestId: string, status: 'approved' | 'rejected' | 'paid') => Promise<void>;
  handleUpdatePromotionStatus: (promotionId: string, status: 'approved' | 'rejected') => Promise<void>;
  handleRejectKyc: (userId: string) => Promise<void>;
  handleReviewCampaign: (campaignId: string, decision: 'approve' | 'reject') => Promise<void>;
  handleToggleCampaignStatus: (campaignId: string) => Promise<void>;
  handleDeleteCampaign: (campaignId: string) => Promise<void>;
  handleDeleteArticleAsAdmin: (articleId: string) => Promise<void>;
  followersCountByUserId: Record<string, number>;
  themePreset: ThemePresetKey;
  handleChangeThemePreset: (preset: ThemePresetKey) => Promise<void>;
  backgroundPreset: BackgroundPresetKey;
  handleChangeBackgroundPreset: (preset: BackgroundPresetKey) => Promise<void>;
  platformAdsEnabled: boolean;
  handleTogglePlatformAds: (enabled: boolean) => Promise<void>;
  handleSaveExternalAdsConfig: (config: ExternalAdsConfig) => Promise<void>;
  publishingBotsEnabled: boolean;
  handleTogglePublishingBots: (enabled: boolean) => Promise<void>;
  handleSeedBotAccounts: () => Promise<any>;
  adminActiveTab: 'overview' | 'analytics' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings';
  setAdminActiveTab: React.Dispatch<React.SetStateAction<'overview' | 'analytics' | 'fraud' | 'campaigns' | 'moderation' | 'users' | 'promotions' | 'money' | 'accounting' | 'settings'>>;
  tweets: Tweet[];
  tweetComments: TweetComment[];
  tweetLikes: { id: string; tweetId: string; userId: string }[];
  favoritedTweetIds: string[];
  handleDeleteTweet: (tweetId: string) => Promise<void>;
  handleToggleTweetLike: (tweetId: string) => Promise<void>;
  handleToggleTweetFavorite: (tweetId: string) => Promise<void>;
  handleShareTweet: (tweet: Tweet) => void;
  handlePostTweetComment: (tweetId: string, content: string, imageUrl?: string) => Promise<void>;
  handleToggleTweetCommentLike: (commentId: string, isLiking: boolean) => Promise<void>;
  handleReplyToTweetComment: (commentId: string, content: string) => Promise<void>;
  handleToggleBookmark: (articleId: string) => void;
  homeFeedMode: HomeFeedMode;
  setHomeFeedMode: React.Dispatch<React.SetStateAction<HomeFeedMode>>;
  isTweetSearchExpanded: boolean;
  setIsTweetSearchExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  tweetSearchQuery: string;
  setTweetSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  handleRefreshFeed: () => void;
  isRefreshing: boolean;
  handlePostTweet: (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => Promise<void>;
  tweetComposeFocusTrigger: number;
  tweetsLoaded: boolean;
  isSearchExpanded: boolean;
  setIsSearchExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  matchingUsers: User[];
  categoryFilters: { id: string; label: string }[];
  selectedCategory: string;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  featuredArticles: Article[];
  filteredArticles: Article[];
  articlesLoaded: boolean;
  visibleArticles: Article[];
  hasMoreArticles: boolean;
  articlesSentinelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    viewingWriterProfile,
    setViewingWriterProfile,
    activeTab,
    articles,
    setArticles,
    campaigns,
    setCampaigns,
    currentUserId,
    currentUser,
    setReadingArticle,
    handleToggleFollow,
    followsData,
    followedWriterIds,
    setActiveChatPartner,
    setIsDirectMessagesOpen,
    handleShowFollowers,
    handleShowFollowing,
    bookmarkedArticleIds,
    memberStatusLabel,
    writerActiveTab,
    setWriterActiveTab,
    setIsNewCampaignOpen,
    setIsWalletOpen,
    setIsKycOpen,
    setIsBeta20Open,
    setLegalSection,
    setEditingArticle,
    setIsArticleEditorOpen,
    handleDeleteArticle,
    setPromotingArticle,
    promotions,
    handleSaveSocialLinks,
    handleSaveProfile,
    pendingKycCount,
    pendingMoneyCount,
    pendingFraudCount,
    setIsSubscriptionOpen,
    handleSwitchRole,
    theme,
    setTheme,
    language,
    setLanguage,
    handleLogout,
    users,
    setUsers,
    fraudFlags,
    setFraudFlags,
    depositRequests,
    payoutRequests,
    purchaseRequests,
    adEvents,
    earningsRecords,
    setEarningsRecords,
    manualBalanceAdjustments,
    handleProcessAdEvents,
    externalAdsConfig,
    handleProcessExternalAdRevenue,
    handleUpdatePurchaseRequest,
    handleUpdateMoneyRequest,
    handleUpdatePromotionStatus,
    handleRejectKyc,
    handleReviewCampaign,
    handleToggleCampaignStatus,
    handleDeleteCampaign,
    handleDeleteArticleAsAdmin,
    followersCountByUserId,
    themePreset,
    handleChangeThemePreset,
    backgroundPreset,
    handleChangeBackgroundPreset,
    platformAdsEnabled,
    handleTogglePlatformAds,
    handleSaveExternalAdsConfig,
    publishingBotsEnabled,
    handleTogglePublishingBots,
    handleSeedBotAccounts,
    adminActiveTab,
    setAdminActiveTab,
    tweets,
    tweetComments,
    tweetLikes,
    favoritedTweetIds,
    handleDeleteTweet,
    handleToggleTweetLike,
    handleToggleTweetFavorite,
    handleShareTweet,
    handlePostTweetComment,
    handleToggleTweetCommentLike,
    handleReplyToTweetComment,
    handleToggleBookmark,
    homeFeedMode,
    setHomeFeedMode,
    isTweetSearchExpanded,
    setIsTweetSearchExpanded,
    tweetSearchQuery,
    setTweetSearchQuery,
    handleRefreshFeed,
    isRefreshing,
    handlePostTweet,
    tweetComposeFocusTrigger,
    tweetsLoaded,
    isSearchExpanded,
    setIsSearchExpanded,
    searchQuery,
    setSearchQuery,
    matchingUsers,
    categoryFilters,
    selectedCategory,
    setSelectedCategory,
    featuredArticles,
    filteredArticles,
    articlesLoaded,
    visibleArticles,
    hasMoreArticles,
    articlesSentinelRef
  } = props;

  return (
    /* Unified Role & Tab Based View Router */
    /* مفتاح React أدناه (key) يُعيد تركيب هذا الغلاف عند كل تبديل فعلي
        لقسم/تبويب رئيسي أو الدخول لملف كاتب آخر، فيُشغَّل .animate-android-in
        من جديد (فيد + انزلاق خفيف للأعلى، 280ms) في كل مرة — بدل التبديل
        الفوري بلا أي إحساس حركي الذي كان يجعل التنقل بين الأقسام يبدو مجرد
        صفحة ويب عادية بدل تطبيق أصيل. */
    <div key={`${viewingWriterProfile?.id || 'none'}-${activeTab}`} className="animate-android-in">
    {viewingWriterProfile ? (
      <WriterProfileView
        writer={viewingWriterProfile}
        articles={articles}
        campaigns={campaigns}
        currentUserId={currentUserId || null}
        onBack={() => setViewingWriterProfile(null)}
        onSelectArticle={(art) => setReadingArticle(art)}
        onFollowWriter={handleToggleFollow}
        followersCount={followsData.filter((f) => f.followingId === viewingWriterProfile.id).length}
        followingCount={followsData.filter((f) => f.followerId === viewingWriterProfile.id).length}
        isFollowing={followedWriterIds.includes(viewingWriterProfile.id)}
        isFollowingMe={followsData.some(
          (f) => f.followerId === viewingWriterProfile.id && f.followingId === currentUserId
        )}
        onOpenDirectMessage={(w) => {
          setActiveChatPartner(w);
          setIsDirectMessagesOpen(true);
        }}
        onShowFollowers={() => handleShowFollowers(viewingWriterProfile.id)}
        onShowFollowing={() => handleShowFollowing(viewingWriterProfile.id)}
      />
    ) : (activeTab === 'profile' || activeTab === 'articles' || activeTab === 'saved') && currentUser.id !== 'guest' ? (
      <UserProfileView
        currentUser={currentUser}
        articles={articles}
        bookmarkedArticleIds={bookmarkedArticleIds}
        followingCount={followedWriterIds.length}
        followersCount={followsData.filter((f) => f.followingId === currentUser.id).length}
        memberStatusLabel={memberStatusLabel}
        campaigns={campaigns}
        initialWriterTab={activeTab === 'profile' ? writerActiveTab : 'blog'}
        onWriterTabChange={setWriterActiveTab}
        onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
        onSelectArticle={(art) => setReadingArticle(art)}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenKyc={() => setIsKycOpen(true)}
        onOpenBeta20={() => setIsBeta20Open(true)}
        onOpenPolicies={() => setLegalSection('privacy')}
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
        onSaveProfile={handleSaveProfile}
        pendingKycCount={pendingKycCount}
        pendingMoneyCount={pendingMoneyCount}
        pendingFraudCount={pendingFraudCount}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onSwitchUserRole={handleSwitchRole}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        language={language}
        onToggleLanguage={() => setLanguage(LANGUAGE_CYCLE[(LANGUAGE_CYCLE.indexOf(language) + 1) % LANGUAGE_CYCLE.length])}
        onLogout={handleLogout}
        users={users}
        fraudFlags={fraudFlags}
        depositRequests={depositRequests}
        payoutRequests={payoutRequests}
        purchaseRequests={purchaseRequests}
        adEvents={adEvents}
        earningsRecords={earningsRecords}
        manualBalanceAdjustments={manualBalanceAdjustments}
        onProcessAdEvents={handleProcessAdEvents}
        estimatedExternalCpmUsd={externalAdsConfig.estimatedCpmUsd}
        onProcessExternalAdRevenue={handleProcessExternalAdRevenue}
        onUpdatePurchaseRequest={handleUpdatePurchaseRequest}
        onUpdateMoneyRequest={handleUpdateMoneyRequest}
        onUpdatePromotionStatus={handleUpdatePromotionStatus}
        onBroadcastMessage={(text) =>
          broadcastMessageToAllUsers(
            currentUser.id,
            users.map((u) => u.id),
            text
          )
        }
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
          await markKycDocumentReviewed(userId, 'approved', currentUser.id);
        }}
        onRejectKyc={handleRejectKyc}
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
        onReviewCampaign={handleReviewCampaign}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        onDeleteCampaign={handleDeleteCampaign}
        onUpdateArticleStatus={async (articleId, status) => {
          setArticles((prev) =>
            prev.map((a) => (a.id === articleId ? { ...a, status } : a))
          );
          await setArticleStatusInFirestore(articleId, status);
        }}
        onDeleteArticleAsAdmin={handleDeleteArticleAsAdmin}
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
        onAdjustBalance={async (userId, field, amount, reason) => {
          const target = users.find((u) => u.id === userId);
          if (!target) return;
          const current = Number((target as any)[field] ?? 0);
          const next = Number((current + amount).toFixed(2));
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? ({ ...u, [field]: next } as any) : u))
          );
          try {
            await adminAdjustUserBalance(userId, { [field]: next } as any);
            await logManualBalanceAdjustment({
              userId,
              field,
              amount,
              newValue: next,
              reason,
              adjustedBy: currentUser.id
            });
          } catch (err) {
            console.error('تعذر حفظ تعديل الرصيد:', err);
            alert('تعذر حفظ تعديل الرصيد. حاول مجدداً.');
          }
        }}
        onReleaseEarning={async (earning) => {
          const targetUser = users.find((u) => u.id === earning.userId);
          if (!targetUser) {
            alert('تعذر إيجاد بيانات هذا المستخدم لتحرير أرباحه.');
            return;
          }
          const currentPending = (targetUser as any).pendingEarnings || 0;
          const currentAvailable = (targetUser as any).availableBalance || 0;
          try {
            await adminReleaseEarnings(earning.userId, currentPending, currentAvailable, earning.amount);
            await markEarningReleasedInFirestore(earning.id);
            setEarningsRecords((prev) =>
              prev.map((e) => (e.id === earning.id ? { ...e, status: 'released' } : e))
            );
          } catch (err) {
            console.error('تعذر تحرير الربح:', err);
            alert('تعذر تحرير هذا الربح. تحقق من اتصالك ثم حاول مجدداً.');
          }
        }}
        onSelectUser={(u) => setViewingWriterProfile(u)}
        followersCountByUserId={followersCountByUserId}
        currentThemePreset={themePreset}
        onChangeThemePreset={handleChangeThemePreset}
        currentBackgroundPreset={backgroundPreset}
        onChangeBackgroundPreset={handleChangeBackgroundPreset}
        platformAdsEnabled={platformAdsEnabled}
        onTogglePlatformAds={handleTogglePlatformAds}
        externalAdsConfig={externalAdsConfig}
        onSaveExternalAdsConfig={handleSaveExternalAdsConfig}
        publishingBotsEnabled={publishingBotsEnabled}
        onTogglePublishingBots={handleTogglePublishingBots}
        onSeedBotAccounts={handleSeedBotAccounts}
        initialAdminSection={adminActiveTab}
        onAdminSectionChange={setAdminActiveTab}
        tweets={tweets.filter((t) => t.authorId === currentUser.id)}
        tweetComments={tweetComments}
        likedTweetIds={tweetLikes.filter((l) => l.userId === currentUser.id).map((l) => l.tweetId)}
        favoritedTweetIds={favoritedTweetIds}
        favoritedTweets={tweets.filter((t) => favoritedTweetIds.includes(t.id))}
        onDeleteTweet={handleDeleteTweet}
        onToggleTweetLike={handleToggleTweetLike}
        onToggleTweetFavorite={handleToggleTweetFavorite}
        onShareTweet={handleShareTweet}
        onAddTweetComment={handlePostTweetComment}
        onLikeTweetComment={handleToggleTweetCommentLike}
        onReplyToTweetComment={handleReplyToTweetComment}
        onShowFollowers={() => handleShowFollowers(currentUser.id)}
        onShowFollowing={() => handleShowFollowing(currentUser.id)}
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
        campaigns={campaigns}
        viewerId={currentUserId || null}
      />
    ) : activeTab === 'campaigns' && currentUser.id !== 'guest' ? (
      <AdvertiserDashboard
        campaigns={campaigns.filter((c) => c.advertiserId === currentUser.id)}
        onOpenNewCampaign={() => setIsNewCampaignOpen(true)}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        onDeleteCampaign={handleDeleteCampaign}
        advertiserBalance={currentUser.walletBalance || 0}
        onOpenDeposit={() => setIsWalletOpen(true)}
        activeUsersCount={Math.max(users.length, 1)}
      />
    ) : (
      <HomeFeedView
        homeFeedMode={homeFeedMode}
        setHomeFeedMode={setHomeFeedMode}
        isTweetSearchExpanded={isTweetSearchExpanded}
        setIsTweetSearchExpanded={setIsTweetSearchExpanded}
        tweetSearchQuery={tweetSearchQuery}
        setTweetSearchQuery={setTweetSearchQuery}
        handleRefreshFeed={handleRefreshFeed}
        isRefreshing={isRefreshing}
        currentUser={currentUser}
        currentUserId={currentUserId}
        tweets={tweets}
        tweetComments={tweetComments}
        tweetLikes={tweetLikes}
        favoritedTweetIds={favoritedTweetIds}
        campaigns={campaigns}
        setCampaigns={setCampaigns}
        users={users}
        articles={articles}
        followsData={followsData}
        handlePostTweet={handlePostTweet}
        tweetComposeFocusTrigger={tweetComposeFocusTrigger}
        tweetsLoaded={tweetsLoaded}
        handleToggleTweetLike={handleToggleTweetLike}
        handleToggleTweetFavorite={handleToggleTweetFavorite}
        handleShareTweet={handleShareTweet}
        handleDeleteTweet={handleDeleteTweet}
        handlePostTweetComment={handlePostTweetComment}
        handleToggleTweetCommentLike={handleToggleTweetCommentLike}
        handleReplyToTweetComment={handleReplyToTweetComment}
        setViewingWriterProfile={setViewingWriterProfile}
        isSearchExpanded={isSearchExpanded}
        setIsSearchExpanded={setIsSearchExpanded}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        matchingUsers={matchingUsers}
        categoryFilters={categoryFilters}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        featuredArticles={featuredArticles}
        setReadingArticle={setReadingArticle}
        handleToggleBookmark={handleToggleBookmark}
        bookmarkedArticleIds={bookmarkedArticleIds}
        platformAdsEnabled={platformAdsEnabled}
        setFraudFlags={setFraudFlags}
        filteredArticles={filteredArticles}
        articlesLoaded={articlesLoaded}
        visibleArticles={visibleArticles}
        handleToggleFollow={handleToggleFollow}
        followedWriterIds={followedWriterIds}
        hasMoreArticles={hasMoreArticles}
        articlesSentinelRef={articlesSentinelRef}
      />
    )}
    </div>
  );
}
