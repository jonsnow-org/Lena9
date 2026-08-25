import React, { useEffect, useRef, useState } from 'react';

const SPLASH_DURATION_MS = 3200;
const STAR_COUNT = 40;

interface Star {
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

// مواقع/أحجام النجوم تُحسب مرة واحدة بس (خارج المكوّن) — لو حُسبت داخله
// بـ Math.random() مباشرة بالـ render، كل إعادة رسم كانت ستنقل كل النجوم
// لمواضع عشوائية جديدة فجأة بدل بقائها ثابتة تتلألأ في مكانها.
const STARS: Star[] = Array.from({ length: STAR_COUNT }, () => ({
  top: Math.random() * 70,
  left: Math.random() * 100,
  size: Math.random() * 2 + 1,
  delay: Math.random() * 3,
  duration: Math.random() * 2 + 2
}));

/**
 * شاشة بدء تشغيل مخصصة (Splash) تظهر عند فتح التطبيق — تحل محل الانتقال
 * الفوري لجملة "منصة ليتيريوم للأدب والفكر" الجامدة. تُعرض فوق التطبيق
 * الفعلي (المُحمَّل بالفعل بالخلفية) وتختفي تلقائياً، أو فور الضغط عليها.
 *
 * الموسيقى الخفيفة مُولَّدة برمجياً عبر Web Audio API (نغمة محيطية ناعمة)
 * بدل ملف صوتي خارجي — لا حاجة لأصل صوتي إضافي، ولا مشكلة ترخيص. المتصفحات
 * تمنع التشغيل التلقائي أحياناً؛ المحاولة هنا "قدر المستطاع" ولا تُعطّل أي
 * شيء لو فشلت (بعض المتصفحات تعتبر فتح تطبيق PWA من الشاشة الرئيسية بمثابة
 * تفاعل مستخدم كافٍ للسماح بالصوت، وبعضها لا يسمح إطلاقاً).
 */
export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const finish = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    audioCtxRef.current?.close().catch(() => {});
    setTimeout(onFinish, 500);
  };

  useEffect(() => {
    const timer = setTimeout(finish, SPLASH_DURATION_MS);

    // نغمة محيطية ناعمة جداً: وتر من ثلاث ترددات هادئة يتلاشى دخولاً
    // وخروجاً (Fade in/out)، بدل نغمة حادة مفاجئة.
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtx();
      audioCtxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const now = ctx.currentTime;
      const fadeIn = 1.2;
      const fadeOut = 1.0;
      const totalSec = SPLASH_DURATION_MS / 1000;
      master.gain.linearRampToValueAtTime(0.05, now + fadeIn);
      master.gain.setValueAtTime(0.05, now + totalSec - fadeOut);
      master.gain.linearRampToValueAtTime(0, now + totalSec);

      [261.63, 329.63, 392.0].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 1 / (i + 1.6);
        osc.connect(voiceGain);
        voiceGain.connect(master);
        osc.start(now);
        osc.stop(now + totalSec + 0.1);
      });

      ctx.resume().catch(() => {});
    } catch {
      // الصوت اختياري بالكامل — أي فشل (منع تلقائي، متصفح غير مدعوم) يُتجاهَل بصمت.
    }

    return () => {
      clearTimeout(timer);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-[#050814] via-[#0b1024] to-[#151233] cursor-pointer transition-opacity duration-500 ${
        isLeaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* حقل النجوم المتلألئة */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animation: `splash-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`
          }}
        />
      ))}

      {/* مدار دوّار حول القمر — يمثّل "الفلك يدور" */}
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-56 h-56 sm:w-72 sm:h-72">
        <div
          className="absolute inset-0 rounded-full border border-teal-300/20"
          style={{ animation: 'splash-orbit-spin 18s linear infinite' }}
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-300/80 shadow-[0_0_8px_2px_rgba(45,212,191,0.6)]" />
        </div>
        <div
          className="absolute inset-4 rounded-full border border-amber-200/15"
          style={{ animation: 'splash-orbit-spin 12s linear infinite reverse' }}
        >
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-200/80 shadow-[0_0_6px_2px_rgba(253,230,138,0.6)]" />
        </div>

        {/* القمر */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: 'splash-moon-float 5s ease-in-out infinite' }}
        >
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400 shadow-[0_0_45px_12px_rgba(226,232,240,0.35)]">
            <span className="absolute top-3 left-4 w-3 h-3 rounded-full bg-slate-400/50" />
            <span className="absolute bottom-4 right-3 w-4 h-4 rounded-full bg-slate-400/40" />
            <span className="absolute top-8 right-5 w-2 h-2 rounded-full bg-slate-400/50" />
          </div>
        </div>
      </div>

      {/* شعار المنصة والجملة التعريفية */}
      <div
        className="absolute inset-x-0 bottom-[16%] flex flex-col items-center gap-2 px-6 text-center"
        style={{ animation: 'splash-fade-up 1.2s ease-out 0.3s both' }}
      >
        <img src="/icon.png" alt="ليتيريوم" className="w-14 h-14 rounded-2xl shadow-lg mb-1" />
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide">LITERIUM</h1>
        <p className="text-teal-200/90 text-sm sm:text-base font-bold">منصة ليتيريوم للأدب والفكر</p>
      </div>

      <style>{`
        @keyframes splash-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes splash-orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes splash-moon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes splash-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
