import React from 'react';
import {
  Article,
  User,
  AdCampaign,
  Comment,
  Transaction,
  AppNotification,
  Conversation,
  PaymentMethod,
  KycDetails,
  MessageReport,
  UserRole
} from '../types';
import { ArticleReader } from '../components/ArticleReader';
import { ArticleEditorModal } from '../components/ArticleEditorModal';
import { ImageStudioModal } from '../components/ImageStudioModal';
import { NotificationSettingsModal } from '../components/NotificationSettingsModal';
import { WalletModal } from '../components/WalletModal';
import { MoneyRequestModal } from '../components/MoneyRequestModal';
import { PromoteArticleModal } from '../components/PromoteArticleModal';
import { KycModal } from '../components/KycModal';
import { AiAssistantModal } from '../components/AiAssistantModal';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { DirectMessagesModal } from '../components/DirectMessagesModal';
import { FollowListModal } from '../components/FollowListModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { BetaTesting20Modal } from '../components/BetaTesting20Modal';
import { NewCampaignModal } from '../components/NewCampaignModal';
import { AuthModal } from '../components/AuthModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { requestNativeInterstitial } from '../utils/nativeBridge';
import {
  markMessagesReadByIds,
  markAllNotificationsReadInFirestore,
  markNotificationReadInFirestore,
  deleteNotificationInFirestore,
  clearAllNotificationsInFirestore
} from '../services/firestoreService';

export function AppModalsLayer(props: {
  readingArticle: Article | null;
  setReadingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  campaigns: AdCampaign[];
  isNativeApp: boolean;
  handleLikeArticle: (articleId: string) => Promise<void>;
  likedArticleIds: string[];
  handleToggleBookmark: (articleId: string) => void;
  bookmarkedArticleIds: string[];
  handleToggleFollow: (writerId: string) => Promise<void>;
  followedWriterIds: string[];
  handleUnlockArticle: (article: Article) => Promise<void>;
  unlockedArticleIds: string[];
  comments: Comment[];
  handleAddComment: (articleId: string, content: string, parentCommentId?: string) => Promise<void>;
  handleLikeComment: (commentId: string) => Promise<void>;
  handleShareArticle: (article: Article) => void;
  handleRateArticle: (articleId: string, stars: number) => Promise<void>;
  myRatingsByArticleId: Record<string, number>;
  handleReactToArticle: (articleId: string, type: string) => Promise<void>;
  currentUser: User;
  currentUserId: string;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  articles: Article[];
  followsData: { id: string; followerId: string; followingId: string }[];
  setViewingWriterProfile: React.Dispatch<React.SetStateAction<User | null>>;
  isArticleEditorOpen: boolean;
  setIsArticleEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingArticle: Article | null;
  setEditingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  handleSaveArticle: (articleData: Partial<Article>, status?: 'published' | 'draft') => Promise<void>;
  setIsAuthOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSubscriptionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleConsumeAiQuota: () => boolean;
  imageStudioPrompt: string;
  setImageStudioPrompt: React.Dispatch<React.SetStateAction<string>>;
  imageStudioSelectCallback: ((url: string) => void) | null;
  setImageStudioSelectCallback: React.Dispatch<React.SetStateAction<((url: string) => void) | null>>;
  isImageStudioOpen: boolean;
  setIsImageStudioOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsWalletOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isNotificationSettingsOpen: boolean;
  setIsNotificationSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveNotificationPrefs: (prefs: NonNullable<User['notificationPrefs']>) => Promise<void>;
  isWalletOpen: boolean;
  transactions: Transaction[];
  handleDeposit: (amount: number, method: PaymentMethod, ref: string) => Promise<void>;
  handleWithdraw: (amount: number, method: PaymentMethod, accountDetail: string) => Promise<void>;
  setIsKycOpen: React.Dispatch<React.SetStateAction<boolean>>;
  moneyModalMode: 'deposit' | 'payout' | null;
  setMoneyModalMode: React.Dispatch<React.SetStateAction<'deposit' | 'payout' | null>>;
  depositRequests: any[];
  payoutRequests: any[];
  promotingArticle: Article | null;
  setPromotingArticle: React.Dispatch<React.SetStateAction<Article | null>>;
  isKycOpen: boolean;
  handleSaveKyc: (kyc: KycDetails) => void;
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  guestIdentityUid: string;
  isSubscriptionOpen: boolean;
  handleUpgradeSuccess: (plan: 'monthly' | 'annual', paymentMethod: PaymentMethod) => { ok: boolean; error?: string };
  isDirectMessagesOpen: boolean;
  setIsDirectMessagesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  conversations: Conversation[];
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  handleSendMessage: (recipientId: string, content: string, media?: { url?: string; type: 'image' | 'video' | 'sticker' }) => Promise<void>;
  handleDeleteMessage: (messageId: string) => Promise<void>;
  handleDeleteConversation: (conversationId: string, partnerId: string) => Promise<void>;
  handleHideConversation: (conversationId: string) => Promise<void>;
  handleToggleBlockUser: (targetId: string, block: boolean) => Promise<void>;
  handleToggleMuteUser: (targetId: string, mute: boolean) => Promise<void>;
  handleReportUser: (targetId: string, conversationId: string | undefined, reason: MessageReport['reason'], details: string) => Promise<void>;
  handleSetTyping: (conversationId: string, isTyping: boolean) => void;
  activeChatPartner: User | null;
  followListModal: { title: string; userIds: string[] } | null;
  setFollowListModal: React.Dispatch<React.SetStateAction<{ title: string; userIds: string[] } | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<any>>;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  notifications: AppNotification[];
  isBeta20Open: boolean;
  setIsBeta20Open: React.Dispatch<React.SetStateAction<boolean>>;
  isNewCampaignOpen: boolean;
  setIsNewCampaignOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleCreateCampaign: (campData: Partial<AdCampaign>) => Promise<void>;
  isAuthOpen: boolean;
  authModalRole: UserRole;
  authModalMode: 'login' | 'register';
  setAuthModalMode: React.Dispatch<React.SetStateAction<'login' | 'register'>>;
  handleRealGoogleSignIn: (role?: UserRole) => Promise<void>;
  authTriggerError: string | null;
  passwordResetCode: string | null;
  setPasswordResetCode: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const {
    readingArticle,
    setReadingArticle,
    campaigns,
    isNativeApp,
    handleLikeArticle,
    likedArticleIds,
    handleToggleBookmark,
    bookmarkedArticleIds,
    handleToggleFollow,
    followedWriterIds,
    handleUnlockArticle,
    unlockedArticleIds,
    comments,
    handleAddComment,
    handleLikeComment,
    handleShareArticle,
    handleRateArticle,
    myRatingsByArticleId,
    handleReactToArticle,
    currentUser,
    currentUserId,
    users,
    setUsers,
    articles,
    followsData,
    setViewingWriterProfile,
    isArticleEditorOpen,
    setIsArticleEditorOpen,
    editingArticle,
    setEditingArticle,
    handleSaveArticle,
    setIsAuthOpen,
    setIsSubscriptionOpen,
    handleConsumeAiQuota,
    imageStudioPrompt,
    setImageStudioPrompt,
    imageStudioSelectCallback,
    setImageStudioSelectCallback,
    isImageStudioOpen,
    setIsImageStudioOpen,
    setIsWalletOpen,
    isNotificationSettingsOpen,
    setIsNotificationSettingsOpen,
    handleSaveNotificationPrefs,
    isWalletOpen,
    transactions,
    handleDeposit,
    handleWithdraw,
    setIsKycOpen,
    moneyModalMode,
    setMoneyModalMode,
    depositRequests,
    payoutRequests,
    promotingArticle,
    setPromotingArticle,
    isKycOpen,
    handleSaveKyc,
    isAiAssistantOpen,
    setIsAiAssistantOpen,
    guestIdentityUid,
    isSubscriptionOpen,
    handleUpgradeSuccess,
    isDirectMessagesOpen,
    setIsDirectMessagesOpen,
    conversations,
    messages,
    setMessages,
    handleSendMessage,
    handleDeleteMessage,
    handleDeleteConversation,
    handleHideConversation,
    handleToggleBlockUser,
    handleToggleMuteUser,
    handleReportUser,
    handleSetTyping,
    activeChatPartner,
    followListModal,
    setFollowListModal,
    setActiveTab,
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
    isBeta20Open,
    setIsBeta20Open,
    isNewCampaignOpen,
    setIsNewCampaignOpen,
    handleCreateCampaign,
    isAuthOpen,
    authModalRole,
    authModalMode,
    setAuthModalMode,
    handleRealGoogleSignIn,
    authTriggerError,
    passwordResetCode,
    setPasswordResetCode
  } = props;

  return (
    <>
      {/* Full Article Reader Modal */}
      {readingArticle && (
        <ArticleReader
          article={readingArticle}
          campaigns={campaigns}
          onClose={() => {
            setReadingArticle(null);
            if (isNativeApp) requestNativeInterstitial();
          }}
          onLike={handleLikeArticle}
          isLiked={likedArticleIds.includes(readingArticle.id)}
          onBookmark={handleToggleBookmark}
          isBookmarked={bookmarkedArticleIds.includes(readingArticle.id)}
          onFollowWriter={handleToggleFollow}
          isFollowingWriter={followedWriterIds.includes(readingArticle.writerId)}
          onUnlockArticle={handleUnlockArticle}
          isUnlockedByCurrentUser={unlockedArticleIds.includes(readingArticle.id)}
          comments={comments.filter((c) => c.articleId === readingArticle.id)}
          onAddComment={handleAddComment}
          onLikeComment={handleLikeComment}
          onShare={() => handleShareArticle(readingArticle)}
          onRate={(stars) => handleRateArticle(readingArticle.id, stars)}
          myRating={myRatingsByArticleId[readingArticle.id] || 0}
          onReact={(type) => handleReactToArticle(readingArticle.id, type)}
          sponsoredCampaign={campaigns.find((c) => c.status === 'active' && c.placementType === 'writer')}
          currentUserId={currentUser.id}
          users={users}
          articles={articles}
          followsData={followsData}
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
        onOpenImageStudio={(suggestedPrompt, onSelect) => {
          setImageStudioPrompt(suggestedPrompt || '');
          setImageStudioSelectCallback(() => onSelect || null);
          setIsImageStudioOpen(true);
        }}
      />

      {/* AI Image Generation Studio Modal */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => {
          setIsImageStudioOpen(false);
          setImageStudioSelectCallback(null);
        }}
        currentUser={currentUser}
        initialPrompt={imageStudioPrompt}
        onSelectImage={(url) => {
          if (imageStudioSelectCallback) {
            imageStudioSelectCallback(url);
          }
        }}
        onOpenWallet={() => {
          setIsImageStudioOpen(false);
          setIsWalletOpen(true);
        }}
        onOpenAuth={() => {
          setIsImageStudioOpen(false);
          setIsAuthOpen(true);
        }}
        onBalanceUpdated={(newBal) => {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === currentUser.id
                ? { ...u, walletBalance: newBal }
                : u
            )
          );
        }}
      />

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        currentUser={currentUser}
        onClose={() => setIsNotificationSettingsOpen(false)}
        onSave={handleSaveNotificationPrefs}
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        balance={currentUser.availableBalance || 0}
        spendableBalance={currentUser.walletBalance || 0}
        pendingBalance={currentUser.pendingEarnings || 0}
        transactions={transactions}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
        userRole={currentUser.role}
        isKycVerified={currentUser.isKycVerified || currentUser.kycDetails?.status === 'verified'}
        onOpenKyc={() => {
          setIsWalletOpen(false);
          setIsKycOpen(true);
        }}
        campaigns={campaigns}
        viewerId={currentUserId || null}
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
        guestIdentityUid={guestIdentityUid}
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
        users={users}
        conversations={conversations}
        messages={messages}
        campaigns={campaigns}
        onSendMessage={handleSendMessage}
        onDeleteMessage={handleDeleteMessage}
        onDeleteConversation={handleDeleteConversation}
        onHideConversation={handleHideConversation}
        onToggleBlock={handleToggleBlockUser}
        onToggleMute={handleToggleMuteUser}
        onReportUser={handleReportUser}
        onSetTyping={handleSetTyping}
        activeChatPartner={activeChatPartner}
        onOpenConversation={(partnerId) => {
          // معرّفات الرسائل غير المقروءة الواردة من هذا الطرف — من القائمة
          // المُشترَك بها أصلاً محلياً، بدل استعلام Firestore جديد (كان
          // مرفوضاً بصلاحيات لأي حساب غير أدمن — انظر شرح markMessagesReadByIds).
          const unreadIds = messages
            .filter((m) => m.senderId === partnerId && m.recipientId === currentUser.id && !m.isRead)
            .map((m) => m.id);
          if (unreadIds.length === 0) return;

          // تحديث محلي فوري أولاً — لا ننتظر جولة Firestore كاملة قبل
          // اختفاء الشارة، فيبقى المستخدم يرى "غير مقروء" لثوانٍ رغم أنه
          // يقرأ الرسالة أمامه فعلياً على شبكة بطيئة.
          setMessages((prev) =>
            prev.map((m) => (unreadIds.includes(m.id) ? { ...m, isRead: true } : m))
          );
          markMessagesReadByIds(unreadIds).catch((err) =>
            console.error('تعذر تعليم الرسائل كمقروءة:', err)
          );
        }}
        onOpenProfile={(userId) => {
          const u = users.find((usr) => usr.id === userId);
          if (u) setViewingWriterProfile(u);
        }}
      />

      {/* نافذة قائمة متابِعون/يتابع — كانت الأعداد في الملف الشخصي أرقاماً
          غير قابلة للضغط فقط، دون أي وسيلة لعرض القائمة الفعلية للأشخاص. */}
      {followListModal && (
        <FollowListModal
          title={followListModal.title}
          users={followListModal.userIds
            .map((id) => users.find((u) => u.id === id))
            .filter((u): u is User => Boolean(u))}
          currentUserId={currentUserId || null}
          followedWriterIds={followedWriterIds}
          onToggleFollow={handleToggleFollow}
          onSelectUser={(u) => {
            if (u.id === currentUserId) {
              setActiveTab('profile');
            } else {
              setViewingWriterProfile(u);
            }
          }}
          onClose={() => setFollowListModal(null)}
          campaigns={campaigns}
        />
      )}

      {/* Notifications Modal — التحديد كمقروء والحذف كانا يعدّلان الحالة
          المحلية فقط دون أي كتابة فعلية إلى Firestore، فيعود كل شيء
          "غير مقروء" فور تحديث الصفحة (subscribeToNotifications يعيد
          القيم الحقيقية من الخادم). أصبحت الآن كتابات فعلية. */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          markAllNotificationsReadInFirestore(notifications).catch((err) =>
            console.error('تعذر تحديد كل الإشعارات كمقروءة:', err)
          );
        }}
        onMarkOneAsRead={(id) => {
          markNotificationReadInFirestore(id).catch((err) =>
            console.error('تعذر تحديد الإشعار كمقروء:', err)
          );
        }}
        onDeleteOne={(id) => {
          deleteNotificationInFirestore(id).catch((err) =>
            console.error('تعذر حذف الإشعار:', err)
          );
        }}
        onClearAll={() => {
          clearAllNotificationsInFirestore(notifications).catch((err) =>
            console.error('تعذر مسح الإشعارات:', err)
          );
        }}
        onNotificationClick={(notif) => {
          // مقال (إعجاب/تعليق/رد/مشاركة على مقال) → فتح المقال نفسه.
          if (notif.articleId) {
            const art = articles.find((a) => a.id === notif.articleId);
            if (art) {
              setIsNotificationsOpen(false);
              setReadingArticle(art);
              return;
            }
          }
          // متابعة، أو تفاعل على تغريدة (لا صفحة مستقلة للتغريدة نفسها) →
          // فتح الملف الشخصي لصاحب الحدث.
          if (notif.actorId) {
            const actor = users.find((u) => u.id === notif.actorId);
            if (actor) {
              setIsNotificationsOpen(false);
              setViewingWriterProfile(actor);
            }
          }
        }}
        campaigns={campaigns}
        viewerId={currentUserId || null}
      />

      {/* Google Play 20-Tester Beta Modal */}
      <BetaTesting20Modal
        isOpen={isBeta20Open}
        onClose={() => setIsBeta20Open(false)}
      />

      {/* Reader & Advertiser Campaign Creation Modal */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onCreateCampaign={handleCreateCampaign}
        userBalance={currentUser.walletBalance || 0}
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

      {passwordResetCode && (
        <ResetPasswordModal
          oobCode={passwordResetCode}
          onClose={() => setPasswordResetCode(null)}
          onSuccess={() => {
            setPasswordResetCode(null);
            setAuthModalMode('login');
            setIsAuthOpen(true);
          }}
        />
      )}
    </>
  );
}
