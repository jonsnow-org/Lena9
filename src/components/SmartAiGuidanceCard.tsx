import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ChevronDown, ChevronUp, Lightbulb, ShieldCheck, AlertCircle } from 'lucide-react';
import { REVENUE_SHARES } from '../constants/revenueShares';

interface SmartAiGuidanceCardProps {
  context: 'campaign_creation' | 'article_editor' | 'wallet_payout' | 'anti_fraud_soc';
  title?: string;
  onApplySuggestion?: (field: string, value: any) => void;
}

export const SmartAiGuidanceCard: React.FC<SmartAiGuidanceCardProps> = ({
  context,
  title,
  onApplySuggestion
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const getGuidanceContent = () => {
    switch (context) {
      case 'campaign_creation':
        return {
          title: title || 'نصائح الذكاء الاصطناعي لاختيار نموذج التسعير الأمثل',
          badge: 'دليل المعلن الذكي',
          tips: [
            {
              heading: 'متى تختار الإعلان الثابت (Fixed Duration)؟',
              desc: 'مثالي للرعايات الكبرى وإعلانات إطلاق المنتجات. يظهر في الواجهة الرئيسية واستكشاف المقالات بدون تذبذب في التكلفة.'
            },
            {
              heading: 'متى تختار نموذج المشاهدات (CPM)؟',
              desc: 'أفضل لتعزيز الوعي بالعلامة التجارية داخل مقالات الكُتّاب. نظامنا يضمن عدم احتساب المشاهدة إلا بعد بقاء 50% من الإعلان في الشاشة لثانية متواصلة.'
            },
            {
              heading: 'متى تختار نموذج النقرات (CPC)؟',
              desc: 'الأعلى كفاءة لتحقيق المبيعات والتسجيلات. محمي بأقوى درع لمنع النقر الذاتي والنقرات المتطابقة والمتسارعة.'
            }
          ]
        };

      case 'article_editor':
        return {
          title: title || 'مساعد الكاتب الذكي: معايير القراءة وتحقيق الدخل',
          badge: 'استوديو الكاتب',
          tips: [
            {
              heading: 'طول المقال المثالي ومشاركة الأرباح',
              desc: `المقالات التي تتجاوز 700 كلمة تحقق نسبة بقاء أعلى من القارئ، مما يضاعف مرات ظهور إعلانات AdSense الصالحة بنسبة ${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}%.`
            },
            {
              heading: 'تسعير المقال المقفول (الحصري)',
              desc: `الأسعار بين $1.50 و $3.50 تحقق أعلى معدل شراء وتكسب ${REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% من صافي المبيعات.`
            },
            {
              heading: 'العناوين والكلمات المفتاحية',
              desc: 'استخدم عناوين فضولية رصينة لتتصدر قائمة الرواج (Trending) وتزيد عدد المتابعين.'
            }
          ]
        };

      case 'wallet_payout':
        return {
          title: title || 'إرشادات السحب المالي الآمن والتوثيق',
          badge: 'المرشد المالي',
          tips: [
            {
              heading: 'سرعة التحويل عبر USDT TRC20',
              desc: 'التحويل الرقمي يتم خلال ساعات قليلة برسوم شبكة منخفضة جداً.'
            },
            {
              heading: 'توثيق الهوية (KYC)',
              desc: 'يضمن فك حظر السحوبات الكبرى وحماية حسابك من أي اختراق.'
            }
          ]
        };

      case 'anti_fraud_soc':
        return {
          title: title || 'خوارزميات مكافحة الاحتيال والحوكمة',
          badge: 'درع الأمان المركزي',
          tips: [
            {
              heading: 'منع النقر الذاتي (Self-Click)',
              desc: 'يتم حجب أي نقرة أو مشاهدة متكررة يجريها الكاتب على مقالاته تلقائياً لضمان ثقة المعلنين.'
            },
            {
              heading: 'النقرات المتسرعة (Rapid Clicks)',
              desc: 'أي نقرة خلال أول ثانيتين من تحميل الصفحة تصنف كنقرة غير مقصودة أو محاولة بوت ولا يتم خصمها.'
            }
          ]
        };
    }
  };

  const content = getGuidanceContent();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-950/40 via-slate-900 to-brand-950/40 border border-brand-500/25 p-4 shadow-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white">{content.title}</h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600/30 text-brand-300 border border-brand-500/30">
                {content.badge}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-brand-900/30 transition-all"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3.5 pt-3 border-t border-brand-500/15 space-y-2.5 animate-fadeIn">
          {content.tips.map((tip, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-brand-500/15 text-xs">
              <div className="font-bold text-brand-300 flex items-center gap-1.5 mb-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                {tip.heading}
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">{tip.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
