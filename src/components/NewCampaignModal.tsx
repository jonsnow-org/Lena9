import React, { useState } from 'react';
import {
  X,
  Megaphone,
  Sparkles,
  Target,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  MousePointerClick,
  Layers,
  HelpCircle,
  Zap,
  Image as ImageIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AdCampaign, PricingModel, AdPlacementType, PromotionKind } from '../types';
import { VideoUrlInput } from './VideoEmbed';
import { MediaUploadInput } from './MediaUploadInput';

const PROMOTION_PLATFORMS: { id: Exclude<PromotionKind, 'website'>; label: string; urlHint: string }[] = [
  { id: 'telegram', label: 'قناة تيليجرام', urlHint: 'https://t.me/channel_username' },
  { id: 'youtube', label: 'قناة يوتيوب', urlHint: 'https://youtube.com/@channel_handle' },
  { id: 'instagram', label: 'حساب انستغرام', urlHint: 'https://instagram.com/username' },
  { id: 'twitter', label: 'حساب X (تويتر)', urlHint: 'https://x.com/username' },
  { id: 'facebook', label: 'صفحة فيسبوك', urlHint: 'https://facebook.com/pagename' }
];

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCampaign: (campaignData: Partial<AdCampaign>) => void | Promise<void>;
  userBalance: number;
  onOpenDeposit: () => void;
  activeUsersCount?: number;
}

const PRESET_BANNERS = [
  {
    label: 'تكنولوجيا وبرمجيات',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'كتب ونشر أدبي',
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'أعمال واستثمار',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'ذكاء اصطناعي وعلم',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80'
  }
];

export const NewCampaignModal: React.FC<NewCampaignModalProps> = ({
  isOpen,
  onClose,
  onCreateCampaign,
  userBalance,
  onOpenDeposit,
  // كان الرقم الافتراضي هنا 14200 (وهمي بالكامل) — الآن يعتمد فقط على
  // العدد الحقيقي الممرَّر من App.tsx (users.length)، وفي حال عدم تمريره
  // لأي سبب يبقى الافتراضي 1 بدل رقم مختلق يوهم المعلن بجمهور غير حقيقي.
  activeUsersCount = 1
}) => {
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [adText, setAdText] = useState('');
  const [imageUrl, setImageUrl] = useState(PRESET_BANNERS[0].url);
  const [customImageInput, setCustomImageInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');
  const [promotionKind, setPromotionKind] = useState<PromotionKind>('website');
  const [destinationUrl, setDestinationUrl] = useState('https://literium.app');
  const [pricingModel, setPricingModel] = useState<PricingModel>('cpc');
  const [placementType, setPlacementType] = useState<AdPlacementType>('writer');
  const [durationHours, setDurationHours] = useState<number>(48);
  const [cpcRate, setCpcRate] = useState<number>(0.20);
  const [cpmRate, setCpmRate] = useState<number>(2.50);
  const [totalBudget, setTotalBudget] = useState<number>(50);
  const [targetCategory, setTargetCategory] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const userMultiplier = Math.max(1, activeUsersCount / 10000);
  const fixedDurationPrices: Record<number, number> = {
    24: Math.round(15 * userMultiplier),
    48: Math.round(28 * userMultiplier),
    72: Math.round(39 * userMultiplier),
    168: Math.round(85 * userMultiplier)
  };

  const estimatedCost =
    pricingModel === 'fixed' ? fixedDurationPrices[durationHours] || 28 : totalBudget;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!campaignName.trim()) {
      setErrorMsg('يرجى إدخال اسم الحملة الإعلانية.');
      return;
    }

    if (!adText.trim()) {
      setErrorMsg('يرجى كتابة نص الإعلان الترويجي.');
      return;
    }

    if (!destinationUrl.trim()) {
      setErrorMsg(
        promotionKind === 'website'
          ? 'يرجى إدخال الرابط المستهدف للحملة.'
          : 'يرجى إدخال رابط القناة/الحساب المراد الترويج له.'
      );
      return;
    }

    if (userBalance < estimatedCost) {
      setErrorMsg(`رصيد محفظتك ($${userBalance.toFixed(2)}) غير كافٍ لتغطية ميزانية الحملة ($${estimatedCost.toFixed(2)}). يرجى شحن الرصيد أولاً.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateCampaign({
        campaignName: campaignName.trim(),
        description: description.trim() || adText.trim(),
        adText: adText.trim(),
        imageUrl: mediaMode === 'image' ? (customImageInput.trim() || imageUrl) : '',
        videoUrl: videoUrl.trim() || undefined,
        uploadedVideoUrl: mediaMode === 'video' ? (uploadedVideoUrl.trim() || undefined) : undefined,
        promotionKind,
        destinationUrl: destinationUrl.trim(),
        type: pricingModel === 'fixed' ? 'fixed' : pricingModel === 'cpc' ? 'cpc' : 'cpm',
        pricingModel,
        placementType,
        durationHours: pricingModel === 'fixed' ? durationHours : undefined,
        cpcRate: pricingModel === 'cpc' ? cpcRate : undefined,
        cpmRate: pricingModel === 'cpm' ? cpmRate : undefined,
        // ⚠️ قواعد أمان Firestore تفرض أن تبدأ كل الحقول المالية والعدادات
        // بصفر، وأن تكون الحالة draft. المعلن لا يستطيع تفعيل حملته بنفسه
        // ولا تحديد ميزانيتها — الاعتماد وتحديد الميزانية من الأدمن بعد
        // التحقق من رصيد المحفظة.
        requestedBudget: estimatedCost,
        totalBudget: 0,
        totalSpent: 0,
        impressionsCount: 0,
        validImpressionsCount: 0,
        clicksCount: 0,
        validClicksCount: 0,
        conversionsCount: 0,
        blockedFraudClicks: 0,
        status: 'draft',
        targetCategories: targetCategory === 'all' ? ['all'] : [targetCategory],
        fraudBlockedCount: 0
      });

      try {
        confetti({ particleCount: 60, spread: 60 });
      } catch {}

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ الحملة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                إنشاء حملة إعلانية جديدة
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                روّج لمحتواك أو موقعك أمام جمهور ليتيريوم بنماذج تسعير مرنة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {errorMsg.includes('غير كافٍ') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDeposit();
                  }}
                  className="px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-[11px] shrink-0"
                >
                  شحن الرصيد الآن
                </button>
              )}
            </div>
          )}

          {/* Balance info card */}
          <div className="p-3.5 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-800/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                رصيد محفظتك المتاح:
              </span>
              <span className="font-black text-cyan-700 dark:text-cyan-300 text-sm">
                ${userBalance.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenDeposit}
              className="text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              + شحن المحفظة
            </button>
          </div>

          {/* نوع الحملة: إعلان عادي أو ترويج قناة/حساب اجتماعي */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              نوع الحملة
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPromotionKind('website')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  promotionKind === 'website'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="block text-xs font-bold">حملة إعلانية عادية</span>
                <span className="text-[10px] opacity-75">ترويج موقع أو منتج</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (promotionKind === 'website') {
                    setPromotionKind('telegram');
                    if (destinationUrl === 'https://literium.app') setDestinationUrl('');
                  }
                }}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  promotionKind !== 'website'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="block text-xs font-bold">ترويج قناة/حساب اجتماعي</span>
                <span className="text-[10px] opacity-75">يوتيوب، تيليجرام، إنستغرام...</span>
              </button>
            </div>

            {promotionKind !== 'website' && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 pt-1">
                {PROMOTION_PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPromotionKind(p.id)}
                    className={`p-2 rounded-xl text-center border text-[11px] font-bold transition-all ${
                      promotionKind === p.id
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 1. Campaign Basic Info */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              1. بيانات الإعلان الأساسية
            </label>
            <div>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="عنوان الحملة (مثال: ترويج كتاب الفلسفة المعاصرة)"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm outline-hidden focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <textarea
                value={adText}
                onChange={(e) => setAdText(e.target.value)}
                rows={2}
                placeholder="النص الترويجي الجذاب الذي يظهر للمستخدمين"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500 resize-none"
                required
              />
            </div>
            <div>
              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder={
                  promotionKind === 'website'
                    ? 'الرابط الخارجي المستهدف (https://...)'
                    : PROMOTION_PLATFORMS.find((p) => p.id === promotionKind)?.urlHint
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500"
                dir="ltr"
                required
              />
            </div>
          </div>

          {/* 2. الوسائط الإعلانية: صورة أو فيديو قصير مرفوع مباشرة */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              2. الوسائط الإعلانية
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMediaMode('image')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  mediaMode === 'image'
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                صورة
              </button>
              <button
                type="button"
                onClick={() => setMediaMode('video')}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  mediaMode === 'video'
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                فيديو قصير (حتى دقيقة)
              </button>
            </div>

            {mediaMode === 'image' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_BANNERS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setImageUrl(preset.url);
                        setCustomImageInput('');
                      }}
                      className={`p-1.5 rounded-xl border text-start transition-all overflow-hidden ${
                        imageUrl === preset.url && !customImageInput
                          ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                          : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-14 object-cover rounded-lg mb-1"
                      />
                      <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
                <MediaUploadInput
                  kind="image"
                  value={customImageInput}
                  onChange={(url) => {
                    setCustomImageInput(url);
                    if (url.trim()) setImageUrl(url.trim());
                  }}
                  label="أو ارفع صورة خاصة بك"
                />
              </div>
            ) : (
              <MediaUploadInput
                kind="video"
                value={uploadedVideoUrl}
                onChange={setUploadedVideoUrl}
                label="ارفع مقطع فيديو قصير (حتى دقيقة واحدة)"
              />
            )}
          </div>

          {/* فيديو تعريفي مضمّن (اختياري) — يوتيوب/Vimeo */}
          <VideoUrlInput
            value={videoUrl}
            onChange={setVideoUrl}
            label={promotionKind === 'website' ? 'فيديو إعلاني مضمّن إضافي (اختياري)' : 'مقطع تعريفي عن القناة من يوتيوب/Vimeo (اختياري)'}
            maxDurationHint="يُفضّل ألا تتجاوز مدة الفيديو دقيقة واحدة."
          />

          {/* نوع المساحة الإعلانية */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              نوع المساحة الإعلانية
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'platform', label: 'مساحات المنصة', hint: 'الرئيسية والتصنيفات' },
                { id: 'writer', label: 'داخل المقالات', hint: 'صفحات الكتّاب' },
                { id: 'category_sponsor', label: 'رعاية قسم', hint: 'بانر حصري للقسم' }
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPlacementType(opt.id as any)}
                  className={`p-3 rounded-2xl border text-center transition-all ${
                    placementType === opt.id
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className="text-[10px] opacity-75">{opt.hint}</span>
                </button>
              ))}
            </div>
            {placementType === 'category_sponsor' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                رعاية القسم تحجز البانر العلوي لقسم واحد بالكامل طوال المدة، ولا يشاركك فيه أي معلن آخر.
                يُنصح بنموذج التسعير الزمني الثابت لهذا النوع.
              </p>
            )}
          </div>

          {/* 3. Pricing Model Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              3. نموذج التسعير والميزانية
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPricingModel('fixed')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  pricingModel === 'fixed'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Clock className="w-4 h-4 mx-auto mb-1" />
                <span className="block text-xs font-bold">زمني ثابت</span>
                <span className="text-[10px] opacity-75">24h - 7 أيام</span>
              </button>

              <button
                type="button"
                onClick={() => setPricingModel('cpc')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  pricingModel === 'cpc'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <MousePointerClick className="w-4 h-4 mx-auto mb-1" />
                <span className="block text-xs font-bold">بالنقرة (CPC)</span>
                <span className="text-[10px] opacity-75">$0.20 / نقرة</span>
              </button>

              <button
                type="button"
                onClick={() => setPricingModel('cpm')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  pricingModel === 'cpm'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-extrabold ring-2 ring-cyan-500/20'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Eye className="w-4 h-4 mx-auto mb-1" />
                <span className="block text-xs font-bold">بالمشاهدات (CPM)</span>
                <span className="text-[10px] opacity-75">$2.50 / 1000</span>
              </button>
            </div>

            {/* Pricing Model Details */}
            {pricingModel === 'fixed' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  اختر مدة العرض المستمرة:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { h: 24, label: '24 ساعة', price: fixedDurationPrices[24] },
                    { h: 48, label: '48 ساعة', price: fixedDurationPrices[48] },
                    { h: 72, label: '3 أيام', price: fixedDurationPrices[72] },
                    { h: 168, label: 'أسبوع كامل', price: fixedDurationPrices[168] }
                  ].map((dur) => (
                    <button
                      key={dur.h}
                      type="button"
                      onClick={() => setDurationHours(dur.h)}
                      className={`p-2 rounded-xl text-center border text-xs font-bold transition-all ${
                        durationHours === dur.h
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{dur.label}</span>
                      <span className="block text-[10px] text-cyan-200 font-normal">
                        ${dur.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(pricingModel === 'cpc' || pricingModel === 'cpm') && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  الميزانية الإجمالية المخصصة للحملة:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500 font-bold"
                  />
                  <span className="text-xs text-slate-500 shrink-0">USD</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Target Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              4. تصنيف الجمهور المستهدف
            </label>
            <select
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-hidden focus:border-cyan-500"
            >
              <option value="all">جميع التصنيفات والمقالات (أعلى وصول)</option>
              <option value="literature">الأدب والشعر</option>
              <option value="technology">التقنية والذكاء الاصطناعي</option>
              <option value="philosophy">الفلسفة والفكر</option>
              <option value="history">التاريخ والحضارات</option>
              <option value="business">ريادة الأعمال والمال</option>
              <option value="science">العلوم والفضاء</option>
            </select>
          </div>

          {/* Footer Submit Bar */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-500 block">التكلفة التقديرية:</span>
              <span className="text-base font-black text-cyan-600 dark:text-cyan-400">
                ${estimatedCost.toFixed(2)}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-extrabold shadow-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>جاري الحفظ...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>إطلاق الحملة الآن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
