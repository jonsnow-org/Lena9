import { Article } from '../types';

function hashToUnit(seed: number, id: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x85ebca6b);
    h = (h ^ (h >>> 13)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  // (0, 1] — يتفادى log(0)
  return (h + 1) / 4294967297;
}

function recencyWeight(publishedAt: string | undefined, now: number): number {
  const ageHours = (now - new Date(publishedAt || 0).getTime()) / 3_600_000;
  if (ageHours < 24) return 6;
  if (ageHours < 72) return 3;
  if (ageHours < 24 * 14) return 1.5;
  return 1;
}

/**
 * ترتيب عشوائي موزون ثابت لكل بذرة (Efraimidis–Spirakis): نفس البذرة تعطي
 * نفس الترتيب (فلا تقفز البطاقات مع كل إعادة رسم)، وبذرة جديدة عند كل تحديث
 * تعطي ترتيباً مختلفاً فعلاً — مع بقاء الأحدث مرجَّحاً للظهور قرب الأعلى.
 */
export function rotateArticles(articles: Article[], seed: number, now: number = Date.now()): Article[] {
  return articles
    .map((a) => ({ a, key: -Math.log(hashToUnit(seed, a.id)) / recencyWeight(a.publishedAt, now) }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.a);
}

/** أربعة مقالات مميزة تتبدل مع كل تحديث، مختارة من الأعلى تفاعلاً. */
export function pickFeatured(articles: Article[], seed: number, count = 4): Article[] {
  const pool = [...articles]
    .sort(
      (a, b) =>
        (b.viewsCount || 0) + (b.likesCount || 0) * 5 - ((a.viewsCount || 0) + (a.likesCount || 0) * 5)
    )
    .slice(0, Math.max(count * 3, 12));
  return pool
    .map((a) => ({ a, key: hashToUnit(seed + 1, a.id) }))
    .sort((x, y) => x.key - y.key)
    .slice(0, count)
    .map((x) => x.a);
}
