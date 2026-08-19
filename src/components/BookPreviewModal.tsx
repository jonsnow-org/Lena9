import React, { useState } from 'react';
import { X, BookOpen, Star, Sparkles, CheckCircle2, User, Eye, Bookmark, Share2, Download, ExternalLink, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { Book, User as UserType } from '../types';

interface BookPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  author?: UserType | null;
  onSelectAuthor?: (authorId: string) => void;
}

export const BookPreviewModal: React.FC<BookPreviewModalProps> = ({
  isOpen,
  onClose,
  book,
  author,
  onSelectAuthor
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'sample'>('about');
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  if (!isOpen || !book) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-android-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-500/20">
              {book.category}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              إصدار {book.publishedYear}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2 rounded-xl border transition-colors ${
                isLiked
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-600'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500'
              }`}
              title="إعجاب"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              onClick={() => setIsSaved(!isSaved)}
              className={`p-2 rounded-xl border transition-colors ${
                isSaved
                  ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800 text-teal-600'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-teal-600'
              }`}
              title="حفظ في المفضلة"
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-teal-500 text-teal-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Hero: 3D Book & Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-start">
            <div className="relative w-28 sm:w-32 h-40 sm:h-44 shrink-0 rounded-2xl overflow-hidden book-cover-3d bg-slate-900 border border-slate-700 shadow-lg">
              <img
                src={book.coverImage}
                alt={book.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-y-0 start-0 w-2 bg-gradient-to-r from-black/70 to-transparent" />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white leading-snug">
                {book.title}
              </h3>

              {/* Author pill */}
              <div
                onClick={() => {
                  if (book.authorId && onSelectAuthor) {
                    onClose();
                    onSelectAuthor(book.authorId);
                  }
                }}
                className="inline-flex items-center gap-2 p-1.5 pe-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700/60 cursor-pointer transition-colors"
              >
                {book.authorAvatar && (
                  <img
                    src={book.authorAvatar}
                    alt={book.author}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {book.author}
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
              </div>

              {/* Stats Bar */}
              <div className="flex items-center justify-center sm:justify-start gap-3 text-xs pt-1">
                <span className="flex items-center gap-1 font-black text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-400/20">
                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500" />
                  <span>{book.rating}</span>
                  <span className="text-[10px] text-amber-600/70 font-medium">({book.reviewsCount})</span>
                </span>

                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {book.pages} صفحة
                </span>

                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {book.readsCount.toLocaleString('ar-EG')} قراءة
                </span>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-1">
            <button
              onClick={() => setActiveTab('about')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'about'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              عن الكتاب
            </button>
            <button
              onClick={() => setActiveTab('sample')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'sample'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              مقتطف من النص
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'about' ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {book.description}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {book.tags?.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-500/20 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-loose italic">
              "{book.sampleExcerpt || 'تأملات عميقة بين سطور هذا المؤلف الأدبي الرفيع...'}"
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-700 hover:to-cyan-800 text-white text-xs sm:text-sm font-black shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 transition-transform active:scale-98"
          >
            <BookOpen className="w-4 h-4" />
            <span>{book.isFree ? 'ابدأ القراءة الفورية' : `اقتناء الكتاب (${book.price}$)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
