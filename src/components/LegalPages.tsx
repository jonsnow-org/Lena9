import React from 'react';
import { Shield, FileText, Info, Mail, ArrowRight } from 'lucide-react';
import { REVENUE_SHARES } from '../constants/revenueShares';
import { MIN_PAYOUT_USD, EARNINGS_HOLD_DAYS } from '../constants/payoutRules';

export type LegalSection = 'privacy' | 'terms' | 'about' | 'contact';

interface LegalPagesProps {
  section: LegalSection;
  onChangeSection: (section: LegalSection) => void;
  onBack: () => void;
}

const CONTACT_EMAIL = 'brnardtsho@gmail.com';
const LAST_UPDATED = '21 أغسطس 2026';
const MIN_PAYOUT = MIN_PAYOUT_USD;
const HOLD_DAYS = EARNINGS_HOLD_DAYS;

const SECTIONS: { id: LegalSection; label: string; icon: React.ReactNode }[] = [
  { id: 'privacy', label: 'سياسة الخصوصية', icon: <Shield className="w-4 h-4" /> },
  { id: 'terms', label: 'شروط الاستخدام', icon: <FileText className="w-4 h-4" /> },
  { id: 'about', label: 'من نحن', icon: <Info className="w-4 h-4" /> },
  { id: 'contact', label: 'اتصل بنا', icon: <Mail className="w-4 h-4" /> }
];

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-7 mb-2.5">
    {children}
  </h2>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-slate-600 dark:text-slate-300 leading-[1.9] mb-3">{children}</p>
);

const UL: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="space-y-1.5 mb-3 pe-4">
    {items.map((item, i) => (
      <li key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-[1.9] list-disc">
        {item}
      </li>
    ))}
  </ul>
);

export const LegalPages: React.FC<LegalPagesProps> = ({ section, onChangeSection, onBack }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-brand-600 mb-5"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى المنصة</span>
        </button>

        {/* تنقل بين الصفحات */}
        <div className="flex overflow-x-auto gap-2 scrollbar-none pb-3 mb-5 border-b border-slate-200 dark:border-slate-800">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onChangeSection(s.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                section === s.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <article className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8">
          {section === 'privacy' && (
            <>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                سياسة الخصوصية
              </h1>
              <p className="text-xs text-slate-400 mt-1">آخر تحديث: {LAST_UPDATED}</p>

              <H2>مقدمة</H2>
              <P>
                نحن في منصة ليتيريوم نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه
                السياسة كيف نجمع معلوماتك ونستخدمها ونحميها عند استخدامك للمنصة. باستخدامك
                للمنصة، فإنك توافق على الممارسات الموضحة هنا.
              </P>

              <H2>المعلومات التي نجمعها</H2>
              <P>معلومات تقدمها أنت مباشرة:</P>
              <UL
                items={[
                  'البريد الإلكتروني واسم المستخدم عند إنشاء الحساب',
                  'الاسم المعروض والصورة الشخصية والنبذة التعريفية',
                  'المحتوى الذي تنشره من مقالات وتعليقات',
                  'بيانات الحملات الإعلانية إن كنت معلناً'
                ]}
              />
              <P>معلومات تُجمع تلقائياً:</P>
              <UL
                items={[
                  'عنوان IP ونوع المتصفح ونظام التشغيل',
                  'الصفحات التي تزورها ومدة بقائك فيها',
                  'بيانات التفاعل مع الإعلانات (الظهور والنقرات)'
                ]}
              />

              <H2>كيف نستخدم معلوماتك</H2>
              <UL
                items={[
                  'تشغيل حسابك وتقديم خدمات المنصة',
                  'عرض المحتوى والإعلانات المناسبة لك',
                  'حساب أرباح الكتّاب وإحصاءات الحملات الإعلانية',
                  'كشف ومنع الاحتيال وإساءة الاستخدام',
                  'تحسين المنصة وتطوير خدماتها',
                  'التواصل معك بخصوص حسابك أو تحديثات الخدمة'
                ]}
              />

              <H2>ملفات تعريف الارتباط (Cookies)</H2>
              <P>
                نستخدم ملفات تعريف الارتباط للحفاظ على جلسة تسجيل دخولك، وتذكّر تفضيلاتك،
                وقياس أداء المنصة، وعرض الإعلانات. يمكنك تعطيلها من إعدادات متصفحك، لكن بعض
                ميزات المنصة قد لا تعمل بشكل صحيح عندئذ.
              </P>

              <H2>الإعلانات وخدمات الطرف الثالث</H2>
              <P>
                تعتمد المنصة على شبكات إعلانية تابعة لجوجل (Google AdSense وخدمات مشابهة). قد
                تستخدم جوجل والشركاء الإعلانيون ملفات تعريف ارتباط ومعرّفات مشابهة لعرض إعلانات
                مبنية على زياراتك لهذا الموقع أو مواقع أخرى. بإمكانك مراجعة أو إلغاء الاشتراك في
                الإعلانات المخصصة من{' '}
                <a
                  href="https://adssettings.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  إعدادات إعلانات جوجل
                </a>
                ، وقراءة تفاصيل استخدام جوجل لهذه البيانات عبر{' '}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  صفحة جوجل الرسمية لهذا الغرض
                </a>
                .
              </P>
              <P>
                نستخدم كذلك خدمات Firebase من جوجل للمصادقة وتخزين البيانات، وخدمة reCAPTCHA
                لحماية المنصة من الاستخدام الآلي المسيء. يخضع استخدامها لسياسة خصوصية جوجل
                وشروط خدمتها.
              </P>

              <H2>مشاركة البيانات</H2>
              <P>لا نبيع بياناتك الشخصية لأي جهة. قد نشارك بعض البيانات في الحالات التالية فقط:</P>
              <UL
                items={[
                  'مع مزودي الخدمات التقنية الذين نعتمد عليهم لتشغيل المنصة',
                  'عند الضرورة القانونية أو استجابة لطلب رسمي من جهة مختصة',
                  'لحماية حقوق المنصة أو مستخدميها أو منع نشاط احتيالي'
                ]}
              />

              <H2>أمان البيانات</H2>
              <P>
                نتخذ إجراءات تقنية وتنظيمية معقولة لحماية بياناتك، بما في ذلك التشفير أثناء
                النقل وقواعد صلاحيات صارمة للوصول إلى قاعدة البيانات. مع ذلك، لا توجد وسيلة
                نقل أو تخزين إلكتروني آمنة بشكل مطلق، ولا يمكننا ضمان الأمان التام.
              </P>

              <H2>حقوقك</H2>
              <UL
                items={[
                  'الوصول إلى بياناتك الشخصية المحفوظة لدينا',
                  'تصحيح أي بيانات غير دقيقة',
                  'طلب حذف حسابك وبياناتك',
                  'الاعتراض على معالجة بياناتك لأغراض معينة',
                  'سحب موافقتك في أي وقت'
                ]}
              />
              <P>
                لممارسة أي من هذه الحقوق، تواصل معنا على:{' '}
                <span className="font-bold text-brand-600 dark:text-brand-400">{CONTACT_EMAIL}</span>
              </P>

              <H2>خصوصية الأطفال</H2>
              <P>
                المنصة غير موجهة لمن هم دون سن السادسة عشرة. لا نجمع عن قصد بيانات من الأطفال
                دون هذه السن. إذا علمنا بذلك، سنحذف البيانات فوراً.
              </P>

              <H2>التعديلات على هذه السياسة</H2>
              <P>
                قد نحدّث هذه السياسة من وقت لآخر. سننشر أي تعديل على هذه الصفحة مع تحديث تاريخ
                آخر تحديث في الأعلى.
              </P>
            </>
          )}

          {section === 'terms' && (
            <>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                شروط الاستخدام
              </h1>
              <p className="text-xs text-slate-400 mt-1">آخر تحديث: {LAST_UPDATED}</p>

              <H2>قبول الشروط</H2>
              <P>
                باستخدامك منصة ليتيريوم، فإنك توافق على الالتزام بهذه الشروط. إن لم توافق
                عليها، يرجى عدم استخدام المنصة.
              </P>

              <H2>الحسابات</H2>
              <UL
                items={[
                  'يجب أن تكون المعلومات التي تقدمها عند التسجيل صحيحة ودقيقة',
                  'أنت مسؤول عن الحفاظ على سرية بيانات دخولك وعن كل نشاط يتم من حسابك',
                  'يُمنع إنشاء حسابات متعددة بغرض التلاعب بالإحصاءات أو الأرباح',
                  'يحق للمنصة تعليق أو إغلاق أي حساب يخالف هذه الشروط'
                ]}
              />

              <H2>المحتوى والملكية الفكرية</H2>
              <P>
                تحتفظ بملكية المحتوى الذي تنشره. وبنشرك إياه تمنح المنصة ترخيصاً غير حصري
                لعرضه وتوزيعه والترويج له داخل المنصة. وتقرّ بأن المحتوى من إنتاجك أو تملك حقوق
                نشره، وأنه لا ينتهك حقوق أي طرف ثالث.
              </P>
              <P>يُمنع نشر أي محتوى:</P>
              <UL
                items={[
                  'ينتهك حقوق الملكية الفكرية للآخرين',
                  'يحرّض على الكراهية أو العنف أو التمييز',
                  'يحتوي على تشهير أو إساءة شخصية',
                  'ينتهك القوانين المعمول بها',
                  'يتضمن برمجيات ضارة أو محاولات اختراق',
                  'مولّد آلياً بالكامل دون قيمة أو مراجعة بشرية'
                ]}
              />
              <P>يحق للمنصة إزالة أي محتوى مخالف دون إشعار مسبق.</P>

              <H2>حقوق النشر والعلامة التجارية للمنصة</H2>
              <P>
                اسم "ليتيريوم" وشعارها وهويتها البصرية وتصميم الواجهة والكود البرمجي الذي
                يشغّلها هي ملكية حصرية لمنصة ليتيريوم ومحمية بموجب قوانين حقوق النشر والعلامات
                التجارية المعمول بها. يُمنع نسخ تصميم المنصة أو هيكلها البرمجي أو محتواها بشكل
                جماعي (Scraping) أو إعادة نشره أو إنشاء نسخة مطابقة أو مشابهة له لأغراض تجارية
                أو غير تجارية دون إذن كتابي صريح من إدارة المنصة.
              </P>
              <P>
                هذا لا يشمل مقالات وتغريدات الكتّاب الفرديين أنفسهم، التي تبقى ملكاً لهم كما هو
                موضح أعلاه — المقصود هو تصميم وبنية وعلامة المنصة ذاتها. أي انتهاك مشتبه به
                يُرجى الإبلاغ عنه عبر صفحة "اتصل بنا".
              </P>

              <H2>الأرباح والمدفوعات</H2>
              <P>
                يكسب الكاتب حصة من عائدات الإعلانات التي تظهر في صفحته الشخصية وداخل مقالاته،
                ومن مبيعات مقالاته الحصرية، وفق النسب التالية:
              </P>
              <UL
                items={[
                  `إعلانات داخل المقالات: الكاتب ${REVENUE_SHARES.IN_ARTICLE_ADS.WRITER_PERCENT}% والمنصة ${REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM_PERCENT}%`,
                  `إعلانات صفحة الكاتب الشخصية: الكاتب ${REVENUE_SHARES.WRITER_PROFILE_ADS.WRITER_PERCENT}% والمنصة ${REVENUE_SHARES.WRITER_PROFILE_ADS.PLATFORM_PERCENT}%`,
                  `المقالات الحصرية المدفوعة: الكاتب ${REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT}% والمنصة ${REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM_PERCENT}%`,
                  'إعلانات الصفحة الرئيسية وصفحات التصنيفات: المنصة 100%'
                ]}
              />
              <P>
                <strong className="text-slate-900 dark:text-white">فترة التجميد:</strong> تبقى
                الأرباح في حالة معلّقة لمدة {HOLD_DAYS} يوماً من تاريخ تسجيلها قبل أن تصبح
                قابلة للسحب، وذلك للتحقق من صحتها.
              </P>
              <P>
                <strong className="text-slate-900 dark:text-white">الحد الأدنى للسحب:</strong>{' '}
                {MIN_PAYOUT} دولاراً أمريكياً.
              </P>
              <P>
                <strong className="text-slate-900 dark:text-white">
                  النقرات والمشاهدات الصالحة:
                </strong>{' '}
                تُحتسب الأرباح على أساس التفاعلات الصالحة فقط بعد تصفية الاحتيال. لا تُحتسب
                النقرات أو المشاهدات المرفوضة.
              </P>
              <P>
                <strong className="text-slate-900 dark:text-white">حق الإلغاء:</strong> تحتفظ
                المنصة بحق إلغاء أي أرباح يثبت أنها ناتجة عن نشاط احتيالي أو مخالف، حتى بعد
                إضافتها إلى الرصيد، وقبل صرفها.
              </P>
              <P>سلوك محظور صراحةً:</P>
              <UL
                items={[
                  'النقر على الإعلانات في صفحتك أو مقالاتك بنفسك',
                  'الطلب من الآخرين النقر على إعلاناتك',
                  'استخدام برامج آلية أو خدمات مدفوعة لزيادة الزيارات أو النقرات',
                  'أي محاولة للتلاعب بأنظمة القياس'
                ]}
              />
              <P>
                مخالفة أي مما سبق تؤدي إلى إلغاء الأرباح وإغلاق الحساب نهائياً.
              </P>

              <H2>المعلنون</H2>
              <UL
                items={[
                  'كل حملة إعلانية تخضع لمراجعة واعتماد إدارة المنصة قبل نشرها',
                  'يحق للمنصة رفض أي إعلان دون إبداء أسباب',
                  'المبالغ المودعة في محفظة الإعلانات تُستخدم للحملات فقط',
                  'المعلن مسؤول عن قانونية وصحة ما يعلن عنه',
                  'لا يُخصم من المعلن مقابل تفاعلات مرفوضة كاحتيال'
                ]}
              />

              <H2>إخلاء المسؤولية</H2>
              <P>
                تُقدَّم المنصة كما هي دون ضمانات من أي نوع. لا نضمن استمرارية الخدمة دون انقطاع
                أو خلوها من الأخطاء. المنصة ليست مسؤولة عن آراء أو محتوى المستخدمين، ولا عن أي
                أضرار غير مباشرة ناتجة عن استخدام المنصة.
              </P>

              <H2>القانون المطبق</H2>
              <P>
                تخضع هذه الشروط لقوانين الجمهورية التركية، وأي نزاع ينشأ عنها يخضع لاختصاص
                محاكمها.
              </P>

              <H2>التواصل</H2>
              <P>
                <span className="font-bold text-brand-600 dark:text-brand-400">{CONTACT_EMAIL}</span>
              </P>
            </>
          )}

          {section === 'about' && (
            <>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                من نحن
              </h1>

              <P>
                <strong className="text-slate-900 dark:text-white">ليتيريوم</strong> منصة عربية
                للأدب والمعرفة، تجمع بين القرّاء والكتّاب في مساحة واحدة تحتفي بالكلمة المكتوبة.
              </P>

              <H2>رؤيتنا</H2>
              <P>
                أن نكون البيت الرقمي للمحتوى الأدبي والثقافي العربي الأصيل، حيث يجد القارئ ما
                يستحق وقته، ويجد الكاتب ما يستحق جهده.
              </P>

              <H2>ما نقدمه</H2>
              <P>
                <strong className="text-slate-900 dark:text-white">للقرّاء:</strong> مكتبة
                متنامية من المقالات والدراسات في الأدب والفلسفة والفكر والتكنولوجيا، بتجربة
                قراءة نقية ومريحة.
              </P>
              <P>
                <strong className="text-slate-900 dark:text-white">للكتّاب:</strong> منصة نشر
                احترافية تتيح الوصول إلى جمهور مهتم، مع نظام عادل لتحقيق دخل من المحتوى عبر
                الإعلانات والمقالات الحصرية.
              </P>
              <P>
                <strong className="text-slate-900 dark:text-white">للمعلنين:</strong> وصول دقيق
                إلى جمهور عربي مثقف ومتفاعل، بأدوات استهداف مرنة وحماية من الاحتيال.
              </P>

              <H2>التزامنا</H2>
              <P>
                نلتزم بجودة المحتوى، وشفافية توزيع الأرباح، واحترام خصوصية مستخدمينا.
              </P>
            </>
          )}

          {section === 'contact' && (
            <>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                اتصل بنا
              </h1>
              <P>يسعدنا تواصلك معنا.</P>

              <div className="space-y-3 mt-5">
                {[
                  { label: 'للاستفسارات العامة', email: CONTACT_EMAIL },
                  { label: 'للكتّاب', email: CONTACT_EMAIL },
                  { label: 'للمعلنين', email: CONTACT_EMAIL },
                  { label: 'للإبلاغ عن مخالفة أو انتهاك حقوق ملكية فكرية', email: CONTACT_EMAIL }
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {item.label}
                    </div>
                    <a
                      href={`mailto:${item.email}`}
                      className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {item.email}
                    </a>
                  </div>
                ))}
              </div>

              <P>
                <span className="block mt-5">
                  نسعى للرد على جميع الرسائل خلال 48 ساعة عمل.
                </span>
              </P>
            </>
          )}
        </article>
      </div>
    </div>
  );
};
