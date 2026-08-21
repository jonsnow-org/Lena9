import React, { useState } from 'react';
import {
  Search,
  TrendingUp,
  Compass,
  Sparkles,
  Users,
  Award,
  BookOpen,
  ArrowRight,
  Flame,
  CheckCircle2,
  Bookmark,
  Heart,
  Eye,
  MessageSquare
} from 'lucide-react';
import { Article, User } from '../types';
import { formatDateTimeAr } from '../utils/dateFormat';

interface ExploreViewProps {
  articles: Article[];
  writers: User[];
  onSelectArticle: (article: Article) => void;
  onSelectWriter: (writer: User) => void;
  onFollowWriter: (writerId: string) => void;
  followedWriterIds: string[];
  onToggleBookmark: (articleId: string) => void;
  bookmarkedArticleIds: string[];
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  articles,
  writers,
  onSelectArticle,
  onSelectWriter,
  onFollowWriter,
  followedWriterIds,
  onToggleBookmark,
  bookmarkedArticleIds
}) => {
  const [exploreQuery, setExploreQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'trending' | 'top_rated' | 'writers' | 'locked'>('trending');

  // Extract real tags and dynamic counts directly from actual articles
  const tagCounts: Record<string, number> = {};
  articles.forEach((art) => {
    (art.tags || []).forEach((t) => {
      const cleanTag = t.trim();
      if (cleanTag) {
        tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
      }
    });
  });

  const dynamicTrendingTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      name,
      count: `${count} مقال`
    }));

  const filteredArticles = articles.filter((art) => {
    const q = exploreQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      art.title.toLowerCase().includes(q) ||
      art.description.toLowerCase().includes(q) ||
      art.writerName.toLowerCase().includes(q) ||
      (art.tags && art.tags.some((t) => t.toLowerCase().includes(q)));

    if (!matchSearch) return false;

    if (activeFilter === 'trending') return art.viewsCount > 100;
    if (activeFilter === 'top_rated') return (art.ratingsCount || 0) > 0 && (art.rating || 0) >= 4.8;
    if (activeFilter === 'writers') return writers.some((w) => w.id === art.writerId);
    if (activeFilter === 'locked') return art.isLocked;
    return true;
  });

  return (
    <div className="space-y-6 animate-android-in pb-12">
      {/* Explore Header & Search Input */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
              استكشف العالم الأدبي
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تصفح نخبة الكُتّاب، أكثر المقالات رواجاً والمواضيع الأكثر نقاشاً
            </p>
          </div>
        </div>

        {/* Large Touch Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute start-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={exploreQuery}
            onChange={(e) => setExploreQuery(e.target.value)}
            placeholder="ابحث عن كاتب، عنوان مقال، فكرة فلسفية..."
            className="w-full ps-12 pe-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'trending', label: '🔥 الأكثر رواجاً', icon: Flame },
          { id: 'top_rated', label: '⭐ الأعلى تقييماً', icon: Award },
          { id: 'writers', label: '✍️ كبار الكُتّاب', icon: Users },
          { id: 'locked', label: '💎 مقالات مميزة وحصرية', icon: Sparkles }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`min-h-[42px] px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 flex items-center gap-1.5 ${
              activeFilter === tab.id
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Featured Writers Section */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
              كُتّاب موصى بمتابعتهم
            </h3>
          </div>
          <span className="text-xs text-teal-600 dark:text-teal-400 font-bold">
            {writers.length} كاتب
          </span>
        </div>

        {/* Horizontal scrollable writers list */}
        {writers.length > 0 ? (
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {writers.map((writer) => {
              const isFollowing = followedWriterIds.includes(writer.id);
              return (
                <div
                  key={writer.id}
                  className="shrink-0 w-44 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center text-center group"
                >
                  <div
                    onClick={() => onSelectWriter(writer)}
                    className="cursor-pointer relative mb-2"
                  >
                    <img
                      src={writer.avatarUrl}
                      alt={writer.fullName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-teal-500/30 group-hover:scale-105 transition-transform"
                    />
                    {writer.isVerified && (
                      <span className="absolute -bottom-1 -end-1 bg-teal-600 text-white rounded-full p-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <h4
                    onClick={() => onSelectWriter(writer)}
                    className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-full cursor-pointer hover:text-teal-600 transition-colors"
                  >
                    {writer.fullName}
                  </h4>

                  <p className="text-[11px] text-slate-400 line-clamp-1 mb-3">
                    {writer.bio || 'كاتب ومفكر في منصة ليتيريوم'}
                  </p>

                  <button
                    onClick={() => onFollowWriter(writer.id)}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                      isFollowing
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                    }`}
                  >
                    {isFollowing ? 'مُتابَع' : '+ متابعة'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3 text-center">لا يوجد كُتّاب متاحون حالياً.</p>
        )}
      </div>

      {/* Trending Tags Cloud */}
      {dynamicTrendingTags.length > 0 && (
        <div className="rounded-3xl bg-gradient-to-br from-teal-900/10 via-slate-900/10 to-slate-900/5 dark:from-teal-950/40 dark:via-slate-950/30 dark:to-slate-900/40 border border-teal-200/60 dark:border-teal-800/60 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              الوسوم الأكثر تداولاً
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {dynamicTrendingTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => setExploreQuery(tag.name.replace(/_/g, ' '))}
                className="px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-teal-100 dark:hover:bg-teal-950/80 border border-teal-200/60 dark:border-teal-800/60 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-all active:scale-95 touch-manipulation"
              >
                <span>#{tag.name.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                  {tag.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Explore Articles List */}
      <div className="space-y-4">
        <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <span>المقالات المستكشفة ({filteredArticles.length})</span>
        </h3>

        {filteredArticles.length > 0 ? (
          <div className="space-y-3">
            {filteredArticles.map((art, idx) => {
              const isSaved = bookmarkedArticleIds.includes(art.id);
              return (
                <div
                  key={art.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3 sm:gap-4 hover:border-teal-300 dark:hover:border-teal-800 transition-all active:scale-[0.99] touch-manipulation cursor-pointer"
                  onClick={() => onSelectArticle(art)}
                >
                  {/* Ranking Pill */}
                  <div className="w-7 h-7 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>

                  {/* Thumbnail */}
                  <img
                    src={art.featuredImage}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {art.writerName}
                      </span>
                      <span>•</span>
                      <span>{formatDateTimeAr(art.publishedAt)}</span>
                    </div>

                    <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 mb-1">
                      {art.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-teal-500" />
                        <span>{art.viewsCount}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span>{art.likesCount}</span>
                      </span>
                      {art.isLocked && (
                        <span className="text-amber-500 font-bold">
                          💎 {art.lockedPrice || 2.99}$
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bookmark trigger */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(art.id);
                    }}
                    className={`p-2 rounded-xl text-slate-400 hover:text-teal-600 active:scale-90 transition-transform ${
                      isSaved ? 'text-teal-600 bg-teal-50 dark:bg-teal-950' : ''
                    }`}
                    title={isSaved ? 'محفوظ في المفضلة' : 'حفظ'}
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">لا توجد مقالات مطابقة</h4>
            <p className="text-xs text-slate-500 mt-1">جرّب تغيير كلمات البحث أو الفلاتر.</p>
          </div>
        )}
      </div>
    </div>
  );
};
