import React, { useState, useEffect } from 'react';
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
  onSaveExternalAdsConfig?: (config: ExternalAdsConfig) => void | Promise<void>;
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

  // ⚠️ حقول "الشبكات الخارجية" أدناه كانت وهمية بالكامل: بلا onChange وبلا
  // زر حفظ إطلاقاً، وتقرأ propellerAds.zoneId / adsterra.tagId رغم أن
  // الشكل الحقيقي المحفوظ فعلياً في Firestore (externalAdsStore.ts) هو
  // {enabled, snippet} — فكانت الكتابة فيها لا تُخزَّن ولا تُقرأ من أي
  // مكان، ويظهر الحقل فارغاً دائماً حتى بعد أي "حفظ" وهمي. الآن حالة
  // محلية حقيقية + زر حفظ فعلي يستدعي onSaveExternalAdsConfig.
  const [propellerEnabled, setPropellerEnabled] = useState(externalAdsConfig?.propellerAds?.enabled ?? false);
  const [propellerSnippet, setPropellerSnippet] = useState(externalAdsConfig?.propellerAds?.snippet ?? '');
  const [adsterraEnabled, setAdsterraEnabled] = useState(externalAdsConfig?.adsterra?.enabled ?? false);
  const [adsterraSnippet, setAdsterraSnippet] = useState(externalAdsConfig?.adsterra?.snippet ?? '');
  const [isSavingExternalAds, setIsSavingExternalAds] = useState(false);
  const [externalAdsSavedMsg, setExternalAdsSavedMsg] = useState('');

  // آخر نسخة محفوظة فعلياً — يُقارَن بها الإدخال الحالي لإظهار زر الحفظ
  // فقط عند وجود تغيير حقيقي لم يُحفَظ بعد، ولإخفائه بعد نجاح الحفظ
  // (بدل بقائه ظاهراً دائماً بلا فائدة تُذكر للمستخدم عن حالة الحفظ).
  const [savedExternalAdsSnapshot, setSavedExternalAdsSnapshot] = useState({
    propellerEnabled,
    propellerSnippet,
    adsterraEnabled,
    adsterraSnippet
  });

  const isExternalAdsDirty =
    propellerEnabled !== savedExternalAdsSnapshot.propellerEnabled ||
    propellerSnippet.trim() !== savedExternalAdsSnapshot.propellerSnippet.trim() ||
    adsterraEnabled !== savedExternalAdsSnapshot.adsterraEnabled ||
    adsterraSnippet.trim() !== savedExternalAdsSnapshot.adsterraSnippet.trim();

  // إن وصلت قيمة externalAdsConfig من Firestore بعد أول تحميل لهذا
  // المكوّن (شائع: الاشتراك اللحظي يبدأ فارغاً ثم يمتلئ بعد جزء من
  // الثانية)، أو حدَّثها أدمن آخر من جلسة مختلفة، يجب أن تنعكس في الحقول
  // — لكن فقط ما دام المستخدم لم يبدأ تعديلاً محلياً غير محفوظ بعد،
  // حتى لا تُفقَد كتابته الحالية.
  useEffect(() => {
    if (isExternalAdsDirty) return;
    const nextSnapshot = {
      propellerEnabled: externalAdsConfig?.propellerAds?.enabled ?? false,
      propellerSnippet: externalAdsConfig?.propellerAds?.snippet ?? '',
      adsterraEnabled: externalAdsConfig?.adsterra?.enabled ?? false,
      adsterraSnippet: externalAdsConfig?.adsterra?.snippet ?? ''
    };
    setPropellerEnabled(nextSnapshot.propellerEnabled);
    setPropellerSnippet(nextSnapshot.propellerSnippet);
    setAdsterraEnabled(nextSnapshot.adsterraEnabled);
    setAdsterraSnippet(nextSnapshot.adsterraSnippet);
    setSavedExternalAdsSnapshot(nextSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAdsConfig]);

  const handleSaveExternalNetworks = async () => {
    if (!onSaveExternalAdsConfig) return;
    setIsSavingExternalAds(true);
    setExternalAdsSavedMsg('');
    try {
      const trimmedPropeller = propellerSnippet.trim();
      const trimmedAdsterra = adsterraSnippet.trim();
      await onSaveExternalAdsConfig({
        propellerAds: { enabled: propellerEnabled, snippet: trimmedPropeller },
        adsterra: { enabled: adsterraEnabled, snippet: trimmedAdsterra }
      });
      setSavedExternalAdsSnapshot({
        propellerEnabled,
        propellerSnippet: trimmedPropeller,
        adsterraEnabled,
        adsterraSnippet: trimmedAdsterra
      });
      setExternalAdsSavedMsg('تم الحفظ بنجاح ✓');
      setTimeout(() => setExternalAdsSavedMsg(''), 3000);
    } finally {
      setIsSavingExternalAds(false);
    }
  };

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((camp) => {
    if (campaignFilter !== 'all' && camp.status !== campaignFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = camp.campaignName?.toLowerCase().includes(q);
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
                const isPlatformAd = !camp.advertiserId;

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
                                ? 'بانتظار تمويل المعلن ⏳'
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
                          <h4 className="font-bold text-sm text-white mt-1 line-clamp-1">{camp.campaignName}</h4>
                        </div>
                      </div>

                      {camp.imageUrl && (
                        <div className="rounded-xl overflow-hidden h-28 bg-slate-950 border border-slate-800">
                          <img
                            src={camp.imageUrl}
                            alt={camp.campaignName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {camp.description}
                      </p>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500">الميزانية</div>
                          <div className="font-bold text-white">
                            ${camp.status === 'pending' ? camp.requestedBudget || 0 : camp.totalBudget}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">المُنفَق</div>
                          <div className="font-bold text-amber-400">${(camp.totalSpent || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">الظهور</div>
                          <div className="font-bold text-blue-400">{camp.impressionsCount || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500">النقرات</div>
                          <div className="font-bold text-emerald-400">{camp.clicksCount || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {onUpdateCampaignStatus && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                        {camp.status === 'pending' && (
                          <p className="flex-1 text-[11px] text-amber-400 leading-relaxed">
                            الحملة بانتظار أن يموّلها المعلن نفسه من محفظته — لا يمكن تفعيلها إدارياً بلا رصيد حقيقي مخصوم.
                          </p>
                        )}
                        {camp.status === 'paused' && (
                          <button
                            onClick={() => onUpdateCampaignStatus(camp.id, 'active')}
                            className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>استئناف</span>
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
                        الكاتب: {writer ? writer.fullName : promo.writerId} • التكلفة: ${promo.cost} • {promo.pricingModel === 'cpc' ? 'الدفع لكل نقرة' : 'سعر ثابت'}
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
              إذا لم تكن هناك حملات محلية نشطة للمعلنين، يمكن ملء المساحات الشاغرة تلقائياً عبر شبكات خارجية مثل PropellerAds (يشمل Monetag) أو Adsterra لتعظيم الدخل السلبي. الصق كود الإعلان الكامل (وسم &lt;script&gt; كاملاً) كما هو من لوحة الشبكة، ثم فعّل المفتاح.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-white">PropellerAds (ويشمل Monetag)</div>
                  <button
                    type="button"
                    onClick={() => setPropellerEnabled((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      propellerEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {propellerEnabled ? 'مفعّلة ✓' : 'معطّلة'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="الصق كود <script> الكامل من PropellerAds/Monetag هنا"
                  value={propellerSnippet}
                  onChange={(e) => setPropellerSnippet(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500 resize-y"
                  dir="ltr"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-white">Adsterra</div>
                  <button
                    type="button"
                    onClick={() => setAdsterraEnabled((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      adsterraEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {adsterraEnabled ? 'مفعّلة ✓' : 'معطّلة'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="الصق كود <script> الكامل من Adsterra هنا"
                  value={adsterraSnippet}
                  onChange={(e) => setAdsterraSnippet(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500 resize-y"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 min-h-[38px]">
              {(isExternalAdsDirty || isSavingExternalAds) && (
                <button
                  type="button"
                  onClick={handleSaveExternalNetworks}
                  disabled={isSavingExternalAds || !onSaveExternalAdsConfig}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  {isSavingExternalAds ? 'جارٍ الحفظ...' : 'حفظ إعدادات الشبكات الخارجية'}
                </button>
              )}
              {externalAdsSavedMsg && (
                <span className="text-xs font-bold text-emerald-400">{externalAdsSavedMsg}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
