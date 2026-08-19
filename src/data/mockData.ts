import { Article, User, AdCampaign, Comment, AppNotification, Conversation, DirectMessage, Transaction, Book, FraudFlag } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'user_writer_1',
    email: 'naguib.writer@literium.com',
    phone: '+966501234567',
    fullName: 'د. طارق المنصور',
    username: 'tariq_almansoor',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&auto=format&fit=crop&q=80',
    role: 'writer',
    bio: 'كاتب وباحث في الأدب المقارن والفلسفة المعاصرة. مؤلف كتاب "أطياف الحداثة" ورئيس تحرير سابق لمجلة الرواق الثقافي.',
    isVerified: true,
    isKycVerified: true,
    kycDetails: {
      idType: 'جواز سفر رسمي',
      idNumber: 'SA98214981',
      selfieUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      status: 'verified',
      submittedAt: '2025-01-15'
    },
    socialLinks: {
      website: 'https://almansoor-literary.org',
      twitter: 'https://x.com/tariq_writings',
      linkedin: 'https://linkedin.com/in/tariq-almansoor',
      instagram: 'https://instagram.com/tariq_words'
    },
    specialties: ['الأدب والشعر', 'الفلسفة والفكر', 'النقد المعاصر'],
    badges: [
      { id: 'b1', name: 'كاتب موثق', icon: 'CheckCircle2', color: 'emerald', description: 'تم التحقق من الهوية والأوراق الرسمية' },
      { id: 'b2', name: 'قلم ماسي', icon: 'Award', color: 'purple', description: 'تجاوز 100,000 قراءة لمقالاته' },
      { id: 'b3', name: 'المؤلف الأكثر تفاعلاً', icon: 'Sparkles', color: 'amber', description: 'معدل ردود على القراء يفوق 95%' }
    ],
    rating: 4.96,
    followersCount: 14280,
    followingCount: 184,
    articlesCount: 26,
    totalViews: 248900,
    totalEarnings: 3420.50,
    monthlyEarnings: 685.20,
    joinedDate: 'يناير 2024',
    twoFactorEnabled: true,
    notificationsEnabled: true,
    aiQuota: {
      freeDailyLimit: 5,
      usedToday: 1,
      lastResetTime: new Date().toISOString(),
      isSubscriber: false,
      plan: 'none'
    }
  },
  {
    id: 'user_writer_2',
    email: 'layla.philosophy@literium.com',
    phone: '+971501122334',
    fullName: 'أ. د. ليلى الشامسي',
    username: 'layla_alshamsi',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&auto=format&fit=crop&q=80',
    role: 'writer',
    bio: 'أستاذة الفلسفة والجماليات ومؤلفة "العقل والدهشة". مهتمة بدراسات الوعي الإنساني ومستقبل الثقافة الرقمية.',
    isVerified: true,
    isKycVerified: true,
    specialties: ['الفلسفة والفكر', 'علم الاجتماع', 'دراسات الوعي'],
    badges: [
      { id: 'bw2', name: 'وسام التميز الفكري', icon: 'Crown', color: 'amber', description: 'أعلى نسبة قراءة متعمقة' }
    ],
    rating: 4.94,
    followersCount: 18950,
    followingCount: 92,
    articlesCount: 19,
    totalViews: 312000,
    totalEarnings: 4210.00,
    monthlyEarnings: 890.50,
    joinedDate: 'فبراير 2024',
    twoFactorEnabled: true,
    notificationsEnabled: true,
    aiQuota: {
      freeDailyLimit: 5,
      usedToday: 0,
      lastResetTime: new Date().toISOString(),
      isSubscriber: true,
      plan: 'annual'
    }
  },
  {
    id: 'user_writer_3',
    email: 'khalid.history@literium.com',
    phone: '+962791234567',
    fullName: 'م. مروان الأندلسي',
    username: 'marwan_andalus',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&auto=format&fit=crop&q=80',
    role: 'writer',
    bio: 'مؤرخ ومحقق مخطوطات قديمة. باحث في تاريخ الحضارة الأندلسية وحركات الترجمة والتنوير الفكري.',
    isVerified: true,
    isKycVerified: true,
    specialties: ['التاريخ والحضارات', 'المخطوطات', 'الأدب الأندلسي'],
    badges: [
      { id: 'bw3', name: 'المؤرخ الذهبي', icon: 'Award', color: 'emerald', description: 'أفضل أبحاث تاريخية موثقة' }
    ],
    rating: 4.91,
    followersCount: 11400,
    followingCount: 110,
    articlesCount: 15,
    totalViews: 189000,
    totalEarnings: 2150.00,
    monthlyEarnings: 460.00,
    joinedDate: 'مارس 2024',
    twoFactorEnabled: false,
    notificationsEnabled: true,
    aiQuota: {
      freeDailyLimit: 5,
      usedToday: 2,
      lastResetTime: new Date().toISOString(),
      isSubscriber: false,
      plan: 'none'
    }
  },
  {
    id: 'user_reader_1',
    email: 'reader.sarah@gmail.com',
    phone: '+966559876543',
    fullName: 'سارة العتيبي',
    username: 'sarah_reads',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&auto=format&fit=crop&q=80',
    role: 'reader',
    bio: 'عاشقة للأدب الكلاسيكي، مراجعة كتب شغوفة، ومهتمة بالترجمة الأدبية والنقد الفكري.',
    isVerified: false,
    isKycVerified: false,
    socialLinks: {
      twitter: 'https://x.com/sarah_reads_daily'
    },
    specialties: ['قراءة نقدية', 'الروايات'],
    badges: [
      { id: 'br1', name: 'قارئ نهم', icon: 'BookOpen', color: 'indigo', description: 'قرأ أكثر من 150 مقالاً خلال العام' }
    ],
    rating: 5.0,
    followersCount: 430,
    followingCount: 52,
    articlesCount: 0,
    totalViews: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
    joinedDate: 'مارس 2024',
    twoFactorEnabled: false,
    notificationsEnabled: true,
    aiQuota: {
      freeDailyLimit: 5,
      usedToday: 2,
      lastResetTime: new Date().toISOString(),
      isSubscriber: false,
      plan: 'none'
    }
  },
  {
    id: 'user_adv_1',
    email: 'marketing@techhorizon.com',
    phone: '+971508889922',
    fullName: 'شركة أفق للتقنية السحابية',
    username: 'horizon_tech',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
    role: 'advertiser',
    bio: 'منصة حلول سحابية وبرمجيات للشركات الناشئة والمبتكرين في العالم العربي.',
    isVerified: true,
    isKycVerified: true,
    kycDetails: {
      idType: 'سجل تجاري معتمد',
      idNumber: 'CR-9041842',
      selfieUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300',
      status: 'verified',
      submittedAt: '2025-02-01'
    },
    socialLinks: {
      website: 'https://techhorizon.io',
      twitter: 'https://x.com/techhorizon_ar',
      linkedin: 'https://linkedin.com/company/techhorizon'
    },
    specialties: ['التكنولوجيا السحابية', 'الذكاء الاصطناعي'],
    badges: [
      { id: 'ba1', name: 'معلن موثوق', icon: 'ShieldCheck', color: 'blue', description: 'حملات إعلانية معتمدة وملتزمة بالمعايير' }
    ],
    rating: 4.85,
    followersCount: 1950,
    followingCount: 12,
    articlesCount: 0,
    totalViews: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
    joinedDate: 'فبراير 2024',
    twoFactorEnabled: true,
    notificationsEnabled: true,
    aiQuota: {
      freeDailyLimit: 5,
      usedToday: 0,
      lastResetTime: new Date().toISOString(),
      isSubscriber: true,
      plan: 'annual',
      planLimit: -1,
      planExpiresAt: '2027-01-01'
    }
  },
  {
    id: 'user_admin_1',
    email: 'admin@literium.com',
    phone: '+966500000001',
    fullName: 'المدير العام (مالك المنصة)',
    username: 'literium_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    coverUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
    role: 'admin',
    bio: 'الإدارة العليا ومنظومة الحوكمة، إدارة المحتوى، الإعلانات والأمان المالي لمنصة ليتيريوم.',
    isVerified: true,
    isKycVerified: true,
    specialties: ['إدارة المنظومة', 'حماية النزاهة الإعلانية', 'حوكمة المحتوى'],
    badges: [
      { id: 'b_admin', name: 'مالك المنصة', icon: 'ShieldAlert', color: 'purple', description: 'صلاحيات الإشراف الكاملة' }
    ],
    rating: 5.0,
    followersCount: 35000,
    followingCount: 0,
    articlesCount: 0,
    totalViews: 1200000,
    totalEarnings: 18450.00,
    monthlyEarnings: 3950.00,
    joinedDate: 'يناير 2024',
    twoFactorEnabled: true,
    notificationsEnabled: true
  }
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art_1',
    writerId: 'user_writer_1',
    writerName: 'د. طارق المنصور',
    writerUsername: 'tariq_almansoor',
    writerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'فلسفة اللغة واستعارات المعنى في الأدب العربي المعاصر',
    slug: 'philosophy-of-language-and-metaphor-in-arabic-literature',
    description: 'رحلة استكشافية عميقة في بنية الاستعارة العربية وكيف يعيد الكُتّاب الجدد صياغة الوعي الجمعي من خلال مجازات القرن الحادي والعشرين.',
    content: `## مقدمة: هل اللغة مجرد وعاء أم صانعة للمعنى؟

لطالما كان السؤال عن ماهية اللغة مدار بحث لا يهدأ بين فلاسفة الفكر ومبدعي الكلمة. لم تكن اللغة العربية في تاريخها الطويل مجرد أداة للتخاطب أو نقل المعلومات الجافة، بل كانت على الدوام مرآة صقيلة تعكس البنى النفسية والروحية والجمالية للإنسان العربي في شتى تقلبات عصوره.

> "إنّ المجاز ليس ترفاً لغوياً يضاف على هامش الكلام، بل هو الرئة التي يتنفس بها الفكر حين تضيق به قوالب الحقيقة الضيقة."

### تجليات الاستعارة الجديدة في الرواية المعاصرة

حين نتأمل الإنتاج الروائي العربي خلال العقدين الأخيرين، نلحظ انزياحاً واضحاً عن الاستعارات الكلاسيكية التي تشبثت بالرمزية المباشرة. باتت الصورة الفنية أكثر التحاماً بالواقع المديني المركب، وبالقلق الوجودي الذي يرافق الإنسان المعاصر أمام طوفان الرقمنة والسرعة.

1. **إعادة تفكيك البداهات اللغوية**: حيث لم تعد العبارة مقيدة بالجزالة المعجمية الصارمة بقدر ما تهتم بنبض الشارع والشعور الداخلي الدفين.
2. **شعرية اليومي والمهمش**: تحويل التفاصيل الصغيرة والمنسية إلى بؤر إشعاع دلالي يحمل كثافة فلسفية مذهلة.
3. **تعدد الأصوات والوعي الهجين**: تداخل اللهجات المحلية بالفصحى المعاصرة لخلق نسيج حكائي نابض بالحياة.

### خاتمة واستشراف

تظل التجربة الأدبية الحقيقية هي تلك التي تجعلنا نعيد النظر في ألفاظنا المألوفة كأننا نراها للمرة الأولى. فالكاتب الحق لا يكتب بالكلمات فقط، بل يكتب بما بين السطور من صمت وتأمل ودهشة.`,
    featuredImage: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80',
    category: 'literature',
    subCategory: 'النقد الأدبي والفلسفة',
    isLocked: false,
    readingTimeMinutes: 6,
    status: 'published',
    viewsCount: 14820,
    likesCount: 1240,
    sharesCount: 380,
    commentsCount: 42,
    purchasesCount: 0,
    rating: 4.95,
    ratingsCount: 88,
    revenueFromAds: 44.46,
    revenueFromSales: 0,
    totalRevenue: 44.46,
    publishedAt: 'منذ يومين',
    tags: ['أدب', 'فلسفة', 'لغة عربية', 'نقد', 'قراءات']
  },
  {
    id: 'art_2',
    writerId: 'user_writer_1',
    writerName: 'د. طارق المنصور',
    writerUsername: 'tariq_almansoor',
    writerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'الذكاء الاصطناعي ومستقبل التأليف: هل تسرق الخوارزميات روح الإبداع؟ [مقال حصري]',
    slug: 'ai-and-future-of-creative-writing-exclusive',
    description: 'دراسة نقدية حصرية وموسعة حول النماذج اللغوية التوليدية وتأثيرها على الملكية الفكرية، وحقيقة الفارق الجوهري بين المحاكاة والإلهام البشري.',
    content: `## الجزء الأول: ثورة النماذج اللغوية والأفق الجديد

مع تصاعد قدرات الذكاء الاصطناعي التوليدي، واجه المجتمع الأدبي صدمة وجودية لم يشهد مثلها منذ اختراع المطبعة. هل يمكن لخوارزمية تتنبأ بالكلمة التالية أن تنتج نصاً يلامس عمق الروح البشرية؟

### تحليل المقارنة بين المحاكاة والإحساس الإنساني

يقوم الذكاء الاصطناعي على تحليل المليارات من النصوص السابقة، واستخراج الأنماط الأكثر تكراراً وانسجاماً. هذا يعني بطبيعته أنه يمثل "الوسط الرياضي" لما كتبه البشر سابقاً، بينما ينبثق الإبداع البشري الفذ دائماً من "الشذوذ عن القاعدة" والتمرد على المألوف.

### استراتيجيات الكاتب المعاصر في عصر الذكاء الاصطناعي

1. **التركيز على التجارب الحياتية الذاتية**: المشاعر المعاشة التي لا توجد في أي خادم حاسوبي.
2. **استخدام الذكاء الاصطناعي كمساعد بحثي ملهم**، وليس كبديل عن القرار الإبداعي النهائي.
3. **تعميق البعد الفلسفي والأخلاقي للنص**، وهو ما تعجز عنه أي شبكة عصبية اصطناعية.

> استمر في قراءة التحليل التفكيكي الشامل ونماذج النصوص المقارنة الحصرية للمشتركين...`,
    featuredImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    category: 'technology',
    subCategory: 'الذكاء الاصطناعي والثقافة',
    isLocked: true,
    lockedPrice: 3.50,
    isUnlockedByCurrentUser: false,
    readingTimeMinutes: 11,
    status: 'published',
    viewsCount: 8400,
    likesCount: 890,
    sharesCount: 215,
    commentsCount: 31,
    purchasesCount: 165,
    rating: 4.88,
    ratingsCount: 54,
    revenueFromAds: 25.20,
    revenueFromSales: 548.62,
    totalRevenue: 573.82,
    publishedAt: 'منذ 4 أيام',
    tags: ['ذكاء اصطناعي', 'مستقبل الكتابة', 'تكنولوجيا', 'دراسات حصرية']
  },
  {
    id: 'art_3',
    writerId: 'user_writer_1',
    writerName: 'د. طارق المنصور',
    writerUsername: 'tariq_almansoor',
    writerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'أندلسيات منسية: كيف حفظت مكتبات قرطبة وطليطلة شعلة المعرفة الإنسانية',
    slug: 'forgotten-andalusian-libraries-cordoba-toledo',
    description: 'إضاءة تاريخية على عصر الترجمة الأندلسي والنهضة العلمية التي مهدت لعصر التنوير الأوروبي، مع وثائق نادرة من خزائن المخطوطات.',
    content: `## ملحمة الورّاقين ومدينة العلم

لم تكن قرطبة في القرن الرابع الهجري مجرد عاصمة سياسية، بل كانت واحة كونية استقطبت العلماء والباحثين من شتى بقاع الأرض. في وقت كانت فيه معظم عواصم أوروبا تفتقر للمكتبات العامة، ضمت قرطبة وحدها أكثر من سبعين مكتبة عامة وخاصة.

### مكتبة الحكم المستنصر: أعجوبة العصر الوسيط

تجاوزت مقتنيات مكتبة الخليفة الحكم الثاني أربعمائة ألف مجلد، وفهرست في أربعة وأربعين دفتراً. والأهم من جمع الكتب كان نشاط حركة النسخ والتحقيق، حيث كان يرسل مبعوثيه إلى بغداد ودمشق والقاهرة لشراء النسخ الأولى من كل مؤلف جديد قبل أن يشيع في الأسواق.

> "كانت الوراقة في الأندلس صناعة حضارية تجمع بين الفن والتدقيق اللغوي والبحث العلمي الرصين."`,
    featuredImage: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&auto=format&fit=crop&q=80',
    category: 'history',
    subCategory: 'التاريخ الأندلسي والحضاري',
    isLocked: false,
    readingTimeMinutes: 8,
    status: 'published',
    viewsCount: 21300,
    likesCount: 1980,
    sharesCount: 640,
    commentsCount: 78,
    purchasesCount: 0,
    rating: 4.98,
    ratingsCount: 120,
    revenueFromAds: 63.90,
    revenueFromSales: 0,
    totalRevenue: 63.90,
    publishedAt: 'منذ أسبوع',
    tags: ['تاريخ', 'الأندلس', 'مخطوطات', 'حضارة إسلامية']
  },
  {
    id: 'art_4',
    writerId: 'user_writer_2',
    writerName: 'أ. د. ليلى الشامسي',
    writerUsername: 'layla_alshamsi',
    writerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'فلسفة الصمت: حين تصبح العزلة ملاذاً لإنتاج المعنى',
    slug: 'philosophy-of-silence-solitude-and-meaning',
    description: 'قراءة فينومينولوجية في مفهوم الصمت الإيجابي وكيف يتحول الانعزال الاختياري إلى مختبر لصفاء الذهن وتجديد الطاقات الإبداعية.',
    content: `## مقدمة: ضجيج العالم ومأساة التشتت

في عصر الإشعارات المتلاحقة والتدفق اللامتناهي للمعلومات، غدا الصمت عملة نادرة يبحث عنها العقل البشري المنهك. إن الصمت ليس غياباً للكلام، بل هو حضور مكثف للوعي واستعادة لبوصلة الذات التائهة في زحام العالم الخارجي.

### الصمت في التراث الفلسفي والصوفي

تحدث فلاسفة الإشراق وحكماء الشرق عن الصمت بوصفه أول درجات الحكمة. فالصمت يتيح للإنسان أن يستمع إلى ما لا تقوله الكلمات، وأن يعيد بناء علاقته مع الزمن الداخلي بعيداً عن ضغوط التقييم الاجتماعي المستمر.

> "الصمت هو الفضاء الذي تولد فيه الأفكار العظيمة قبل أن ترتدي ثياب الحروف."

### كيف نبني ملاذنا الهادئ اليوم؟

1. **تخصيص ساعة صمت يومية**: خالية تماماً من الشاشات والأصوات الاصطناعية.
2. **التأمل في الطبيعة والتفاصيل العفوية**: إعادة تدريب الحواس على الاستمتاع بالبساطة.
3. **الكتابة الاسترجاعية في دفتر ورقي**: تفريغ الأفكار العالقة دون رقابة مسبقة.`,
    featuredImage: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=80',
    category: 'philosophy',
    subCategory: 'فلسفة الوعي والحياة',
    isLocked: false,
    readingTimeMinutes: 7,
    status: 'published',
    viewsCount: 18900,
    likesCount: 1620,
    sharesCount: 510,
    commentsCount: 64,
    purchasesCount: 0,
    rating: 4.96,
    ratingsCount: 95,
    revenueFromAds: 56.70,
    revenueFromSales: 0,
    totalRevenue: 56.70,
    publishedAt: 'منذ 3 أيام',
    tags: ['فلسفة', 'تأمل', 'وعي', 'علم النفس', 'هدوء']
  },
  {
    id: 'art_5',
    writerId: 'user_writer_3',
    writerName: 'م. مروان الأندلسي',
    writerUsername: 'marwan_andalusi',
    writerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'أسرار الكون والمادة المظلمة: رحلة إلى حافة الفضاء السحيق',
    slug: 'secrets-of-cosmos-and-dark-matter',
    description: 'استكشاف علمي شيق لأحدث اكتشافات تلسكوب جيمس ويب الفضائي حول الثقوب السوداء البدائية واللغز الذي يحير علماء الفيزياء الفلكية.',
    content: `## أفق جديد لرؤية الكون المبكر

منذ أن أرسل تلسكوب جيمس ويب الفضائي صوره الأولى عالية الدقة للأعماق السحيقة للكون، بدأت كتب الفيزياء الفلكية تعيد صياغة نظرياتها حول نشأة المجرات الأولى.

### لغز المادة المظلمة والطاقة الكونية

تشير الحسابات الرياضية الدقيقة إلى أن المادة المرئية التي نراها ونلمسها لا تشكل سوى أقل من 5% من مجمل طاقة ومادة الكون، بينما تسيطر المادة المظلمة والطاقة المظلمة على النسبة الباقية.

> "الكون ليس فقط أكثر غرابة مما نتصور، بل هو أكثر غرابة مما نستطيع أصلاً أن نتصور."`,
    featuredImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
    category: 'science',
    subCategory: 'الفيزياء الفلكية والفضاء',
    isLocked: false,
    readingTimeMinutes: 9,
    status: 'published',
    viewsCount: 16400,
    likesCount: 1410,
    sharesCount: 420,
    commentsCount: 53,
    purchasesCount: 0,
    rating: 4.93,
    ratingsCount: 78,
    revenueFromAds: 49.20,
    revenueFromSales: 0,
    totalRevenue: 49.20,
    publishedAt: 'منذ 5 أيام',
    tags: ['علوم', 'فلك', 'فيزياء', 'جيمس ويب', 'كون']
  },
  {
    id: 'art_6',
    writerId: 'user_writer_1',
    writerName: 'د. طارق المنصور',
    writerUsername: 'tariq_almansoor',
    writerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'اقتصاد المعرفة وصناعة المحتوى الرقمي في العالم العربي [مقال حصري]',
    slug: 'knowledge-economy-digital-content-arab-world',
    description: 'دليل استراتيجي شامل للكُتّاب ورواد الأعمال حول نماذج تحقيق الدخل والاشتراكات المصغرة وحماية حقوق الملكية الفكرية على الويب.',
    content: `## التحول من الهواية إلى الصناعة المستدامة

لم يعد صانع المحتوى العربي ملزماً بالاعتماد فقط على التبرعات أو الرعايات التقليدية المتقطعة. لقد أثبتت منصات مثل ليتيريوم أن القارئ العربي مستعد للاستثمار في المحتوى ذي القيمة العالية حين يجد أطروحات تحترم عقله ووقته.

### ركائز الاقتصاد الإبداعي الرقمي:

1. **الولاء والتفاعل النوعي**: بناء مجتمع قارئ مخلص أهم من ملاحقة التريند العابر.
2. **تنويع مصادر الدخل**: الجمع الذكي بين عائدات الإعلانات التفاعلية والمقالات المقفولة المتميزة والكتب الرقمية.
3. **الجودة المعرفية الموثقة**: تقديم أبحاث وبيانات دقيقة تميزك عن الضخ الإعلامي السطحي.`,
    featuredImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
    category: 'business',
    subCategory: 'ريادة الأعمال واقتصاد المعرفة',
    isLocked: true,
    lockedPrice: 4.20,
    isUnlockedByCurrentUser: false,
    readingTimeMinutes: 10,
    status: 'published',
    viewsCount: 9700,
    likesCount: 980,
    sharesCount: 310,
    commentsCount: 38,
    purchasesCount: 142,
    rating: 4.91,
    ratingsCount: 62,
    revenueFromAds: 29.10,
    revenueFromSales: 566.58,
    totalRevenue: 595.68,
    publishedAt: 'منذ أسبوع',
    tags: ['ريادة أعمال', 'اقتصاد المعرفة', 'أرباح المحتوى', 'استراتيجيات']
  },
  {
    id: 'art_7',
    writerId: 'user_writer_2',
    writerName: 'أ. د. ليلى الشامسي',
    writerUsername: 'layla_alshamsi',
    writerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'شعرية الغربة والحنين في ديوان المنفى العربي الحديث',
    slug: 'poetry-of-exile-and-nostalgia-modern-arabic',
    description: 'قراءة نقدية في قصائد محمود درويش وبدر شاكر السياب وسركون بولص، وكيف صاغ الشتات معجزة التعبير الشعري العربي.',
    content: `## الوطن حين يسكن في القصيدة

حين يضيق المكان الجغرافي بالشاعر، يتسع الفضاء اللغوي ليكون وطناً بديلاً. تفيض القصيدة العربية الحديثة بصور الحنين الجارف والمكابدة الوجدانية التي تعيد تشكيل صورة الوطن المفقود كفردوس رمزي لا يزول.

> "لا شيء يوجع الشاعر مثل اغتراب المعنى في عيون العابرين، ولا شيء يشفيه سوى أن يكتب وجعه بمداد الخلود."`,
    featuredImage: 'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=1200&auto=format&fit=crop&q=80',
    category: 'literature',
    subCategory: 'النقد الشعري والجمالي',
    isLocked: false,
    readingTimeMinutes: 6,
    status: 'published',
    viewsCount: 12100,
    likesCount: 1150,
    sharesCount: 290,
    commentsCount: 45,
    purchasesCount: 0,
    rating: 4.97,
    ratingsCount: 71,
    revenueFromAds: 36.30,
    revenueFromSales: 0,
    totalRevenue: 36.30,
    publishedAt: 'منذ يوم',
    tags: ['شعر عربي', 'أدب المنفى', 'نقد أدبي', 'درويش', 'قصائد']
  },
  {
    id: 'art_8',
    writerId: 'user_writer_3',
    writerName: 'م. مروان الأندلسي',
    writerUsername: 'marwan_andalusi',
    writerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    writerIsVerified: true,
    title: 'سيكولوجيا العادات اليومية: كيف تصنع التغييرات الصغيرة فارقاً جذرياً؟',
    slug: 'psychology-of-daily-habits-micro-changes',
    description: 'قواعد علم النفس السلوكي والهندسة العصبية لبناء عادات قراءة وإنتاجية صلبة ومستدامة تدوم طوال العمر دون إرهاق الإرادة.',
    content: `## الحلقة الثلاثية للعادات: المحفز، الروتين، والمكافأة

إن النجاح ليس حدثاً مفاجئاً بل هو محصلة للعادات الصغيرة المتكررة كل يوم. حين نفهم كيف يتفاعل الدوبامين مع الإنجازات اليومية البسيطة، نستطيع التغلب على التسويف والمماطلة بسلاسة بالغة.

### استراتيجيات ترسيخ العادات:

1. **الاقتران العادتي**: ربط العادة الجديدة بعادة يومية راسخة كشرب قهوة الصباح.
2. **قاعدة الدقيقتين**: جعل بداية الفعل سهلة جداً بحيث يستحيل رفضها.
3. **البيئة المهيأة**: إزالة العوائق بينك وبين ما تريد تحقيقه ووضع الكتاب في متناول يدك دائماً.`,
    featuredImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80',
    category: 'health',
    subCategory: 'علم النفس وتطوير الذات',
    isLocked: false,
    readingTimeMinutes: 5,
    status: 'published',
    viewsCount: 23400,
    likesCount: 2100,
    sharesCount: 780,
    commentsCount: 92,
    purchasesCount: 0,
    rating: 4.98,
    ratingsCount: 140,
    revenueFromAds: 70.20,
    revenueFromSales: 0,
    totalRevenue: 70.20,
    publishedAt: 'منذ يومين',
    tags: ['علم النفس', 'عادات', 'تطوير الذات', 'إنتاجية', 'قراءة']
  }
];

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book_1',
    title: 'أطياف الحداثة: في فلسفة المعنى وتفكيك النص العربي',
    author: 'د. طارق المنصور',
    authorId: 'user_writer_1',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    category: 'فلسفة وفكر',
    rating: 4.96,
    reviewsCount: 342,
    pages: 284,
    description: 'رؤية نقدية متماسكة تتناول تحولات البنية اللغوية والجمالية في الفكر العربي الحديث، مع تطبيقات عملية على كبار شعراء وروائيي القرن العشرين.',
    isFree: true,
    readsCount: 28900,
    publishedYear: '2025',
    tags: ['فلسفة', 'نقد أدبي', 'فكر عربي', 'كتب مختارة'],
    sampleExcerpt: 'إن التحديث الفعلي لا يبدأ من استيراد المفاهيم الجاهزة، بل من تحرير الطاقة الرمزية الكامنة في لغتنا التراثية وإعادة شحنها بأسئلة الحاضر...'
  },
  {
    id: 'book_2',
    title: 'العقل والدهشة: قراءات في الوعي الإنساني والذكاء الاصطناعي',
    author: 'أ. د. ليلى الشامسي',
    authorId: 'user_writer_2',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80',
    category: 'علوم وفلسفة',
    rating: 4.92,
    reviewsCount: 218,
    pages: 320,
    description: 'استقصاء معرفي شامل حول ما يميز التجربة الواعية للإنسان عن معالجة البيانات الخوارزمية، وكيف يصيغ الإبداع مستقبل الثقافة.',
    isFree: false,
    price: 4.99,
    readsCount: 19400,
    publishedYear: '2026',
    tags: ['ذكاء اصطناعي', 'فلسفة العقل', 'دراسات المستقبل'],
    sampleExcerpt: 'حين تنظر الآلة إلى القصيدة ترى تواتراً إحصائياً للكلمات، أما الوعي البشري فيرى جراح الشاعر ووميض أمله الدفين...'
  },
  {
    id: 'book_3',
    title: 'خزائن النور: تاريخ المخطوطات والترجمة في قرطبة وبغداد',
    author: 'م. مروان الأندلسي',
    authorId: 'user_writer_3',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e37273?w=600&auto=format&fit=crop&q=80',
    category: 'تاريخ وحضارة',
    rating: 4.98,
    reviewsCount: 480,
    pages: 410,
    description: 'توثيق تاريخي شائق لمغامرات الورّاقين وحفظة الكتب الذين شيدوا جسور التبادل الحضاري بين الشرق والغرب عبر القرون الوسطى.',
    isFree: true,
    readsCount: 35200,
    publishedYear: '2024',
    tags: ['تاريخ الأندلس', 'مخطوطات', 'بيت الحكمة', 'حضارة'],
    sampleExcerpt: 'كان حبر الورّاق في أسواق قرطبة يباع بوزن الفضة، لأن الكلمة المنسوخة كانت تعني نجاة فكرة من مقصلة النسيان...'
  },
  {
    id: 'book_4',
    title: 'شعرية المكان: من أطلال البادية إلى ناطحات الزجاج',
    author: 'د. طارق المنصور',
    authorId: 'user_writer_1',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&auto=format&fit=crop&q=80',
    category: 'أدب ونقد',
    rating: 4.89,
    reviewsCount: 175,
    pages: 240,
    description: 'تتبع سيميائي لمفهوم المكان في الوجدان الشعري العربي، وكيف تحول الرمز المكاني من طلل حنين إلى مدينة اغتراب وسرعة.',
    isFree: false,
    price: 3.50,
    readsCount: 14800,
    publishedYear: '2025',
    tags: ['أدب', 'شعر عربي', 'نقد فني'],
    sampleExcerpt: 'المكان في القصيدة ليس جغرافيا صماء، بل هو مرآة عاطفية ترتسم عليها انكسارات الروح وأشواقها الأبدية...'
  }
];

export const INITIAL_CAMPAIGNS: AdCampaign[] = [
  {
    id: 'camp_1',
    advertiserId: 'user_adv_1',
    advertiserName: 'شركة أفق للتقنية السحابية',
    campaignName: 'حملة السحابة العربية - بانر عام (Fixed Duration)',
    description: 'إعلان رئيسي في واجهة المنصة واستكشاف المحتوى.',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    destinationUrl: 'https://techhorizon.io/promo-cloud',
    type: 'fixed',
    pricingModel: 'fixed',
    placementType: 'platform',
    adText: 'سيرفرات فائقة السرعة مع دعم تقني باللغة العربية على مدار الساعة. احصل على تجربتك المجانية!',
    status: 'active',
    durationHours: 48,
    fixedRate: 60.00,
    startDate: '2026-08-15',
    endDate: '2026-08-17',
    impressionsCount: 41200,
    validImpressionsCount: 41200,
    clicksCount: 1540,
    validClicksCount: 1540,
    conversionsCount: 210,
    totalSpent: 60.00,
    totalBudget: 60.00,
    fraudShieldScore: 99,
    blockedFraudClicks: 0,
    targetCategories: ['technology', 'business'],
    targetCountries: ['SA', 'AE', 'EG', 'KW'],
    antiFraudLevel: 'basic'
  },
  {
    id: 'camp_2',
    advertiserId: 'user_adv_1',
    advertiserName: 'شركة أفق للتقنية السحابية',
    campaignName: 'حملة الظهور CPM: حزمة المحتوى الأدبي الفاخر',
    description: 'إعلانات داخل مقالات الكُتّاب مع مشاركة الأرباح بنظام CPM المحمي.',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
    destinationUrl: 'https://techhorizon.io/enterprise-cpm',
    type: 'cpm',
    pricingModel: 'cpm',
    placementType: 'writer',
    adText: 'استضف مدونتك الأدبية أو منصتك الثقافية على أسرع سحابة عربية مشفرة.',
    status: 'active',
    cpmRate: 2.50, // $2.50 per 1000 valid views
    startDate: '2026-08-12',
    endDate: '2026-08-28',
    impressionsCount: 28400,
    validImpressionsCount: 26200,
    clicksCount: 890,
    validClicksCount: 840,
    conversionsCount: 112,
    totalSpent: 65.50,
    totalBudget: 150.00,
    fraudShieldScore: 96,
    blockedFraudClicks: 50,
    targetCategories: ['literature', 'philosophy', 'arts'],
    targetCountries: ['ALL'],
    antiFraudLevel: 'enhanced_viewability'
  },
  {
    id: 'camp_3',
    advertiserId: 'user_adv_1',
    advertiserName: 'شركة أفق للتقنية السحابية',
    campaignName: 'حملة النقرات CPC: برنامج الذكاء اللغوي',
    description: 'إعلان نقرات خاضع لنظام الحماية الأقصى (درع النقرات الذكي ومنع النقر الذاتي).',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    destinationUrl: 'https://techhorizon.io/ai-assistant-ar',
    type: 'cpc',
    pricingModel: 'cpc',
    placementType: 'writer',
    adText: 'اكتشف الجيل الجديد من معالجة اللغة العربية الفصحى بالذكاء التوليدي.',
    status: 'active',
    cpcRate: 0.20,
    startDate: '2026-08-10',
    endDate: '2026-08-25',
    impressionsCount: 31200,
    validImpressionsCount: 29800,
    clicksCount: 780,
    validClicksCount: 680,
    conversionsCount: 94,
    totalSpent: 136.00,
    totalBudget: 250.00,
    fraudShieldScore: 98,
    blockedFraudClicks: 100,
    targetCategories: ['literature', 'technology', 'philosophy'],
    targetCountries: ['ALL'],
    antiFraudLevel: 'maximum_cpc_shield'
  }
];

export const INITIAL_FRAUD_FLAGS: FraudFlag[] = [
  {
    id: 'ff_101',
    campaignId: 'camp_3',
    campaignName: 'حملة النقرات CPC: برنامج الذكاء اللغوي',
    articleId: 'art_1',
    articleTitle: 'فلسفة اللغة واستعارات المعنى',
    writerId: 'user_writer_1',
    writerName: 'د. طارق المنصور',
    userId: 'user_writer_1',
    userIp: '188.130.45.12',
    pricingModel: 'cpc',
    triggerType: 'self_click',
    severity: 'high',
    status: 'auto_blocked',
    detectedAt: '2026-08-17 09:14',
    details: 'محاولة نقر من الكاتب صاحب المقال على إعلان داخل صفحته الشخصية. تم الحظر الفوري.',
    mitigationAction: 'تم حجب النقرة وإلغاء عمولة النقر المالي وحماية رصيد المعلن بنجاح',
    revenueBlocked: 0.20
  },
  {
    id: 'ff_102',
    campaignId: 'camp_3',
    campaignName: 'حملة النقرات CPC: برنامج الذكاء اللغوي',
    articleId: 'art_2',
    articleTitle: 'الذكاء الاصطناعي ومستقبل التأليف',
    userId: 'user_anon_bot',
    userIp: '45.12.98.204',
    pricingModel: 'cpc',
    triggerType: 'insufficient_dwell',
    severity: 'medium',
    status: 'auto_blocked',
    detectedAt: '2026-08-17 08:30',
    details: 'نقر فوري بعد 0.4 ثانية من تحميل الصفحة دون تحقق معيار الرؤية المستمرة (احتمال بوت).',
    mitigationAction: 'استبعاد احتساب النقرة من إحصائيات الدفع وتنبيه المعلن بنزاهة التقرير',
    revenueBlocked: 0.20
  },
  {
    id: 'ff_103',
    campaignId: 'camp_2',
    campaignName: 'حملة الظهور CPM: حزمة المحتوى الأدبي الفاخر',
    articleId: 'art_3',
    articleTitle: 'أندلسيات منسية',
    userId: 'user_anon_refresh',
    userIp: '194.27.10.88',
    pricingModel: 'cpm',
    triggerType: 'rapid_refresh',
    severity: 'low',
    status: 'flagged',
    detectedAt: '2026-08-17 07:15',
    details: 'إعادة تحميل سريع متكرر للصفحة (14 مرة خلال دقيقة واحدة) لنفس الإعلان.',
    mitigationAction: 'تحييد الظهور واحتساب ظهور واحد فقط خلال الجلسة الواحدة',
    revenueBlocked: 0.035
  },
  {
    id: 'ff_104',
    campaignId: 'camp_3',
    campaignName: 'حملة النقرات CPC: برنامج الذكاء اللغوي',
    articleId: 'art_6',
    articleTitle: 'اقتصاد المعرفة وصناعة المحتوى الرقمي',
    userId: 'user_reader_1',
    userIp: '82.114.60.10',
    pricingModel: 'cpc',
    triggerType: 'click_throttle',
    severity: 'high',
    status: 'auto_blocked',
    detectedAt: '2026-08-16 22:40',
    details: 'تكرار النقر 3 مرات على نفس الرابط الإعلاني خلال أقل من 4 دقائق.',
    mitigationAction: 'احتساب النقرة الأولى فقط وحظر النقرات الإضافية لحماية ميزانية الحملة',
    revenueBlocked: 0.40
  }
];

export const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'comm_1',
    articleId: 'art_1',
    userId: 'user_reader_1',
    userName: 'سارة العتيبي',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    userRole: 'reader',
    content: 'مقال بالغ الرقي والعمق كعادتكم دكتور طارق. لفت انتباهي بشدة الربط بين شعرية اليومي وأزمة المعنى في المدينة الحديثة!',
    likesCount: 24,
    isLiked: false,
    isPinned: true,
    createdAt: 'منذ يوم',
    replies: [
      {
        id: 'rep_1',
        userId: 'user_writer_1',
        userName: 'د. طارق المنصور',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
        userRole: 'writer',
        content: 'أشكركِ جزيل الشكر أستاذة سارة على هذا المرور النبيه والتفاعل الراقي الذي يثري النص وكاتبه.',
        likesCount: 14,
        isLiked: false,
        createdAt: 'منذ 18 ساعة'
      }
    ]
  },
  {
    id: 'comm_2',
    articleId: 'art_1',
    userId: 'user_gen_2',
    userName: 'م. خالد الدوسري',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    userRole: 'reader',
    content: 'طرح فلسفي متقن. نتمنى مقالاً قادماً يتناول أثر الفلسفة الظاهراتية (الفينومينولوجيا) في الشعر العربي المعاصر.',
    likesCount: 9,
    isLiked: false,
    createdAt: 'منذ 14 ساعة',
    replies: []
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_101',
    type: 'earning_locked',
    amount: 142.50,
    currency: 'USD',
    status: 'completed',
    paymentMethod: 'مبيعات مقال الذكاء الاصطناعي',
    referenceId: 'SLS-984129',
    description: 'أرباح بيع المقال المقفول (حصة الكاتب 95%)',
    relatedArticleTitle: 'الذكاء الاصطناعي ومستقبل التأليف',
    createdAt: '2026-08-15'
  },
  {
    id: 'tx_102',
    type: 'earning_adsense',
    amount: 63.90,
    currency: 'USD',
    status: 'completed',
    paymentMethod: 'Google AdSense CPM',
    referenceId: 'ADS-23841',
    description: 'أرباح ظهور الإعلانات (حصة الكاتب 60%)',
    relatedArticleTitle: 'أندلسيات منسية',
    createdAt: '2026-08-14'
  },
  {
    id: 'tx_103',
    type: 'withdrawal',
    amount: 250.00,
    currency: 'USD',
    status: 'completed',
    paymentMethod: 'USDT (Tether TRC20)',
    referenceId: 'WD-USDT-982194',
    description: 'تحويل محفظة رقمية إلى عنوان: TEv9...7xKq',
    createdAt: '2026-08-10'
  },
  {
    id: 'tx_104',
    type: 'deposit',
    amount: 300.00,
    currency: 'USD',
    status: 'completed',
    paymentMethod: 'بطاقة ائتمان Stripe',
    referenceId: 'DEP-STR-38914',
    description: 'شحن رصيد محفظة المعلن لتمويل الحملات',
    createdAt: '2026-08-08'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_1',
    userId: 'user_writer_1',
    type: 'earning',
    title: 'أرباح جديدة في محفظتك 💰',
    message: 'تمت إضافة 18.50$ من مبيعات المقالات المقفولة وعائدات إعلانات Google AdSense.',
    isRead: false,
    createdAt: 'منذ ساعتين'
  },
  {
    id: 'notif_2',
    userId: 'user_writer_1',
    type: 'follow',
    title: 'متابع جديد 🌟',
    message: 'بدأت سارة العتيبي بمتابعة حسابك ومقالاتك الأدبية.',
    isRead: false,
    createdAt: 'منذ 5 ساعات'
  },
  {
    id: 'notif_3',
    userId: 'user_writer_1',
    type: 'comment',
    title: 'تعليق جديد 💬',
    message: 'علق م. خالد الدوسري على مقالك "فلسفة اللغة واستعارات المعنى".',
    isRead: true,
    createdAt: 'منذ يوم'
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_1',
    partnerId: 'user_reader_1',
    partnerName: 'سارة العتيبي',
    partnerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    partnerRole: 'reader',
    lastMessage: 'مرحباً دكتور، هل تخطط لإصدار كتاب يجمع هذه المقالات النقدية قريباً؟',
    lastMessageTime: '10:45 ص',
    unreadCount: 1
  }
];

export const INITIAL_MESSAGES: DirectMessage[] = [
  {
    id: 'msg_1',
    senderId: 'user_reader_1',
    senderName: 'سارة العتيبي',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    recipientId: 'user_writer_1',
    content: 'السلام عليكم ورحمة الله دكتور طارق. أتابع منشوراتك القيمة باستمرار على ليتيريوم.',
    createdAt: '10:30 ص',
    isRead: true
  },
  {
    id: 'msg_2',
    senderId: 'user_writer_1',
    senderName: 'د. طارق المنصور',
    senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    recipientId: 'user_reader_1',
    content: 'وعليكم السلام ورحمة الله أستاذة سارة. أهلاً بكِ ويسعدني دائماً تفاعل القراء المهتمين.',
    createdAt: '10:38 ص',
    isRead: true
  },
  {
    id: 'msg_3',
    senderId: 'user_reader_1',
    senderName: 'سارة العتيبي',
    senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    recipientId: 'user_writer_1',
    content: 'مرحباً دكتور، هل تخطط لإصدار كتاب يجمع هذه المقالات النقدية قريباً؟',
    createdAt: '10:45 ص',
    isRead: false
  }
];


