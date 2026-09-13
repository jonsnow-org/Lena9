import React, { useRef, useState } from 'react';
import { Heart, MessageSquare, Share2, Star, CornerDownLeft, Trash2, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { Tweet, TweetComment, User } from '../types';
import { timeAgoAr } from '../utils/dateFormat';
import { uploadAdMedia, fetchMediaUploadStatus } from '../services/mediaApi';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
  onAddComment: (tweetId: string, content: string, imageUrl?: string) => void;
  onLikeComment: (commentId: string, isLiking: boolean) => void;
  onReplyToComment: (commentId: string, content: string) => void;
  onSelectAuthor?: (userId: string) => void;
}

/** زر إجراء موحّد لصف الإعجاب/التعليق/المشاركة/المفضلة — حجم وحواف ولمسة
 *  ضغط (scale-90) موحّدة على الأربعة بدل تكرار نفس الأصناف يدوياً في كل زر. */
const TweetActionButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  hoverClass: string;
  title?: string;
}> = ({ onClick, icon, label, hoverClass, title }) => (
  // بطاقة بخلفية ثابتة (لا تعتمد على hover فقط) بنفس حجم زر موحّد للأربعة
  // (إعجاب/تعليق/مشاركة/مفضلة) — نفس لغة تصميم بطاقتي "متابعون/يتابع" في
  // الملف الشخصي، ليتضح أن هذه أزرار حقيقية قابلة للنقر لا مجرد نص وأيقونة.
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl min-w-[44px] justify-center bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 transition-all active:scale-90 ${hoverClass}`}
  >
    {icon}
    {label !== undefined && <span className="text-xs font-bold">{label}</span>}
  </button>
);

/** حقل إرفاق صورة مصغّر يُستخدم في مُنشئ التعليق — يرفع فوراً عند الاختيار
 *  ويعرض معاينة قابلة للحذف، بنفس منطق TweetComposer لكن بحجم أصغر يلائم
 *  صف تعليق مضغوط. */
const InlineImageAttach: React.FC<{
  imageUrl: string;
  onImageUrlChange: (url: string) => void;
  uploading: boolean;
  onUploadingChange: (v: boolean) => void;
  onError: (msg: string) => void;
}> = ({ imageUrl, onImageUrlChange, uploading, onUploadingChange, onError }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const handlePick = async () => {
    let ok = configured;
    if (ok === null) {
      ok = await fetchMediaUploadStatus();
      setConfigured(ok);
    }
    if (!ok) {
      onError('رفع الصور غير مفعّل على الخادم حالياً.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('يرجى اختيار ملف صورة صالح.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError('حجم الصورة يتجاوز 8 ميغابايت.');
      return;
    }
    onUploadingChange(true);
    try {
      const result = await uploadAdMedia(file, 'tweet');
      onImageUrlChange(result.url);
    } catch (err: any) {
      onError(err?.message || 'تعذر رفع الصورة.');
    } finally {
      onUploadingChange(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={uploading}
        className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 active:scale-90 transition-all disabled:opacity-40 shrink-0"
        title="إرفاق صورة"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
      </button>
    </>
  );
};

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
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [commentImageUploading, setCommentImageUploading] = useState(false);
  const [commentImageError, setCommentImageError] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const canDelete = currentUser.id === tweet.authorId || currentUser.role === 'admin';

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    onAddComment(tweet.id, commentText.trim(), commentImageUrl || undefined);
    setCommentText('');
    setCommentImageUrl('');
    setCommentImageError('');
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
          className="flex items-center gap-2.5 min-w-0 text-start active:opacity-70 transition-opacity"
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
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 active:scale-90 transition-all shrink-0"
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

      {tweet.imageUrl && (
        <img
          src={tweet.imageUrl}
          alt=""
          className="w-full max-h-96 object-cover rounded-xl border border-slate-200 dark:border-slate-800"
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
        <TweetActionButton
          onClick={() => onToggleLike(tweet.id)}
          hoverClass="hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
          label={String(tweet.likesCount || 0)}
          icon={<Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />}
        />
        <TweetActionButton
          onClick={() => setShowComments((v) => !v)}
          hoverClass="hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20"
          label={String(tweet.commentsCount || 0)}
          icon={<MessageSquare className="w-4 h-4" />}
        />
        <TweetActionButton
          onClick={() => onShare(tweet)}
          hoverClass="hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
          label={String(tweet.sharesCount || 0)}
          icon={<Share2 className="w-4 h-4" />}
        />
        <TweetActionButton
          onClick={() => onToggleFavorite(tweet.id)}
          hoverClass="hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20"
          title="إضافة إلى المفضلة"
          icon={<Star className={`w-4 h-4 ${isFavorited ? 'fill-amber-500 text-amber-500' : ''}`} />}
        />
      </div>

      {/* Comments Thread */}
      {showComments && (
        <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800/60">
          {/* Composer */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <InlineImageAttach
                imageUrl={commentImageUrl}
                onImageUrlChange={setCommentImageUrl}
                uploading={commentImageUploading}
                onUploadingChange={setCommentImageUploading}
                onError={setCommentImageError}
              />
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
                disabled={!commentText.trim() || commentImageUploading}
                className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold active:scale-90 transition-transform shrink-0"
              >
                تعليق
              </button>
            </div>
            {commentImageUploading && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 ps-1">
                <Loader2 className="w-3 h-3 animate-spin" /> جاري رفع الصورة...
              </p>
            )}
            {commentImageUrl && !commentImageUploading && (
              <div className="relative inline-block ms-8">
                <img src={commentImageUrl} alt="" className="max-h-24 rounded-lg border border-slate-200 dark:border-slate-700 object-cover" />
                <button
                  type="button"
                  onClick={() => setCommentImageUrl('')}
                  className="absolute top-1 end-1 p-0.5 rounded-md bg-slate-950/70 text-white hover:bg-slate-950 active:scale-90 transition-transform"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {commentImageError && <p className="text-[11px] text-rose-500 font-medium ps-1">{commentImageError}</p>}
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
                  {comm.imageUrl && (
                    <img
                      src={comm.imageUrl}
                      alt=""
                      className="max-h-56 w-full object-cover rounded-lg border border-slate-200 dark:border-slate-700 mb-2"
                    />
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => onLikeComment(comm.id, !(comm.likedBy || []).includes(currentUser.id))}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-90"
                    >
                      <Heart className={`w-3 h-3 ${(comm.likedBy || []).includes(currentUser.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{comm.likesCount || 0}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingToId(replyingToId === comm.id ? null : comm.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/50 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20 transition-all font-medium active:scale-90"
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
                        className="px-2.5 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold active:scale-90 transition-transform"
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
