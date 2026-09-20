import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowRight,
  Heart,
  Share2,
  Bookmark,
  MessageSquare,
  Lock,
  Sparkles,
  Star,
  CheckCircle2,
  Send,
  CornerDownLeft,
  DollarSign,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  Type,
  Sun,
  Moon,
  Coffee,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  ArrowUp,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Article, Comment, ReactionType, AdCampaign, User } from '../types';
import { formatDateAr, formatDateTimeAr, timeAgoAr } from '../utils/dateFormat';
import { SmartAdBanner } from './SmartAdBanner';
import { AdSlot } from './AdSlot';
import { VideoEmbed } from './VideoEmbed';
import { VideoPlayer } from './VideoPlayer';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { buildMemberLabelMap } from '../utils/creatorEligibility';

type ReaderTheme = 'default' | 'sepia' | 'charcoal';
type ReaderFontSize = 'sm' | 'md' | 'lg' | 'xl';

interface ArticleReaderProps {
  article: Article;
  onClose: () => void;
  onLike: (articleId: string) => void;
  isLiked: boolean;
  onBookmark: (articleId: string) => void;
  isBookmarked: boolean;
  onFollowWriter: (writerId: string) => void;
  isFollowingWriter: boolean;
  onUnlockArticle: (article: Article) => void;
  isUnlockedByCurrentUser?: boolean;
  comments: Comment[];
  onAddComment: (articleId: string, content: string, parentCommentId?: string) => void;
  onLikeComment: (commentId: string) => void;
  onShare?: () => void;
  onRate?: (stars: number) => void;
  myRating?: number;
  onReact?: (type: ReactionType) => void;
  sponsoredCampaign?: AdCampaign | null;
  onWriterProfileClick?: (writerId: string) => void;
  currentUserId?: string;
  campaigns?: AdCampaign[];
  isAdFree?: boolean;
  /** لحساب وسم "الكاتب/قارئ مسجل" الحقيقي لكل معلّق/رادّ (انظر
   *  resolveAuthorMemberLabel) بدل الثقة بـComment.userRole/CommentReply.userRole
   *  المخزَّنين وقت النشر — يحملان دائماً قيمة role الأصلية بصرف النظر عن
   *  الأهلية الفعلية، وكل حساب جديد role='writer' افتراضياً. */
  users?: User[];
  articles?: Article[];
  followsData?: { followingId: string }[];
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  article,
  onClose,
  onLike,
  isLiked,
  onBookmark,
  isBookmarked,
  onFollowWriter,
  isFollowingWriter,
  onUnlockArticle,
  isUnlockedByCurrentUser = false,
  comments,
  onAddComment,
  onLikeComment,
  onShare,
  onRate,
  myRating = 0,
  sponsoredCampaign,
  onWriterProfileClick,
  currentUserId,
  campaigns = [],
  isAdFree = false,
  onReact,
  users = [],
  articles = [],
  followsData = []
}) => {
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // خريطة (معرّف معلّق ← وسم حقيقي) لكل معلّقين/رادّين فريدين على هذا
  // المقال — بدل الثقة بـComment.userRole/CommentReply.userRole المخزَّنين
  // وقت النشر (انظر resolveAuthorMemberLabel لسبب عدم كفايتهما).
  const commenterLabels = useMemo(() => {
    const ids = comments.flatMap((c) => [c.userId, ...c.replies.map((r) => r.userId)]);
    return buildMemberLabelMap(ids, users, articles, followsData);
  }, [comments, users, articles, followsData]);

  // Reading Experience Customization State
  const [fontSize, setFontSize] = useState<ReaderFontSize>(() => {
    return (localStorage.getItem('literium_reader_font_size') as ReaderFontSize) || 'md';
  });
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    return (localStorage.getItem('literium_reader_theme') as ReaderTheme) || 'default';
  });
  const [showAppearanceMenu, setShowAppearanceMenu] = useState(false);

  // Scroll & Progress Tracking
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Text to Speech (Audio Reading)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRate, setAudioRate] = useState(1.0);
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [audioErrorNotice, setAudioErrorNotice] = useState<string | null>(null);

  const isLocked = article.isLocked && !isUnlockedByCurrentUser;

  // استئناف القراءة تلقائياً وبهدوء من آخر موضع محفوظ (بدل بانر يسأل
  // المستخدم عن نسبة مئوية قد لا تُطابق الموضع الفعلي بدقة، لأن ارتفاع
  // المقال يتغيّر بين الجلسات بسبب حجم الخط أو تحميل الصور والإعلانات).
  // شريط التقدّم الحي أعلى الشاشة هو المرجع الدقيق والموثوق لموضع القراءة.
  useEffect(() => {
    const savedPos = localStorage.getItem(`literium_read_pos_${article.id}`);
    if (!savedPos) return;
    const pos = parseFloat(savedPos);
    if (!(pos > 5 && pos < 95)) return;

    // تأخير بسيط حتى تكتمل الصور والإعلانات ويستقر الارتفاع الحقيقي
    // للمقال، فتكون نسبة التمرير المحسوبة دقيقة قدر الإمكان.
    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      const targetScroll = ((scrollHeight - clientHeight) * pos) / 100;
      scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'auto' });
    }, 350);

    return () => clearTimeout(timer);
  }, [article.id]);

  // Track scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll > 0) {
      const progress = Math.min(100, Math.max(0, Math.round((scrollTop / totalScroll) * 100)));
      setReadingProgress(progress);
      setShowScrollTop(scrollTop > 400);

      // Save reading progress every scroll threshold
      if (progress > 5 && progress < 95) {
        localStorage.setItem(`literium_read_pos_${article.id}`, progress.toString());
      } else {
        // المقال انتهت قراءته تقريباً أو بدأ للتو — لا داعٍ لموضع محفوظ
        // يزعج المستخدم بإرجاعه لمنتصف مقال أنهاه بالفعل.
        localStorage.removeItem(`literium_read_pos_${article.id}`);
      }
    }
  };

  const handleScrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSetFontSize = (size: ReaderFontSize) => {
    setFontSize(size);
    localStorage.setItem('literium_reader_font_size', size);
  };

  const handleSetTheme = (theme: ReaderTheme) => {
    setReaderTheme(theme);
    localStorage.setItem('literium_reader_theme', theme);
  };

  // Web Speech API for Arabic audio playback
  const handleToggleAudio = () => {
    setAudioErrorNotice(null);
    if (!('speechSynthesis' in window)) {
      setAudioErrorNotice('ميزة القراءة الصوتية غير مدعومة في متصفحك الحالي.');
      setTimeout(() => setAudioErrorNotice(null), 4000);
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = `${article.title}. ${article.description || ''}. ${article.content.replace(/[#*>`]/g, '')}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'ar-SA';
      utterance.rate = audioRate;

      utterance.onend = () => {
        setIsPlayingAudio(false);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
      };

      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
      setShowAudioControls(true);
    }
  };

  const handleAudioRateChange = (newRate: number) => {
    setAudioRate(newRate);
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      const textToRead = `${article.title}. ${article.description || ''}. ${article.content.replace(/[#*>`]/g, '')}`;
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'ar-SA';
      utterance.rate = newRate;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleReactionClick = (reaction: ReactionType) => {
    const next = activeReaction === reaction ? null : reaction;
    setActiveReaction(next);
    if (next) onReact?.(next);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(article.id, newCommentText);
    setNewCommentText('');
  };

  const handleReplySubmit = (parentCommentId: string) => {
    if (!replyText.trim()) return;
    onAddComment(article.id, replyText, parentCommentId);
    setReplyText('');
    setReplyingToCommentId(null);
  };

  const handleUnlockClick = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // fallback
    }
    onUnlockArticle(article);
  };

  const getShareUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('article', article.id);
      return url.toString();
    } catch {
      return window.location.href;
    }
  };

  const handleShareClick = async () => {
    onShare?.();
    const shareUrl = getShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.description || article.title,
          url: shareUrl
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    setShowShareModal(true);
  };

  const handleCopyShareLink = async () => {
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Styling maps based on font size and theme
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-sm sm:text-base leading-relaxed';
      case 'md': return 'text-base sm:text-lg leading-loose';
      case 'lg': return 'text-lg sm:text-xl leading-loose';
      case 'xl': return 'text-xl sm:text-2xl leading-loose';
      default: return 'text-base sm:text-lg leading-loose';
    }
  };

  const getThemeContainerClass = () => {
    switch (readerTheme) {
      case 'sepia':
        return 'bg-[#faf3e0] text-[#382b22] border-[#e8dcc4]';
      case 'charcoal':
        return 'bg-[#0b0f17] text-[#e2e8f0] border-[#1e293b]';
      default:
        return 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200/80 dark:border-slate-800';
    }
  };

  const getThemeHeaderClass = () => {
    switch (readerTheme) {
      case 'sepia':
        return 'bg-[#faf3e0]/98 text-[#382b22] border-[#e8dcc4]';
      case 'charcoal':
        return 'bg-[#0b0f17]/98 text-[#e2e8f0] border-[#1e293b]';
      default:
        return 'bg-white/98 dark:bg-slate-900/98 text-slate-900 dark:text-slate-100 border-slate-200/80 dark:border-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-md flex justify-center p-0 sm:p-3 md:p-6 animate-android-in">
      <div className={`relative w-full max-w-4xl h-full sm:h-auto sm:max-h-[95vh] sm:rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors duration-300 ${getThemeContainerClass()}`}>
        {/* Top Reading Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 relative overflow-hidden shrink-0">
          <div
            className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-amber-500 transition-all duration-150"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Sticky Header Bar */}
        <header className={`sticky top-0 z-30 flex items-center justify-between px-3.5 sm:px-6 py-3 border-b transition-colors ${getThemeHeaderClass()}`}>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-500 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            <span className="hidden sm:inline">العودة للرئيسية</span>
            <span className="sm:hidden">رجوع</span>
          </button>

          {/* Reading Customization Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Audio Reader Trigger */}
            <button
              onClick={handleToggleAudio}
              className={`p-2 rounded-xl border flex items-center gap-1 text-xs font-bold transition-all active:scale-95 ${
                isPlayingAudio
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-600'
              }`}
              title={isPlayingAudio ? 'إيقاف القراءة الصوتية' : 'استمع للمقال صوتياً'}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden md:inline">{isPlayingAudio ? 'إيقاف' : 'استماع'}</span>
            </button>

            {/* Appearance Customizer Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowAppearanceMenu(!showAppearanceMenu)}
                className={`p-2 rounded-xl border transition-all active:scale-95 ${
                  showAppearanceMenu
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-teal-600'
                }`}
                title="تخصيص الخط والخلفية"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Appearance Dropdown Popover */}
              {showAppearanceMenu && (
                <div className="absolute end-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xl z-50 animate-android-in">
                  <div className="space-y-4">
                    {/* Font Size Selector */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        حجم الخط:
                      </span>
                      <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {[
                          { id: 'sm' as ReaderFontSize, label: 'صغير' },
                          { id: 'md' as ReaderFontSize, label: 'متوسط' },
                          { id: 'lg' as ReaderFontSize, label: 'كبير' },
                          { id: 'xl' as ReaderFontSize, label: 'ضخم' }
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSetFontSize(item.id)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                              fontSize === item.id
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Theme Mode Selector */}
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                        مظهر ووضع القراءة:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleSetTheme('default')}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                            readerTheme === 'default'
                              ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Sun className="w-4 h-4" />
                          <span>الافتراضي</span>
                        </button>

                        <button
                          onClick={() => handleSetTheme('sepia')}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                            readerTheme === 'sepia'
                              ? 'border-amber-700 bg-[#f7eed6] text-[#4a3b32] ring-2 ring-amber-500/30'
                              : 'border-[#e8dcc4] bg-[#fbf0d9] text-[#5a483e]'
                          }`}
                        >
                          <Coffee className="w-4 h-4 text-amber-700" />
                          <span>ورق دافئ</span>
                        </button>

                        <button
                          onClick={() => handleSetTheme('charcoal')}
                          className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
                            readerTheme === 'charcoal'
                              ? 'border-slate-500 bg-slate-950 text-slate-100 ring-2 ring-slate-400/30'
                              : 'border-slate-800 bg-slate-900 text-slate-400'
                          }`}
                        >
                          <Moon className="w-4 h-4 text-brand-400" />
                          <span>فحمي ليلي</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bookmark */}
            <button
              onClick={() => onBookmark(article.id)}
              className={`p-2 rounded-xl border transition-colors active:scale-95 ${
                isBookmarked
                  ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-600 dark:text-teal-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600'
              }`}
              title="حفظ المقال"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>

            {/* Share */}
            <button
              onClick={handleShareClick}
              className="p-2 rounded-xl border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600 transition-colors active:scale-95"
              title="مشاركة المقال"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Audio Error Notice Banner */}
        {audioErrorNotice && (
          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
            <span>{audioErrorNotice}</span>
            <button onClick={() => setAudioErrorNotice(null)} className="font-bold text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {/* Audio Floating Player Widget */}
        {showAudioControls && isPlayingAudio && (
          <div className="px-4 py-2 bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>جاري القراءة الصوتية للمقال...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">السرعة:</span>
              {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleAudioRateChange(rate)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    audioRate === rate
                      ? 'bg-amber-500 text-slate-950 shadow-2xs font-black'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Article Scrollable Body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-14 py-6 relative scroll-smooth"
        >
          {/* Category & Lock badge */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-200 dark:border-teal-800">
              {article.category === 'literature'
                ? 'الأدب والشعر'
                : article.category === 'technology'
                ? 'التقنية والذكاء الاصطناعي'
                : article.category === 'history'
                ? 'التاريخ والحضارات'
                : article.category === 'philosophy'
                ? 'الفلسفة والفكر'
                : article.category === 'business'
                ? 'ريادة الأعمال والمال'
                : article.category === 'science'
                ? 'العلوم والفضاء'
                : article.category === 'health'
                ? 'علم النفس والذات'
                : 'مقالات عامة'}
            </span>

            {article.isLocked && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                <Lock className="w-3.5 h-3.5" />
                <span>مقال حصري مدفوع ({article.lockedPrice || 2.99}$)</span>
              </span>
            )}

            <span className="text-xs text-slate-400 font-medium ms-auto flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-teal-500" />
              <span>{article.viewsCount.toLocaleString('ar-EG')} قراءة</span>
            </span>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black leading-tight mb-4 tracking-tight">
            {article.title}
          </h1>

          {/* Description Lead */}
          <p className="text-sm sm:text-base opacity-90 leading-relaxed mb-6 font-medium border-s-4 border-teal-500 ps-3">
            {article.description}
          </p>

          {/* Author info card */}
          <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 mb-6">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => onWriterProfileClick && onWriterProfileClick(article.writerId)}
            >
              <img
                src={article.writerAvatar}
                alt={article.writerName}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-teal-500/50"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm sm:text-base hover:text-teal-600 dark:hover:text-teal-400">
                    {article.writerName}
                  </h4>
                  {article.writerIsVerified && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 fill-teal-600/10" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  نُشر في {formatDateTimeAr(article.publishedAt)} ({timeAgoAr(article.publishedAt)}) • {article.readingTimeMinutes} دقائق قراءة
                </p>
              </div>
            </div>

            <button
              onClick={() => onFollowWriter(article.writerId)}
              className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 ${
                isFollowingWriter
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
              }`}
            >
              {isFollowingWriter ? 'تتابعه' : '+ متابعة'}
            </button>
          </div>

          {/* Featured Image */}
          <div className="relative rounded-3xl overflow-hidden mb-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <img
              src={article.featuredImage}
              alt={article.title}
              referrerPolicy="no-referrer"
              className="w-full h-64 sm:h-80 md:h-96 object-cover"
            />
          </div>

          {/* موضع article_top حُذف من هنا بناءً على طلب صريح — أُفسِح
              المجال بدله لإعلان قسم التعليقات (comments_feed) ليظهر
              فعلياً ضمن حد الـ3 إعلانات لكل صفحة، بدل بقائه معطَّلاً
              دائماً بسبب امتلاء المواضع الثلاثة الأخرى (top/mid/bottom)
              قبل وصول الدور لقسم التعليقات. */}

          {/* Main Content Area */}
          <div className={`relative space-y-4 font-normal article-content ${getFontSizeClass()}`}>
            {isLocked ? (
              <div>
                {/* Teaser content */}
                <p className="mb-4">
                  {article.content.split('\n\n')[0] || article.description}
                </p>

                {/* Locked Blur Card */}
                <div className="relative mt-6 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-amber-500/10 via-teal-500/10 to-slate-900/20 border-2 border-dashed border-amber-500/40 text-center backdrop-blur-sm">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
                    <Lock className="w-7 h-7" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black mb-2">
                    هذا المحتوى حصري ومقفول
                  </h3>
                  <p className="text-xs sm:text-sm opacity-80 max-w-md mx-auto mb-6">
                    ادعم الكاتب {article.writerName} لفتح باقي المقال بالكامل ومتابعة تحليلاته العميقة لمرة واحدة بدون اشتراكات دورية.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={handleUnlockClick}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" />
                      <span>فتح المقال مقابل {article.lockedPrice || 2.99}$ فقط</span>
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>توزيع العوائد: {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% مباشرة للكاتب • {REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}% رسم المنصة</span>
                  </div>
                </div>
              </div>
            ) : (
              (() => {
                // تقسيم المقال إلى فقرات لإدراج الإعلان المدمج بينها.
                const paragraphs = (article.content || '').split('\n\n').filter((p) => p.trim());
                const wordCount = (article.content || '').split(/\s+/).filter(Boolean).length;

                // المقال أقل من 500 كلمة: لا إعلان مدمج إطلاقاً
                // (حشر الإعلانات في مقال قصير سبب مباشر لرفض AdSense).
                const showMidAd = wordCount >= 500 && paragraphs.length >= 7;

                // موضع الإدراج: بعد 40% من الفقرات، وبما لا يقل عن 3 فقرات
                // من البداية ولا عن 3 من النهاية، وبين فقرتين كاملتين دائماً.
                const rawIndex = Math.floor(paragraphs.length * 0.4);
                const midIndex = Math.min(
                  Math.max(rawIndex, 3),
                  Math.max(paragraphs.length - 3, 3)
                );

                if (!showMidAd) {
                  return (
                    <div className="whitespace-pre-line leading-relaxed">{article.content}</div>
                  );
                }

                return (
                  <div className="leading-relaxed">
                    {paragraphs.map((para, i) => (
                      <React.Fragment key={i}>
                        <p className="whitespace-pre-line mb-4">{para}</p>
                        {i === midIndex - 1 && (
                          <AdSlot
                            slotId="article_mid"
                            campaigns={campaigns}
                            articleId={article.id}
                            writerId={article.writerId}
                            viewerId={currentUserId}
                            inRead
                            adFree={isAdFree}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* فيديو المقال: الملف المرفوع مباشرة له الأولوية على رابط التضمين */}
          {article.uploadedVideoUrl ? (
            <div className="my-6">
              <VideoPlayer src={article.uploadedVideoUrl} className="w-full rounded-2xl bg-slate-950" />
            </div>
          ) : (
            article.videoUrl && (
              <div className="my-6">
                <VideoEmbed url={article.videoUrl} />
              </div>
            )
          )}

          {/* رابط مرجعي/مصدر — إحالة فقط، وليس وسيط عرض */}
          {article.sourceUrl && (
            <div className="my-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold">المصدر: </span>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-teal-600 dark:text-teal-400 hover:underline break-all"
              >
                {article.sourceUrl}
              </a>
            </div>
          )}

          {/* إعلان نهاية المقال */}
          <AdSlot
            slotId="article_bottom"
            campaigns={campaigns}
            articleId={article.id}
            writerId={article.writerId}
            viewerId={currentUserId}
            adFree={isAdFree}
          />

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold">الوسوم:</span>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Reactions Bar */}
          <div className="my-8 p-4 sm:p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <h4 className="text-xs sm:text-sm font-bold mb-3 text-center sm:text-start">
              ما هو انطباعك عن هذا المقال؟
            </h4>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
              {[
                { type: 'love' as ReactionType, emoji: '❤️', label: 'أحببته' },
                { type: 'insightful' as ReactionType, emoji: '💡', label: 'ملهم ومفيد' },
                { type: 'funny' as ReactionType, emoji: '😂', label: 'طريف' },
                { type: 'surprised' as ReactionType, emoji: '😲', label: 'مدهش' },
                { type: 'sad' as ReactionType, emoji: '😢', label: 'مؤثر' }
              ].map((rec) => (
                <button
                  key={rec.type}
                  onClick={() => handleReactionClick(rec.type)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    activeReaction === rec.type
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm scale-105'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400'
                  }`}
                >
                  <span className="text-base">{rec.emoji}</span>
                  <span>{rec.label}</span>
                </button>
              ))}
            </div>

            {/* تقييم حقيقي بالنجوم — متصل فعلياً بـ Firestore عبر onRate،
                بدل تقييم محلي وهمي كان يبدأ افتراضياً من 5 نجوم مسبقة
                الاختيار (كأن كل مقال "مُقيَّم بالفعل" حتى قبل أي تفاعل). */}
            {onRate && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تقييم المقال:
                  </span>
                  <div className="flex items-center gap-1" dir="ltr">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => onRate(star)}
                        className="p-1 text-amber-400 hover:scale-125 transition-transform active:scale-90"
                        title={`تقييم ${star} نجوم`}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= myRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  {article.ratingsCount > 0
                    ? `${article.rating.toFixed(1)} ★ من ${article.ratingsCount.toLocaleString()} تقييم`
                    : 'كن أول من يقيّم هذا المقال'}
                </span>
              </div>
            )}
          </div>

          {/* Action Bar (Like, Share, Bookmark) */}
          <div className="flex items-center justify-between gap-3 py-4 border-y border-slate-200 dark:border-slate-800 mb-8">
            <button
              onClick={() => onLike(article.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 ${
                isLiked
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-transparent hover:text-rose-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              <span>{article.likesCount} إعجاب</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowShareModal(true);
                  onShare?.();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>مشاركة</span>
              </button>
            </div>
          </div>

          {/* Comments Section */}
          <section id="comments-section" className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-teal-600" />
                <span>التعليقات والمناقشات ({comments.length})</span>
              </h3>
            </div>

            {/* Comment Box */}
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="أضف رأيك أو سؤالك حول المقال للكاتب والقراء..."
                  rows={3}
                  className="w-full bg-transparent text-sm placeholder-slate-400 outline-hidden resize-none"
                />
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400">
                    شارك برقي واحترام
                  </span>
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>نشر التعليق</span>
                    <Send className="w-3 h-3 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4">
              {comments.map((comm, commIdx) => (
                <React.Fragment key={comm.id}>
                  {/* comments_feed — بعد التعليق الثالث فقط إن كان هناك عدد
                      كافٍ من التعليقات، حتى لا تُثقل نقاشاً قصيراً بإعلان
                      يزاحم المحتوى الحقيقي. */}
                  {commIdx === 3 && comments.length >= 5 && (
                    <AdSlot
                      slotId="comments_feed"
                      campaigns={campaigns}
                      articleId={article.id}
                      writerId={article.writerId}
                      viewerId={currentUserId}
                      adFree={isAdFree}
                    />
                  )}
                <div
                  className={`p-4 rounded-2xl border ${
                    comm.isPinned
                      ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={comm.userAvatar}
                        alt={comm.userName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm">
                            {comm.userName}
                          </span>
                          {commenterLabels[comm.userId] === 'كاتب' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold">
                              الكاتب
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{timeAgoAr(comm.createdAt)}</span>
                      </div>
                    </div>

                    {comm.isPinned && (
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950 px-2 py-0.5 rounded-full">
                        📌 تعليق مثبت
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed mb-3 select-text">
                    {comm.content}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <button
                      onClick={() => onLikeComment(comm.id)}
                      className="flex items-center gap-1 hover:text-rose-500 transition-colors active:scale-95"
                    >
                      <Heart className={`w-3.5 h-3.5 ${(comm.likedBy || []).includes(currentUserId || '') ? 'fill-rose-500 text-rose-500' : ''}`} />
                      <span>{comm.likesCount}</span>
                    </button>

                    <button
                      onClick={() => setReplyingToCommentId(replyingToCommentId === comm.id ? null : comm.id)}
                      className="flex items-center gap-1 hover:text-teal-600 transition-colors font-medium active:scale-95"
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                      <span>رد</span>
                    </button>
                  </div>

                  {/* Inline Reply input */}
                  {replyingToCommentId === comm.id && (
                    <div className="mt-3 ps-4 border-s-2 border-teal-500">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`رد على ${comm.userName}...`}
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-hidden focus:border-teal-500"
                        />
                        <button
                          onClick={() => handleReplySubmit(comm.id)}
                          className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 active:scale-95"
                        >
                          إرسال
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Nested replies */}
                  {comm.replies && comm.replies.length > 0 && (
                    <div className="mt-3 space-y-2 ps-4 border-s-2 border-teal-300 dark:border-teal-800">
                      {comm.replies.map((rep) => (
                        <div key={rep.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <img
                                src={rep.userAvatar}
                                alt={rep.userName}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full object-cover"
                              />
                              <span className="font-bold">
                                {rep.userName}
                              </span>
                              {commenterLabels[rep.userId] === 'كاتب' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold">
                                  الكاتب
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{timeAgoAr(rep.createdAt)}</span>
                          </div>
                          <p className="opacity-90 select-text">{rep.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </React.Fragment>
              ))}
            </div>
          </section>
        </div>

        {/* Floating Back to Top Button */}
        {showScrollTop && (
          <button
            onClick={handleScrollToTop}
            className="absolute bottom-5 start-5 z-40 p-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/30 flex items-center justify-center transition-all active:scale-90 animate-android-in"
            title="العودة للأعلى"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl animate-android-in">
              <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2 text-center">
                مشاركة المقال
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
                شارك هذا المقال مع أصدقائك عبر المنصات الاجتماعية أو انسخ الرابط المباشر
              </p>

              <div className="grid grid-cols-4 gap-2 mb-4">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(getShareUrl())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
                >
                  <span className="text-lg">𝕏</span>
                  <span className="text-[10px]">تويتر</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + ' ' + getShareUrl())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold"
                >
                  <span className="text-lg">💬</span>
                  <span className="text-[10px]">واتساب</span>
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(article.title)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 hover:bg-sky-100 text-xs font-semibold"
                >
                  <span className="text-lg">✈️</span>
                  <span className="text-[10px]">تيليجرام</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 hover:bg-blue-100 text-xs font-semibold"
                >
                  <span className="text-lg">📘</span>
                  <span className="text-[10px]">فيسبوك</span>
                </a>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyShareLink}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط المقال'}</span>
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 active:scale-95"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
