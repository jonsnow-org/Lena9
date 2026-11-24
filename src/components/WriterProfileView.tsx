import React, { useState } from 'react';
import {
  Youtube,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Award,
  Globe,
  Twitter,
  Linkedin,
  Instagram,
  Eye,
  Heart,
  MessageSquare,
  BookOpen,
  Calendar,
  Lock,
  Send,
  Star
} from 'lucide-react';
import { User, Article, AdCampaign } from '../types';
import { formatDateTimeAr } from '../utils/dateFormat';
import { AdSlot } from './AdSlot';
import { AdTickerBar } from './AdTickerBar';
import { getCreatorEligibility, getMemberStatusLabel } from '../utils/creatorEligibility';
import { WRITER_MONETIZATION_ENABLED } from '../constants/revenueShares';

interface WriterProfileViewProps {
  writer: User;
  articles: Article[];
  campaigns?: AdCampaign[];
  currentUserId?: string | null;
  onBack: () => void;
  onSelectArticle: (article: Article) => void;
  onFollowWriter: (writerId: string) => void;
  isFollowing: boolean;
  /** هل هذا الكاتب يتابع المستخدم الحالي أيضاً؟ لعرض شارة "يتابعك". */
  isFollowingMe?: boolean;
  onOpenDirectMessage: (writer: User) => void;
  /** عدد المتابِعين الفعلي محسوباً من مجموعة follows */
  followersCount?: number;
  /** عدد من يتابعهم هذا المستخدم */
  followingCount?: number;
  onShowFollowers?: () => void;
  onShowFollowing?: () => void;
}

export const WriterProfileView: React.FC<WriterProfileViewProps> = ({
  writer,
  articles,
  campaigns = [],
  currentUserId = null,
  onBack,
  onSelectArticle,
  onFollowWriter,
  isFollowing,
  isFollowingMe = false,
  onOpenDirectMessage,
  followersCount,
  followingCount,
  onShowFollowers,
  onShowFollowing
}) => {
  const [activeTab, setActiveTab] = useState<'articles' | 'about'>('articles');
  const writerArticles = articles.filter((a) => a.writerId === writer.id);
  const totalViews = writerArticles.reduce((acc, a) => acc + a.viewsCount, 0);
  // متوسط تقييم حقيقي محسوب من مقالات الكاتب فعلياً (بدل رقم افتراضي
  // "4.9" كان يظهر لأي كاتب بلا أي تقييمات حقيقية بعد).
  const writerRatingsCount = writerArticles.reduce((acc, a) => acc + (a.ratingsCount || 0), 0);
  const writerRatingsSum = writerArticles.reduce(
    (acc, a) => acc + (a.ratingsSum ?? a.rating * (a.ratingsCount || 0)),
    0
  );
  const writerAvgRating = writerRatingsCount > 0 ? writerRatingsSum / writerRatingsCount : 0;
  const creatorEligibility = getCreatorEligibility(writer, articles, followersCount ?? writer.followersCount);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-2xs"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
        <span>العودة للمقالات</span>
      </button>

      {/* Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Cover Photo */}
        <div className="h-44 sm:h-56 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
          <img
            src={
              writer.coverUrl ||
              'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&auto=format&fit=crop&q=80'
            }
            alt="Cover"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Profile Details Bar */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-14 mb-4">
            <div className="flex items-end gap-4">
              <div className="relative">
                <img
                  src={writer.avatarUrl}
                  alt={writer.fullName}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover ring-4 ring-white dark:ring-slate-900 shadow-xl bg-white"
                />
                {writer.isVerified && (
                  <div
                    className="absolute -bottom-1 -end-1 p-1 rounded-full bg-teal-600 text-white shadow-md"
                    title="حساب كاتب موثق رسمياً"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white">
                    {writer.fullName}
                  </h1>
                  {writer.isKycVerified && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      title="تم التحقق من الهوية الوطنية (KYC)"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>KYC موثق</span>
                    </span>
                  )}
                  {/* وسم حالة واحد — نفس منطق الملف الشخصي الموحّد بالضبط:
                      قارئ افتراضياً، يتحوّل تلقائياً إلى كاتب عند تحقيق
                      شروط الأهلية الكاملة، بلا وسوم وسيطة متضاربة. */}
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    title={WRITER_MONETIZATION_ENABLED && creatorEligibility.isEligible ? 'استوفى شروط الأهلية الكاملة لاحتساب الأرباح' : undefined}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{getMemberStatusLabel(writer.role, creatorEligibility.isEligible)}</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 font-medium dir-ltr text-end sm:text-start">
                  @{writer.username}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={() => onOpenDirectMessage(writer)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-200 hover:text-teal-600 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>رسالة مباشرة</span>
              </button>

              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => onFollowWriter(writer.id)}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all ${
                    isFollowing
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
                  }`}
                >
                  {isFollowing ? 'تتابعه' : '+ متابعة الكاتب'}
                </button>
                {isFollowingMe && (
                  <span className="text-[10px] font-bold text-slate-400">يتابعك</span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl mb-4 select-text">
            {writer.bio}
          </p>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-3 border-y border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            {/* عدد المتابِعين — محسوب من بيانات المتابعة الفعلية. بطاقة بحجم
                زر موحّد (بدل نص عاري) بنفس لغة تصميم زر "متابعة" أعلاه، ليتضح
                أنهما عنصران قابلان للنقر فعلاً وليسا مجرد رقمين للعرض. */}
            <button
              onClick={onShowFollowers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
            >
              <strong className="text-slate-900 dark:text-white font-black text-sm">
                {(followersCount ?? writer.followersCount ?? 0).toLocaleString('ar-EG')}
              </strong>
              <span>متابِع</span>
            </button>

            <button
              onClick={onShowFollowing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
            >
              <strong className="text-slate-900 dark:text-white font-black text-sm">
                {(followingCount ?? 0).toLocaleString('ar-EG')}
              </strong>
              <span>يتابع</span>
            </button>

            <div>
              <strong className="text-slate-900 dark:text-white font-black text-sm me-1">
                {writer.articlesCount || writerArticles.length}
              </strong>
              <span>مقال منشور</span>
            </div>

            <div>
              <strong className="text-slate-900 dark:text-white font-black text-sm me-1">
                {totalViews.toLocaleString('ar-EG')}
              </strong>
              <span>قراءة</span>
            </div>

            <div className="flex items-center gap-1 text-amber-500 font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <span>
                {writerRatingsCount > 0
                  ? `${writerAvgRating.toFixed(1)} تقييم القراء (${writerRatingsCount})`
                  : 'لا تقييمات بعد'}
              </span>
            </div>

            {writer.joinedDate && (
              <div className="ms-auto text-[11px] text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>انضم في {writer.joinedDate}</span>
              </div>
            )}
          </div>

          {/* Badges List */}
          {writer.badges && writer.badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {writer.badges.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                  title={b.description}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>{b.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tab Headers */}
        <div className="flex border-t border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('articles')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'articles'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            المقالات المنشورة ({writerArticles.length})
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            عن الكاتب والروابط
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'articles' ? (
        <div className="space-y-4">
          {/* writer_profile_top — أسفل بطاقة تعريف الكاتب، 50% للكاتب */}
          <AdSlot
            slotId="writer_profile_top"
            campaigns={campaigns}
            writerId={writer.id}
            viewerId={currentUserId}
            adFree={false}
          />
          {writerArticles.map((art, artIdx) => (
            <React.Fragment key={art.id}>
              {/* writer_profile_feed — بعد البطاقة السادسة، 50% للكاتب.
                  احتياط: كاتب بمقالات قليلة (منصة حديثة الإطلاق) قد لا
                  يصل أبداً للمقال السابع — نعرضه أيضاً عند آخر مقال لقائمة
                  قصيرة (3-5 مقالات) بدل حرمانه من هذا الموضع لأشهر. */}
              {(artIdx === 6 ||
                (artIdx === writerArticles.length - 1 && writerArticles.length >= 3 && writerArticles.length < 7)) && (
                <AdSlot
                  slotId="writer_profile_feed"
                  campaigns={campaigns}
                  writerId={writer.id}
                  viewerId={currentUserId}
                  adFree={false}
                />
              )}
            <div
              onClick={() => onSelectArticle(art)}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/40 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <img
                  src={art.featuredImage}
                  alt={art.title}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                      {art.category === 'literature'
                        ? 'الأدب والشعر'
                        : art.category === 'technology'
                        ? 'التقنية'
                        : art.category === 'history'
                        ? 'التاريخ'
                        : 'فلسفة'}
                    </span>
                    {WRITER_MONETIZATION_ENABLED && art.isLocked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>مقفول ({art.lockedPrice}$)</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-teal-600 transition-colors line-clamp-1 mb-1">
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                    {art.description}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-teal-500" />
                      <span>{art.viewsCount.toLocaleString('ar-EG')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>{art.likesCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-cyan-500" />
                      <span>{art.commentsCount}</span>
                    </span>
                    <span>•</span>
                    <span>{formatDateTimeAr(art.publishedAt)}</span>
                  </div>
                </div>
              </div>

              <button className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shrink-0 self-end sm:self-center">
                قراءة المقال
              </button>
            </div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-2">
              التخصص والاهتمامات الفكرية
            </h3>
            <div className="flex flex-wrap gap-2">
              {writer.specialties?.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-3">
              الروابط والموقع الشخصي
            </h3>
            <div className="space-y-2">
              {writer.socialLinks?.website && (
                <a
                  href={writer.socialLinks.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  <span>الموقع الرسمي للكاتب</span>
                </a>
              )}
              {writer.socialLinks?.youtube && (
                <a
                  href={writer.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 transition-colors"
                  title="قناة يوتيوب"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}

              {writer.socialLinks?.whatsapp && (
                <a
                  href={writer.socialLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300 transition-colors"
                  title="واتساب"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}

              {writer.socialLinks?.telegram && (
                <a
                  href={writer.socialLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-600 dark:text-slate-300 transition-colors"
                  title="تيليجرام"
                >
                  <Send className="w-4 h-4" />
                </a>
              )}

              {writer.socialLinks?.twitter && (
                <a
                  href={writer.socialLinks.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-teal-600"
                >
                  <Twitter className="w-4 h-4 text-sky-500" />
                  <span>حساب منصة X (تويتر سابقاً)</span>
                </a>
              )}
              {writer.socialLinks?.linkedin && (
                <a
                  href={writer.socialLinks.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-teal-600"
                >
                  <Linkedin className="w-4 h-4 text-blue-600" />
                  <span>حساب LinkedIn</span>
                </a>
              )}
              {writer.socialLinks?.instagram && (
                <a
                  href={writer.socialLinks.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:text-teal-600"
                >
                  <Instagram className="w-4 h-4 text-pink-500" />
                  <span>إنستغرام</span>
                </a>
              )}
            </div>
          </div>
          <AdTickerBar slotId="writer_about" campaigns={campaigns} viewerId={currentUserId} externalPriority minHeightPx={56} />
        </div>
      )}
    </div>
  );
};
