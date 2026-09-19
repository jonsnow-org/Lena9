import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Lock,
  Save,
  CheckCircle,
  Wand2,
  BookOpen,
  FileText,
  HelpCircle,
  Loader2,
  Crown,
  Zap,
  AlertCircle,
  LogIn,
  Maximize2,
  Minimize2,
  Tag,
  PenTool,
  Check,
  RotateCcw,
  Eye,
  Edit3,
  Layers,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Link as LinkIcon,
  CheckCheck,
  ListOrdered,
  Search
} from 'lucide-react';
import { Article, ArticleCategory, User } from '../types';
import { VideoUrlInput, VideoEmbed } from './VideoEmbed';
import { MediaUploadInput } from './MediaUploadInput';
import { VideoPlayer } from './VideoPlayer';
import { getRemainingAiUses } from '../utils/aiQuota';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface ArticleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveArticle: (articleData: Partial<Article>, status: 'published' | 'draft') => Promise<void> | void;
  initialArticle?: Article | null;
  currentUser: User | null;
  onOpenAuth: () => void;
  onOpenSubscription: () => void;
  onConsumeAiQuota: () => boolean;
  onOpenImageStudio?: (suggestedPrompt?: string, onSelectCallback?: (url: string) => void) => void;
}

const COVER_IMAGE_PRESETS = [
  {
    label: 'أدب وكتابة كلاسيكية',
    url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80'
  },
  {
    label: 'فلسفة وفكر',
    url: 'https://images.unsplash.com/photo-1507842229451-79b1be897a27?w=1200&auto=format&fit=crop&q=80'
  },
  {
    label: 'تكنولوجيا وذكاء اصطناعي',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80'
  },
  {
    label: 'تاريخ وحضارات',
    url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1200&auto=format&fit=crop&q=80'
  },
  {
    label: 'علم وفضاء',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80'
  }
];

export const ArticleEditorModal: React.FC<ArticleEditorModalProps> = ({
  isOpen,
  onClose,
  onSaveArticle,
  initialArticle,
  currentUser,
  onOpenAuth,
  onOpenSubscription,
  onConsumeAiQuota,
  onOpenImageStudio
}) => {
  // مفتاح خاص بكل مستخدم صراحة (uid داخل اسم المفتاح نفسه): مفتاح ثابت مشترك
  // بين كل الحسابات كان يعني أن مسودة غير منشورة لحساب "أ" تظهر فوراً لحساب "ب"
  // بمجرد تسجيل الدخول على نفس الجهاز/المتصفح — بل وتنتقل حتى عبر نسخ احتياطي
  // بيانات أندرويد التلقائي (Auto Backup) إلى جهاز آخر مختلف تماماً طالما يستخدم
  // نفس حساب جوجل، لأن localStorage الخاص بالـWebView يُنسخ ضمن هذا النسخ
  // الاحتياطي. ربط المفتاح بمعرّف المستخدم يمنع هذا التسرب من جذوره.
  const draftKey = currentUser ? `literium_article_editor_draft_${currentUser.id}` : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('literature');
  const [subCategory, setSubCategory] = useState('');
  const [featuredImage, setFeaturedImage] = useState(COVER_IMAGE_PRESETS[0].url);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockedPrice, setLockedPrice] = useState<number>(3.0);
  const [tagsInput, setTagsInput] = useState('أدب, فكر, قراءات');

  // Submitting state & errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync state whenever modal opens or initialArticle changes
  useEffect(() => {
    if (!isOpen) return;
    setSubmitError(null);
    setIsSubmitting(false);

    if (initialArticle) {
      setTitle(initialArticle.title || '');
      setDescription(initialArticle.description || '');
      setContent(initialArticle.content || '');
      setCategory(initialArticle.category || 'literature');
      setSubCategory(initialArticle.subCategory || '');
      setFeaturedImage(initialArticle.featuredImage || COVER_IMAGE_PRESETS[0].url);
      setVideoUrl(initialArticle.videoUrl || '');
      setUploadedVideoUrl(initialArticle.uploadedVideoUrl || '');
      setSourceUrl(initialArticle.sourceUrl || '');
      setIsLocked(initialArticle.isLocked || false);
      setLockedPrice(initialArticle.lockedPrice || 3.0);
      setTagsInput(
        Array.isArray(initialArticle.tags) ? initialArticle.tags.join(', ') : 'أدب, فكر, قراءات'
      );
    } else {
      const savedDraft = JSON.parse((draftKey ? localStorage.getItem(draftKey) : null) || '{}');
      setTitle(savedDraft.title || '');
      setDescription(savedDraft.description || '');
      setContent(savedDraft.content || '');
      setCategory(savedDraft.category || 'literature');
      setSubCategory(savedDraft.subCategory || '');
      setFeaturedImage(savedDraft.featuredImage || COVER_IMAGE_PRESETS[0].url);
      setVideoUrl(savedDraft.videoUrl || '');
      setUploadedVideoUrl(savedDraft.uploadedVideoUrl || '');
      setSourceUrl(savedDraft.sourceUrl || '');
      setIsLocked(savedDraft.isLocked || false);
      setLockedPrice(savedDraft.lockedPrice || 3.0);
      setTagsInput(
        Array.isArray(savedDraft.tags) ? savedDraft.tags.join(', ') : 'أدب, فكر, قراءات'
      );
    }
  }, [isOpen, initialArticle]);

  // Editor View Mode: 'edit' or 'preview'
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  // Focus Mode
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);

  // AI assistant loading & output
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [activeAiTool, setActiveAiTool] = useState<string | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  // مولّد وسوم/وصف/تصنيف SEO بالذكاء الاصطناعي + تأكيد مسح المسودة — كانت
  // هذه الثلاثة معرَّفة بعد `if (!isOpen) return null` أدناه، فتُستدعى فقط
  // في الإطارات التي isOpen=true. React يقارن عدد الخطافات بين كل إطار
  // متتالٍ لنفس المكوّن (وهذا المكوّن مثبَّت دوماً في App.tsx بغض النظر عن
  // isOpen)، فأول ضغطة على "كتابة مقال" تنقل isOpen من false إلى true
  // وتستدعي 3 خطافات useState لم تُستدعَ في الإطار السابق — خطأ فادح
  // ("Rendered more hooks than during the previous render") يُسقط الشجرة
  // بأكملها لشاشة بيضاء فوراً. نقلها هنا قبل الشرط يضمن استدعاءها دائماً.
  const [isSeoLoading, setIsSeoLoading] = useState(false);
  const [seoSuccessNotice, setSeoSuccessNotice] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Word count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Auto save draft to localStorage
  useEffect(() => {
    if (draftKey && !initialArticle && (title || content || description)) {
      const timer = setTimeout(() => {
        const draftObj = {
          title,
          description,
          content,
          category,
          subCategory,
          featuredImage,
          videoUrl,
          uploadedVideoUrl,
          sourceUrl,
          isLocked,
          lockedPrice,
          tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean)
        };
        localStorage.setItem(draftKey, JSON.stringify(draftObj));
        const now = new Date();
        setLastAutoSaved(
          now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        );
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [draftKey, title, description, content, category, subCategory, featuredImage, videoUrl, uploadedVideoUrl, sourceUrl, isLocked, lockedPrice, tagsInput, initialArticle]);
  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  const quotaStats = currentUser ? getRemainingAiUses(currentUser.aiQuota) : null;
  const isOutOfQuota = quotaStats ? !quotaStats.isUnlimited && quotaStats.remaining <= 0 : true;

  const handleAiAction = async (
    actionType:
      | 'suggest_titles'
      | 'generate_paragraph'
      | 'improve_style'
      | 'fix_grammar'
      | 'summarize_article'
      | 'suggest_categories'
      | 'generate_outline'
  ) => {
    setAiErrorMessage(null);

    // 1. Mandatory login check
    if (!currentUser) {
      setAiErrorMessage('يتطلب استخدام أدوات الذكاء الاصطناعي تسجيل الدخول أولاً.');
      onOpenAuth();
      return;
    }

    // 2. Quota check
    if (isOutOfQuota) {
      setAiErrorMessage('لقد استنفدت حد الاستخدام المجاني لليوم (10 استخدامات). اشترك في باقة Pro للمتابعة.');
      onOpenSubscription();
      return;
    }

    // 3. Deduct usage
    const allowed = onConsumeAiQuota();
    if (!allowed) {
      onOpenSubscription();
      return;
    }

    setActiveAiTool(actionType);
    setIsAiLoading(true);
    setAiOutput(null);

    // مهلة زمنية صريحة للطلب: بدونها كان أي تعثر شبكي أو تأخر من جهة
    // الخدمة الذكية يترك المستخدم أمام مؤشر تحميل عالق للأبد دون أي رسالة
    // تفسّر له ما يجري — وهذا ما كان يُقرأ كـ"بطء شديد" في الأدوات حتى لو
    // كان السبب الفعلي طلباً واحداً معلّقاً لا أكثر.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch('/api/ai/writing-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: actionType,
          title,
          text: content || description,
          category,
          userId: currentUser.id,
          isSubscriber: !!currentUser.aiQuota?.plan && currentUser.aiQuota.plan !== 'none',
          plan: currentUser.aiQuota?.plan || 'none'
        })
      });

      const data = await res.json();
      if (res.ok && data.result) {
        setAiOutput(data.result);
      } else {
        setAiErrorMessage(data.message || data.error || 'تعذر الاتصال بالخدمة الذكية.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setAiErrorMessage('استغرقت الخدمة الذكية وقتاً أطول من المعتاد ولم تستجب. حاول مرة أخرى، أو اختصر النص إن كان طويلاً.');
      } else {
        setAiErrorMessage('حدث خطأ أثناء معالجة الطلب الذكي.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAiLoading(false);
    }
  };

  const handleGenerateAiSeo = async () => {
    setAiErrorMessage(null);
    setSeoSuccessNotice(null);

    if (!currentUser) {
      setAiErrorMessage('يتطلب استخدام أدوات الذكاء الاصطناعي تسجيل الدخول أولاً.');
      onOpenAuth();
      return;
    }

    if (isOutOfQuota) {
      setAiErrorMessage('لقد استنفدت حد الاستخدام المجاني لليوم. اشترك في باقة Pro للمتابعة.');
      onOpenSubscription();
      return;
    }

    if (!title && !content) {
      setAiErrorMessage('يرجى كتابة عنوان المقال أو جزء من محتواه أولاً لتوليد وسوم وسيو ملائم.');
      return;
    }

    const allowed = onConsumeAiQuota();
    if (!allowed) {
      onOpenSubscription();
      return;
    }

    setIsSeoLoading(true);
    try {
      const res = await fetch('/api/ai/seo-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          category,
          userId: currentUser.id,
          isSubscriber: !!currentUser.aiQuota?.plan && currentUser.aiQuota.plan !== 'none',
          plan: currentUser.aiQuota?.plan || 'none'
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          setTagsInput(data.tags.join(', '));
        }
        if (data.metaDescription && !description) {
          setDescription(data.metaDescription);
        }
        if (data.suggestedCategory) {
          setCategory(data.suggestedCategory as ArticleCategory);
        }
        setSeoSuccessNotice('تم توليد الوسوم والوصف التعريفي والتصنيف الأنسب بالذكاء الاصطناعي بنجاح!');
        setTimeout(() => setSeoSuccessNotice(null), 4000);
      } else {
        setAiErrorMessage(data.message || data.error || 'تعذر توليد الوسوم تلقائياً.');
      }
    } catch {
      setAiErrorMessage('حدث خطأ أثناء توليد وسوم ومفاتيح SEO الذكية.');
    } finally {
      setIsSeoLoading(false);
    }
  };

  const handleApplyAiOutput = () => {
    if (!aiOutput) return;

    if (activeAiTool === 'suggest_titles') {
      // Pick first title from list if numbered
      const firstLine = aiOutput.split('\n')[0].replace(/^\d+[\.\-\s]+/, '').replace(/^["']|["']$/g, '');
      setTitle(firstLine);
    } else if (activeAiTool === 'generate_paragraph' || activeAiTool === 'generate_outline') {
      setContent((prev) => (prev ? `${prev}\n\n${aiOutput}` : aiOutput));
    } else if (activeAiTool === 'improve_style' || activeAiTool === 'fix_grammar') {
      setContent(aiOutput);
    } else if (activeAiTool === 'summarize_article') {
      setDescription(aiOutput);
    } else if (activeAiTool === 'suggest_categories') {
      const tagsMatch = aiOutput.match(/#[^\s,]+/g);
      if (tagsMatch) {
        setTagsInput(tagsMatch.map((t) => t.replace('#', '')).join(', '));
      }
    }
    setAiOutput(null);
    setActiveAiTool(null);
  };

  const handleClearDraft = () => {
    setShowClearConfirm(true);
  };

  const confirmClearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setTitle('');
    setDescription('');
    setContent('');
    setTagsInput('أدب, ثقافة');
    setLastAutoSaved(null);
    setShowClearConfirm(false);
  };

  const handleAction = async (status: 'published' | 'draft') => {
    if (!title.trim() || !content.trim()) {
      setSubmitError('يرجى ملء عنوان المقال ومحتواه الرئيسي أولاً قبل الحفظ أو النشر.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // الوسوم تُخزَّن دائماً بلا علامة # (تُضاف تلقائياً عند العرض في كل
      // مكان — معاينة المحرر وصفحة قراءة المقال)، حتى لو كتبها المستخدم
      // بنفسه في الحقل — لتفادي ظهورها مكررة "##".
      const tagsArray = tagsInput
        .split(',')
        .map((s) => s.trim().replace(/^#+/, ''))
        .filter(Boolean);

      await onSaveArticle(
        {
          title: title.trim(),
          description: description.trim() || title.trim().slice(0, 120),
          content: content.trim(),
          category,
          subCategory: subCategory.trim() || undefined,
          featuredImage,
          videoUrl,
          uploadedVideoUrl: uploadedVideoUrl.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          isLocked,
          lockedPrice: isLocked ? Number(lockedPrice) : 0,
          tags: tagsArray.length > 0 ? tagsArray : ['أدب', 'ثقافة']
        },
        status
      );

      if (!initialArticle && draftKey) {
        localStorage.removeItem(draftKey);
      }
      onClose();
    } catch (err: any) {
      console.error('Error in article action:', err);
      setSubmitError(err?.message || 'تعذر حفظ المقال في Firestore. يرجى التحقق من الاتصال والمحاولة مجدداً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div
        className={`relative w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFocusMode ? 'max-w-6xl h-[94vh]' : 'max-w-4xl max-h-[90vh]'
        }`}
      >
        {/* Header Strip */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>{initialArticle ? 'تعديل المقال' : 'استوديو كتابة ونشر المقالات'}</span>
                {lastAutoSaved && !initialArticle && (
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-500/20">
                    حُفظ محلياً: {lastAutoSaved}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {wordCount} كلمة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle: Edit vs Preview */}
            <div className="p-1 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>التحرير</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>معاينة المقال</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isFocusMode ? 'إنهاء وضع التركيز' : 'وضع التركيز الكامل'}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="إغلاق"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {submitError && (
          <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="p-1 hover:bg-red-500/20 rounded-lg text-red-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* AI Writing Suite Toolbar Bar */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-brand-950/40 via-brand-950/30 to-slate-900 border-b border-brand-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-brand-300 font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>أدوات الذكاء الاصطناعي (Gemini):</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('suggest_titles')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3 text-brand-300" />
              <span>اقتراح عناوين</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('generate_paragraph')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <PenTool className="w-3 h-3 text-teal-300" />
              <span>توليد فقرة</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('improve_style')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>تحسين الأسلوب</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('fix_grammar')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3 text-emerald-300" />
              <span>تدقيق لغوي</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('generate_outline')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <ListOrdered className="w-3 h-3 text-indigo-300" />
              <span>مخطط مقال</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('summarize_article')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <FileText className="w-3 h-3 text-cyan-300" />
              <span>تلخيص المقال</span>
            </button>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={() => handleAiAction('suggest_categories')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-900/40 hover:bg-brand-800/60 border border-brand-500/30 text-brand-200 font-medium whitespace-nowrap active:scale-95 transition-all flex items-center gap-1"
            >
              <Tag className="w-3 h-3 text-emerald-300" />
              <span>اقتراح وسوم</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <span>المتبقي اليوم:</span>
            <span className="font-bold text-brand-300">
              {quotaStats?.isUnlimited ? '∞ غير محدود' : `${quotaStats?.remaining ?? 5}/5`}
            </span>
          </div>
        </div>

        {/* AI Output Banner if present */}
        {isAiLoading && (
          <div className="p-3 bg-brand-950/60 border-b border-brand-500/30 flex items-center justify-center gap-2 text-xs text-brand-200 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>جاري صياغة وتحليل النص باستخدام Gemini AI...</span>
          </div>
        )}

        {aiErrorMessage && (
          <div className="p-3 bg-rose-950/60 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{aiErrorMessage}</span>
            </div>
            <button onClick={() => setAiErrorMessage(null)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {aiOutput && (
          <div className="p-4 bg-brand-950/80 border-b border-brand-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>النتيجة المقترحة من الذكاء الاصطناعي:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAiOutput}
                  className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs active:scale-95 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>تطبيق في المقال</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiOutput(null)}
                  className="text-xs text-slate-400 hover:text-white px-2"
                >
                  تجاهل
                </button>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/90 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap border border-slate-800 leading-relaxed font-sans max-h-44 overflow-y-auto">
              {aiOutput}
            </div>
          </div>
        )}

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {viewMode === 'preview' ? (
            /* ================= LIVE PREVIEW MODE ================= */
            <div className="space-y-6 max-w-3xl mx-auto py-2">
              <div className="rounded-3xl overflow-hidden aspect-16/9 bg-slate-950 relative shadow-xl">
                <img
                  src={featuredImage}
                  alt={title || 'غلاف المقال'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                <div className="absolute bottom-6 start-6 end-6 text-white space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md">
                      {category}
                    </span>
                    {isLocked && (
                      <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md">
                        <Lock className="w-3 h-3" />
                        <span>مقال حصري مدفوع (${lockedPrice})</span>
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black leading-tight">
                    {title || 'عنوان المقال التجريبي هنا'}
                  </h1>
                </div>
              </div>

              {/* Author Strip */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80'}
                    alt="Author"
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-teal-500/30"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {currentUser?.penName || currentUser?.fullName || 'اسم الكاتب'}
                    </h4>
                    <p className="text-xs text-slate-500">مؤلف شريك في ليتيريوم</p>
                  </div>
                </div>
              </div>

              {/* Excerpt */}
              {description && (
                <div className="p-4 rounded-2xl bg-brand-50 dark:bg-brand-950/20 border-s-4 border-brand-600 text-slate-700 dark:text-slate-300 text-sm italic">
                  {description}
                </div>
              )}

              {/* Article Content */}
              <div className="text-slate-800 dark:text-slate-200 text-base leading-loose whitespace-pre-wrap font-serif">
                {content || 'اكتب محتوى المقال في وضع التحرير لتشاهد المعاينة الحية هنا...'}
              </div>

              {/* Video: uploaded file takes priority over an embed link */}
              {uploadedVideoUrl ? (
                <VideoPlayer src={uploadedVideoUrl} className="w-full rounded-2xl" />
              ) : (
                videoUrl && <VideoEmbed url={videoUrl} />
              )}

              {/* Source/reference link — shown as a citation, not as media */}
              {sourceUrl && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold">المصدر: </span>
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-teal-600 dark:text-teal-400 hover:underline break-all">
                    {sourceUrl}
                  </a>
                </div>
              )}

              {/* Tags */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
                {tagsInput.split(',').map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    #{tag.trim().replace(/^#+/, '')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form
              id="article-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleAction('published');
              }}
              className="space-y-6"
            >
              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان المقال *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="اكتب عنواناً أدبياً جاذباً وملهماً..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm sm:text-base font-bold text-slate-900 dark:text-white outline-hidden focus:border-teal-500"
                  required
                />
              </div>

              {/* Category & Tags Selector Row */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    التصنيف والوسوم الذكية (SEO)
                  </span>
                  <button
                    type="button"
                    disabled={isSeoLoading}
                    onClick={handleGenerateAiSeo}
                    className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/30 text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    {isSeoLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>توليد وسوم وسيو ذكي بنقرة واحدة (Gemini)</span>
                  </button>
                </div>

                {seoSuccessNotice && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{seoSuccessNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      التصنيف الرئيسي للمقال
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 outline-hidden focus:border-teal-500"
                    >
                      <option value="literature">الأدب والشعر</option>
                      <option value="philosophy">الفلسفة والفكر</option>
                      <option value="technology">التكنولوجيا والذكاء</option>
                      <option value="history">التاريخ والحضارات</option>
                      <option value="science">العلوم والمعرفة</option>
                      <option value="arts">الفنون والنقد</option>
                      <option value="business">الاقتصاد والأعمال</option>
                      <option value="health">طب وصحة</option>
                      <option value="politics">سياسي</option>
                      <option value="education">تعليمي</option>
                      <option value="beauty_fashion">مكياج وموضة وجمال</option>
                      <option value="sports">رياضة</option>
                      <option value="food">طبخ وأكلات</option>
                      <option value="travel">سفر وسياحة</option>
                      <option value="family">تربية وأسرة</option>
                      <option value="general">عام ودراسات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                      الوسوم (مفصولة بفواصل)
                    </label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="مثال: شعر, فلسفة, نقد, لغة عربية"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 outline-hidden focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cover Image Upload & Presets */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">صورة غلاف المقال</span>
                  {onOpenImageStudio && (
                    <button
                      type="button"
                      onClick={() => {
                        const promptSuggestion = title
                          ? `غلاف مقال أدبي وفكري بعنوان "${title}" في تصنيف (${category})`
                          : `غلاف مقال فكري وأدبي رصين بألوان دافئة`;
                        onOpenImageStudio(promptSuggestion, (generatedUrl) => {
                          setFeaturedImage(generatedUrl);
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>توليد غلاف ذكي بالذكاء الاصطناعي (Gemini)</span>
                    </button>
                  )}
                </div>

                <MediaUploadInput
                  kind="image"
                  purpose="article"
                  value={featuredImage}
                  onChange={setFeaturedImage}
                  label="اختيار أو رفع صورة الغلاف"
                />

                {/* رفع فيديو حقيقي للمقال — بلا حد لمدة الفيديو */}
                <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-700">
                  <MediaUploadInput
                    kind="video"
                    purpose="article"
                    maxDurationSeconds={Infinity}
                    value={uploadedVideoUrl}
                    onChange={setUploadedVideoUrl}
                    label="فيديو المقال (رفع مباشر، اختياري)"
                  />
                </div>

                {/* رابط فيديو مضمّن (يوتيوب/Vimeo) — بديل عن الرفع المباشر */}
                <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-700">
                  <VideoUrlInput
                    value={videoUrl}
                    onChange={setVideoUrl}
                    label="أو رابط تضمين فيديو (يوتيوب/Vimeo، اختياري)"
                  />
                </div>

                {/* رابط مرجعي/مصدر — يظهر داخل المقال كإحالة، وليس كوسيط عرض */}
                <div className="pt-3 mt-1 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>رابط مرجعي/مصدر (اختياري، يظهر في نهاية المقال كإحالة)</span>
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/source-article"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-teal-500 text-start"
                  />
                </div>

                {/* Preset image buttons */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                  {COVER_IMAGE_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFeaturedImage(preset.url)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        featuredImage === preset.url
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <img src={preset.url} alt="" className="w-4 h-4 rounded-md object-cover" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Short Excerpt Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الوصف القصير والمقدمة (يظهر في بطاقة المقال والبحث)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="موجز جذاب يعبر عن جوهر الأطروحة أو المقال..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-teal-500"
                />
              </div>

              {/* Main Content Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  محتوى المقال الكامل *
                </label>
                <textarea
                  rows={isFocusMode ? 14 : 10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب أفكارك بتأنٍ وبلاغة... يمكنك الاستعانة بأدوات الذكاء الاصطناعي في الأعلى لتوليد وتدقيق الفقرات."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm leading-relaxed text-slate-900 dark:text-slate-100 font-sans outline-hidden focus:border-teal-500"
                  required
                />
              </div>

              {/* Monetization / Locking Options */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                        نمط النشر وتحقيق الأرباح
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        المقال المجاني يربح {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% من عوائد AdSense • المقال المقفول يربح {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% من قيمة الشراء
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLocked(false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        !isLocked
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      مجاني للجميع
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLocked(true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        isLocked
                          ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>مقفول مدفوع</span>
                    </button>
                  </div>
                </div>

                {isLocked && (
                  <div className="pt-2 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        سعر فتح المقال:
                      </label>
                      <select
                        value={lockedPrice}
                        onChange={(e) => setLockedPrice(Number(e.target.value))}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                      >
                        <option value={1.0}>$1.00</option>
                        <option value={2.5}>$2.50</option>
                        <option value={3.0}>$3.00 (الموصى به)</option>
                        <option value={5.0}>$5.00</option>
                        <option value={10.0}>$10.00</option>
                      </select>
                    </div>

                    <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                      صافي أرباحك لكل قارئ ({REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%): ${(lockedPrice * REVENUE_SHARES.LOCKED_ARTICLES.WRITER).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions Strip */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!initialArticle && (
              <button
                type="button"
                onClick={handleClearDraft}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl text-slate-500 hover:text-rose-500 text-xs font-bold transition-colors flex items-center gap-1.5"
                title="مسح المسودة المحفوظة"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">مسح المسودة</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>

            {/* Save as Draft Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction('draft')}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>حفظ كمسودة</span>
            </button>

            {/* Publish Article Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleAction('published')}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>
                {initialArticle?.status === 'published'
                  ? 'حفظ التعديلات'
                  : 'نشر المقال للجمهور'}
              </span>
            </button>
          </div>
        </div>

        {/* Clear Draft Confirmation Modal */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                  مسح المسودة والبدء من جديد؟
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  سيتم حذف النصوص والعناوين المحفوظة محلياً وإعادة ضبط المحرر.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={confirmClearDraft}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30"
                >
                  تأكيد المسح
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
