import React, { useMemo, useState } from 'react';
import { MessageSquare, Search, X } from 'lucide-react';
import { Tweet, TweetComment, User, AdCampaign } from '../types';
import { TweetComposer } from './TweetComposer';
import { TweetCard } from './TweetCard';
import { AdSlot } from './AdSlot';

interface TweetFeedProps {
  currentUser: User;
  tweets: Tweet[];
  comments: TweetComment[];
  likedTweetIds: string[];
  favoritedTweetIds: string[];
  campaigns?: AdCampaign[];
  onPostTweet: (content: string, imageUrl?: string, mediaType?: 'image' | 'video') => void | Promise<void>;
  /** يتغيّر كلما ضُغط زر الكتابة العائم وكان المستخدم في وضع التغريد — يُستخدَم
   *  لتمرير الصفحة إلى المُنشئ وتركيز حقل الكتابة، بدل فتح محرر مقال كامل لا
   *  علاقة له بالتغريد إطلاقاً. */
  focusComposeTrigger?: number;
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
  onPostTweet,
  focusComposeTrigger,
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
  // بحث محلي بالمحتوى أو اسم/معرّف الكاتب — لم يكن لقسم التغريد أي وسيلة
  // بحث إطلاقاً، بخلاف قسم المدونة الذي يملك شريط بحث خاصاً به.
  const [searchQuery, setSearchQuery] = useState('');
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

  return (
    <div className="space-y-4">
      {!isGuest && (
        <TweetComposer currentUser={currentUser} onSubmit={onPostTweet} focusTrigger={focusComposeTrigger} />
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث في التغريدات أو عن كاتب..."
          className="w-full ps-9 pe-9 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-hidden focus:border-brand-500 shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {filteredTweets.length === 0 ? (
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
