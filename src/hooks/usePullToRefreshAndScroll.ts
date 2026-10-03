import React, { useEffect, useRef } from 'react';
import { fetchArticlesOnce, fetchTweetsOnce, updateCampaignStatsInFirestore } from '../services/firestoreService';
import { Article, Tweet, AdCampaign, User } from '../types';

export function usePullToRefreshAndScroll(params: {
  setShowScrollTop: React.Dispatch<React.SetStateAction<boolean>>;
  touchStartPosRef: React.MutableRefObject<number>;
  setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  setTweets: React.Dispatch<React.SetStateAction<Tweet[]>>;
  setFeedSeed: React.Dispatch<React.SetStateAction<number>>;
  currentUser: User;
  campaigns: AdCampaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<AdCampaign[]>>;
}) {
  const {
    setShowScrollTop,
    touchStartPosRef,
    setIsRefreshing,
    setArticles,
    setTweets,
    setFeedSeed,
    currentUser,
    campaigns,
    setCampaigns
  } = params;

  // Listen to scroll position for Scroll-to-Top floating button
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          setShowScrollTop(scrollY > 350);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // السحب للتحديث بأسلوب أندرويد الأصلي (SwipeRefreshLayout): دائرة تنزل من
  // أعلى وتدور مع الإصبع. تُحرَّك مباشرة عبر ref في كل إطار — كانت حالة React
  // (pullDistance) تعيد رسم التطبيق كاملاً في كل إطار سحب، ومؤشر نصي يُدرَج داخل
  // الصفحة فيدفع المحتوى لأسفل، وهذان سبب ثقل السحب.
  const PULL_THRESHOLD = 70;
  const pullIndicatorRef = useRef<HTMLDivElement>(null);
  const pullRafRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const renderPullIndicator = (distance: number, animate: boolean) => {
    const el = pullIndicatorRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 220ms ease-out, opacity 220ms ease-out' : 'none';
    el.style.transform = `translate3d(0, ${distance - 56}px, 0) rotate(${distance * 3}deg)`;
    el.style.opacity = String(Math.min(1, distance / 40));
    el.dataset.armed = distance >= PULL_THRESHOLD ? '1' : '0';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    touchStartPosRef.current = scrollY <= 1 && !isRefreshingRef.current ? e.touches[0].clientY : 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current <= 0) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (scrollY > 1) return;
    const diff = e.touches[0].clientY - touchStartPosRef.current;
    if (diff < -5) {
      touchStartPosRef.current = 0;
      pullDistanceRef.current = 0;
      renderPullIndicator(0, true);
      return;
    }
    if (diff <= 0) return;
    pullDistanceRef.current = Math.min(diff * 0.5, 110);
    if (pullRafRef.current === null) {
      pullRafRef.current = requestAnimationFrame(() => {
        pullRafRef.current = null;
        if (touchStartPosRef.current > 0) renderPullIndicator(pullDistanceRef.current, false);
      });
    }
  };

  const handleTouchEnd = () => {
    if (pullRafRef.current !== null) {
      cancelAnimationFrame(pullRafRef.current);
      pullRafRef.current = null;
    }
    const pulled = pullDistanceRef.current;
    pullDistanceRef.current = 0;
    touchStartPosRef.current = 0;
    if (pulled >= PULL_THRESHOLD) {
      renderPullIndicator(PULL_THRESHOLD, true);
      handleRefreshFeed();
    } else if (pulled > 0) {
      renderPullIndicator(0, true);
    }
  };

  // كانت هذه الدالة عرضاً بصرياً فقط (مؤشر دوران 750ms ثم يختفي) بلا أي طلب
  // شبكة فعلي — الاشتراك الحي (subscribeToArticles/subscribeToTweets) يُفترض
  // أن يدفع أي محتوى جديد تلقائياً، لكن اتصال onSnapshot قد ينقطع بصمت على
  // الجوال (تبديل شبكة، تعليق تطبيق TWA في الخلفية لفترة طويلة) دون إعادة
  // اتصال فورية، فتبقى البطاقات القديمة ظاهرة مهما ضغط المستخدم "تحديث" لأن
  // لا شيء كان يطلب بيانات جديدة أصلاً. الآن تجلب نسخة طازجة حقيقية دائماً.
  const handleRefreshFeed = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const [freshArticles, freshTweets] = await Promise.all([
        fetchArticlesOnce(),
        fetchTweetsOnce()
      ]);
      if (freshArticles.length > 0) setArticles(freshArticles);
      setTweets(freshTweets);
    } catch (err) {
      // كان هذا الفشل صامتاً تماماً (console.error فقط) — يدوّر مؤشر
      // التحديث ثم يتوقف بلا أي تغيير وبلا أي تفسير، فيبدو للمستخدم أن
      // "زر التحديث لا يفعل شيئاً" رغم وجود سبب حقيقي (غالباً انقطاع شبكة).
      console.error('تعذر تحديث الخلاصة:', err);
      alert('تعذر تحديث المحتوى الآن. تحقق من اتصالك بالإنترنت وحاول مجدداً.');
    } finally {
      setFeedSeed(Date.now());
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      renderPullIndicator(0, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // إنهاء تلقائي للحملات المنتهية زمنياً (endDate) رغم بقاء status='active'.
  // بدون هذا، حملة انتهت مدتها تبقى تُعرض في كل المواضع (AdSlot يفلتر فقط
  // على status==='active') إلى الأبد حتى يلاحظها الأدمن يدوياً. مقصورة على
  // جلسة الأدمن فقط لأن قواعد Firestore لا تسمح لغير الأدمن/صاحب الحملة
  // بتعديل status، وصاحب الحملة نفسه ممنوع صراحة من تعديله (انظر
  // firestore.rules) — فتُترك هذه العملية لأول جلسة أدمن متصلة تلاحظها.
  const expiredCampaignsSweepRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (currentUser.role !== 'admin') return;
    const now = Date.now();
    const expired = campaigns.filter(
      (c) =>
        c.status === 'active' &&
        c.endDate &&
        new Date(c.endDate).getTime() < now &&
        !expiredCampaignsSweepRef.current.has(c.id)
    );
    if (expired.length === 0) return;
    expired.forEach((c) => {
      expiredCampaignsSweepRef.current.add(c.id);
      updateCampaignStatsInFirestore(c.id, { status: 'completed' }).catch((err) =>
        console.error(`تعذر إنهاء الحملة المنتهية ${c.id} تلقائياً:`, err)
      );
    });
    setCampaigns((prev) =>
      prev.map((c) => (expired.some((e) => e.id === c.id) ? { ...c, status: 'completed' } : c))
    );
  }, [campaigns, currentUser.role]);

  return {
    scrollToTop,
    pullIndicatorRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleRefreshFeed
  };
}
