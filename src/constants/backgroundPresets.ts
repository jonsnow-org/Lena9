// -------------------------------------------------------------------
// إعدادات خلفيات القالب الجمالية القابلة للاختيار من لوحة الإدارة
// -------------------------------------------------------------------
// جميع الخلفيات مصممة خصيصاً مع طبقات تظليل (Overlays) وفلاتر عتامة
// دقيقة حتى لا تؤثر إطلاقاً على وضوح الحروف وقابلية القراءة في كلا
// الوضعين (الفاتح والداكن).

export type BackgroundPresetKey =
  | 'none'
  | 'library_warm'
  | 'parchment_manuscript'
  | 'celestial_night'
  | 'arabesque_geometry'
  | 'minimalist_gradient'
  | 'emerald_forest'
  | 'aurora_mesh'
  | 'midnight_gradient'
  | 'marble_luxury';

export interface BackgroundPresetDefinition {
  key: BackgroundPresetKey;
  label: string;
  labelEn: string;
  description: string;
  /** معاينة مصغّرة داخل لوحة الإدارة — رابط صورة أو تدرّج CSS، حسب النوع */
  previewUrl: string;
  /** رابط صورة خارجية (Unsplash) — فارغ إن كانت الخلفية تدرّجاً بلا صورة */
  imageUrl: string;
  /** تدرّج CSS مُولَّد بالكامل محلياً (بلا أي اعتماد على صورة خارجية أو
   *  اتصال إنترنت) — يُستخدم بدل imageUrl عند توفّره، فلا تتأخر الخلفية
   *  بالتحميل ولا يمكن أن تنكسر أبداً. */
  cssBackground?: string;
  overlayLight: string;
  overlayDark: string;
}

export const DEFAULT_BACKGROUND_PRESET: BackgroundPresetKey = 'none';

export const BACKGROUND_PRESETS: Record<BackgroundPresetKey, BackgroundPresetDefinition> = {
  none: {
    key: 'none',
    label: 'بدون خلفية (افتراضي)',
    labelEn: 'None (Default Clean)',
    description: 'الخلفية الافتراضية النقية والهادئة المناسبة لجميع الشاشات.',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60',
    imageUrl: '',
    overlayLight: 'transparent',
    overlayDark: 'transparent'
  },
  library_warm: {
    key: 'library_warm',
    label: 'مكتبة كلاسيكية عريقة',
    labelEn: 'Classic Library',
    description: 'أجواء مكتبة أدبية دافئة وهادئة تضفي هيبة وفخامة للقرّاء والكتّاب.',
    previewUrl: 'https://images.unsplash.com/photo-1507842229451-7f01be7ff612?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1507842229451-7f01be7ff612?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(255, 255, 255, 0.94)',
    overlayDark: 'rgba(2, 6, 23, 0.92)'
  },
  parchment_manuscript: {
    key: 'parchment_manuscript',
    label: 'ورق ومخطوطات عتيقة',
    labelEn: 'Vintage Parchment',
    description: 'ملمس أدبي تاريخي ناعم مستوحى من المخطوطات القديمة وأوراق البردي.',
    previewUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(254, 252, 247, 0.93)',
    overlayDark: 'rgba(15, 23, 42, 0.92)'
  },
  celestial_night: {
    key: 'celestial_night',
    label: 'سماء وسديم ليلي هادئ',
    labelEn: 'Celestial Night',
    description: 'أفق ليلي وسديم كوني خافت مريح للعين في جلسات القراءة والتأمل الليلية.',
    previewUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(248, 250, 252, 0.94)',
    overlayDark: 'rgba(2, 6, 23, 0.90)'
  },
  arabesque_geometry: {
    key: 'arabesque_geometry',
    label: 'زخارف هندسية فاخرة',
    labelEn: 'Arabesque Luxury',
    description: 'أنماط هندسية معمارية راقية بطابع تراثي معاصر يعزز أصالة المنصة.',
    previewUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(255, 255, 255, 0.93)',
    overlayDark: 'rgba(15, 23, 42, 0.91)'
  },
  minimalist_gradient: {
    key: 'minimalist_gradient',
    label: 'أمواج شفق أدبي ناعم',
    labelEn: 'Literary Aurora',
    description: 'تدرجات لونية هادئة وشفق ضوئي سينمائي خفيف يمنح الموقع حيوية بصرية.',
    previewUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(255, 255, 255, 0.92)',
    overlayDark: 'rgba(2, 6, 23, 0.88)'
  },
  emerald_forest: {
    key: 'emerald_forest',
    label: 'واحة زمردية مريحة',
    labelEn: 'Emerald Serenity',
    description: 'طبيعة زمردية ضبابية تمنح إحساساً بالسكينة والتركيز أثناء تصفح المقالات.',
    previewUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&auto=format&fit=crop&q=60',
    imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&auto=format&fit=crop&q=80',
    overlayLight: 'rgba(244, 249, 245, 0.93)',
    overlayDark: 'rgba(2, 18, 10, 0.90)'
  },
  // الخلفيات الثلاث التالية تدرّجات CSS مُولَّدة بالكامل محلياً — بلا أي
  // صورة خارجية، فتظهر فوراً بلا تحميل ولا يمكن أن تنكسر أبداً مهما حدث
  // لاتصال الإنترنت.
  aurora_mesh: {
    key: 'aurora_mesh',
    label: 'توهّج الشفق الأدبي',
    labelEn: 'Literary Aurora Mesh',
    description: 'تدرّج ألوان ناعم متعدد الطبقات بروح عصرية راقية — بلا أي صورة، يظهر فوراً دون تحميل.',
    previewUrl: '',
    imageUrl: '',
    cssBackground:
      'radial-gradient(at 15% 20%, rgba(168,85,247,0.45) 0, transparent 55%), radial-gradient(at 85% 25%, rgba(56,189,248,0.40) 0, transparent 55%), radial-gradient(at 50% 85%, rgba(236,72,153,0.30) 0, transparent 55%), linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
    overlayLight: 'rgba(255, 255, 255, 0.90)',
    overlayDark: 'rgba(2, 6, 23, 0.82)'
  },
  midnight_gradient: {
    key: 'midnight_gradient',
    label: 'عمق ليلي متدرّج',
    labelEn: 'Midnight Depth',
    description: 'تدرّج داكن هادئ يريح العين في القراءة الليلية الطويلة — تدرّج CSS خالص بلا صورة.',
    previewUrl: '',
    imageUrl: '',
    cssBackground: 'linear-gradient(160deg, #020617 0%, #0f172a 45%, #1e293b 100%)',
    overlayLight: 'rgba(255, 255, 255, 0.93)',
    overlayDark: 'rgba(2, 6, 23, 0.75)'
  },
  marble_luxury: {
    key: 'marble_luxury',
    label: 'رخام فاخر دافئ',
    labelEn: 'Warm Marble Luxury',
    description: 'درجات رخام كريمية فاخرة وناعمة تمنح إحساساً بالفخامة الهادئة — تدرّج CSS خالص بلا صورة.',
    previewUrl: '',
    imageUrl: '',
    cssBackground: 'linear-gradient(135deg, #fdfbf7 0%, #f3ede3 40%, #e8ddd0 70%, #f5f0e8 100%)',
    overlayLight: 'rgba(255, 255, 255, 0.90)',
    overlayDark: 'rgba(2, 6, 23, 0.93)'
  }
};

export function isValidBackgroundPreset(key: any): key is BackgroundPresetKey {
  return typeof key === 'string' && key in BACKGROUND_PRESETS;
}
