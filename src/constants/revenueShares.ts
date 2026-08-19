/**
 * Literium Revenue Sharing Constants
 * Centralized single source of truth for platform vs writer profit splits.
 */

export const REVENUE_SHARES = {
  // 1. Ads inside writer articles: 55% Writer / 45% Platform
  IN_ARTICLE_ADS: {
    WRITER: 0.55,
    PLATFORM: 0.45,
    WRITER_PERCENT: 55,
    PLATFORM_PERCENT: 45,
    LABEL: '55% للكاتب / 45% للمنصة'
  },

  // 2. Ads on writer personal profile page: 50% Writer / 50% Platform
  WRITER_PROFILE_ADS: {
    WRITER: 0.50,
    PLATFORM: 0.50,
    WRITER_PERCENT: 50,
    PLATFORM_PERCENT: 50,
    LABEL: '50% للكاتب / 50% للمنصة'
  },

  // 3. Locked / Premium Articles sales: 85% Writer / 15% Platform
  LOCKED_ARTICLES: {
    WRITER: 0.85,
    PLATFORM: 0.15,
    WRITER_PERCENT: 85,
    PLATFORM_PERCENT: 15,
    LABEL: '85% للكاتب / 15% للمنصة'
  },

  // 4. Platform general ads (Homepage, explore, categories): 100% Platform / 0% Writer
  PLATFORM_ADS: {
    WRITER: 0.00,
    PLATFORM: 1.00,
    WRITER_PERCENT: 0,
    PLATFORM_PERCENT: 100,
    LABEL: '100% للمنصة'
  }
} as const;

// Default AdSense writer split for blended in-article estimates (55%)
export const DEFAULT_WRITER_ADSENSE_SHARE = REVENUE_SHARES.IN_ARTICLE_ADS.WRITER;
export const DEFAULT_PLATFORM_ADSENSE_SHARE = REVENUE_SHARES.IN_ARTICLE_ADS.PLATFORM;
export const DEFAULT_WRITER_SALES_SHARE = REVENUE_SHARES.LOCKED_ARTICLES.WRITER;
export const DEFAULT_PLATFORM_SALES_SHARE = REVENUE_SHARES.LOCKED_ARTICLES.PLATFORM;
