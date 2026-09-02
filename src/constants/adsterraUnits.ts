/**
 * كتالوج وحدات Adsterra الحقيقية المرسلة من المالك مباشرة (لوحة
 * literium.ai.studio على Adsterra) — أكواد ثابتة في الشيفرة، وليست حقلاً
 * يُلصق يدوياً في لوحة الأدمن (كان هذا القيد السابق: مربع لصق واحد فقط
 * لكل الشبكة، فلا يمكن استخدام أكثر من مقاس واحد في آن).
 *
 * كل الوحدات هنا من نوع "Banner" (تنسيق `iframe` ثابت المقاس عبر
 * `atOptions`) أو "Native Banner" (شبكة صور مقترحة داخل حاوية div) — وليست
 * من الأنواع المزعجة (Social Bar/In-Page Push/Popunder) التي تغطي الشاشة؛
 * لذلك جميعها آمنة تجربة-مستخدم ومؤهَّلة افتراضياً appSafe عبر
 * `adsterra.appSafe` في لوحة الأدمن (مفتاح واحد يوقفها كلها عن نسخة APK
 * دفعة واحدة عند الحاجة، إضافة إلى مفتاح تفعيل/إيقاف مستقل لكل وحدة).
 */
export interface AdsterraUnit {
  id: string;
  label: string;
  widthPx: number;
  heightPx: number;
  snippet: string;
}

export const ADSTERRA_UNITS: AdsterraUnit[] = [
  {
    id: '160x300',
    label: 'شريط جانبي 160×300',
    widthPx: 160,
    heightPx: 300,
    snippet: `<script>
  atOptions = {
    'key' : '750f3f7da6bb12c0bb3749a1dfb47e2e',
    'format' : 'iframe',
    'height' : 300,
    'width' : 160,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/750f3f7da6bb12c0bb3749a1dfb47e2e/invoke.js"></script>`
  },
  {
    id: '160x600',
    label: 'شريط طويل 160×600',
    widthPx: 160,
    heightPx: 600,
    snippet: `<script>
  atOptions = {
    'key' : '5af425b2959139fbe64cfdf1a3cd7fa0',
    'format' : 'iframe',
    'height' : 600,
    'width' : 160,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/5af425b2959139fbe64cfdf1a3cd7fa0/invoke.js"></script>`
  },
  {
    id: '300x250',
    label: 'مربع متوسط 300×250',
    widthPx: 300,
    heightPx: 250,
    snippet: `<script>
  atOptions = {
    'key' : '52da6e1ab87e40b8f1e3a8b7c19c4dd5',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/52da6e1ab87e40b8f1e3a8b7c19c4dd5/invoke.js"></script>`
  },
  {
    id: '320x50',
    label: 'شريط جوال 320×50',
    widthPx: 320,
    heightPx: 50,
    snippet: `<script>
  atOptions = {
    'key' : '91104547eb3766f79b5d980c3a1c0b3f',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/91104547eb3766f79b5d980c3a1c0b3f/invoke.js"></script>`
  },
  {
    id: '468x60',
    label: 'شريط أفقي 468×60',
    widthPx: 468,
    heightPx: 60,
    snippet: `<script>
  atOptions = {
    'key' : '7c5d724a36c9eefbb28ba1004ebc8bd9',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/7c5d724a36c9eefbb28ba1004ebc8bd9/invoke.js"></script>`
  },
  {
    id: '728x90',
    label: 'شريط عريض 728×90',
    widthPx: 728,
    heightPx: 90,
    snippet: `<script>
  atOptions = {
    'key' : '6a7a8f774ccb9fcb8cde77b43dfff1c3',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://www.highrevenueformat.com/6a7a8f774ccb9fcb8cde77b43dfff1c3/invoke.js"></script>`
  },
  {
    id: 'native_banner',
    label: 'بطاقات صور مقترحة (Native Banner)',
    widthPx: 0,
    heightPx: 240,
    snippet: `<script async="async" data-cfasync="false" src="https://pl31032517.profitableratecpmnetwork.com/44873569efe1495c898068e4aecde4e9/invoke.js"></script>
<div id="container-44873569efe1495c898068e4aecde4e9"></div>`
  }
];

/** خريطة تفعيل افتراضية: كل الوحدات مفعّلة إلا إن أوقفها الأدمن صراحة. */
export function defaultAdsterraUnitsEnabled(): Record<string, boolean> {
  return Object.fromEntries(ADSTERRA_UNITS.map((u) => [u.id, true]));
}

/**
 * يختار وحدة واحدة من الوحدات المفعّلة فقط، بإزاحة دوران ثابتة (نفس نمط
 * `slotIndex + rotationSeed` المستخدم في بقية `AdSlot`) — أو null إن أوقف
 * الأدمن كل الوحدات يدوياً.
 */
export function pickAdsterraUnit(
  unitsEnabled: Record<string, boolean> | undefined,
  seed: number
): AdsterraUnit | null {
  const enabled = ADSTERRA_UNITS.filter((u) => (unitsEnabled ?? {})[u.id] !== false);
  if (enabled.length === 0) return null;
  const idx = ((seed % enabled.length) + enabled.length) % enabled.length;
  return enabled[idx];
}
