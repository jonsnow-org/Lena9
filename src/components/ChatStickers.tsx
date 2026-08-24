import React from 'react';

/**
 * ملصقات ليتيريوم المخصّصة — مجموعة أولى بسيطة (تصميم مسطّح، وليس صوراً
 * فوتوغرافية حقيقية؛ هذا قيد واقعي لتوليد الرسوم عبر SVG برمجياً) لوجوه
 * بشرية مبسّطة (ذكر/أنثى) بتعبيرات مزاجية مختلفة، تحمل جميعها لمسة العلامة
 * التجارية (شارة تركوازية صغيرة بحرف "ل" في الزاوية) لتمييزها عن السمايلات
 * القياسية المعروفة. كل الرسوم SVG مضمّنة — بلا أي طلب شبكي أو ملف خارجي.
 */

export type StickerMood =
  | 'happy'
  | 'laughing'
  | 'love'
  | 'wink'
  | 'cool'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'blushing'
  | 'sleepy'
  | 'angry'
  | 'calm';

export interface StickerMeta {
  id: string;
  label: string;
  gender: 'male' | 'female';
  mood: StickerMood;
}

export const CHAT_STICKERS: StickerMeta[] = [
  { id: 'f_happy', label: 'سعيدة', gender: 'female', mood: 'happy' },
  { id: 'm_happy', label: 'سعيد', gender: 'male', mood: 'happy' },
  { id: 'f_laughing', label: 'ضاحكة', gender: 'female', mood: 'laughing' },
  { id: 'm_laughing', label: 'ضاحك', gender: 'male', mood: 'laughing' },
  { id: 'f_love', label: 'معجبة', gender: 'female', mood: 'love' },
  { id: 'm_love', label: 'معجب', gender: 'male', mood: 'love' },
  { id: 'f_wink', label: 'غمزة', gender: 'female', mood: 'wink' },
  { id: 'm_cool', label: 'رايق', gender: 'male', mood: 'cool' },
  { id: 'f_sad', label: 'حزينة', gender: 'female', mood: 'sad' },
  { id: 'm_sad', label: 'حزين', gender: 'male', mood: 'sad' },
  { id: 'f_surprised', label: 'متفاجئة', gender: 'female', mood: 'surprised' },
  { id: 'm_thinking', label: 'يفكر', gender: 'male', mood: 'thinking' },
  { id: 'f_blushing', label: 'خجولة', gender: 'female', mood: 'blushing' },
  { id: 'm_sleepy', label: 'نعسان', gender: 'male', mood: 'sleepy' },
  { id: 'f_angry', label: 'غاضبة', gender: 'female', mood: 'angry' },
  { id: 'm_calm', label: 'هادئ', gender: 'male', mood: 'calm' }
];

const SKIN_TONES: Record<string, string> = {
  f_happy: '#F1C27D', m_happy: '#E8B08A', f_laughing: '#C68642', m_laughing: '#F1C27D',
  f_love: '#E8B08A', m_love: '#C68642', f_wink: '#F1C27D', m_cool: '#8D5524',
  f_sad: '#E8B08A', m_sad: '#F1C27D', f_surprised: '#C68642', m_thinking: '#E8B08A',
  f_blushing: '#F1C27D', m_sleepy: '#8D5524', f_angry: '#E8B08A', m_calm: '#C68642'
};

function HairFemale({ color }: { color: string }) {
  return (
    <path
      d="M10 26c-1-14 9-22 22-22s23 8 22 22c0 4-2 10-2 10s-3-6-4-14c-6 4-14 5-18 3-4-2-8-2-14 2-1-9 3-13 3-13s-8 2-9 12z"
      fill={color}
    />
  );
}
function HairMale({ color }: { color: string }) {
  return <path d="M12 24c-1-12 8-19 20-19s21 7 20 19c0 3-1 6-1 6s-6-9-19-9-19 9-19 9-1-3-1-6z" fill={color} />;
}

function Eyes({ mood }: { mood: StickerMood }) {
  switch (mood) {
    case 'love':
      return (
        <g fill="#e11d48">
          <path d="M20 30c-3-4-9-2-9 2 0 4 5 7 9 10 4-3 9-6 9-10 0-4-6-6-9-2z" />
          <path d="M44 30c-3-4-9-2-9 2 0 4 5 7 9 10 4-3 9-6 9-10 0-4-6-6-9-2z" />
        </g>
      );
    case 'wink':
      return (
        <g stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M17 32c2-2 6-2 8 0" />
          <circle cx="44" cy="31" r="3.4" fill="#1e293b" stroke="none" />
        </g>
      );
    case 'cool':
      return (
        <g>
          <rect x="14" y="27" width="16" height="9" rx="3" fill="#0f172a" />
          <rect x="34" y="27" width="16" height="9" rx="3" fill="#0f172a" />
          <rect x="30" y="30" width="4" height="2" fill="#0f172a" />
        </g>
      );
    case 'sad':
      return (
        <g>
          <circle cx="21" cy="31" r="3.4" fill="#1e293b" />
          <circle cx="43" cy="31" r="3.4" fill="#1e293b" />
          <path d="M17 40c1-2 2-2 3 0" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'surprised':
      return (
        <g fill="#1e293b">
          <circle cx="21" cy="31" r="4.2" />
          <circle cx="43" cy="31" r="4.2" />
        </g>
      );
    case 'sleepy':
      return (
        <g stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M16 31c2-1.5 5-1.5 7 0" />
          <path d="M38 31c2-1.5 5-1.5 7 0" />
        </g>
      );
    case 'angry':
      return (
        <g fill="#1e293b">
          <circle cx="21" cy="32" r="3.2" />
          <circle cx="43" cy="32" r="3.2" />
        </g>
      );
    case 'thinking':
      return (
        <g fill="#1e293b">
          <circle cx="21" cy="31" r="3.2" />
          <circle cx="43" cy="28" r="3.2" />
        </g>
      );
    case 'laughing':
      return (
        <g stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M16 30c2 3 6 3 8 0" />
          <path d="M38 30c2 3 6 3 8 0" />
        </g>
      );
    default:
      return (
        <g fill="#1e293b">
          <circle cx="21" cy="31" r="3.4" />
          <circle cx="43" cy="31" r="3.4" />
        </g>
      );
  }
}

function Eyebrows({ mood }: { mood: StickerMood }) {
  const common = { stroke: '#1e293b', strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mood) {
    case 'angry':
      return (
        <g {...common}>
          <path d="M14 22l10 4" />
          <path d="M50 22l-10 4" />
        </g>
      );
    case 'surprised':
      return (
        <g {...common}>
          <path d="M15 22c3-2 8-2 11 0" />
          <path d="M38 22c3-2 8-2 11 0" />
        </g>
      );
    case 'thinking':
      return (
        <g {...common}>
          <path d="M15 24c3-1 8-1 11 1" />
          <path d="M39 21c3-2 7-1 10 1" />
        </g>
      );
    default:
      return (
        <g {...common}>
          <path d="M15 24c3-1.5 8-1.5 11 0" />
          <path d="M38 24c3-1.5 8-1.5 11 0" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: StickerMood }) {
  switch (mood) {
    case 'happy':
    case 'love':
      return <path d="M20 42c4 5 20 5 24 0" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />;
    case 'laughing':
      return <path d="M18 40c5 8 23 8 28 0" fill="#7f1d1d" stroke="#1e293b" strokeWidth="2.4" />;
    case 'wink':
    case 'cool':
    case 'calm':
      return <path d="M22 42c4 3 16 3 20 0" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />;
    case 'sad':
      return <path d="M22 46c4-4 16-4 20 0" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />;
    case 'surprised':
      return <ellipse cx="32" cy="43" rx="5" ry="6" fill="#7f1d1d" stroke="#1e293b" strokeWidth="2" />;
    case 'angry':
      return <path d="M23 45c4-2 14-2 18 0" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />;
    case 'blushing':
      return <path d="M24 41c3 3 13 3 16 0" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" fill="none" />;
    case 'sleepy':
      return <ellipse cx="32" cy="42" rx="3.4" ry="2.4" fill="#1e293b" />;
    case 'thinking':
      return <path d="M24 43c4 1 12 1 16-1" stroke="#1e293b" strokeWidth="2.6" strokeLinecap="round" fill="none" />;
    default:
      return <path d="M22 42c4 3 16 3 20 0" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
}

function Extras({ mood }: { mood: StickerMood }) {
  switch (mood) {
    case 'blushing':
      return (
        <g fill="#fb7185" opacity="0.55">
          <circle cx="15" cy="38" r="4.5" />
          <circle cx="49" cy="38" r="4.5" />
        </g>
      );
    case 'sleepy':
      return (
        <text x="46" y="18" fontSize="9" fill="#94a3b8" fontFamily="sans-serif" fontWeight="bold">
          zZ
        </text>
      );
    case 'surprised':
      return <circle cx="50" cy="24" r="2.2" fill="#38bdf8" opacity="0.8" />;
    case 'thinking':
      return (
        <g fill="#cbd5e1" opacity="0.9">
          <circle cx="52" cy="16" r="1.6" />
          <circle cx="56" cy="11" r="2.2" />
        </g>
      );
    default:
      return null;
  }
}

/** الشارة التركوازية الصغيرة بحرف "ل" — تمييز ملصقات ليتيريوم عن أي حزمة أخرى. */
function BrandBadge() {
  return (
    <g>
      <circle cx="53" cy="53" r="9" fill="#0d9488" stroke="white" strokeWidth="2" />
      <text x="53" y="57" fontSize="10" fill="white" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
        ل
      </text>
    </g>
  );
}

export const ChatStickerFace: React.FC<{ meta: StickerMeta; className?: string }> = ({ meta, className }) => {
  const skin = SKIN_TONES[meta.id] || '#F1C27D';
  const hairColor = meta.gender === 'female' ? '#3b2415' : '#1c1c1c';
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={meta.label}>
      <circle cx="32" cy="34" r="24" fill={skin} />
      {meta.gender === 'female' ? <HairFemale color={hairColor} /> : <HairMale color={hairColor} />}
      <Eyebrows mood={meta.mood} />
      <Eyes mood={meta.mood} />
      <Mouth mood={meta.mood} />
      <Extras mood={meta.mood} />
      <BrandBadge />
    </svg>
  );
};

export function findStickerMeta(id: string): StickerMeta | undefined {
  return CHAT_STICKERS.find((s) => s.id === id);
}
