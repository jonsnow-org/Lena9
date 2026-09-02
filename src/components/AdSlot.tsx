import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdCampaign } from '../types';
import { logAdEvent } from '../services/firestoreService';
import { VideoEmbed } from './VideoEmbed';
import { VideoPlayer } from './VideoPlayer';
import { parseVideoUrl } from '../utils/videoEmbed';
import { subscribePlatformAdsEnabled, getPlatformAdsEnabled } from '../utils/platformAdsStore';
import {
  subscribeExternalAdsConfig,
  getExternalAdsConfig,
  pickActiveExternalNetwork,
  getAllEligibleExternalNetworks,
  ExternalAdNetworkConfig
} from '../utils/externalAdsStore';
import { ExternalAdScript } from './ExternalAdScript';
import { SocialPromoCta } from './SocialPromoCta';
import { pickAdsterraUnit } from '../constants/adsterraUnits';

/**
 * رموز المواضع الإعلانية المعتمدة في المنصة.
 * أي موضع جديد يجب أن يُضاف هنا وفي جدول SLOT_CONFIG أدناه.
 */
export type AdSlotId =
  | 'home_hero'
  | 'home_feed_1'
  | 'home_feed_2'
  | 'category_banner'
  | 'category_feed'
  | 'article_top'
  | 'article_mid'
  | 'article_bottom'
  | 'writer_profile_top'
  | 'writer_profile_feed'
  | 'reader_profile'
  | 'comments_feed'
  | 'tweet_feed';

interface SlotConfig {
  /** من يستفيد من عائد هذا الموضع */
  beneficiary: 'platform' | 'writer';
  /** حصة الكاتب من العائد (0 = لا حصة) */
  writerShare: number;
  /** موضع مخصص لراعي القسم حصراً */
  sponsorOnly?: boolean;
  /**
   * true = يُعرض المعلن الداخلي أولاً (والشبكة الخارجية احتياط فقط عند
   * غياب معلن داخلي مناسب). يُقرأ الآن فقط لمواضع الكاتب
   * (beneficiary: 'writer') — حماية لعائد الكاتب المتوقَّع من حملات
   * المعلنين الداخليين التي تدفع تحديداً مقابل الظهور داخل المقالات.
   * لمواضع المنصة العامة (beneficiary: 'platform') هذا الحقل بلا أثر:
   * تلك المواضع تستخدم تجمّع دوران عادل يضمّ الحملات الداخلية والشبكات
   * الخارجية معاً بالتساوي (انظر rotationPool في AdSlot.tsx) بدل أي
   * أولوية ثابتة لطرف على آخر.
   */
  internalPriority?: boolean;
}

export const SLOT_CONFIG: Record<AdSlotId, SlotConfig> = {
  home_hero: { beneficiary: 'platform', writerShare: 0 },
  home_feed_1: { beneficiary: 'platform', writerShare: 0 },
  home_feed_2: { beneficiary: 'platform', writerShare: 0 },
  category_banner: { beneficiary: 'platform', writerShare: 0, sponsorOnly: true },
  category_feed: { beneficiary: 'platform', writerShare: 0 },
  article_top: { beneficiary: 'writer', writerShare: 0.55, internalPriority: true },
  article_mid: { beneficiary: 'writer', writerShare: 0.55, internalPriority: true },
  article_bottom: { beneficiary: 'writer', writerShare: 0.55, internalPriority: true },
  writer_profile_top: { beneficiary: 'writer', writerShare: 0.5, internalPriority: true },
  writer_profile_feed: { beneficiary: 'writer', writerShare: 0.5, internalPriority: true },
  reader_profile: { beneficiary: 'platform', writerShare: 0 },
  // قسم التعليقات مرتبط مباشرة بمقال الكاتب ونقاشه، فحصته من العائد
  // تطابق بقية مواضع داخل المقال (55% كاتب / 45% منصة) بدل تركه بلا أي
  // استفادة كما كان الحال (لم تكن مساحة التعليقات مستثمرة إعلانياً إطلاقاً).
  comments_feed: { beneficiary: 'writer', writerShare: 0.55, internalPriority: true },
  // قسم التغريد الجديد — إعلان منصة عادي مدمج في القائمة (نفس تنسيق بطاقة
  // مستقلة واضحة العنوان "إعلان"، وليس نافذة منبثقة أو محتوى مموّه) حتى
  // لا يُفسد تجربة التصفح السريع للتغريدات القصيرة.
  tweet_feed: { beneficiary: 'platform', writerShare: 0 }
};

/**
 * حد أقصى صارم: 3 وحدات إعلانية في أي صفحة واحدة.
 * تجاوزه يعرّض حساب AdSense للرفض أو الإغلاق.
 */
export const MAX_ADS_PER_PAGE = 3;
let renderedAdsOnPage = 0;
// إزاحة دوران عشوائية تتغيّر مع كل انتقال شاشة (انظر resetAdSlotCounter) —
// دون هذه الإزاحة كان اختيار الحملة الداخلية "eligible[slotIndex % length]"
// يعتمد فقط على ترتيب الموضع على الصفحة (0، 1، 2...)، وبما أن أول موضع
// إعلاني على أي شاشة يحمل دوماً slotIndex=0 لكل مستخدم وكل تحميل صفحة، كانت
// نفس الحملة (الأولى في ترتيب campaigns الثابت) تفوز دوماً بكل موضع أول —
// فحملات أخرى نشطة (كترويج قناة يوتيوب) لا تظهر إطلاقاً إلا إن عُرضت
// مواضع إعلانية متعددة معاً على نفس الشاشة. بإضافة إزاحة عشوائية تتجدد مع
// كل شاشة، تتوزّع الحملات على المواضع بالتناوب فعلياً بمرور الوقت.
let adRotationSeed = Math.floor(Math.random() * 997);
export function resetAdSlotCounter() {
  renderedAdsOnPage = 0;
  adRotationSeed = Math.floor(Math.random() * 997);
}
/** يحجز الرقم التالي في عدّاد الإعلانات المشترك — يُستخدم من أي مكوّن
 *  إعلاني آخر خارج <AdSlot> نفسه (مثل SmartAdBanner) حتى يخضع لنفس الحد
 *  الأقصى (3 وحدات/صفحة) بدل عدّه بمعزل عن بقية المواضع. */
export function claimAdSlotIndex(): number {
  return renderedAdsOnPage++;
}

interface AdSlotProps {
  slotId: AdSlotId;
  campaigns?: AdCampaign[];
  articleId?: string;
  writerId?: string;
  viewerId?: string | null;
  /** التصنيف الحالي — يُستخدم لمطابقة راعي القسم */
  category?: string;
  /** true = الإعلان مدمج داخل نص المقال (تنسيق خاص) */
  inRead?: boolean;
  /** المستخدم مشترك في باقة بلا إعلانات */
  adFree?: boolean;
}

export const AdSlot: React.FC<AdSlotProps> = ({
  slotId,
  campaigns = [],
  articleId,
  writerId,
  viewerId = null,
  category,
  inRead = false,
  adFree = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasLoggedImpression = useRef(false);
  const [slotIndex] = useState(() => renderedAdsOnPage++);
  const [rotationSeed] = useState(() => adRotationSeed);
  const [platformAdsEnabled, setPlatformAdsEnabled] = useState(getPlatformAdsEnabled());
  const [externalAdsConfig, setExternalAdsConfig] = useState(getExternalAdsConfig());

  const config = SLOT_CONFIG[slotId];

  // مفتاح تشغيل/إيقاف الإعلانات العام — يشمل الآن كل المواضع (المنصة
  // والكاتب معاً)، بعد أن أصبح لدينا نظام لحساب حصة الكاتب من مشاهدات
  // الشبكات الخارجية أيضاً (انظر estimatedCpmUsd أدناه) بدل استبعادها من
  // مواضع الكاتب كلياً كما كان سابقاً.
  useEffect(() => {
    return subscribePlatformAdsEnabled(setPlatformAdsEnabled);
  }, []);

  useEffect(() => {
    return subscribeExternalAdsConfig(setExternalAdsConfig);
  }, []);

  const isSponsorSlot = Boolean(config.sponsorOnly);
  const isPlatformSlot = config.beneficiary === 'platform';

  /**
   * مرشَّح المعلن الداخلي — يُستخدم مباشرة لموضع راعي القسم (حصري بطبيعته،
   * لا ينافسه فيه أي شيء آخر إطلاقاً — منتج مدفوع "بانر واحد للقسم كاملاً
   * طوال مدة الحملة") ولمواضع الكاتب (article_*, writer_profile_*,
   * comments_feed — انظر تعليق rotationPool أدناه لسبب استثنائها). لمواضع
   * المنصة العامة، لا يُستخدم مباشرة؛ تجمّع rotationPool أدناه يعيد بناء
   * قائمته الخاصة ليضمّ الشبكات الخارجية معه في نفس الدوران.
   */
  const internalCandidate = useMemo(() => {
    if (isPlatformSlot && !platformAdsEnabled) return null;
    const active = campaigns.filter((c) => c.status === 'active');
    if (active.length === 0) return null;

    if (isSponsorSlot) {
      // راعي القسم: حملة من نوع رعاية تطابق التصنيف الحالي
      return (
        active.find(
          (c: any) =>
            c.placementType === 'category_sponsor' &&
            (!category || (c.targetCategories || []).includes(category))
        ) || null
      );
    }

    // استبعاد حملات رعاية الأقسام من المواضع العادية
    const eligible = active.filter((c: any) => c.placementType !== 'category_sponsor');
    if (eligible.length === 0) return null;
    return eligible[(slotIndex + rotationSeed) % eligible.length] || null;
  }, [campaigns, isSponsorSlot, isPlatformSlot, platformAdsEnabled, category, slotIndex, rotationSeed]);

  /**
   * مرشَّح الشبكة الخارجية الوحيد (بمعزل عن الأولوية) — يُستخدم فقط لمواضع
   * الكاتب أدناه (احتياط عند غياب حملة داخلية). لمواضع المنصة، انظر
   * rotationPool الذي يضمّ كل الشبكات المؤهَّلة معاً وليس أولها فقط.
   */
  const externalCandidate: ExternalAdNetworkConfig | null = useMemo(() => {
    if (!platformAdsEnabled) return null;
    return pickActiveExternalNetwork(externalAdsConfig);
  }, [platformAdsEnabled, externalAdsConfig]);

  /**
   * تجمّع دوران عادل — لمواضع "منصة" العامة فقط (home_hero, home_feed_1/2,
   * category_feed, reader_profile, tweet_feed)، باستثناء راعي القسم
   * الحصري: كل حملة معلن داخلية نشطة + كل شبكة خارجية مؤهَّلة فعلياً
   * (Adsterra/Monetag/Taboola) تدخل معاً في قائمة واحدة تُختار منها عبر
   * نفس إزاحة الدوران (slotIndex + rotationSeed)، بدل "أولوية ثابتة" —
   * إما الداخلي يفوز دوماً (كما كان الحال في البانر الرئيسي وملف القارئ)
   * أو الخارجي يفوز دوماً (بقية المواضع). ذاك التصميم كان يعني عملياً أن
   * وجود ولو حملة داخلية نشطة واحدة يُقصي كل شبكة خارجية إلى الأبد من
   * بعض المواضع، والعكس تماماً في مواضع أخرى — بالضبط "التصادم" الذي لا
   * نريده. الآن الجميع يتناوب فعلياً بمرور الوقت عبر كل هذه المواضع معاً،
   * فلا يُقصى أي طرف — لا معلن داخلي ولا شبكة خارجية — بشكل دائم من أي
   * موضع منها.
   *
   * مواضع الكاتب (article_*, writer_profile_*, comments_feed) مستثناة
   * عمداً من هذا التجمّع وتبقى بالنظام القديم (الداخلي أولاً، والشبكة
   * الخارجية احتياط فقط) — تلك مساحة كتبها الكاتب نفسه، وحصته المالية
   * منها (55%) مرتبطة تحديداً بحملات المعلنين الداخليين الذين يدفعون فعلاً
   * لتلك المساحة تحديداً؛ إعطاؤهم الأولوية هناك حماية لعائد الكاتب
   * المتوقَّع، وليس "تضارباً" يحتاج حلاً كمواضع المنصة العامة.
   */
  const rotationPool = useMemo(() => {
    type PoolItem = { campaign?: AdCampaign; network?: ExternalAdNetworkConfig };
    if (isSponsorSlot || !isPlatformSlot || !platformAdsEnabled) return [] as PoolItem[];
    const eligibleCampaigns = campaigns.filter(
      (c) => c.status === 'active' && (c as any).placementType !== 'category_sponsor'
    );
    const pool: PoolItem[] = eligibleCampaigns.map((c) => ({ campaign: c }));
    getAllEligibleExternalNetworks(externalAdsConfig).forEach((net) => pool.push({ network: net }));
    return pool;
  }, [campaigns, isSponsorSlot, isPlatformSlot, platformAdsEnabled, externalAdsConfig]);

  const selectedPoolItem = rotationPool.length > 0 ? rotationPool[(slotIndex + rotationSeed) % rotationPool.length] : null;

  const selectedCampaign = isSponsorSlot
    ? internalCandidate
    : isPlatformSlot
    ? selectedPoolItem?.campaign || null
    : config.internalPriority
    ? internalCandidate
    : externalCandidate
    ? null
    : internalCandidate;

  const externalNetwork: ExternalAdNetworkConfig | null = isSponsorSlot
    ? null
    : isPlatformSlot
    ? selectedPoolItem?.network || null
    : config.internalPriority
    ? internalCandidate
      ? null
      : externalCandidate
    : externalCandidate;

  // تسجيل الظهور فقط بعد بقاء 50% من الإعلان مرئياً لمدة ثانية متواصلة
  // (Viewability) — وليس عند مجرد دخوله الشاشة للحظة عابرة أثناء التمرير
  // السريع. أي خروج من نطاق الرؤية قبل اكتمال الثانية يُلغي المؤقّت
  // ويُعاد بدؤه عند العودة. لا يُحتسب أي مبلغ هنا — الاحتساب يتم لاحقاً
  // بمراجعة الأدمن.
  const MIN_VIEWABLE_MS = 1000;
  // تتبّع مشاهدة إعلان شبكة خارجية في موضع كاتب (حصة ربح ثابتة) — أساس
  // حساب عائد الكاتب من هذه الشبكات بسعر تقديري ثابت (settings/
  // externalAds.estimatedCpmUsd) عبر معالجة إدارية لاحقة، بنفس شرط الرؤية
  // الحقيقية (50% مرئي لمدة ثانية متواصلة) المستخدم أصلاً للحملات
  // الداخلية — بلا هذا الفرع كانت مشاهدات الإعلان الخارجي في مقالات/ملفات
  // الكُتّاب تمرّ دون أي أثر يُحتسب منه عائد الكاتب لاحقاً.
  const trackExternalWriterView = Boolean(externalNetwork) && config.beneficiary === 'writer';
  useEffect(() => {
    if ((!selectedCampaign && !trackExternalWriterView) || hasLoggedImpression.current) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoggedImpression.current) {
            if (dwellTimer) clearTimeout(dwellTimer);
            dwellTimer = setTimeout(() => {
              if (hasLoggedImpression.current) return;
              hasLoggedImpression.current = true;
              logAdEvent(
                selectedCampaign
                  ? { campaignId: selectedCampaign.id, slotId, articleId, writerId, viewerId, eventType: 'impression' }
                  : { slotId, articleId, writerId, viewerId, eventType: 'impression', isExternalAdView: true }
              ).catch(() => {
                /* تسجيل الظهور ليس حرجاً — لا نزعج المستخدم برسالة خطأ */
              });
              observer.disconnect();
            }, MIN_VIEWABLE_MS);
          } else if (dwellTimer) {
            clearTimeout(dwellTimer);
            dwellTimer = null;
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [selectedCampaign, trackExternalWriterView, slotId, articleId, writerId, viewerId]);

  const handleClick = () => {
    if (!selectedCampaign) return;
    logAdEvent({
      campaignId: selectedCampaign.id,
      slotId,
      articleId,
      writerId,
      viewerId,
      eventType: 'click'
    }).catch(() => {});

    const url = (selectedCampaign as any).destinationUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  // المشترك في باقة بلا إعلانات لا يرى أي موضع
  if (adFree) return null;

  // احترام الحد الأقصى للصفحة
  if (slotIndex >= MAX_ADS_PER_PAGE) return null;

  // لا حملة داخلية، لكن توجد شبكة إعلانية خارجية احتياطية مفعّلة لهذا
  // الموضع — نعرض كودها كما هو، بدون أي تتبّع إفصاح/نقر خاص بنا (تتبُّع
  // هذه الشبكات مستقل تماماً ومُدار من طرفها).
  if (!selectedCampaign && externalNetwork) {
    // Adsterra لم يعد لها كود لصق وحيد — كتالوج وحدات ثابت في الشيفرة
    // (`ADSTERRA_UNITS`)، تُختار منه وحدة واحدة مفعّلة فعلياً بنفس إزاحة
    // الدوران المستخدمة لبقية الموضع، فتتنوّع المقاسات المعروضة عبر
    // مواضع الصفحة المختلفة بدل مقاس 250px ثابت للجميع.
    const isAdsterra = externalNetwork === externalAdsConfig.adsterra;
    const adsterraUnit = isAdsterra
      ? pickAdsterraUnit(externalAdsConfig.adsterraUnits, slotIndex + rotationSeed)
      : null;
    if (isAdsterra && !adsterraUnit) return null;
    const snippet = adsterraUnit ? adsterraUnit.snippet : externalNetwork.snippet;
    const heightPx = adsterraUnit ? adsterraUnit.heightPx : 250;
    const widthPx = adsterraUnit && adsterraUnit.widthPx > 0 ? adsterraUnit.widthPx : undefined;
    return (
      <div ref={containerRef} className={inRead ? 'my-8' : 'my-5'}>
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">إعلان</div>
        {/* 250px الافتراضي يطابق المقاس شبه العالمي "300x250" (Medium Rectangle)، المدعوم فعلياً في
            كل شبكة إعلانية خارجية تقريباً (PropellerAds/Taboola) لغياب مقاس حقيقي معروف لكودها —
            أما Adsterra فيستخدم heightPx/widthPx الحقيقيين لكل وحدة كما وثّقتهما الشبكة نفسها، بدل
            صندوق عام واحد قد يقتصّ أو يترك فراغاً حول الوحدة الفعلية. */}
        <ExternalAdScript
          snippet={snippet}
          className="w-full rounded-xl overflow-hidden border border-slate-200/70 dark:border-slate-700/50"
          heightPx={heightPx}
          widthPx={widthPx}
        />
      </div>
    );
  }

  // لا إعلان متاح: لا تُعرض مساحة فارغة ولا هيكل عظمي
  if (!selectedCampaign) return null;

  const adText = (selectedCampaign as any).adText || (selectedCampaign as any).description || '';
  const imageUrl = (selectedCampaign as any).imageUrl;
  const videoUrl = (selectedCampaign as any).videoUrl;
  const uploadedVideoUrl = (selectedCampaign as any).uploadedVideoUrl;
  const hasEmbedVideo = Boolean(videoUrl && parseVideoUrl(videoUrl));
  const hasUploadedVideo = Boolean(uploadedVideoUrl);
  const advertiserName = (selectedCampaign as any).advertiserName || 'معلن';
  const isPromo = Boolean((selectedCampaign as any).promotionKind && (selectedCampaign as any).promotionKind !== 'website');

  const mediaBlock = (extraClass: string) =>
    hasUploadedVideo ? (
      <VideoPlayer src={uploadedVideoUrl} className={extraClass} />
    ) : hasEmbedVideo ? (
      <div onClick={(e) => e.stopPropagation()}>
        <VideoEmbed url={videoUrl} />
      </div>
    ) : (
      imageUrl && <img src={imageUrl} alt="" loading="lazy" className={extraClass} />
    );

  /**
   * تنسيق الإعلان المدمج في النص.
   *
   * الميزان المقصود: يندمج في نمط المنصة، ويتميّز بوضوح في الهوية —
   * يجب أن يعرف القارئ أنه إعلان خلال ثانية واحدة.
   * ⚠️ لا تجعله يشبه المحتوى لدرجة الالتباس: التشابه المفرط يُصنَّف
   * "نقراً مضللاً" وهو من أشهر أسباب إغلاق حسابات AdSense.
   */
  if (inRead) {
    return (
      <div ref={containerRef} className="my-8">
        {/* فاصل علوي رفيع */}
        <div className="h-px bg-slate-200 dark:bg-slate-800 mb-3" />

        {/* وسم الإفصاح — إلزامي، لا يُحذف ولا يُصغّر لدرجة عدم القراءة */}
        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2 tracking-wide">
          إعلان
        </div>

        {isPromo ? (
          <div className="w-full text-start rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 p-4">
            {mediaBlock('w-full max-h-[40vh] object-cover rounded-xl mb-3')}
            <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium mb-3">
              {adText}
            </div>
            <SocialPromoCta campaign={selectedCampaign as AdCampaign} onClickThrough={handleClick} />
            <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{advertiserName}</div>
          </div>
        ) : (
          <button
            onClick={handleClick}
            className="w-full text-start rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            {mediaBlock('w-full max-h-[40vh] object-cover rounded-xl mb-3')}
            <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              {adText}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              محتوى مموّل — {advertiserName}
            </div>
          </button>
        )}

        {/* فاصل سفلي رفيع */}
        <div className="h-px bg-slate-200 dark:bg-slate-800 mt-3" />
      </div>
    );
  }

  // التنسيق القياسي لباقي المواضع
  return (
    <div ref={containerRef} className="my-5">
      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5">
        {config.sponsorOnly ? 'برعاية' : 'إعلان'}
      </div>
      {isPromo ? (
        <div className="w-full text-start rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {mediaBlock('w-full max-h-52 object-cover')}
          <div className="p-3.5">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mb-3">
              {adText}
            </div>
            <SocialPromoCta campaign={selectedCampaign as AdCampaign} onClickThrough={handleClick} />
            <div className="mt-2 text-[11px] text-slate-400">{advertiserName}</div>
          </div>
        </div>
      ) : (
      <button
        onClick={handleClick}
        className="w-full text-start rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
      >
        {mediaBlock('w-full max-h-52 object-cover')}
        <div className="p-3.5">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
            {adText}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">{advertiserName}</div>
        </div>
      </button>
      )}
    </div>
  );
};
