import React, { useState } from 'react';
import { Sparkles, Info, DollarSign, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AdCampaign } from '../types';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface AdMobBannerProps {
  sponsoredCampaign?: AdCampaign | null;
  onAdClick?: (campaign: AdCampaign) => void;
  format?: 'banner' | 'in-feed' | 'in-article';
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  sponsoredCampaign,
  onAdClick,
  format = 'in-feed'
}) => {
  const [showInfo, setShowInfo] = useState(false);

  // If a paid advertiser campaign exists, display it as a sponsored unit
  if (sponsoredCampaign) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-slate-900/5 via-teal-900/5 to-cyan-900/5 dark:from-slate-900/90 dark:via-teal-950/40 dark:to-slate-900/90 p-4 sm:p-5 my-5 shadow-xs transition-all hover:border-teal-500/40 literium-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300 border border-teal-500/20">
              <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              إعلان مُوصى به • شركاء ليتيريوم
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              بواسطة {sponsoredCampaign.advertiserName}
            </span>
          </div>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-1"
            title="معلومات تقاسم الأرباح"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {showInfo && (
          <div className="mb-3 p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2 animate-android-in">
            <DollarSign className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">نموذج العوائد لهذا الإعلان:</p>
              <p>
                {sponsoredCampaign.type === 'cpc'
                  ? `إعلان بالنقرة (${sponsoredCampaign.cpcRate || 0.20}$/نقرة): 60% لإدارة المنصة و40% لكاتب المقال المستضيف.`
                  : 'إعلان بمدة ظهور: 70% لإدارة المنصة، 20% لكاتب المقال، و10% صندوق دعم وصيانة.'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {sponsoredCampaign.imageUrl && (
            <img
              src={sponsoredCampaign.imageUrl}
              alt={sponsoredCampaign.campaignName}
              referrerPolicy="no-referrer"
              className="w-full sm:w-32 h-24 sm:h-20 object-cover rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base mb-1">
              {sponsoredCampaign.campaignName}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
              {sponsoredCampaign.adText || sponsoredCampaign.description}
            </p>

            <a
              href={sponsoredCampaign.destinationUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (onAdClick) {
                  onAdClick(sponsoredCampaign);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-xs font-bold shadow-xs shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>زيارة المعلن</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No real ad campaign configured yet — placeholder slot.
  // IMPORTANT: this is a WEB app (literium.ai.studio), so the correct real ad
  // network is Google AdSense (or Ad Manager for larger scale) — NOT AdMob,
  // which only serves native Android/iOS apps and cannot be embedded here.
  // To go live: get approved for AdSense, then replace this block with:
  //   <ins class="adsbygoogle" style={{display:'block'}}
  //        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
  //        data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true" />
  // and load https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js once in index.html.
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-4 my-5 shadow-xs ${format === 'banner' ? 'max-w-2xl mx-auto' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            قيد التطوير
          </span>
          <span className="text-xs text-slate-400">مكان إعلان Google AdSense (لم يُفعَّل بعد)</span>
        </div>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          <span>توزيع الأرباح</span>
        </button>
      </div>

      {showInfo && (
        <div className="mb-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 animate-android-in">
          <div className="flex items-center gap-2 mb-1 text-teal-700 dark:text-teal-300 font-bold">
            <DollarSign className="w-3.5 h-3.5" />
            <span>نظام توزيع العوائد المخطط له لكل 1,000 مشاهدة إعلان:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            • <strong>{REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%</strong> تودع في محفظة كاتب المقال.<br />
            • <strong>{REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}%</strong> تودع في حساب منصة ليتيريوم وصيانة الخوادم والذكاء الاصطناعي.<br />
            <span className="text-amber-600 dark:text-amber-400 font-semibold">هذه الأرقام تخطيطية فقط ولن تصبح أرباحاً حقيقية إلا بعد ربط حساب Google AdSense معتمد.</span>
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-gradient-to-r from-teal-50/60 to-cyan-50/60 dark:from-teal-950/20 dark:to-cyan-950/20 border border-teal-100 dark:border-teal-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-600 flex items-center justify-center text-white font-black text-lg shadow-xs shrink-0">
            G
          </div>
          <div>
            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
              Google Workspace & Cloud Solutions
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              حلول الإنتاجية والذكاء الاصطناعي السحابي للشركات والمؤلفين
            </p>
          </div>
        </div>

        <a
          href="https://workspace.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shrink-0 transition-transform active:scale-95 shadow-xs"
        >
          تجربة الآن
        </a>
      </div>
    </div>
  );
};

