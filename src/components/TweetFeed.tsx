import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { Tweet, TweetComment, User, AdCampaign, Article } from '../types';
import { TweetComposer } from './TweetComposer';
import { TweetCard } from './TweetCard';
import { TweetCardSkeleton } from './TweetCardSkeleton';
import { AdSlot } from './AdSlot';
import { buildMemberLabelMap } from '../utils/creatorEligibility';

interface TweetFeedProps {
  currentUser: User;
  tweets: Tweet[];
  comments: TweetComment[];
  likedTweetIds: string[];
  favoritedTweetIds: string[];
  campaigns?: AdCampaign[];
  /** لحساب وسم "الكاتب/قارئ مسجل" الحقيقي لكل صاحب تغريدة (انظر
   *  resolveAuthorMemberLabel) بدل الثقة بـtweet.authorRole المخزَّن وقت
   *  النشر — يحمل قيمة role الأصلية دائماً بصرف النظر عن الأهلية الفعلية. */
  users: User[];
  articles: Article[];
  followsData: { followingId: string }[];
  onPostTweet: (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => void | Promise<void>;
  /** يتغيّر كلما ضُغط زر الكتابة العائم وكان المستخدم في وضع التغريد — يُستخدَم
   *  لتمرير الصفحة إلى المُنشئ وتركيز حقل الكتابة، بدل فتح محرر مقال كامل لا
   *  علاقة له بالتغريد إطلاقاً. */
  focusComposeTrigger?: number;
  /** نص البحث الحالي — أصبح مُتحكَّماً به من الصف العلوي بجانب زر التحديث
   *  (App.tsx)، بدل شريط بحث منفصل هنا، ليطابق نفس موضع زر بحث المدونة. */
  searchQuery: string;
  /** true إلى أن يصل أول رد فعلي من Firestore — بلا ذاكرة تخزين محلي
   *  للتغريدات، القائمة فارغة دائماً عند كل فتح للتطبيق، فبدون هذا العلم
   *  كانت رسالة "لا توجد تغريدات" تومض دائماً للحظة قبل وصول البيانات
   *  الحقيقية حتى مع وجود تغريدات فعلية. */
  isLoading?: boolean;
  onToggleLike: (tweetId: string) => void;
  onToggleFavorite: (tweetId: string) => void;
  onShare: (tweet: Tweet) => void;
  onDeleteTweet: (tweetId: string) => void;
  onAddComment: (tweetId: string, content: string, imageUrl?: string) => void;
  onLikeComment: (commentId: string, isLiking: boolean) => void;
  onReplyToComment: (commentId: string, content: string) => void;
  onSelectAuthor?: (userId: string) => void;
}

// كل كم تغريدة يُدرج إعلان منصة واحد — تباعد كافٍ حتى لا يُشعر القارئ
// بازدحام إعلاني أثناء التصفح السريع المعتاد لمحتوى قصير.
// كانت القيمة 6 سابقاً — على منصة حديثة بعدد تغريدات محدود، هذا يعني أن
// أول موضع إعلاني في خلاصة التغريد لا يظهر إطلاقاً قبل توفر 6 تغريدات
// فأكثر، فتبقى إعلانات الشبكات الخارجية هنا (أولويتها في tweet_feed) بلا
// أي فرصة للظهور عملياً. عتبة أقل تضمن ظهورها فعلياً.
const TWEETS_PER_AD = 3;

export const TweetFeed: React.FC<TweetFeedProps> = ({
  currentUser,
  tweets,
  comments,
  likedTweetIds,
  favoritedTweetIds,
  campaigns = [],
  users,
  articles,
  followsData,
  onPostTweet,
  focusComposeTrigger,
  searchQuery,
  isLoading = false,
  onToggleLike,
  onToggleFavorite,
  onShare,
  onDeleteTweet,
  onAddComment,
  onLikeComment,
  onReplyToComment,
  onSelectAuthor
}) => {
  const isGuest = currentUser.id === 'guest';
  // بحث محلي بالمحتوى أو اسم/معرّف الكاتب — searchQuery مُمرَّر الآن من
  // الصف العلوي بجانب زر التحديث (App.tsx) بدل حالة داخلية هنا.
  const filteredTweets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tweets;
    return tweets.filter(
      (t) =>
        t.content.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q) ||
        t.authorUsername.toLowerCase().includes(q)
    );
  }, [tweets, searchQuery]);

  // خريطة (معرّف كاتب ← وسم حقيقي) محسوبة مرة واحدة لكل كتّاب فريدين
  // ظاهرين حالياً، بدل إعادة حساب نفس الكاتب في كل تغريدة له.
  const authorLabels = useMemo(
    () => buildMemberLabelMap(filteredTweets.map((t) => t.authorId), users, articles, followsData),
    [filteredTweets, users, articles, followsData]
  );

  return (
    <div className="space-y-4">
      {!isGuest && (
        <TweetComposer currentUser={currentUser} onSubmit={onPostTweet} focusTrigger={focusComposeTrigger} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <TweetCardSkeleton key={n} />
          ))}
        </div>
      ) : filteredTweets.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {searchQuery ? 'لا نتائج مطابقة لبحثك.' : 'لا توجد تغريدات بعد — كن أول من يشارك خاطرة قصيرة.'}
          </p>
        </div>
      ) : (
        filteredTweets.map((tweet, idx) => (
          <React.Fragment key={tweet.id}>
            {idx > 0 && idx % TWEETS_PER_AD === 0 && (
              <AdSlot slotId="tweet_feed" campaigns={campaigns} viewerId={currentUser.id !== 'guest' ? currentUser.id : null} />
            )}
            <TweetCard
              tweet={tweet}
              authorLabel={authorLabels[tweet.authorId]}
              currentUser={currentUser}
              isLiked={likedTweetIds.includes(tweet.id)}
              isFavorited={favoritedTweetIds.includes(tweet.id)}
              comments={comments.filter((c) => c.tweetId === tweet.id)}
              onToggleLike={onToggleLike}
              onToggleFavorite={onToggleFavorite}
              onShare={onShare}
              onDelete={onDeleteTweet}
              onAddComment={onAddComment}
              onLikeComment={onLikeComment}
              onReplyToComment={onReplyToComment}
              onSelectAuthor={onSelectAuthor}
            />
          </React.Fragment>
        ))
      )}
    </div>
  );
};
