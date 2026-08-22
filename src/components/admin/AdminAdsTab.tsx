import React, { useState } from 'react';
import {
  Megaphone,
  Rocket,
  Globe,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Layers,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { User, AdCampaign, ArticlePromotion } from '../../types';
import { ExternalAdsConfig } from '../../utils/externalAdsStore';

interface AdminAdsTabProps {
  campaigns: AdCampaign[];
  promotions?: ArticlePromotion[];
  users: User[];
  platformAdsEnabled?: boolean;
  onTogglePlatformAds?: (enabled: boolean) => void;
  externalAdsConfig?: ExternalAdsConfig;
  onSaveExternalAdsConfig?: (config: ExternalAdsConfig) => void;
  onUpdateCampaignStatus?: (campaignId: string, status: AdCampaign['status']) => void;
  onUpdatePromotionStatus?: (promotionId: string, status: 'approved' | 'rejected') => void;
  initialSubTab?: 'ad_campaigns' | 'promotions' | 'external_networks';
}

export const AdminAdsTab: React.FC<AdminAdsTabProps> = ({
  campaigns,
  promotions = [],
  users,
  platformAdsEnabled = true,
  onTogglePlatformAds,
  externalAdsConfig,
  onSaveExternalAdsConfig,
  onUpdateCampaignStatus,
  onUpdatePromotionStatus,
  initialSubTab = 'ad_campaigns'
}) => {
  const [subTab, setSubTab] = useState<'ad_campaigns' | 'promotions' | 'external_networks'>(
    initialSubTab
  );

  const [campaignFilter, setCampaignFilter] = useState<'all' | 'active' | 'pending' | 'paused' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((camp) => {
    if (campaignFilter !== 'all' && camp.status !== campaignFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = camp.title?.toLowerCase().includes(q);
      const matchDesc = camp.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const pendingCampaignsCount = campaigns.filter((c) => c.status === 'pending').length;
  const pendingPromotionsCount = promotions.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Sub-tabs Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-400" />
            مركز الإعلانات والترويج
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            إدارة حملات المعلنين، رعاية وترويج مقالات الكُتّاب، والشبكات الإعلانية الخارجية.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[
            {
              id: 'ad_campaigns',
              label: 'حملات المعلنين',
              icon: Megaphone,
              badge: pendingCampaignsCount
            },
            {
              id: 'promotions',
              label: 'ترويج المقالات',
              icon: Rocket,
              badge: pendingPromotionsCount
            },
            {
              id: 'external_networks',
              label: 'الشبكات الخارجية',
              icon: Globe,
              badge: 0
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-amber-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. AD CAMPAIGNS */}
      {subTab === 'ad_campaigns' && (
        <div className="space-y-4">
          {/* Controls: Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="البحث في الحملات الإعلانية..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'النشطة' },
                { id: 'pending', label: 'بانتظار الاعتماد' },
                { id: 'paused', label: 'المتوقفة' },
                { id: 'rejected', label: 'المرفوضة' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCampaignFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    campaignFilter === f.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد حملات إعلانية تطابق هذا البحث أو الفلتر.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCampaigns.map((camp) => {
                const adv = users.find((u) => u.id === camp.advertiserId);
                const isPlatformAd = camp.isPlatformAd || !camp.advertiserId;

                return (
                  <div
                    key={camp.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                camp.status === 'active'
                                  ? 'bg-emerald-500 text-slate-950 font-bold'
                                  : camp.status === 'pending'
                                  ? 'bg-amber-500 text-slate-950 font-black'
                                  : camp.status === 'paused'
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
                              {camp.status === 'active'
                                ? 'نشطة ✓'
                                : camp.status === 'pending'
                                ? 'بانتظار الاعتماد ⏳'
                                : camp.status === 'paused'
                                ? 'متوقفة مؤقتاً'
                                : 'مرفوضة ✗'}
                            </span>
                            {isPlatformAd ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                إعلان منصة (100%)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                معلن خارجي
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-white mt-1 line-clamp-1">{camp.title}</h4>
                        </div>
                      </div>

                      {camp.imageUrl && (
                        <div className="rounded-xl overflow-hidden h-28 bg-slate-950 border border-slate-800">
                          <img
                            src={camp.imageUrl}
                            alt={camp.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {camp.description}
                      </p>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500">الميزانية</div>
                          <div className="font-bold text-white">${camp.budget}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">الظهور</div>
                          <div className="font-bold text-blue-400">{camp.impressions || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">النقرات</div>
                          <div className="font-bold text-emerald-400">{camp.clicks || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {onUpdateCampaignStatus && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                        {camp.status !== 'active' && (
                          <button
                            onClick={() => onUpdateCampaignStatus(camp.id, 'active')}
                            className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>تفعيل / موافقة</span>
                          </button>
                        )}
                        {camp.status === 'active' && (
                          <button
                            onClick={() => onUpdateCampaignStatus(camp.id, 'paused')}
                            className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Pause className="w-3 h-3" />
                            <span>إيقاف مؤقت</span>
                          </button>
                        )}
                        {camp.status !== 'rejected' && (
                          <button
                            onClick={() => onUpdateCampaignStatus(camp.id, 'rejected')}
                            className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white font-bold text-xs transition-colors"
                          >
                            رفض
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. PROMOTION REQUESTS */}
      {subTab === 'promotions' && (
        <div className="space-y-4">
          <h4 className="font-black text-white text-sm">
            طلبات ترويج المقالات من الكُتّاب ({promotions.length})
          </h4>

          {promotions.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              لا توجد طلبات ترويج مقالات حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((promo) => {
                const writer = users.find((u) => u.id === promo.writerId);
                return (
                  <div
                    key={promo.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          promo.status === 'pending'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : promo.status === 'approved'
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-rose-500 text-white font-bold'
                        }`}
                      >
                        {promo.status === 'pending'
                          ? 'بانتظار الاعتماد'
                          : promo.status === 'approved'
                          ? 'موافق عليه ونشط ✓'
                          : 'مرفوض ✗'}
                      </span>
                      <h5 className="font-bold text-sm text-white mt-1 truncate">
                        {promo.articleTitle || promo.articleId}
                      </h5>
                      <div className="text-xs text-slate-400 mt-0.5">
                        الكاتب: {writer ? writer.fullName : promo.writerId} • الميزانية: ${promo.budget} • الهدف: {promo.goal}
                      </div>
                    </div>

                    {promo.status === 'pending' && onUpdatePromotionStatus && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onUpdatePromotionStatus(promo.id, 'approved')}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
                        >
                          اعتماد الترويج
                        </button>
                        <button
                          onClick={() => onUpdatePromotionStatus(promo.id, 'rejected')}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. EXTERNAL AD NETWORKS */}
      {subTab === 'external_networks' && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">تفعيل شبكة إعلانات المنصة العامة</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  التحكم في ظهور الإعلانات العامة (Banner / Native) في التغذية الرئيسية وصفحات الاستكشاف.
                </p>
              </div>
              {onTogglePlatformAds && (
                <button
                  onClick={() => onTogglePlatformAds(!platformAdsEnabled)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    platformAdsEnabled
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {platformAdsEnabled ? 'مفعلة حالياً ✓' : 'معطلة'}
                </button>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              ربط شبكات الإعلانات الخارجية البديلة (Fallback Ad Networks)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              إذا لم تكن هناك حملات محلية نشطة للمعلنين، يمكن ملء المساحات الشاغرة تلقائياً عبر شبكات خارجية مثل PropellerAds أو Adsterra أو Google AdSense لتعظيم الدخل السلبي.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-xs text-white">PropellerAds Zone ID</div>
                <input
                  type="text"
                  placeholder="مثال: 7291048"
                  defaultValue={externalAdsConfig?.propellerAds?.zoneId || ''}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-bold text-xs text-white">Adsterra Key / Tag ID</div>
                <input
                  type="text"
                  placeholder="مثال: 4a2b9f..."
                  defaultValue={externalAdsConfig?.adsterra?.tagId || ''}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
