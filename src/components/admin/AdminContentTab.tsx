import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Lock,
  Unlock,
  Archive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Tag
} from 'lucide-react';
import { Article, User } from '../../types';

interface AdminContentTabProps {
  articles: Article[];
  users: User[];
  onSelectArticle?: (article: Article) => void;
  onUpdateArticleStatus?: (articleId: string, status: Article['status']) => void;
}

export const AdminContentTab: React.FC<AdminContentTabProps> = ({
  articles,
  users,
  onSelectArticle,
  onUpdateArticleStatus
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'published' | 'locked' | 'free' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = Array.from(new Set(articles.map((a) => a.category).filter(Boolean)));

  const filteredArticles = articles.filter((art) => {
    if (filterType === 'published' && art.status !== 'published') return false;
    if (filterType === 'archived' && art.status !== 'archived') return false;
    if (filterType === 'locked' && !art.isLocked) return false;
    if (filterType === 'free' && art.isLocked) return false;

    if (categoryFilter !== 'all' && art.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = art.title?.toLowerCase().includes(q);
      const matchAuthor = art.writerName?.toLowerCase().includes(q);
      const matchExcerpt = art.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchAuthor && !matchExcerpt) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            حوكمة المحتوى والمقالات المنشورة
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            مراجعة المقالات، تصفية المحتوى الحصري والمجاني، الأرشفة، والتحقق من جودة النشر.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>إجمالي المقالات:</span>
          <span className="font-mono text-blue-400 font-black">{articles.length}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="البحث في عنوان المقال أو اسم الكاتب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'published', label: 'المنشورة' },
              { id: 'locked', label: 'الحصرية' },
              { id: 'free', label: 'المجانية' },
              { id: 'archived', label: 'المؤرشفة' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  filterType === f.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="all">جميع التصنيفات</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Articles List */}
      {filteredArticles.length === 0 ? (
        <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
          لا توجد مقالات تطابق معايير البحث والفلترة.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredArticles.map((art) => {
            const author = users.find((u) => u.id === art.writerId);
            const isArchived = art.status === 'archived';

            return (
              <div
                key={art.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center gap-4 justify-between hover:border-slate-700 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {art.featuredImage ? (
                    <img
                      src={art.featuredImage}
                      alt={art.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {art.isLocked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>حصري (${art.lockedPrice})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          مجاني
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isArchived
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isArchived ? 'مؤرشف / غير منشور' : 'منشور نشط'}
                      </span>

                      <span className="text-[10px] font-bold text-slate-500">
                        {art.category}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white line-clamp-1">{art.title}</h4>

                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>الكاتب: {author ? author.fullName : art.writerName}</span>
                      <span>•</span>
                      <span>{art.viewsCount || 0} مشاهدة</span>
                      <span>•</span>
                      <span>{art.likesCount || 0} إعجاب</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {onSelectArticle && (
                    <button
                      onClick={() => onSelectArticle(art)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>معاينة المقال</span>
                    </button>
                  )}

                  {onUpdateArticleStatus && (
                    <>
                      {isArchived ? (
                        <button
                          onClick={() => onUpdateArticleStatus(art.id, 'published')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-emerald-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>إعادة النشر</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateArticleStatus(art.id, 'archived')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>أرشفة / حجب</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
