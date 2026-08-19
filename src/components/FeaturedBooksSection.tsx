import React from 'react';
import { BookOpen, Star, Sparkles, ChevronLeft, ChevronRight, Eye, Bookmark, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { Book } from '../types';

interface FeaturedBooksSectionProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onSelectAuthor?: (authorId: string) => void;
}

export const FeaturedBooksSection: React.FC<FeaturedBooksSectionProps> = ({
  books,
  onSelectBook,
  onSelectAuthor
}) => {
  return (
    <section id="featured-books-section" className="space-y-3.5">
      {/* Section Header with Literary Accent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-teal-500/20 via-cyan-500/20 to-sky-500/20 dark:from-teal-500/30 dark:to-cyan-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
            <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight">
                المكتبة الرقمية: الكتب المميزة
              </h3>
              <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                <Sparkles className="w-3 h-3 text-teal-500" />
                مختارات حصرية
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              أحدث الإصدارات والمؤلفات الفكرية والأدبية لنخبة كُتّاب المنصة
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
          {books.length} مؤلفات
        </span>
      </div>

      {/* Horizontal Scrollable Books Shelf */}
      <div className="flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
        {books.map((book, index) => (
          <div
            key={book.id}
            onClick={() => onSelectBook(book)}
            className="snap-start shrink-0 w-64 sm:w-72 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 literium-card cursor-pointer shadow-xs hover:border-teal-400/50 dark:hover:border-teal-500/40 flex flex-col justify-between group"
          >
            {/* Top row: Cover Art + Meta */}
            <div className="flex gap-3.5">
              {/* 3D-styled Book Cover */}
              <div className="relative w-20 sm:w-22 h-28 sm:h-32 shrink-0 rounded-2xl overflow-hidden book-cover-3d bg-slate-800 border border-slate-700/50">
                <img
                  src={book.coverImage}
                  alt={book.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-y-0 start-0 w-1.5 bg-gradient-to-r from-black/60 to-transparent" />
                {book.isFree ? (
                  <span className="absolute top-1.5 end-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-500 text-white shadow-xs">
                    مجاني
                  </span>
                ) : (
                  <span className="absolute top-1.5 end-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 shadow-xs">
                    {book.price}$
                  </span>
                )}
              </div>

              {/* Book Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <span className="inline-block text-[10px] font-black text-teal-600 dark:text-teal-400 mb-1">
                    {book.category}
                  </span>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {book.title}
                  </h4>
                </div>

                <div className="space-y-1 pt-1">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (book.authorId && onSelectAuthor) {
                        onSelectAuthor(book.authorId);
                      }
                    }}
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors"
                  >
                    {book.authorAvatar && (
                      <img
                        src={book.authorAvatar}
                        alt={book.author}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span className="font-bold truncate">{book.author}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5 text-amber-500 font-black">
                      <Star className="w-3 h-3 fill-amber-400 stroke-amber-500" />
                      <span>{book.rating}</span>
                    </span>
                    <span>•</span>
                    <span>{book.pages} صفحة</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Excerpt & Action */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Eye className="w-3 h-3 text-slate-400" />
                <span>{book.readsCount.toLocaleString('ar-EG')} قراءة</span>
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400 group-hover:translate-x-[-2px] transition-transform">
                <span>تصفح الكتاب</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
