import React, { useEffect, useRef, useState } from 'react';
import { Youtube, Send, Instagram, Twitter, Facebook, ExternalLink, ShieldCheck, Loader2, AlertCircle, Gift, Lock } from 'lucide-react';
import { AdCampaign, PromotionKind } from '../types';
import { mountTelegramLoginWidget, TelegramWidgetUser } from '../utils/telegramWidgetAuth';
import { requestYoutubeReadonlyToken, isGoogleOAuthConfigured } from '../utils/googleIdentity';
import { verifyTelegramJoin, verifyYoutubeSubscription, fetchSocialVerifyStatus } from '../services/socialVerifyApi';
import { SOCIAL_VERIFIED_ACTION_REWARD_USD } from '../constants/socialPromoRewards';
import { auth } from '../firebase';

const PLATFORM_META: Record<Exclude<PromotionKind, 'website'>, { label: string; platformName: string; icon: React.FC<any>; color: string }> = {
  youtube: { label: 'اشترك في القناة', platformName: 'يوتيوب', icon: Youtube, color: 'bg-red-600 hover:bg-red-700' },
  telegram: { label: 'انضم إلى القناة', platformName: 'تيليجرام', icon: Send, color: 'bg-sky-500 hover:bg-sky-600' },
  instagram: { label: 'تابعنا على انستغرام', platformName: 'انستغرام', icon: Instagram, color: 'bg-fuchsia-600 hover:bg-fuchsia-700' },
  twitter: { label: 'تابعنا على X', platformName: 'X (تويتر)', icon: Twitter, color: 'bg-slate-800 hover:bg-slate-900' },
  facebook: { label: 'تابع الصفحة', platformName: 'فيسبوك', icon: Facebook, color: 'bg-blue-600 hover:bg-blue-700' }
};

interface SocialPromoCtaProps {
  campaign: AdCampaign;
  onClickThrough: () => void;
}

/**
 * زر الترويج الاجتماعي: يسجّل النقرة دائماً وبصدق (لكل المنصات)، ويضيف
 * فوق ذلك مسار تحقق حقيقي (وليس مجرد نقرة) لتيليجرام ويوتيوب فقط —
 * المنصتان الوحيدتان اللتان تسمحان تقنياً بذلك مجاناً لتطبيق صغير.
 * انستغرام/X/فيسبوك تبقى "نقرة موثقة" فقط، ومُعلَن عن ذلك بوضوح
 * للقارئ والمعلن معاً دون أي ادّعاء تحقق وهمي.
 */
export const SocialPromoCta: React.FC<SocialPromoCtaProps> = ({ campaign, onClickThrough }) => {
  const kind = campaign.promotionKind;
  if (!kind || kind === 'website') return null;

  const meta = PLATFORM_META[kind];
  const Icon = meta.icon;
  const canVerify = kind === 'telegram' || kind === 'youtube';

  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'verified' | 'error'>('idle');
  const [wasRewarded, setWasRewarded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [serverSupport, setServerSupport] = useState({ telegram: false, youtube: false });
  const telegramContainerRef = useRef<HTMLDivElement | null>(null);
  const [showTelegramWidget, setShowTelegramWidget] = useState(false);

  useEffect(() => {
    if (!canVerify) return;
    fetchSocialVerifyStatus().then(setServerSupport);
  }, [canVerify]);

  useEffect(() => {
    if (kind !== 'telegram' || !showTelegramWidget || !telegramContainerRef.current) return;
    const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
    if (!botUsername) return;

    const handleAuth = async (user: TelegramWidgetUser) => {
      setVerifyStatus('checking');
      setErrorMsg('');
      try {
        const { verified, rewarded } = await verifyTelegramJoin(campaign.id, user);
        setVerifyStatus(verified ? 'verified' : 'error');
        setWasRewarded(rewarded);
        if (!verified) setErrorMsg('لم نجد اشتراكك في القناة بعد. انضم أولاً ثم أعد المحاولة.');
      } catch (err: any) {
        setVerifyStatus('error');
        setErrorMsg(err?.message || 'تعذر التحقق من الانضمام.');
      }
    };

    const cleanup = mountTelegramLoginWidget(telegramContainerRef.current, botUsername, handleAuth);
    return cleanup;
  }, [kind, showTelegramWidget, campaign.id]);

  const handleYoutubeVerify = async () => {
    setVerifyStatus('checking');
    setErrorMsg('');
    try {
      const token = await requestYoutubeReadonlyToken();
      const { verified, rewarded } = await verifyYoutubeSubscription(campaign.id, token);
      setVerifyStatus(verified ? 'verified' : 'error');
      setWasRewarded(rewarded);
      if (!verified) setErrorMsg('لم نجد اشتراكك في القناة بعد. اشترك أولاً ثم أعد المحاولة.');
    } catch (err: any) {
      setVerifyStatus('error');
      setErrorMsg(err?.message || 'تعذر التحقق من الاشتراك.');
    }
  };

  const verifyAvailable =
    (kind === 'telegram' && serverSupport.telegram && Boolean(import.meta.env.VITE_TELEGRAM_BOT_USERNAME)) ||
    (kind === 'youtube' && serverSupport.youtube && isGoogleOAuthConfigured());

  // مكافأة التحقق مقصورة على الأعضاء المسجَّلين حقيقياً — جلسة الزائر
  // (Anonymous Auth) لا تصلح لها إطلاقاً (نفس القيد مفروض من الخادم أيضاً
  // في recordVerificationAndReward، هذا فقط لتوضيح السبب للزائر مسبقاً
  // بدل تركه يجرّب فيفشل الطلب بلا تفسير).
  const isGuestSession = Boolean(auth.currentUser?.isAnonymous);

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickThrough();
        }}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-extrabold transition-colors ${meta.color}`}
      >
        <Icon className="w-4 h-4" />
        <span>{meta.label}</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </button>

      {canVerify && isGuestSession && verifyStatus !== 'verified' && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1">
          <Lock className="w-3 h-3" />
          <span>سجّل حساباً (وليس زائراً) لتربح ${SOCIAL_VERIFIED_ACTION_REWARD_USD.toFixed(2)} عند التحقق الحقيقي</span>
        </div>
      )}

      {canVerify && !isGuestSession && verifyAvailable && verifyStatus !== 'verified' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <Gift className="w-3 h-3" />
            <span>اربح ${SOCIAL_VERIFIED_ACTION_REWARD_USD.toFixed(2)} عند التحقق من انضمامك الحقيقي</span>
          </div>
          {kind === 'youtube' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleYoutubeVerify();
              }}
              disabled={verifyStatus === 'checking'}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-60"
            >
              {verifyStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>تحقق من اشتراكي (حقيقي)</span>
            </button>
          ) : !showTelegramWidget ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTelegramWidget(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>تحقق من انضمامي (حقيقي)</span>
            </button>
          ) : (
            <div className="flex items-center justify-center" ref={telegramContainerRef} />
          )}

          {errorMsg && (
            <div className="flex items-start gap-1.5 text-[10px] text-rose-500 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {canVerify && verifyStatus === 'verified' && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            تم التحقق من انضمامك فعلياً ✓
            {wasRewarded && ` — أُضيف ${SOCIAL_VERIFIED_ACTION_REWARD_USD.toFixed(2)}$ لأرباحك المعلّقة`}
          </span>
        </div>
      )}

      {!canVerify && (
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          نتتبّع نقر الزر فقط — {meta.platformName} لا تتيح تقنياً التحقق من المتابعة الفعلية لتطبيق خارجي صغير.
        </p>
      )}
    </div>
  );
};
