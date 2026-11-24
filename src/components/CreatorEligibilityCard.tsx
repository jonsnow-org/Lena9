import React from 'react';
import { CheckCircle2, Circle, ShieldCheck, Sparkles, ShieldAlert } from 'lucide-react';
import { CreatorEligibilityStatus, CREATOR_ELIGIBILITY_THRESHOLDS } from '../utils/creatorEligibility';

interface CreatorEligibilityCardProps {
  eligibility: CreatorEligibilityStatus;
  onOpenKyc?: () => void;
}

const Requirement: React.FC<{ met: boolean; label: string; value: string }> = ({ met, label, value }) => (
  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-slate-500 shrink-0" />
      )}
      <span className={`text-xs font-bold ${met ? 'text-emerald-300' : 'text-slate-300'}`}>{label}</span>
    </div>
    <span className="text-[11px] text-slate-400 font-mono">{value}</span>
  </div>
);

/** بطاقة أهلية "منشئ محتوى موثّق": تُستخدم في استوديو الكاتب وأي مكان آخر
 *  يحتاج عرض تقدّم الكاتب نحو استيفاء شروط احتساب الأرباح، بمصدر بيانات
 *  واحد (getCreatorEligibility) لتفادي أي تناقض بين الشاشات. */
export const CreatorEligibilityCard: React.FC<CreatorEligibilityCardProps> = ({ eligibility, onOpenKyc }) => {
  if (eligibility.isEligible) {
    return (
      <div className="p-5 rounded-3xl bg-gradient-to-l from-emerald-950/60 to-slate-900 border border-emerald-500/30 shadow-sm flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h4 className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
            منشئ محتوى موثّق <Sparkles className="w-3.5 h-3.5" />
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5">
            استوفيت كل الشروط وهويتك موثّقة — تُحتسب أرباحك من الإعلانات والمبيعات بشكل طبيعي.
          </p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            نسبتك من إعلانات الشبكات الخارجية (Adsterra وغيرها) تُحتسب فقط من الإعلانات التي تظهر
            داخل مقالاتك وصفحة ملفك الشخصي، بسعر تقديري ثابت لكل 1000 مشاهدة تعتمده إدارة المنصة —
            وليس السعر الحقيقي الذي تدفعه الشبكة نفسها. الإعلانات التي تظهر في الصفحة الرئيسية أو
            قسم التغريد أو الصفحة الأولى قبل تسجيل الدخول أو أي مكان آخر خارج مقالاتك وملفك الشخصي
            لا تُحتسب لك منها أي نسبة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/25 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <h4 className="text-sm font-black text-white">شروط تفعيل احتساب الأرباح</h4>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        يمكنك الكتابة والنشر بحرية الآن، لكن احتساب أرباح الإعلانات والمبيعات لحسابك يبدأ فقط بعد استيفاء كل الشروط التالية معاً — لحماية المنصة والمعلنين من الحسابات الوهمية، تماشياً مع سياسات برامج الإعلانات.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Requirement
          met={eligibility.meetsFollowers}
          label="عدد المتابعين"
          value={`${eligibility.followersCount}/${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_FOLLOWERS}`}
        />
        <Requirement
          met={eligibility.meetsViews}
          label="مشاهدات صالحة"
          value={`${eligibility.validViewsCount}/${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_VALID_VIEWS}`}
        />
        <Requirement
          met={eligibility.meetsAge}
          label="عمر الحساب (أيام)"
          value={`${eligibility.accountAgeDays}/${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_ACCOUNT_AGE_DAYS}`}
        />
        <Requirement
          met={eligibility.meetsArticles}
          label="مقالات منشورة"
          value={`${eligibility.publishedArticlesCount}/${CREATOR_ELIGIBILITY_THRESHOLDS.MIN_PUBLISHED_ARTICLES}`}
        />
      </div>
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800">
        <div className="flex items-center gap-2">
          {eligibility.isKycVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <span className={`text-xs font-bold ${eligibility.isKycVerified ? 'text-emerald-300' : 'text-slate-300'}`}>
            التحقق من الهوية (KYC) — شرط إلزامي أخير
          </span>
        </div>
        {!eligibility.isKycVerified && onOpenKyc && (
          <button
            onClick={onOpenKyc}
            className="text-[11px] font-bold text-amber-300 hover:underline shrink-0"
          >
            تحقق الآن
          </button>
        )}
      </div>
    </div>
  );
};
