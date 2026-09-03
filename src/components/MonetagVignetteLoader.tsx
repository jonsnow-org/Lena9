import React, { useEffect, useRef } from 'react';
import { subscribeExternalAdsConfig } from '../utils/externalAdsStore';
import { isRunningInNativeApp } from '../utils/nativeAppEnv';
import { MONETAG_VIGNETTE_ZONE, MONETAG_VIGNETTE_SRC } from '../constants/monetagVignette';

/**
 * يُحمِّل سكربت Monetag "Vignette" مرة واحدة فقط لكل جلسة تصفح، عند تحقق
 * شرطين: مفعَّل من لوحة الإدارة (settings/externalAds.monetag.enabled)،
 * وليس داخل تطبيق APK (isRunningInNativeApp) — هذا النوع من الإعلانات
 * (بيني كامل الشاشة) يحقن نفسه في DOM المتصفح مباشرة عبر سكربت خارجي،
 * فلا معنى ولا إمكانية لتشغيله داخل تطبيق Kotlin/Compose الأصلي إطلاقاً.
 *
 * مُركَّب مرة واحدة في جذر <App> (وليس داخل <AdSlot>): لا يرتبط بموضع محدد
 * في صفحة معيّنة، بل يتحكم بظهوره الشبكة نفسها عبر سكربتها الخاص.
 */
export const MonetagVignetteLoader: React.FC = () => {
  const injectedRef = useRef(false);

  useEffect(() => {
    return subscribeExternalAdsConfig((config) => {
      if (injectedRef.current) return;
      if (isRunningInNativeApp()) return;
      if (!config.monetag.enabled) return;
      injectedRef.current = true;

      const target = [document.documentElement, document.body].filter(Boolean).pop();
      if (!target) return;
      const script = target.appendChild(document.createElement('script'));
      script.dataset.zone = MONETAG_VIGNETTE_ZONE;
      script.src = MONETAG_VIGNETTE_SRC;
    });
  }, []);

  return null;
};
