import React from 'react';
import { MessageSquare } from 'lucide-react';
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
  onPostTweet: (content: string) => void | Promise<void>;
  onToggleLike: (tweetId: string) => void;
  onToggleFavorite: (tweetId: string) => void;
  onShare: (tweet: Tweet) => void;
  onDeleteTweet: (tweetId: string) => void;
  onAddComment: (tweetId: string, content: string) => void;
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

  return (
    <div className="space-y-4">
      {!isGuest && <TweetComposer currentUser={currentUser} onSubmit={onPostTweet} />}

      {tweets.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-400">لا توجد تغريدات بعد — كن أول من يشارك خاطرة قصيرة.</p>
        </div>
      ) : (
        tweets.map((tweet, idx) => (
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
