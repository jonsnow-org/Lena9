import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Tweet, TweetComment, User } from '../types';
import { TweetComposer } from './TweetComposer';
import { TweetCard } from './TweetCard';

interface TweetFeedProps {
  currentUser: User;
  tweets: Tweet[];
  comments: TweetComment[];
  likedTweetIds: string[];
  favoritedTweetIds: string[];
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

export const TweetFeed: React.FC<TweetFeedProps> = ({
  currentUser,
  tweets,
  comments,
  likedTweetIds,
  favoritedTweetIds,
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
        tweets.map((tweet) => (
          <TweetCard
            key={tweet.id}
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
        ))
      )}
    </div>
  );
};
