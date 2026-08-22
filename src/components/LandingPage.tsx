import React, { useState } from 'react';
import {
  BookOpen,
  PenTool,
  Megaphone,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Award,
  Crown,
  Eye,
  Heart,
  Search,
  ExternalLink,
  ChevronLeft,
  Star,
  Zap,
  Globe,
  Sun,
  Moon,
  Users,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { Article, User, UserRole } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface LandingPageProps {
  articles?: Article[];
  currentUser?: User | null;
  isAuthenticated?: boolean;
  onStartReading: () => void;
  onOpenRegister?: (role: UserRole) => void;
  onOpenLogin?: () => void;
  onGoogleSignIn?: (role?: UserRole) => void;
  onSelectArticlePreview?: (article: Article) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  language?: 'ar' | 'en';
  onToggleLanguage?: () => void;
  onOpenLegal?: (section: 'privacy' | 'terms' | 'about' | 'contact') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  articles = [],
  currentUser = null,
  isAuthenticated = false,
  onStartReading,
  onOpenRegister = (_role: UserRole) => {},
  onOpenLogin = () => {},
  onGoogleSignIn = (_role?: UserRole) => {},
  onSelectArticlePreview = (_article: Article) => {},
  theme = 'dark',
  onToggleTheme = () => {},
  language = 'ar',
  onToggleLanguage = () => {},
  onOpenLegal = (_s) => {}
}) => {
  const [activeFeatureTab, setActiveFeatureTab] = useState<'readers' | 'writers' | 'advertisers'>('readers');
  const [previewCategory, setPreviewCategory] = useState<string>('all');

  const isUserLoggedIn = isAuthenticated && currentUser && currentUser.id !== 'guest';

  const safeArticles = Array.isArray(articles) ? articles : [];
  const filteredPreviewArticles = previewCategory === 'all'
    ? safeArticles.slice(0, 6)
    : safeArticles.filter((a) => a.category === previewCategory).slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Background glowing atmospheric mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] start-[20%] w-[600px] h-[600px] bg-brand-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] end-[-5%] w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] start-[-10%] w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-[160px]" />
      </div>

      {/* Top Floating Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-600 to-teal-400 p-0.5 shadow-lg shadow-brand-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-teal-300 text-lg sm:text-xl tracking-wider">
                  L
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-xl tracking-tight text-white">
                  LITERIUM
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  منصة الأدب والفكر
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:block">
                حيث تلتقي بلاغة الكلمة بنماذج الذكاء الاصطناعي
              </span>
            </div>
          </div>

          {/* Quick Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
              title="تبديل المظهر"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {isUserLoggedIn && currentUser ? (
              <button
                onClick={onStartReading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span>دخول لوحة التحكم ({currentUser.fullName.split(' ')[0]})</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onStartReading}
                  className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-all"
                >
                  <Compass className="w-3.5 h-3.5 text-brand-400" />
                  <span>تصفح كزائر</span>
                </button>

                <button
                  onClick={onOpenLogin}
                  className="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md active:scale-95 transition-all"
                >
                  تسجيل الدخول / إنشاء حساب
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative z-10 pt-12 sm:pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Glowing Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-950/60 border border-brand-500/30 text-xs text-brand-300 mb-6 shadow-inner animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold">المجتمع الأدبي والثقافي الرقمي الأول</span>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="text-slate-400 hidden sm:inline">نظام تقاسم أرباح حقيقي للكُتّاب والمعلنين</span>
        </div>

        {/* Hero Display Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.2] max-w-4xl mx-auto">
          حيث تلتقي <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-300 to-teal-300">عراقة الفكر والأدب</span>، بآفاق الذكاء الاصطناعي
        </h1>

        {/* Clear Mission Tagline */}
        <p className="mt-5 text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-medium">
          منصة أدبية عربية تتيح <span className="text-brand-300 font-bold">للقراء القراءة</span>، و<span className="text-teal-300 font-bold">للكتاب النشر والربح</span>، و<span className="text-cyan-300 font-bold">للمعلنين الإعلان</span>.
        </p>

        {/* Primary Role Action CTAs */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-2xl mx-auto">
          {isUserLoggedIn && currentUser ? (
            <button
              onClick={onStartReading}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-brand-600/30 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <BookOpen className="w-5 h-5 text-brand-200" />
              <span>مرحباً {currentUser.fullName} — الذهاب إلى لوحة التحكم</span>
              <ArrowLeft className="w-4 h-4 text-brand-200" />
            </button>
          ) : (
            <>
              {/* 1. Primary: open the unified sign-up / login modal (role chosen inside) */}
              <button
                onClick={() => onOpenRegister('reader')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-brand-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5 text-brand-200" />
                <span>ابدأ الآن مجاناً</span>
                <ArrowLeft className="w-4 h-4 text-brand-200" />
              </button>

              {/* 2. Browse as Guest */}
              <button
                onClick={onStartReading}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Compass className="w-4 h-4 text-slate-400" />
                <span>تصفح كزائر</span>
              </button>
            </>
          )}
        </div>

        {/* Small helper line: unified account description */}
        {!isUserLoggedIn && (
          <p className="mt-4 text-xs text-slate-500">
            حساب واحد يمنحك القراءة الحرة، نشر المقالات، وإطلاق الإعلانات فور التسجيل.
          </p>
        )}

        {/* Live Metrics Row */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 max-w-4xl mx-auto text-center">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
            <span className="text-2xl sm:text-3xl font-black text-brand-400">50K+</span>
            <p className="text-xs text-slate-400 font-medium mt-1">قارئ نهم شهرياً</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
            <span className="text-2xl sm:text-3xl font-black text-teal-400">
              {REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% - {REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}%
            </span>
            <p className="text-xs text-slate-400 font-medium mt-1">نسبة أرباح الكتّاب</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400">2,800+</span>
            <p className="text-xs text-slate-400 font-medium mt-1">مقال ودراسة معتمدة</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">4.9 ★</span>
            <p className="text-xs text-slate-400 font-medium mt-1">تقييم المجتمع والنقاد</p>
          </div>
        </div>
      </section>

      {/* 3 Core Pillars Section (القرّاء، الكتّاب، المعلنين) */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800/80 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              منظومة متكاملة تلبي تطلعات الجميع
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400">
              صُممت ليتيريوم بدقة لتقديم تجربة فريدة لكل من يبحث عن المعرفة، الإبداع، أو الاستثمار الإعلامي
            </p>

            {/* Pillar Selector Tabs */}
            <div className="flex items-center justify-center gap-2 mt-8 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 max-w-md mx-auto">
              <button
                onClick={() => setActiveFeatureTab('readers')}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeFeatureTab === 'readers'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>للقرّاء</span>
              </button>
              <button
                onClick={() => setActiveFeatureTab('writers')}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeFeatureTab === 'writers'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>للكتّاب</span>
              </button>
              <button
                onClick={() => setActiveFeatureTab('advertisers')}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeFeatureTab === 'advertisers'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                <span>للمعلنين</span>
              </button>
            </div>
          </div>

          {/* 3 Interactive Pillar Cards Grid.
              On mobile only the active tab's card shows (tabs now actually
              filter content, not just highlight it). Desktop keeps all 3 side by side. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* 1. Readers Card */}
            <div
              className={`${activeFeatureTab === 'readers' ? 'block' : 'hidden md:block'} p-6 sm:p-8 rounded-3xl transition-all border ${
                activeFeatureTab === 'readers'
                  ? 'bg-gradient-to-b from-brand-950/60 to-slate-900 border-brand-500/50 ring-2 ring-brand-500/20 shadow-2xl'
                  : 'bg-slate-900/40 border-slate-800 opacity-90'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mb-5">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">1. للقرّاء: واحة المعرفة والأدب النقي</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                استمتع بقراءة مقالات وتحليلات حصرية معمقة خالية من الحشو، مع بيئة قراءة مصممة خصيصاً لراحة عينيك وفكرك.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>قارئ صوتي ذكي بالذكاء الاصطناعي مع تحكم كامل بالسرعة</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>تخصيص ثيمات القراءة وخطوط مريحة وخلفيات فنية راقية</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>مكتبة كتب رقمية مجانية ومفضلة شخصية لحفظ مقالاتك</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>محفظة شحن سهلة لفتح المقالات الحصرية ودعم كتابك المفضلين</span>
                </li>
              </ul>
              <button
                onClick={onStartReading}
                className="mt-6 w-full py-2.5 rounded-xl bg-brand-600/30 hover:bg-brand-600 border border-brand-500/40 text-brand-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>تصفح المقالات كقارئ الآن</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Writers Card */}
            <div
              className={`${activeFeatureTab === 'writers' ? 'block' : 'hidden md:block'} p-6 sm:p-8 rounded-3xl transition-all border ${
                activeFeatureTab === 'writers'
                  ? 'bg-gradient-to-b from-teal-950/60 to-slate-900 border-teal-500/50 ring-2 ring-teal-500/20 shadow-2xl'
                  : 'bg-slate-900/40 border-slate-800 opacity-90'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-600/20 text-teal-400 border border-teal-500/30 flex items-center justify-center mb-5">
                <PenTool className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">2. للكتّاب: انشر مقالاتك وحقق أرباحاً حقيقية</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                حوّل إبداعك إلى عوائد مالية مجزية مع برنامج شركاء ليتيريوم الأعدل عربياً، وسحب أرباحك بسلاسة.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>
                    <strong>ربح يصل إلى 70%</strong> من مبيعات المقالات المقفولة وعوائد الإعلانات
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>استوديو كتابة مدعوم بنموذج Gemini AI لتوليد الصور وصياغة الأفكار</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>شروط انضمام واضحة (10 مقالات، 100 متابع، 1,000 قراءة)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>سحب أرباح موثوق (بايبال، تحويل بنكي، بطاقات) بحد أدنى 50$ فقط</span>
                </li>
              </ul>
              <button
                onClick={() => onOpenRegister('writer')}
                className="mt-6 w-full py-2.5 rounded-xl bg-teal-600/30 hover:bg-teal-600 border border-teal-500/40 text-teal-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>سجّل حساب كاتب وابدأ النشر</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. Advertisers Card */}
            <div
              className={`${activeFeatureTab === 'advertisers' ? 'block' : 'hidden md:block'} p-6 sm:p-8 rounded-3xl transition-all border ${
                activeFeatureTab === 'advertisers'
                  ? 'bg-gradient-to-b from-cyan-950/60 to-slate-900 border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-2xl'
                  : 'bg-slate-900/40 border-slate-800 opacity-90'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-5">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">3. للمعلنين: وصول مباشر لجمهور نخبوي</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                أعلن عن خدماتك أو منتجاتك بحرية وسهولة من داخل حسابك، مستهدفاً جمهوراً عربياً مثقفاً وعالي التفاعل.
              </p>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>إطلاق حملات فورية من نفس الحساب دون تعقيد أو تسجيل إضافي</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>خطط مرنة: تسعير حسب مدة العرض (24/48 ساعة) أو بالنقرة CPC</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>استهداف دقيق بحسب مجالات المقالات (أدب، تقنية، مال، فكر)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>لوحة تحليلات لحظية تتبع المشاهدات والنقرات ونسبة التحويل</span>
                </li>
              </ul>
              <button
                onClick={() => onOpenRegister('reader')}
                className="mt-6 w-full py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>سجّل حسابك وأطلق إعلانك</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Register - Additional Incentive Cards Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-500/10 text-brand-300 text-xs font-bold border border-brand-500/20 mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>مزايا حصرية تنتظرك عند التسجيل</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            لماذا يختار آلاف القراء والكتاب منصة ليتيريوم؟
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-400">
            تجربة رقمية فريدة تمنحك أدوات متطورة وحرية تامة في القراءة والتعبير والاستثمار
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: AI Integration */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-brand-500/40 transition-all hover:-translate-y-1 duration-300 flex flex-col justify-between shadow-lg">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">استوديو ذكاء اصطناعي</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                توليد صور احترافية للمقالات، تلخيصات فورية، ومساعد لغوي فائق الدقة مدعوم بأحدث نماذج Gemini AI.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-1 text-[11px] font-bold text-amber-400">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>متاح مجاناً لجميع الكتّاب</span>
            </div>
          </div>

          {/* Card 2: Financial Safety & Withdrawals */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 transition-all hover:-translate-y-1 duration-300 flex flex-col justify-between shadow-lg">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">شفافية وسحب مالي فوري</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                محفظة إلكترونية تتبع أرباحك لحظة بلحظة، مع إمكانية سحب مستحقاتك بكل أمان عبر بايبال والحساب البنكي والبطاقات عند بلوغ 50$.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-1 text-[11px] font-bold text-teal-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>سحب موثوق وبدون رسوم خفية</span>
            </div>
          </div>

          {/* Card 3: Custom Themes & Artwork */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all hover:-translate-y-1 duration-300 flex flex-col justify-between shadow-lg">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">تخصيص كامل وخلفيات فنية</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                اختر ثيمات مظهر مخصصة، وألوان القالب التي تفضلها، بالإضافة لمجموعة من الخلفيات الفنية عالية الجودة المريحة للنظر.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-1 text-[11px] font-bold text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>راحة بصرية لا مثيل لها</span>
            </div>
          </div>

          {/* Card 4: Community & Interaction */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-all hover:-translate-y-1 duration-300 flex flex-col justify-between shadow-lg">
            <div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">مجتمع تفاعلي راقٍ</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                تفاعل عبر التعليقات، تابع كتابك المفضلين، قيّم المقالات، وشارك في بناء مكتبة معرفية عربية رائدة ومستدامة.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center gap-1 text-[11px] font-bold text-cyan-400">
              <Award className="w-3.5 h-3.5" />
              <span>شارات توثيق وشهرة للكتاب</span>
            </div>
          </div>
        </div>

        {/* Quick CTA to register */}
        <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-brand-950/80 via-slate-900 to-teal-950/80 border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h4 className="text-lg font-black text-white">هل أنت مستعد لبدء رحلتك في ليتيريوم؟</h4>
            <p className="text-xs text-slate-400 mt-0.5">التسجيل مجاني ويستغرق أقل من دقيقة واحدة فقط.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => onOpenRegister('reader')}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>إنشاء حساب مجاني</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenLogin}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 active:scale-95 transition-all"
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      </section>

      {/* Limited Article Preview Section (تصفح بعض المقالات بدون تسجيل) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>معاينة حصرية للزوار</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              تصفح مقتطفات من أحدث مقالات المنصة
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              يمكنك قراءة عينات مجانية الآن دون الحاجة إلى إنشاء حساب فوري
            </p>
          </div>

          {/* Quick Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'literature', label: 'الأدب والشعر' },
              { id: 'philosophy', label: 'الفلسفة' },
              { id: 'technology', label: 'التقنية والذكاء' },
              { id: 'history', label: 'التاريخ' }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setPreviewCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  previewCategory === cat.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPreviewArticles.map((art) => (
            <div
              key={art.id}
              onClick={() => onSelectArticlePreview(art)}
              className="group rounded-3xl bg-slate-900/80 border border-slate-800/90 hover:border-brand-500/50 overflow-hidden shadow-lg hover:shadow-brand-500/10 cursor-pointer transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-16/9 overflow-hidden bg-slate-950">
                <img
                  src={art.featuredImage}
                  alt={art.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute top-3 start-3">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-brand-300 border border-brand-500/20">
                    {art.category === 'literature'
                      ? 'الأدب'
                      : art.category === 'philosophy'
                      ? 'الفلسفة'
                      : art.category === 'technology'
                      ? 'التقنية'
                      : 'دراسات'}
                  </span>
                </div>
                {art.isLocked && (
                  <div className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm">
                    <span>مقال مقفول ({art.lockedPrice}$)</span>
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={art.writerAvatar}
                      alt={art.writerName}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-brand-500/30"
                    />
                    <span className="text-xs font-bold text-slate-300">{art.writerName}</span>
                  </div>
                  <h3 className="font-extrabold text-base text-white group-hover:text-brand-300 transition-colors line-clamp-2">
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {art.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-teal-400" />
                      <span>{art.viewsCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-400" />
                      <span>{art.likesCount}</span>
                    </span>
                  </div>
                  <span className="text-brand-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    <span>قراءة المعاينة</span>
                    <span>←</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All CTA */}
        <div className="mt-10 text-center">
          <button
            onClick={onStartReading}
            className="px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-extrabold text-sm shadow-md transition-all inline-flex items-center gap-2 active:scale-95"
          >
            <span>استكشف جميع المقالات والكتب في المنصة</span>
            <ArrowLeft className="w-4 h-4 text-brand-400" />
          </button>
        </div>
      </section>

      {/* Prominent Footer Call to Action Banner */}
      <footer className="mt-20 border-t border-slate-800 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-r from-brand-950/60 via-brand-950/60 to-slate-900 border border-brand-500/30 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-3xl mx-auto space-y-4">
            {isUserLoggedIn && currentUser ? (
              <>
                <h2 className="text-2xl sm:text-4xl font-black text-white">
                  مرحباً بعودتك، {currentUser.fullName.split(' ')[0]}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  أكمل رحلتك في مجتمع ليتيريوم الأدبي والثقافي من حيث توقفت.
                </p>
                <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onStartReading}
                    className="px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>الذهاب إلى لوحة التحكم</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-4xl font-black text-white">
                  انضم اليوم إلى أكبر مجتمع أدبي وثقافي عربي
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  سواء كنت قارئاً شغوفاً بالمعرفة، أو كاتباً تطمح لنشر أفكارك ومشاركة الأرباح، أو معلناً تبحث عن جمهور نوعي.
                </p>
                <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => onOpenRegister('reader')}
                    className="px-6 py-3 rounded-2xl bg-white text-slate-950 font-black text-xs sm:text-sm shadow-lg hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>أنشئ حسابك الآن</span>
                  </button>
                  <button
                    onClick={onStartReading}
                    className="px-6 py-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all"
                  >
                    تصفح المنصة مباشرة
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 LITERIUM. جميع الحقوق محفوظة لمنصة ليتيريوم للأدب والفكر ومشاركة الأرباح.</p>
          {/* روابط الصفحات القانونية — إلزامية وقابلة للنقر (شرط AdSense) */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => onOpenLegal('privacy')} className="hover:text-brand-400 transition-colors font-bold">
              سياسة الخصوصية
            </button>
            <button onClick={() => onOpenLegal('terms')} className="hover:text-brand-400 transition-colors font-bold">
              شروط الاستخدام
            </button>
            <button onClick={() => onOpenLegal('about')} className="hover:text-brand-400 transition-colors font-bold">
              من نحن
            </button>
            <button onClick={() => onOpenLegal('contact')} className="hover:text-brand-400 transition-colors font-bold">
              اتصل بنا
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
