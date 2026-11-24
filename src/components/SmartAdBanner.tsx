import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertTriangle, ExternalLink, Sparkles, Info, Eye, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { AdCampaign, PricingModel, AdPlacementType, FraudFlag } from '../types';
import { AntiFraudEngine } from '../utils/antiFraud';
import { REVENUE_SHARES, WRITER_MONETIZATION_ENABLED } from '../constants/revenueShares';
import { claimAdSlotIndex, MAX_ADS_PER_PAGE } from './AdSlot';

interface SmartAdBannerProps {
  campaign: AdCampaign;
  placementType: AdPlacementType; // 'platform' (100% owner) or 'writer' (revenue share)
  currentUserId?: string;
  articleId?: string;
  articleWriterId?: string;
  writerName?: string;
  onAdClick?: (campaign: AdCampaign, isValid: boolean) => void;
  onAdImpression?: (campaign: AdCampaign, isValid: boolean) => void;
  onFraudDetected?: (flag: Omit<FraudFlag, 'id' | 'detectedAt'>) => void;
  variant?: 'banner' | 'card' | 'inline' | 'compact';
}

export const SmartAdBanner: React.FC<SmartAdBannerProps> = ({
  campaign,
  placementType,
  currentUserId,
  articleId,
  articleWriterId,
  writerName,
  onAdClick,
  onAdImpression,
  onFraudDetected,
  variant = 'banner'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // يحجز رقماً من نفس عدّاد <AdSlot> المشترك حتى يُحتسب ضمن الحد الأقصى
  // (3 وحدات/صفحة) بدل الظهور دائماً بمعزل عن بقية مواضع الإعلانات —
  // كان هذا البانر يتجاوز الحد فعلياً عند اجتماعه مع 3 مواضع أخرى.
  const [slotIndex] = useState<number>(() => claimAdSlotIndex());
  const [loadTime] = useState<number>(Date.now());
  const [visiblePercentage, setVisiblePercentage] = useState<number>(0);
  const [continuousVisibleMs, setContinuousVisibleMs] = useState<number>(0);
  const [impressionLogged, setImpressionLogged] = useState<boolean>(false);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [fraudAlert, setFraudAlert] = useState<string | null>(null);
  const [clickCount, setClickCount] = useState<number>(0);

  const isSelfContent = Boolean(
    placementType === 'writer' &&
    articleWriterId &&
    currentUserId &&
    articleWriterId === currentUserId
  );

  // Viewport tracking using IntersectionObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let visibilityTimer: NodeJS.Timeout | null = null;
    let accumulatedMs = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ratio = Math.round(entry.intersectionRatio * 100);
          setVisiblePercentage(ratio);

          if (ratio >= 50) {
            if (!visibilityTimer) {
              const start = Date.now();
              visibilityTimer = setInterval(() => {
                accumulatedMs = Date.now() - start;
                setContinuousVisibleMs(accumulatedMs);

                // Check CPM validation once threshold met
                if (accumulatedMs >= 1000 && !impressionLogged) {
                  const result = AntiFraudEngine.validateImpression({
                    campaignId: campaign.id,
                    pricingModel: campaign.pricingModel || 'fixed',
                    visiblePercentage: ratio,
                    continuousVisibleMs: accumulatedMs,
                    pageScrollDepth: 40,
                    pageDwellTimeSeconds: (Date.now() - loadTime) / 1000,
                    userId: currentUserId,
                    articleId,
                    articleWriterId
                  });

                  if (result.isValid) {
                    setImpressionLogged(true);
                    onAdImpression?.(campaign, true);
                  } else if (result.fraudFlag) {
                    onFraudDetected?.(result.fraudFlag);
                  }
                }
              }, 200);
            }
          } else {
            if (visibilityTimer) {
              clearInterval(visibilityTimer);
              visibilityTimer = null;
            }
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (visibilityTimer) clearInterval(visibilityTimer);
    };
  }, [campaign, impressionLogged, currentUserId, articleId, articleWriterId, loadTime, onAdImpression, onFraudDetected]);

  const handleAdClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const clickElapsedSec = (Date.now() - loadTime) / 1000;

    // Run Anti-Fraud verification
    const validation = AntiFraudEngine.validateClick({
      campaignId: campaign.id,
      pricingModel: campaign.pricingModel || 'fixed',
      visiblePercentage,
      continuousVisibleMs,
      pageScrollDepth: 50,
      pageDwellTimeSeconds: clickElapsedSec,
      clickTimeFromLoadSeconds: clickElapsedSec,
      userId: currentUserId,
      articleId,
      articleWriterId
    });

    setClickCount((prev) => prev + 1);

    if (!validation.isValid) {
      setFraudAlert(validation.reason || 'تم حجب النقرة لحماية نظام الإعلانات');
      if (validation.fraudFlag) {
        onFraudDetected?.(validation.fraudFlag);
      }
      onAdClick?.(campaign, false);

      // Still allow genuine navigation preview after 1.5s
      setTimeout(() => {
        window.open(campaign.destinationUrl, '_blank', 'noopener,noreferrer');
      }, 1200);
      return;
    }

    setFraudAlert(null);
    onAdClick?.(campaign, true);
    window.open(campaign.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  const getPricingBadge = () => {
    switch (campaign.pricingModel) {
      case 'fixed':
        return { label: 'إعلان ثابت (Fixed)', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'cpm':
        return { label: 'محمي بنظام المشاهدات (CPM)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'cpc':
        return { label: 'درع النقرات الذكي (CPC Shield)', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20' };
      default:
        return { label: 'إعلان موثوق', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20' };
    }
  };

  // احترام الحد الأقصى للصفحة — نفس فحص <AdSlot> بالضبط.
  if (slotIndex >= MAX_ADS_PER_PAGE) return null;

  const badge = getPricingBadge();

  return (
    <div
      ref={containerRef}
      id={`smart-ad-${campaign.id}`}
      className="relative my-6 rounded-2xl overflow-hidden border border-brand-500/20 bg-gradient-to-r from-slate-900 via-brand-950/40 to-slate-900 p-4 shadow-xl transition-all hover:border-brand-500/40"
    >
      {/* Top Header Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-brand-500/15">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-400" />
            إعلان راعٍ
          </span>

          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>

          {WRITER_MONETIZATION_ENABLED && placementType === 'writer' ? (
            <span className="text-[10px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              مشاركة أرباح مع الكاتب ({REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%)
            </span>
          ) : (
            <span className="text-[10px] text-blue-400/90 bg-blue-950/40 border border-blue-500/20 px-2 py-0.5 rounded-full">
              عائدات المنصة (100%)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowInspector(!showInspector)}
          className="text-[11px] text-slate-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          <span>{showInspector ? 'إخفاء الفاحص' : 'فحص الحماية'}</span>
        </button>
      </div>

      {/* Fraud Alert Toast */}
      {fraudAlert && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold mb-0.5">تنبيه درع الأمان ومكافحة الاحتيال:</div>
            <div>{fraudAlert}</div>
          </div>
        </div>
      )}

      {/* Writer Self-Click Warning Banner */}
      {isSelfContent && (
        <div className="mb-3 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>
            أنت تشاهد مقالك الخاص: النقرات والمشاهدات الذاتية مفصولة آلياً لحماية نزاهة حسابك ومعلنيك.
          </span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {campaign.imageUrl && (
          <div className="relative w-full sm:w-44 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800 border border-brand-500/10 group">
            <img
              src={campaign.imageUrl}
              alt={campaign.campaignName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <span className="absolute bottom-1.5 right-1.5 text-[10px] text-white/90 bg-black/70 px-1.5 py-0.5 rounded font-mono">
              {campaign.advertiserName}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0 text-right w-full">
          <h4 className="text-sm sm:text-base font-bold text-white mb-1 line-clamp-1">
            {campaign.campaignName}
          </h4>
          <p className="text-xs sm:text-sm text-slate-300 mb-3 line-clamp-2 leading-relaxed">
            {campaign.adText || campaign.description}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAdClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-600 hover:from-brand-500 hover:to-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 active:scale-95 transition-all"
            >
              <span>زيارة العرض / استكشف</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] text-slate-400">
              معلن موثوق • {campaign.advertiserName}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Live Protection Inspector */}
      {showInspector && (
        <div className="mt-4 pt-3 border-t border-brand-500/15 bg-brand-950/20 rounded-xl p-3 text-xs space-y-2 font-mono">
          <div className="flex items-center justify-between text-brand-300 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              مؤشرات الحماية اللحظية (Anti-Fraud Live Telemetry)
            </span>
            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              الدرع نشط 100%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                <Eye className="w-3 h-3 text-blue-400" />
                نسبة الرؤية
              </div>
              <div className="font-bold text-white">{visiblePercentage}% {visiblePercentage >= 50 ? '✅ متوافق' : '⏳ جاري'}</div>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                <ShieldCheck className="w-3 h-3 text-brand-400" />
                الرؤية المستمرة
              </div>
              <div className="font-bold text-white">{(continuousVisibleMs / 1000).toFixed(1)}s (المطلوب ≥ 1s)</div>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                <MousePointerClick className="w-3 h-3 text-amber-400" />
                نموذج التسعير
              </div>
              <div className="font-bold text-amber-300 uppercase">{campaign.pricingModel}</div>
            </div>

            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 mb-0.5">توزيع الإيراد</div>
              <div className="font-bold text-emerald-400">
                {WRITER_MONETIZATION_ENABLED && placementType === 'writer' ? `${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% كاتب / ${REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}% منصة` : '100% مالك المنصة'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
