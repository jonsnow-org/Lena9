import React, { useState } from 'react';
import { Heart, MessageSquare, Share2, Star, CornerDownLeft, Trash2 } from 'lucide-react';
import { Tweet, TweetComment, User } from '../types';
import { timeAgoAr } from '../utils/dateFormat';

interface TweetCardProps {
  tweet: Tweet;
  currentUser: User;
  isLiked: boolean;
  isFavorited: boolean;
  comments: TweetComment[];
  onToggleLike: (tweetId: string) => void;
  onToggleFavorite: (tweetId: string) => void;
  onShare: (tweet: Tweet) => void;
  onDelete?: (tweetId: string) => void;
  onAddComment: (tweetId: string, content: string) => void;
  onLikeComment: (commentId: string, isLiking: boolean) => void;
  onReplyToComment: (commentId: string, content: string) => void;
  onSelectAuthor?: (userId: string) => void;
}

export const TweetCard: React.FC<TweetCardProps> = ({
  tweet,
  currentUser,
  isLiked,
  isFavorited,
  comments,
  onToggleLike,
  onToggleFavorite,
  onShare,
  onDelete,
  onAddComment,
  onLikeComment,
  onReplyToComment,
  onSelectAuthor
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const canDelete = currentUser.id === tweet.authorId || currentUser.role === 'admin';

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    onAddComment(tweet.id, commentText.trim());
    setCommentText('');
    setShowComments(true);
  };

  const handleReplySubmit = (commentId: string) => {
    if (!replyText.trim()) return;
    onReplyToComment(commentId, replyText.trim());
    setReplyText('');
    setReplyingToId(null);
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectAuthor?.(tweet.authorId)}
          className="flex items-center gap-2.5 min-w-0 text-start"
        >
          <img
            src={tweet.authorAvatar}
            alt={tweet.authorName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {tweet.authorName}
              </span>
              {tweet.authorRole === 'writer' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold shrink-0">
                  الكاتب
                </span>
              )}
              <span className="text-[11px] text-slate-400 shrink-0">@{tweet.authorUsername}</span>
            </div>
            <span className="text-[10px] text-slate-400">{timeAgoAr(tweet.createdAt)}</span>
          </div>
        </button>

        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('حذف هذه التغريدة نهائياً؟')) onDelete(tweet.id);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors shrink-0"
            title="حذف التغريدة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
        {tweet.content}
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          onClick={() => onToggleLike(tweet.id)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors active:scale-95"
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span className="text-xs font-bold">{tweet.likesCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-colors active:scale-95"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs font-bold">{tweet.commentsCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onShare(tweet)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span className="text-xs font-bold">{tweet.sharesCount || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(tweet.id)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors active:scale-95"
          title="إضافة إلى المفضلة"
        >
          <Star className={`w-4 h-4 ${isFavorited ? 'fill-amber-500 text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Comments Thread */}
      {showComments && (
        <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800/60">
          {/* Composer */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="اكتب تعليقاً..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-hidden focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold active:scale-95"
            >
              تعليق
            </button>
          </div>

          {comments.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-2">لا توجد تعليقات بعد.</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((comm) => (
                <div
                  key={comm.id}
                  className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <img
                      src={comm.userAvatar}
                      alt={comm.userName}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className="font-bold text-xs">{comm.userName}</span>
                    <span className="text-[10px] text-slate-400">{timeAgoAr(comm.createdAt)}</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-2">{comm.content}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => onLikeComment(comm.id, !(comm.likedBy || []).includes(currentUser.id))}
                      className="flex items-center gap-1 hover:text-rose-500 transition-colors active:scale-95"
                    >
                      <Heart className={`w-3 h-3 ${(comm.likedBy || []).includes(currentUser.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{comm.likesCount || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingToId(replyingToId === comm.id ? null : comm.id)}
                      className="flex items-center gap-1 hover:text-brand-600 transition-colors font-medium active:scale-95"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                      <span>رد</span>
                    </button>
                  </div>

                  {replyingToId === comm.id && (
                    <div className="mt-2 ps-3 border-s-2 border-brand-500 flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(comm.id)}
                        placeholder={`رد على ${comm.userName}...`}
                        className="flex-1 px-2.5 py-1 text-[11px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-hidden focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplySubmit(comm.id)}
                        className="px-2.5 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold active:scale-95"
                      >
                        إرسال
                      </button>
                    </div>
                  )}

                  {comm.replies && comm.replies.length > 0 && (
                    <div className="mt-2 space-y-1.5 ps-3 border-s-2 border-brand-200 dark:border-brand-900">
                      {comm.replies.map((rep) => (
                        <div
                          key={rep.id}
                          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <img
                              src={rep.userAvatar}
                              alt={rep.userName}
                              referrerPolicy="no-referrer"
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="font-bold">{rep.userName}</span>
                            <span className="text-[9px] text-slate-400">{timeAgoAr(rep.createdAt)}</span>
                          </div>
                          <p className="opacity-90">{rep.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
