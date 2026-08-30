import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdCampaign } from '../types';
import { logAdEvent } from '../services/firestoreService';
import { getPlatformAdsEnabled, subscribePlatformAdsEnabled } from '../utils/platformAdsStore';
import {
  subscribeExternalAdsConfig,
  getExternalAdsConfig,
  pickActiveExternalNetwork,
  ExternalAdNetworkConfig
} from '../utils/externalAdsStore';
import { ExternalAdScript } from './ExternalAdScript';
import { claimAdSlotIndex, MAX_ADS_PER_PAGE } from './AdSlot';

interface AdTickerBarProps {
  campaigns?: AdCampaign[];
  /** معرّف نصّي حر لتمييز موضع الشريط في سجلات الأحداث (وليس من AdSlotId) */
  slotId: string;
  viewerId?: string | null;
  /** مدة عرض كل إعلان قبل التبديل للتالي (مللي ثانية) */
  rotateMs?: number;
  /**
   * true = الشبكة الخارجية أولاً (تُستبعَد الحملات الداخلية كلياً من
   * الدوران إن وُجدت شبكة خارجية مؤهَّلة)، والحملات الداخلية تملأ الفراغ
   * فقط عند غياب أي شبكة خارجية. false (الافتراضي) = العكس: الحملات
   * الداخلية أولاً، والشبكة الخارجية احتياط فقط عند غيابها.
   * بتوزيع هذا الخيار بالتناوب بين مواضع مختلفة نضمن ألا يُقصى أي طرف —
   * لا المعلنون الداخليون ولا الشبكات الخارجية — بشكل دائم من كل الشرائط.
   */
  externalPriority?: boolean;
  /** ارتفاع أدنى بالبكسل للشريط (كلا الفرعين: الحملة الداخلية والشبكة
   *  الخارجية) — افتراضياً 56 (نفس ارتفاع قائمة الرسائل الأصلي). */
  minHeightPx?: number;
}

/**
 * شريط إعلاني صغير متقلّب — بديل خفيف عن بطاقة <AdSlot> الكاملة للأماكن
 * التي يجب أن يبقى فيها الإعلان في الخلفية تماماً (قوائم، مساحات فارغة):
 * سطر واحد رفيع يتنقّل تلقائياً بين كل الحملات النشطة، بنفس نمط أشرطة
 * الإعلانات الصغيرة المعروفة على الإنترنت. يحترم نفس الحد الأقصى للصفحة
 * (claimAdSlotIndex) المستخدم في <AdSlot> حتى لا يتجاوز الموقع 3 وحدات/صفحة.
 */
export const AdTickerBar: React.FC<AdTickerBarProps> = ({
  campaigns = [],
  slotId,
  viewerId = null,
  rotateMs = 5000,
  externalPriority = false,
  minHeightPx = 56
}) => {
  const [slotIndex] = useState<number>(() => claimAdSlotIndex());
  const [platformAdsEnabled, setPlatformAdsEnabled] = useState(getPlatformAdsEnabled());
  const [externalAdsConfig, setExternalAdsConfig] = useState(getExternalAdsConfig());
  useEffect(() => subscribePlatformAdsEnabled(setPlatformAdsEnabled), []);
  useEffect(() => subscribeExternalAdsConfig(setExternalAdsConfig), []);

  const active = useMemo(
    () =>
      platformAdsEnabled
        ? campaigns.filter((c: any) => c.status === 'active' && c.placementType !== 'category_sponsor')
        : [],
    [campaigns, platformAdsEnabled]
  );

  const externalNetwork: ExternalAdNetworkConfig | null = useMemo(() => {
    if (!platformAdsEnabled) return null;
    return pickActiveExternalNetwork(externalAdsConfig);
  }, [platformAdsEnabled, externalAdsConfig]);

  // بأولوية خارجية: تُستبعَد الحملات الداخلية كلياً من الدوران طالما توجد
  // شبكة خارجية مؤهَّلة — لا مجرد احتياط كما في الوضع الافتراضي.
  const rotationCampaigns = externalPriority && externalNetwork ? [] : active;

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (rotationCampaigns.length <= 1) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % rotationCampaigns.length);
        setVisible(true);
      }, 250);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [rotationCampaigns.length, rotateMs]);

  const loggedIds = useRef<Set<string>>(new Set());
  const campaign = rotationCampaigns[index % rotationCampaigns.length] as any;

  useEffect(() => {
    if (!campaign || loggedIds.current.has(campaign.id)) return;
    loggedIds.current.add(campaign.id);
    logAdEvent({ campaignId: campaign.id, slotId, viewerId, eventType: 'impression' }).catch(() => {});
  }, [campaign, slotId, viewerId]);

  if (slotIndex >= MAX_ADS_PER_PAGE) return null;

  if (!campaign && externalNetwork) {
    return (
      <div className="w-full rounded-xl overflow-hidden border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/60">
        <ExternalAdScript snippet={externalNetwork.snippet} className="w-full" heightPx={minHeightPx} />
      </div>
    );
  }

  if (!campaign) return null;

  const handleClick = () => {
    logAdEvent({ campaignId: campaign.id, slotId, viewerId, eventType: 'click' }).catch(() => {});
    if (campaign.destinationUrl) window.open(campaign.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      style={{ minHeight: minHeightPx }}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50 text-start transition-opacity duration-250 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {campaign.imageUrl && (
        <img src={campaign.imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
      )}
      <span className="flex-1 min-w-0 text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
        {campaign.adText || campaign.description || campaign.campaignName}
      </span>
      <span className="text-[9px] font-bold text-slate-400 shrink-0">إعلان</span>
    </button>
  );
};
