import React from 'react';
import { Users, CheckCircle2, Award, Crown, Zap, Sparkles, TrendingUp, UserCheck, UserPlus } from 'lucide-react';
import { User } from '../types';

interface TopAuthorsSectionProps {
  authors?: User[];
  onSelectAuthor: (author: User) => void;
  onFollowAuthor: (authorId: string) => void;
  followedAuthorIds?: string[];
  /** عدد المتابعين الحقيقي لكل كاتب، محسوب من مجموعة follows الفعلية —
   *  بخلاف user.followersCount المخزَّن الذي لا يُحدَّث أبداً ويبقى صفراً. */
  followersCountByUserId?: Record<string, number>;
}

export const TopAuthorsSection: React.FC<TopAuthorsSectionProps> = ({
  authors = [],
  onSelectAuthor,
  onFollowAuthor,
  followedAuthorIds = [],
  followersCountByUserId = {}
}) => {
  const safeAuthors = Array.isArray(authors) ? authors : [];
  // Sort authors by views or real followers count
  const sortedAuthors = [...safeAuthors]
    .filter((u) => u.role === 'writer' || (u.articlesCount && u.articlesCount > 0))
    .sort(
      (a, b) =>
        (b.totalViews || followersCountByUserId[b.id] || 0) -
        (a.totalViews || followersCountByUserId[a.id] || 0)
    )
    .slice(0, 6);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="absolute -top-1.5 -start-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900 z-10" title="الكاتب الأول">
          👑
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="absolute -top-1.5 -start-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-teal-400 to-cyan-600 text-white font-black text-[11px] flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900 z-10" title="المرتبة الثانية">
          2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="absolute -top-1.5 -start-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 text-white font-black text-[11px] flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900 z-10" title="المرتبة الثالثة">
          3
        </span>
      );
    }
    return (
      <span className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center ring-2 ring-white dark:ring-slate-900 z-10">
        {index + 1}
      </span>
    );
  };

  return (
    <section id="top-authors-section" className="space-y-3.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-blue-500/20 via-brand-500/20 to-teal-500/20 dark:from-blue-500/30 dark:to-teal-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight">
                الكُتّاب الأكثر قراءة ومتابعة
              </h3>
              <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                أقلام مميزة
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              تصفح ملفات كبار المفكرين والأدباء وانضم لمجتمعاتهم الفكرية
            </p>
          </div>
        </div>
      </div>

      {/* Authors Carousel Cards */}
      <div className="flex items-stretch gap-3 sm:gap-3.5 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
        {sortedAuthors.map((author, idx) => {
          const isFollowing = followedAuthorIds.includes(author.id);
          return (
            <div
              key={author.id}
              className="snap-start shrink-0 w-48 sm:w-54 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 literium-card flex flex-col items-center text-center justify-between group shadow-xs hover:border-teal-400/50"
            >
              <div className="flex flex-col items-center w-full">
                {/* Avatar with Ranking */}
                <div
                  onClick={() => onSelectAuthor(author)}
                  className="relative mb-2.5 cursor-pointer"
                >
                  {getRankBadge(idx)}
                  <img
                    src={author.avatarUrl}
                    alt={author.fullName}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover ring-2 ring-teal-500/30 group-hover:scale-105 group-hover:ring-teal-500 transition-all duration-300"
                    loading="lazy"
                  />
                  {author.isVerified && (
                    <span className="absolute -bottom-1 -end-1 bg-teal-600 text-white rounded-full p-0.5 ring-2 ring-white dark:ring-slate-900">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Author Name */}
                <h4
                  onClick={() => onSelectAuthor(author)}
                  className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-full cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {author.fullName}
                </h4>

                {/* Specialty / Bio */}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-medium">
                  {author.specialties?.[0] || author.bio || 'مفكر وكاتب'}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-2 py-1 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 w-full">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {(followersCountByUserId[author.id] ?? 0).toLocaleString('ar-EG')} متابع
                  </span>
                  <span>•</span>
                  <span>{author.articlesCount || 0} مقال</span>
                </div>
              </div>

              {/* Follow Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFollowAuthor(author.id);
                }}
                className={`w-full mt-3 py-1.5 px-3 rounded-xl text-xs font-bold transition-all touch-manipulation active:scale-95 flex items-center justify-center gap-1 ${
                  isFollowing
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-xs shadow-teal-500/20'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>مُتابَع</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>متابعة</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
