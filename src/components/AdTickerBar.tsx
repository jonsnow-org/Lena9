import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdCampaign } from '../types';
import { logAdEvent } from '../services/firestoreService';
import { getPlatformAdsEnabled, subscribePlatformAdsEnabled } from '../utils/platformAdsStore';
import { claimAdSlotIndex, MAX_ADS_PER_PAGE } from './AdSlot';

interface AdTickerBarProps {
  campaigns?: AdCampaign[];
  /** معرّف نصّي حر لتمييز موضع الشريط في سجلات الأحداث (وليس من AdSlotId) */
  slotId: string;
  viewerId?: string | null;
  /** مدة عرض كل إعلان قبل التبديل للتالي (مللي ثانية) */
  rotateMs?: number;
}

/**
 * شريط إعلاني صغير متقلّب — بديل خفيف عن بطاقة <AdSlot> الكاملة للأماكن
 * التي يجب أن يبقى فيها الإعلان في الخلفية تماماً (مثل قائمة المحادثات):
 * سطر واحد رفيع يتنقّل تلقائياً بين كل الحملات النشطة (لا يعرض حملة واحدة
 * ثابتة)، بنفس نمط أشرطة الإعلانات الصغيرة المعروفة على الإنترنت التي لا
 * تُزعج تجربة المستخدم. يحترم نفس الحد الأقصى للصفحة (claimAdSlotIndex)
 * المستخدم في <AdSlot> حتى لا يتجاوز الموقع 3 وحدات إعلانية/صفحة إجمالاً.
 */
export const AdTickerBar: React.FC<AdTickerBarProps> = ({ campaigns = [], slotId, viewerId = null, rotateMs = 5000 }) => {
  const [slotIndex] = useState<number>(() => claimAdSlotIndex());
  const [platformAdsEnabled, setPlatformAdsEnabled] = useState(getPlatformAdsEnabled());
  useEffect(() => subscribePlatformAdsEnabled(setPlatformAdsEnabled), []);

  const active = useMemo(
    () =>
      platformAdsEnabled
        ? campaigns.filter((c: any) => c.status === 'active' && c.placementType !== 'category_sponsor')
        : [],
    [campaigns, platformAdsEnabled]
  );

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (active.length <= 1) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % active.length);
        setVisible(true);
      }, 250);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [active.length, rotateMs]);

  const loggedIds = useRef<Set<string>>(new Set());
  const campaign = active[index % active.length] as any;

  useEffect(() => {
    if (!campaign || loggedIds.current.has(campaign.id)) return;
    loggedIds.current.add(campaign.id);
    logAdEvent({ campaignId: campaign.id, slotId, viewerId, eventType: 'impression' }).catch(() => {});
  }, [campaign, slotId, viewerId]);

  if (slotIndex >= MAX_ADS_PER_PAGE) return null;
  if (!campaign) return null;

  const handleClick = () => {
    logAdEvent({ campaignId: campaign.id, slotId, viewerId, eventType: 'click' }).catch(() => {});
    if (campaign.destinationUrl) window.open(campaign.destinationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
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
