import React, { useEffect, useState } from 'react';
import { Bot, Power, RefreshCw, Users2, Heart, MessageCircle, FileText, Rss, Trash2, CheckSquare, Square } from 'lucide-react';
import { User } from '../../types';
import {
  fetchRecentBotActivity,
  BotActivityLogEntry,
  fetchBotPublishedContent,
  deleteBotPublishedContentBatch,
  BotPublishedItem
} from '../../services/firestoreService';

interface AdminBotsTabProps {
  users: User[];
  publishingBotsEnabled: boolean;
  onTogglePublishingBots: (enabled: boolean) => void | Promise<void>;
  onSeedBotAccounts: () => Promise<{ created: number; alreadyExisted: number; total: number }>;
}

const ACTIVITY_ICON: Record<BotActivityLogEntry['type'], React.ElementType> = {
  article: FileText,
  tweet: Rss,
  like: Heart,
  comment: MessageCircle
};

const ACTIVITY_LABEL: Record<BotActivityLogEntry['type'], string> = {
  article: 'نشر مقالاً',
  tweet: 'نشر تغريدة',
  like: 'أعجب بـ',
  comment: 'علّق على'
};

export const AdminBotsTab: React.FC<AdminBotsTabProps> = ({
  users,
  publishingBotsEnabled,
  onTogglePublishingBots,
  onSeedBotAccounts
}) => {
  const bots = users.filter((u) => u.isBot);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const [activity, setActivity] = useState<BotActivityLogEntry[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // محتوى البوتات المنشور فعلياً (مقالات + تغريدات) — قابل للتحديد الفردي
  // أو الجماعي وحذفه: إما مقال واحد لم يعجب الأدمن، أو مسح كل شيء دفعة
  // واحدة لاحقاً بعد أن يصبح الموقع مشهوراً ولم تعد الحاجة للمحتوى الوهمي.
  const [content, setContent] = useState<BotPublishedItem[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadActivity = async () => {
    setIsLoadingActivity(true);
    try {
      const entries = await fetchRecentBotActivity(30);
      setActivity(entries);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const loadContent = async (botIds: string[]) => {
    setIsLoadingContent(true);
    try {
      const items = await fetchBotPublishedContent(botIds);
      setContent(items);
      setSelectedIds((prev) => {
        const validIds = new Set(items.map((it) => it.id));
        return new Set([...prev].filter((id) => validIds.has(id)));
      });
    } finally {
      setIsLoadingContent(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, []);

  useEffect(() => {
    if (bots.length > 0) loadContent(bots.map((b) => b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots.length]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = content.length > 0 && selectedIds.size === content.length;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(content.map((it) => it.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `سيتم حذف ${selectedIds.size} عنصر محدد نهائياً (مقالات و/أو تغريدات البوتات). هذا الإجراء لا رجعة فيه. هل تريد المتابعة؟`
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const items = content
        .filter((it) => selectedIds.has(it.id))
        .map((it) => ({ id: it.id, type: it.type }));
      await deleteBotPublishedContentBatch(items);
      setSelectedIds(new Set());
      await loadContent(bots.map((b) => b.id));
    } catch (err) {
      console.error('Bot content delete failed:', err);
      alert('تعذر حذف العناصر المحددة. تحقق من اتصالك ثم حاول مجدداً.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedMessage('');
    try {
      const result = await onSeedBotAccounts();
      setSeedMessage(
        result.created > 0
          ? `تم إنشاء ${result.created} حساب بوت جديد (${result.alreadyExisted} كان موجوداً مسبقاً من أصل ${result.total}).`
          : `كل الحسابات الثمانية موجودة مسبقاً — لا حاجة لأي إنشاء إضافي.`
      );
    } catch (err) {
      console.error('Bot seed failed:', err);
      setSeedMessage('تعذر إنشاء حسابات البوتات. تأكد من صلاحيات الأدمن ثم حاول مجدداً.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* مفتاح التشغيل/الإيقاف الرئيسي */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/15 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">بوتات النشر والتفاعل التلقائي</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                مقال واحد وتغريدة واحدة يومياً بالتداول بين 8 حسابات كتّاب افتراضيين، مع إعجابات وتعليقات تلقائية فيما بينها.
                مستبعدة تماماً من الأرباح والإحصاءات الداخلية.
              </p>
            </div>
          </div>
          <button
            onClick={() => onTogglePublishingBots(!publishingBotsEnabled)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 ${
              publishingBotsEnabled
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {publishingBotsEnabled ? 'مفعّل ✓' : 'متوقف'}
          </button>
        </div>
      </div>

      {/* الحسابات */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Users2 className="w-4 h-4 text-brand-500" />
            حسابات الكتّاب الافتراضيين ({bots.length}/8)
          </h4>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
            {bots.length === 0 ? 'تهيئة الحسابات' : 'تحديث/إكمال الحسابات'}
          </button>
        </div>
        {seedMessage && <p className="text-xs text-slate-400">{seedMessage}</p>}

        {bots.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            لا توجد حسابات بعد — اضغط "تهيئة الحسابات" لإنشاء الحسابات الثمانية.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bots.map((bot) => (
              <div key={bot.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <img src={bot.avatarUrl} alt={bot.fullName} className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{bot.fullName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{bot.bio}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* المحتوى المنشور — تحديد فردي/جماعي وحذف */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-white text-sm">
            المحتوى المنشور ({content.length})
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadContent(bots.map((b) => b.id))}
              disabled={isLoadingContent}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingContent ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {content.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">لا يوجد محتوى منشور من البوتات بعد.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 pb-1">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white transition-colors"
              >
                {allSelected ? <CheckSquare className="w-4 h-4 text-brand-500" /> : <Square className="w-4 h-4" />}
                {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0 || isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-400 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                حذف المحدد ({selectedIds.size})
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {content.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const Icon = item.type === 'article' ? FileText : Rss;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors text-right ${
                      isSelected ? 'bg-red-600/10 border-red-600/40' : 'bg-slate-800/40 border-transparent hover:bg-slate-800/70'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    )}
                    <Icon className="w-3.5 h-3.5 text-brand-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-300 truncate">{item.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })
                          : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* سجل النشاط الأخير */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white text-sm">آخر نشاطات البوتات</h4>
          <button
            onClick={loadActivity}
            disabled={isLoadingActivity}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingActivity ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">لا يوجد نشاط مسجَّل بعد.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activity.map((entry) => {
              const Icon = ACTIVITY_ICON[entry.type];
              return (
                <div key={entry.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/40">
                  <Icon className="w-3.5 h-3.5 text-brand-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-300">
                      <span className="font-bold text-white">{entry.botName}</span> {ACTIVITY_LABEL[entry.type]}
                      {entry.summary ? `: ${entry.summary}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(entry.createdAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
