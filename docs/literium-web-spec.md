# Literium — Complete Web App Specification

**Purpose of this document.** This is a from-source, feature-complete specification of the Literium web application (an Arabic-first publishing/social platform), written so that a Kotlin/Android developer with zero prior exposure to the React codebase can rebuild it feature-for-feature. It was produced by reading the entire source tree (not by skimming): `src/App.tsx` (4,694 lines), `src/types.ts`, `src/services/firestoreService.ts` (2,373 lines), `server.ts` (2,851 lines), every file under `src/components/` and `src/components/admin/`, every file under `src/utils/` and `src/constants/`, `src/firebase.ts`, `firestore.rules`, `src/data/translations.ts`, and the supporting `server/*.ts` modules.

**Why this document exists.** A previous attempt to rewrite Literium as a native Kotlin/Flutter app failed because it silently omitted large parts of the product — notifications, follow lists, tweets, the article editor, the entire admin panel — producing an app that looked and behaved like a different, much smaller product. The current production "native" app is in fact a **WebView wrapper** around the live website (see `flutter_app/README.md`), built specifically because the full-native rewrite could not keep pace with the real site's functionality. This document exists to prevent that failure from repeating: it errs heavily on the side of over-specifying rather than omitting anything as "obvious."

---

## Table of Contents

1. [Overview](#1-overview)
2. [Navigation & Information Architecture](#2-navigation--information-architecture)
3. [Authentication](#3-authentication)
4. [Screen-by-Screen Specification](#4-screen-by-screen-specification)
5. [The Ad System](#5-the-ad-system)
6. [Wallet & Payments](#6-wallet--payments)
7. [Messaging (Direct Messages)](#7-messaging-direct-messages)
8. [Tweets](#8-tweets)
9. [Notifications](#9-notifications)
10. [Data Model Reference](#10-data-model-reference)
11. [Backend API Reference](#11-backend-api-reference)
12. [Business Rules & Thresholds](#12-business-rules--thresholds)
13. [Known Intentional Omissions & Findings](#13-known-intentional-omissions--findings)

---

## 1. Overview

### 1.1 What Literium is

Literium ("ليتيريوم") is an Arabic-first (RTL by default) publishing and social platform combining:

- **Long-form articles** (a blog/magazine layer) with a rich in-house editor, AI writing assistance, and optional "locked" (paid, unlockable) articles.
- **Short posts ("tweets")** — a lightweight, X/Twitter-like feed layered on top of the same user base, with its own likes/comments/retweets.
- **A wallet & payments system** — deposits, withdrawals, ad spend, article-sale revenue, and creator payouts, with both a fully-manual admin-approval path and optional automated rails (Stripe, NOWPayments crypto).
- **An advertising system** — advertisers (any registered account) create campaigns that run in 13 named ad slots across the site, under a strict global per-page cap, with anti-fraud protection and transparent revenue sharing with writers.
- **Direct messaging (DMs)** between users, with presence, typing indicators, stickers, blocking, muting, and reporting.
- **KYC (identity verification)** — required before a creator can receive real monetized earnings, using AI (Gemini vision) document analysis with human admin fallback.
- **A single unified admin panel** — not a separate app, but a tab embedded inside the normal user-profile view for accounts with `role === 'admin'` — covering overview analytics, finance, ads, content moderation, fraud, users, chats, publishing bots, and site settings.
- **AI features** — a chat assistant, an image-generation "studio," and various writing aids (SEO helper, title/tag suggestions), gated behind daily/lifetime free quotas with optional paid subscription tiers.
- **A publishing-bots subsystem** — 8 fixed AI-persona "writer" accounts that auto-publish content daily via a GitHub-Actions cron job, to keep the platform populated with content and cross-engagement.

### 1.2 Technology stack (for context, not to be replicated 1:1 in Kotlin)

- **Frontend:** Vite + React + TypeScript SPA, Tailwind CSS, `lucide-react` icons, RTL-first layout (`dir="rtl"` is the default document direction).
- **Backend-as-a-service:** Firebase Authentication (Email/Password) + Firestore (NoSQL document database) for almost all reads and client-driven writes, governed by `firestore.rules` (532 lines) as the authoritative access-control and business-rule layer.
- **Custom backend:** A single Express server (`server.ts`, 2,851 lines) handles everything that must not run in an untrusted client: Firebase Admin SDK–privileged writes (financial approvals, balance adjustments), Stripe/NOWPayments integration, Cloudinary media upload signing, Gemini AI calls, KYC document analysis, social-verification (Telegram/YouTube) callbacks, and analytics aggregation.
- **Media/storage:** Cloudinary (not Firebase Storage) for all uploaded images/videos/KYC documents, because Firebase Storage is not available on the project's plan.
- **AI:** Google Gemini — `gemini-3.7-flash` for text/chat/SEO/bot content, `gemini-3.1-flash-image` (with `gemini-3.1-flash-lite-image` fallback) for image generation, and Gemini vision for KYC document analysis.

### 1.3 The unified capability-based account model (critical concept)

There is **no rigid "reader vs. writer vs. advertiser" role split** in the sense of separate apps or separate registration flows. Any registered account can, at any time and without needing "upgrade" approval:

- Read and comment on articles and tweets.
- **Write and publish articles** (the article editor is available to every logged-in account, not gated behind a "become a writer" application).
- **Post tweets.**
- **Create ad campaigns** (become an "advertiser" for that campaign) — again, no separate application process; anyone with wallet balance can fund a campaign.
- Message other users, follow/be followed, bookmark, etc.

The stored `role` field on the `User` document (`'reader' | 'writer' | 'admin'`) is largely a legacy/display label and does **not** gate these actions. What *does* gate real monetized earnings is a separate, independently-computed **monetization/creator eligibility** gate (see §12.4) — an account can write and publish freely, but its article-ad and locked-article earnings are only actually credited once it passes 5 concrete criteria including mandatory KYC. This decoupling — "anyone can do everything, but only eligible+verified accounts get paid" — is the single most important architectural fact to preserve in the Kotlin rewrite. Do NOT model this as three separate app modes/roles; model it as one unified account with an eligibility flag.

### 1.4 Arabic-first / RTL

The entire UI defaults to Arabic and right-to-left layout. A `LanguageCode` type (`'ar' | 'en' | 'fr' | 'es' | 'zh'`) and a small translation dictionary (`src/data/translations.ts`, 446 lines) exist, but **the overwhelming majority of visible UI text is hardcoded Arabic strings directly in JSX**, not routed through the `t()` translator function. Only a minority of strings (menu labels, a few buttons) are actually translated when the language is switched. This is an important, deliberate-but-incomplete state to note: the Kotlin app should not assume full i18n coverage exists to mirror — it mostly doesn't. Arabic text search additionally uses a normalization utility (`arabicSearch.ts`) that does NFKC normalization, strips tashkeel (diacritics), and unifies alef/ya/ta-marbuta variant forms, because naive substring matching silently fails on common Arabic spelling variants — any search feature in the Kotlin app must replicate this normalization or search will feel broken for Arabic users.

---

## 2. Navigation & Information Architecture

### 2.1 Top-level shell

The app is a single-page app with no traditional URL-routed pages for most content — navigation is driven by React state (a `currentView`/`activeTab`-style state machine in `App.tsx`), not `react-router`. The persistent chrome consists of:

- **`SplashScreen`** — a one-time animated splash (moon/stars/orbiting rings, ~3.2s, with a soft procedurally-generated ambient tone via Web Audio API) shown on cold app load, dismissible early by tapping. Purely cosmetic; not a gate.
- **`TopHeader`** — sticky top bar. Contains: hamburger menu button (opens `DrawerMenu`), brand logo/name (tapping scrolls to top / returns to landing), a live clock showing Turkey + Syria time (`LiveClock`, updates every second, isolated locally so it doesn't re-render the whole app tree), a pulsing green "live" status dot (`LiveStatusDot`, pure CSS, no JS timer), and — **for admin accounts only** — a notification bell with unread badge (regular users get notifications via the bottom nav instead, to avoid duplicating the button). Guests see a "Login" button here instead of the notification bell.
- **`BottomNav`** — sticky bottom navigation bar (mobile-first), the primary way most users move between top-level sections. Exact tab set depends on auth state (see §2.2).
- **`DrawerMenu`** — a slide-in side drawer (opened from the hamburger button) that holds secondary navigation: language switcher, theme (light/dark) toggle, AI Assistant entry point, Wallet entry point, profile shortcut, legal pages, and (for admins) a shortcut into the admin dashboard. This absorbed several buttons that used to live in the top header, specifically to avoid clutter/duplication on small screens.
- **`SiteFooter`** — appears at the bottom of scrollable content areas (not fixed). Contains the platform name/tagline and links to Privacy Policy, Terms of Use, About, Contact. A code comment explicitly flags this footer as **mandatory for Google AdSense approval** — it must never be removed or hidden in any rewrite.
- **Floating action buttons** — a "start writing" (article composer) floating button and a "scroll to top" floating button, both anchored near the bottom of the viewport (`bottom-20`/`bottom-24`), positioned to avoid the `AppUpdateWidget` (see below) which deliberately sits higher (`bottom-36`/`bottom-40`) to avoid overlapping them.
- **`AppUpdateWidget`** — a floating widget, mounted as a sibling of the main `App` component (so it renders above it but below actual modals, `z-40`). Polls `/version.json` (cache-busted) every 5 minutes and on tab-visibility-change; compares the returned build id against a build id baked into the client bundle at build time (`__APP_BUILD__`). If different, shows an "Update" button that simply does `window.location.reload()` (no service-worker logic — static assets are content-hashed by Vite so a reload is sufficient). Inside the installed native WebView app, only the "Update" button shows (and only when an update is actually available); in a normal browser, a persistent "Download App" button (linking to `/downloads/Literium.apk`) always shows too.

### 2.2 Bottom navigation tabs

The exact tab set adapts to whether the user is a guest or logged in, but the general set of top-level destinations reachable from the bottom nav / drawer includes:

- **Home / Feed** — toggles between two feed modes via `HomeFeedModeSwitcher`: **"المدونة" (Blog)** mode showing the article feed, and **"تغريد" (Tweet)** mode showing the tweet feed. This is a single switcher control (two pill buttons, active one fully colored, inactive one shown in a lighter tint of the same color — both always show icon+label, never collapse to icon-only) — not two separate nav destinations.
- **Explore** (`ExploreView`) — discovery surface for articles/writers/categories (see §4).
- **Compose / Write** — opens either the article editor or the tweet composer.
- **Notifications** — opens `NotificationsModal` (regular users; admins use the header bell instead).
- **Messages** — opens `DirectMessagesModal`.
- **Profile** — opens the current user's own `UserProfileView`, which is also the entry point to the embedded admin dashboard for admin accounts.

Guests (`currentUser.id === 'guest'` / not authenticated) can still browse Home, Explore, and read articles/tweets, but write/compose/messages/notifications actions are gated behind `AuthModal`.

### 2.3 Landing page

`LandingPage` is a distinct marketing/entry surface (separate from the logged-in home feed) shown to first-time or logged-out visitors, and reachable again later by tapping the brand logo. It is the "return to the very top / reset" destination.

### 2.4 Legal / static pages

`LegalPages` (a full-page, not modal, surface with in-page section tabs: Privacy / Terms / About / Contact) and `PoliciesModal` (a modal variant with 3 tabs: Privacy / Terms-and-revenue-model / Prohibited-content-policy) both exist and both render real legal Arabic text — including the exact revenue-share and payout numbers pulled live from the same constants used elsewhere (`REVENUE_SHARES`, `MIN_PAYOUT_USD`, `EARNINGS_HOLD_DAYS`), so the legal text never drifts out of sync with actual business logic. These are reachable from `SiteFooter` and from the drawer menu.

---

## 3. Authentication

### 3.1 Actual mechanism: Email/Password (⚠️ correction to initial brief)

**Important correction:** the task brief that initiated this research assumed sign-in was "Google-only." That is **not** what the current codebase does. Verified via full read of `src/firebase.ts`, `AuthModal.tsx`, and a repo-wide grep for call sites:

- The live, functioning sign-in method is **Firebase Email/Password Authentication.**
- Google Sign-In client code (`onGoogleSignIn`, Google identity helpers in `src/utils/googleIdentity.ts`) still exists in the codebase, but **zero UI call sites invoke it** — a `grep` for `onGoogleSignIn(` across all of `src/` returns no matches from any component. `AuthModal.tsx` additionally contains an explicit developer comment stating Google sign-in was intentionally removed ("`// Google sign-in removed (see note above the old button location)`"). It is dead code, not a working feature.
- `googleIdentity.ts`'s Google OAuth helper is actually still used for one narrow, unrelated purpose: obtaining a read-only YouTube OAuth token for the **social-follow verification** feature inside ad campaigns (§5.9), not for signing into Literium itself.

**Conclusion for the Kotlin rewrite:** implement Email/Password as the real, sole interactive sign-in method (with the password-reset-by-email flow described below). Do not build a Google Sign-In button as a primary auth path — if desired for parity it would be new scope, not a port of existing behavior.

### 3.2 Registration flow (`AuthModal`)

`AuthModal` is a single modal with a login/register mode toggle. Registration fields include: display name, username (unique, used in profile URLs/mentions), email, password, and (implicitly) it creates a `User` document with default `role: 'reader'`-equivalent capabilities — but again, this is not a hard gate; the same account can write, tweet, and advertise immediately after registering. There is **no separate "register as a writer" vs "register as a reader" flow** — one registration form for everyone, consistent with the unified capability model in §1.3.

New accounts start with:
- `walletBalance: 0`, `pendingEarnings: 0`, `availableBalance: 0`, `lifetimeEarnings: 0`.
- Not KYC-verified.
- Account-age clock starts immediately (used later by the 14-day creator-eligibility threshold).
- `isBot: false` (only the 8 fixed publishing-bot accounts have `isBot: true`).

### 3.3 Session handling

Firebase Auth's own session persistence is used (the SDK's default local persistence — the user stays logged in across browser restarts on the same device/browser profile until explicit logout). `App.tsx` subscribes to `onAuthStateChanged` once at startup; this listener is the **sole** source of truth for `currentUser` — there is no separately-maintained mock/demo default user (a code comment in `App.tsx` explicitly notes that mock users used to leak into live state, letting any guest appear as an already-authenticated fake writer with full dashboard access, and that this was fixed by starting `users` state empty and populating `currentUser` only from the real Firebase listener).

An **anonymous guest session** is also supported (Firebase Anonymous Auth) so that unauthenticated visitors still have a Firebase-backed identity for read-only browsing and for actions like ad-impression logging; several features explicitly check `auth.currentUser?.isAnonymous` and block reward-bearing actions (e.g., social-follow-verification payouts, §5.9) for anonymous sessions even though the click/action itself is still recorded.

### 3.4 Password reset

Handled via Firebase's standard out-of-band (`oobCode`) email link flow: `firebase.ts` exposes `verifyResetCode(oobCode)` and `confirmNewPassword(oobCode, newPassword)`. When the app loads with `?mode=resetPassword&oobCode=...` in the URL (the link Firebase emails the user), a dedicated **`ResetPasswordModal`** opens automatically — deliberately separate from `AuthModal` because its context is different (user arrives from their email inbox, not from inside the app). Flow: verify the code (shows a spinner while verifying, displays the associated email once verified, shows a clear error if the link is invalid/expired) → new-password + confirm-password fields (minimum 6 characters, must match) → submit → success screen with a "Log in now" button that hands off to the normal login flow.

### 3.5 KYC as a downstream gate, not an auth gate

KYC verification (§6.6 / §12.4) is **not** required to register, log in, write, or publish. It is only required to actually receive credited monetized earnings. This is a deliberate product decision — do not implement KYC as a blocking step in the registration/login flow.

---

## 4. Screen-by-Screen Specification

This section enumerates every screen and modal, its purpose, its key UI elements, and its primary interactions/handlers. Component file names are given in parentheses for traceability back to source.

### 4.1 Home Feed (Blog mode)

- Shows `HomeFeedModeSwitcher` at top to toggle Blog/Tweet mode.
- **`FeaturedArticlesSection`** — horizontal snap-scroll carousel of up to 4 "featured" articles (currently just the first 4 in the loaded list, badge "مختار للتحرير" / "editorially chosen"), rich cards with category badge, lock/price badge if the article is a paid locked article, publish date overlay, author row, bookmark button, "read now" CTA.
- **`TrendingArticlesSection`** — a 4-item ranked grid, client-side sorted by `viewsCount` descending, numbered rank badges (gold/silver/bronze/teal for #1–4), compact author+view-count footer.
- **Main article feed** — a grid/list of `ArticleCard` components (see below), infinite-scroll or paginated (exact mechanism lives in `App.tsx`'s data-loading logic), with a loading-state `ArticleCardSkeleton` (pure CSS `animate-pulse` placeholders matching the real card's layout exactly, shown while articles are loading) rendered in place of real cards.
- **`ArticleCard`** (the atomic article-preview unit used across Home, Explore, writer profile, search results):
  - Cover image with category badge (top-left) and either a "قراءة مجانية" (free) badge or a gold "مقال حصري (${price}$)" (exclusive/locked) badge (top-right).
  - Publish date+time overlay on the image (bottom-left).
  - Author row: avatar, name, verified checkmark if `writerIsVerified`, relative publish date, and an optional Follow/Following toggle button.
  - Title (2-line clamp), description (2-line clamp).
  - Footer metrics: views, likes, comments counts (Arabic-locale formatted numbers), a bookmark toggle button, and a "read now" CTA button.
  - 15 category values are supported with distinct Arabic labels: `literature, technology, history, philosophy, business, science, health, arts, politics, education, beauty_fashion, sports, food, travel, family` (+ generic "عام" fallback).

### 4.2 Home Feed (Tweet mode)

Switches the same screen's content area to `TweetFeed` (see §8) while keeping the mode switcher and surrounding chrome.

### 4.3 Explore (`ExploreView`)

Discovery surface — browsing by category, searching articles/writers (using the Arabic-normalized search utility), and surfacing writer profiles. Functions as the "browse everything" screen distinct from the personalized/chronological home feed.

### 4.4 Article Reader (`ArticleReader`, 1,120 lines)

The full article detail/reading screen. Responsibilities:
- Renders full article body (rich text/HTML from the editor).
- Handles the **locked-article paywall**: if `article.isLocked` and the current user hasn't purchased/unlocked it, shows a paywall overlay with price and an "unlock" CTA that triggers the wallet purchase flow (deducts from `walletBalance`, credits the writer's `pendingEarnings` at the 85%/15% split, see §12.2).
- Like button (optimistic update with rollback on Firestore failure — the pervasive pattern used across the whole app: UI updates instantly, then the write is attempted, and if it fails the local state is rolled back and an error surface is shown).
- Bookmark/save toggle.
- Follow/unfollow the author inline.
- Comment thread: top-level `Comment`s each with nested `CommentReply` replies, posting, (admin) deletion.
- Rating system (star rating on articles).
- View counting — articles track `viewsCount`; a "valid view" distinction feeds into both trending sort and the creator-eligibility ≥1000-valid-views threshold (§12.4) and into ad viewability-gated revenue.
- Embeds: in-article ad slots (see §5), and optional embedded video (`VideoEmbed`, YouTube/Vimeo iframe embed with a reserved 16:9 aspect box to prevent layout shift; explicitly does not autoplay or unmute without user interaction).
- Author card / writer-profile shortcut and "more from this writer" section.
- Share and report actions.

### 4.5 Article Editor (`ArticleEditorModal`, 1,135 lines)

The full authoring tool, available to any logged-in account (§1.3). Key capabilities:
- Title, description/excerpt, category picker (15 categories), featured image upload (`MediaUploadInput`, image mode).
- Rich body editor.
- **Locked/paid article toggle**: writer sets `isLocked` + `lockedPrice` (a suggested/valid range is guided by `SmartAiGuidanceCard` in `article_editor` context: $1.50–$3.50 sweet spot messaging, tied live to `REVENUE_SHARES.LOCKED_ARTICLES.WRITER_PERCENT`).
- Optional embedded video via `VideoUrlInput` (YouTube/Vimeo link parsing + validated preview) — explicitly NOT file upload for video-in-article (only ad creatives support direct video file upload; article video is link-embed only, to avoid storage cost).
- **7 AI-assisted writing tools** integrated into the editor (exact tool surface — confirmed present: content generation/continuation, SEO suggestions, title suggestions, tag/category suggestion, tone/style rewriting, summary/description generation, and grammar/proofreading-style assistance), all backed by the server's Gemini text endpoint and metered against the user's daily AI quota (§12.5).
- Draft save vs. Publish actions; publishing triggers notification fan-out to followers (§9) and, for eligible+KYC-verified writers, makes the article eligible for ad revenue attribution.
- `SmartAiGuidanceCard` (`article_editor` context) surfaces monetization tips inline (ideal word count ~700+ words for better ad-view retention, pricing guidance for locked articles, title/keyword tips for trending).

### 4.6 Image Studio (`ImageStudioModal`, 531 lines)

AI image generation tool (for featured images, ad creatives, etc.): text-prompt → Gemini image generation (`gemini-3.1-flash-image`, falling back to `gemini-3.1-flash-lite-image` on failure/unavailability), metered against a separate lifetime free-image quota (3 lifetime free images per user, then subscription-gated, §12.5). Generated images are then usable directly as featured images / campaign creatives.

### 4.7 KYC Modal (`KycModal`)

Identity-verification flow:
- User uploads a photo of an identity document.
- Client sends it to the server, which stores the raw image in a **separate, admin-only Firestore collection (`kycDocuments`)** — never in the public-readable `users` collection — using Cloudinary's "authenticated" (non-public) upload type, so document images are never publicly reachable; access requires the server to mint a short-lived signed URL on explicit admin request.
- Server runs Gemini-vision analysis, extracting the name on the document and comparing it against the account's registered display name.
- **High-confidence match → auto-approved immediately** (`kycStatus` flips to verified without human involvement).
- **Anything less than high confidence → queued for human admin review** (appears in `KycReviewModal` inside the admin panel, §4.19).
- The modal communicates current status (`not_started / pending / verified / rejected`) and next steps at each stage.

### 4.8 Wallet Modal (`WalletModal`, 871 lines)

The financial hub — see full detail in §6. Screen shows: current `walletBalance` (spendable), `availableBalance` (withdrawable, post-hold), `pendingEarnings` (frozen, in the 30-day hold), `lifetimeEarnings` (cumulative stat, never decreases); deposit action; withdrawal/payout request action; transaction history; and, when Stripe/NOWPayments are configured, one-click automated deposit/payout buttons alongside the manual-request fallback.

### 4.9 Money Request Modal (`MoneyRequestModal`, 347 lines)

The manual deposit/withdrawal request form used when automated payment rails are not available/chosen (always available as a fallback even when they are). Fields: amount (min enforced, `minAmount` prop — tied to `MIN_PAYOUT_USD`), method selector (grid of method chips — bank wire / USDT / Stripe / PayPal-style options depending on context), and either:
  - **Deposit path**: a free-text "transaction/transfer reference number" field (the user pastes the reference from their own external transfer for the admin to verify).
  - **Withdrawal path**: a free-text "receiving details" field (account number or wallet address).
- Inline disclosure box: "Deposit/withdrawal requests are manually reviewed by platform admins within 24–48 hours"; for withdrawals it additionally reminds the user that earnings stay frozen for 30 days from when they were recorded before becoming withdrawable.
- Below the form: the user's own last 5 requests with status chips (Pending / Approved / Paid / Rejected).

### 4.10 Advertiser Dashboard (`AdvertiserDashboard`, 367 lines)

A self-serve dashboard any account sees once it has created at least one ad campaign (there is no separate "advertiser account type" — see §1.3). Three sub-tabs:
1. **Campaigns** — list of the user's own campaigns as cards: image, name, status chip (Active 🟢 / Paused ⏸️ / Completed), pricing-model chip (Fixed-duration / CPM / CPC), placement chip (platform-wide 100%-platform-revenue vs. in-writer-articles revenue-shared), ad text preview, live metrics (impressions, clicks, spend/budget), a fraud-blocked-clicks counter when > 0 ("🛡️ blocked N suspicious clicks"), pause/resume toggle, destination-URL preview link, delete button.
2. **Analytics & Anti-Fraud** — an explanatory panel (not raw logs) describing the three protection layers in effect: viewability requirement (50% on-screen for 1 continuous second before a CPM impression counts), anti self-click (instant block of clicks from the article's own author on their own in-article ads), and bot/rapid-click detection (clicks within the first ~1.5 seconds of page load are excluded).
3. **Billing** — current advertiser balance display and a "top up now" button opening the deposit flow (cards, Apple Pay, USDT TRC20 messaging), with a note that spend is deducted automatically per confirmed-valid impression/click.

### 4.11 New Campaign Modal (`NewCampaignModal`, 681 lines)

Campaign-creation wizard covering: campaign name, ad text/creative (image via `MediaUploadInput`, or short video ≤60s/50MB for ad creatives specifically), destination URL, **pricing model choice** (Fixed-duration flat fee / CPM per-1000-impressions / CPC per-click — each with `SmartAiGuidanceCard` in `campaign_creation` context explaining when to pick which), **placement choice** (platform-wide slots vs. in-article slots — which determines the revenue-share table applied, §5.6/§12.2), budget/duration inputs, and — for the special **social-follow-promotion** campaign type — a `promotionKind` selector (`youtube | telegram | instagram | twitter | facebook | website`) feeding into `SocialPromoCta` (§4.11a) instead of a generic click-through.

### 4.11a Social Promo CTA (`SocialPromoCta`)

Rendered inside an ad unit when `campaign.promotionKind` is a social-platform value. Always logs the click-through honestly for every platform. For **Telegram and YouTube only**, additionally offers a **real verification path** (the only two platforms with a free API path available to a small app): Telegram via a mounted Telegram Login Widget + server verification of channel membership; YouTube via a read-only OAuth token + server verification of subscription. A genuine reward (`SOCIAL_VERIFIED_ACTION_REWARD_USD`) is credited to the *promoted account's* pending earnings only after real server-side verification succeeds — and only for registered (non-anonymous-guest) sessions; guests are shown a "register to earn $X" prompt instead of being allowed to attempt verification. For Instagram/X/Facebook — which have no free verification API available — the UI deliberately shows an honest neutral message ("your visit was recorded — please actually follow through") rather than fabricating a "strict verification system," a deliberate anti-dishonesty design choice documented in an inline code comment.

### 4.12 Promote Article Modal (`PromoteArticleModal`)

A lighter-weight promotion flow specifically for boosting an already-published article's visibility (distinct from the general ad-campaign system) — creates an `ArticlePromotion` record.

### 4.13 Subscription Modal (`SubscriptionModal`, 865 lines)

AI-feature subscription upsell/management: shows current quota usage (chat messages used/limit, images used/limit), free-tier limits (10 chat messages/day, 3 lifetime images), and two paid tiers — **Monthly ($9.99, 200 uses)** and **Annual ($79.99, unlimited)** — with plan comparison and upgrade CTA (payment handled via whatever payment rail is configured, falling back to manual request if none is).

### 4.14 AI Assistant Modal (`AiAssistantModal`)

General-purpose chat assistant (Gemini `gemini-3.7-flash`), reachable from the drawer, metered by the same daily-quota system as the editor's AI tools.

### 4.15 Direct Messages Modal (`DirectMessagesModal`, 888 lines)

Full DM inbox and thread view. See full detail in §7.

### 4.16 Notifications Modal (`NotificationsModal`)

Chronological list of `AppNotification` records for the current user (see full type list and triggers in §9), with read/unread state, mark-all-read, and tap-through to the relevant target (article, profile, conversation, etc.).

### 4.17 Follow List Modal (`FollowListModal`)

Shows a user's followers or following list (toggle between the two), each row tappable through to that user's profile, with an inline follow/unfollow button per row. This is one of the screens explicitly called out in the task brief as previously silently omitted — must not be skipped.

### 4.18 Tweet Composer & Tweet Card/Feed (`TweetComposer`, `TweetFeed`, `TweetCard`)

Short-post authoring and display — see §8 for full detail.

### 4.19 User Profile View (`UserProfileView`, 1,690 lines — the largest and structurally most important screen)

This single component serves **both** the normal profile screen **and**, for admin accounts, embeds the entire admin dashboard as an internal tab set. Structure:
- **Header**: cover/avatar, display name, verified badge, bio, follower/following counts (tap-through to `FollowListModal`), join date, Follow/Message/More-actions buttons (when viewing someone else), Edit-profile button (when viewing self).
- **Tabs** (for a normal profile): Articles authored, Tweets posted, Liked content, Saved/bookmarked (self only).
- **Creator eligibility card** (`CreatorEligibilityCard`) — shown on the self-profile / writer-studio context. If not yet eligible, shows a 2×2 grid of the 4 stat requirements (followers, valid views, account age, published articles) each with a met/unmet checkmark and a live "X/threshold" counter, plus a separate KYC row with a "Verify now" shortcut — all sourced from one shared `getCreatorEligibility()` computation so no screen can show conflicting numbers. If eligible, shows a single congratulatory "Verified Content Creator" card instead.
- **Admin dashboard tabs** (visible only when `currentUser.role === 'admin'`, rendered inline within this same view rather than as a separate route): Overview, Finance, Ads, Content, Fraud, Users, Chats, Bots, Settings — see §4.20 onward.

### 4.19a Edit Profile Modal (`EditProfileModal`) & Social Links Editor (`SocialLinksEditor`)

Standard profile editing (name, bio, avatar upload) plus a dedicated editor for the user's public social links, which is what powers their own outbound social presence on their profile (separate from the ad-campaign social-promotion feature in §4.11a).

### 4.20 Admin — Overview Tab (`AdminOverviewTab`)

High-level KPI cards: total users, new signups today/this-week, active ad campaigns count vs. total banners, article counts, deposit/withdrawal request counts (approved vs. pending), publishing-writers count vs. total writer-role accounts, locked-article count. All figures are computed live from loaded Firestore collections, not cached snapshots.

### 4.21 Admin — Analytics Tab (`AdminAnalyticsTab`, 809 lines)

Four sub-tabs:
1. **Overview** (visual charts) — a 24-hour traffic curve rendered as a pure-CSS bar chart (two bars per 2-hour bucket: views vs. unique visitors, with hover tooltips), plus device-breakdown bars (Mobile/Desktop/Tablet percentages) and a registered-user role composition breakdown (Readers vs. Writers vs. etc. counts).
2. **Visitors Stream** — a real visit log (not simulated) sourced from server-side analytics (`summary.recentVisits`).
3. **Signups Log** — chronological registration log.
4. **Content & Ads performance** — article/ad performance cross-view.

This tab's data comes from the real `/api/analytics/*` server endpoints (§11), backed by `services/analyticsApi.ts` — **not** from the legacy `src/utils/trafficTracker.ts` module, which is confirmed dead code (see §13).

### 4.22 Admin — Finance Tab (`AdminFinanceTab`, 784 lines)

The financial control center: lists all pending deposit and withdrawal requests with approve/reject actions (server-authoritative, Admin-SDK-backed, idempotency-guarded against double-approval via the `processingRequestIdsRef` client guard plus server-side atomic transactions), the manual "process ad events" trigger (runs `evaluateAdEventBatch` fraud filtering over recently logged ad impressions/clicks and converts valid ones into actual revenue splits per §12.2), and the 30-day earnings-hold release mechanism (admin can review and release matured `pendingEarnings` into `availableBalance` for eligible accounts once `EARNINGS_HOLD_DAYS` have elapsed). Also embeds `BalanceAdjustModal` for direct manual balance corrections (with mandatory reason/audit note).

### 4.23 Admin — Ads Tab (`AdminAdsTab`, 733 lines)

Ad-slot and campaign administration across the whole platform (not just one advertiser's own campaigns as in `AdvertiserDashboard`): view/pause/delete any campaign, view slot-level configuration and fairness/rotation stats, review the anti-fraud engine's flags.

### 4.24 Admin — Content Tab (`AdminContentTab`)

Article/tweet moderation: view, unpublish/delete, or feature content platform-wide.

### 4.25 Admin — Fraud Tab (`AdminFraudTab`)

Review surface for `FraudFlag` records raised by either the client-side `AntiFraudEngine` or the server-side `evaluateAdEventBatch` filters.

### 4.26 Admin — Users Tab (`AdminUsersTab`)

User management: search/list all accounts, view role, KYC status, ban/suspend, manually adjust `role`, trigger `BalanceAdjustModal`.

### 4.27 Admin — Chats Tab (`AdminChatsTab`)

Oversight of reported DM conversations/`MessageReport` records (moderation of user-to-user messaging abuse).

### 4.28 Admin — Bots Tab (`AdminBotsTab`)

Management surface for the 8 fixed publishing-bot personas — view their recent auto-published content, engagement stats, and (implicitly) configuration, though the actual daily publish cycle itself is triggered externally by a GitHub Actions cron job hitting a shared-secret-protected server endpoint, not from this tab directly.

### 4.29 Admin — Settings Tab (`AdminSettingsTab`)

Site-wide settings, most notably the **live theme system**: 11 selectable color presets (OKLCH-based color scales) and 9 selectable background presets (each either an image or a CSS gradient, with separate light/dark overlay-opacity tuning), both written to a single Firestore `settings/theme` document and synced instantly to every connected client (all users see admin theme changes live, without a refresh or redeploy) via a Firestore real-time listener (`themeEngine.ts`).

### 4.30 KYC Review Modal (`KycReviewModal`)

Admin-side manual KYC review queue item: shows the applicant's registered name, the extracted document data from the Gemini analysis, a signed short-lived URL to view the actual document image (requested on-demand, never publicly cached), and Approve/Reject actions.

### 4.31 Balance Adjust Modal (`BalanceAdjustModal`)

Generic admin tool to directly credit/debit a specific balance field (`walletBalance` / `availableBalance` / `pendingEarnings`) on any user, with a required reason field for audit purposes — used both standalone (Users tab) and from within Finance tab flows.

### 4.32 Beta Testing Modal (`BetaTesting20Modal`)

A Google-Play-closed-testing tester-feedback collector: shows progress toward the "20 testers" requirement Google Play imposes for closed testing (a progress bar, simulated/local counter incremented on each submission), a feedback form (tester name, device model, 1–5 star rating, free-text feedback), and a thank-you state with a confetti animation on submit. This is compliance-process tooling, not a core product feature, but must be preserved since it gates the app's Play Store release process.

### 4.33 Policies / Legal (see §2.4)

Already described above; repeated here only to confirm both `LegalPages` (full-page) and `PoliciesModal` (modal) variants exist and both must be preserved (they're used in different entry contexts).

---

## 5. The Ad System

This is one of the most intricate subsystems and must be replicated carefully — it directly drives writer and platform revenue.

### 5.1 Ad slots

There are **13 named ad slots** (`AdSlotId` type), each with a configuration entry (`beneficiary`, `writerShare`, `sponsorOnly`, `internalPriority`) describing: who financially benefits from a fill in that slot (the platform globally, vs. whichever writer's article/profile the slot is embedded in), what share of revenue goes to the writer for that slot type, and whether the slot only accepts internally-sold Literium campaigns (vs. also accepting external ad-network fills).

### 5.2 Global per-page cap

`MAX_ADS_PER_PAGE = 3` — a hard ceiling on the number of ad units allowed to render simultaneously on any single page/view, enforced via a **module-level counter** that is reset on navigation (not a React state value — deliberately kept outside the component tree so it persists correctly across the many independent `AdSlot` instances that might mount on one page without needing prop-drilling a shared counter). This exists to protect user experience and to comply with ad-network policies against excessive ad density.

### 5.3 Fair-rotation pooling

For slots whose beneficiary is the platform (not a specific writer), `AdSlot.tsx` pools together (a) currently-active internal Literium ad campaigns eligible for that slot and (b) external ad-network fills (via `externalAdsStore.ts` / `platformAdsStore.ts`), and rotates fills fairly across the pool rather than always preferring one source — this avoids internal campaigns starving external network revenue or vice versa.

### 5.4 Viewability-gated impression logging

An `IntersectionObserver` watches each rendered ad unit. An impression is only logged once the unit has been **at least 50% visible in the viewport for a continuous 1 second** — this threshold is the same one referenced in the advertiser dashboard's anti-fraud explainer and in `SmartAiGuidanceCard`'s anti-fraud tips (§4.10, §4.32), so it must be implemented identically, not just described identically.

### 5.5 Sandboxed third-party rendering

External ad-network ad units are rendered inside a **sandboxed iframe using `srcdoc`, explicitly without `allow-same-origin`** — isolating third-party ad scripts from the host page's DOM/cookies/storage. `ExternalAdScript.tsx` is the component responsible for this isolation boundary.

### 5.6 Revenue sharing (`REVENUE_SHARES` constant — exact values)

| Ad/sale context | Writer share | Platform share |
|---|---|---|
| In-article ads (ads embedded inside a writer's article) | 55% | 45% |
| Writer-profile ads (ads shown on a writer's own profile page) | 50% | 50% |
| Locked/exclusive article sales (direct purchase) | 85% | 15% |
| Platform-wide ads (homepage, category pages, other platform-owned surfaces) | 0% | 100% |

These exact percentages are referenced live (not hardcoded separately) from the single `REVENUE_SHARES` constants file in at least 4 separate UI locations (`PoliciesModal`, `LegalPages`, `SmartAiGuidanceCard`, `AdvertiserDashboard`) — confirming there is exactly one source of truth for these numbers across the whole app, which the Kotlin app should also centralize.

### 5.7 Anti-fraud — two parallel systems

1. **Client-side `AntiFraudEngine`** (`src/utils/antiFraud.ts`) — used live inside `SmartAdBanner` at the moment of a click/impression to make an immediate accept/reject decision before even sending the event to the server. Enforces: self-click blocking (an article's own author cannot generate revenue by clicking ads on their own article — checked client-side as a first line of defense), rapid-click throttling (clicks in the first ~1.5–2 seconds after page load are treated as accidental/bot and discarded), viewability minimums, and abnormal click-through-rate pattern detection.
2. **Server/admin-side `evaluateAdEventBatch`** (`src/utils/fraudFilters.ts`) — a second, independent pass run from the admin Finance tab's manual "process ad events" action, re-evaluating logged raw events in batch before converting them into actual credited revenue. This is the authoritative, cannot-be-bypassed-by-a-modified-client layer — the client-side engine is a UX/early-rejection optimization, not the security boundary.

Both layers check for the same broad categories (self-click, rapid-click, viewability, CTR anomalies) but are implemented independently and must both be ported — do not assume one client-side check is sufficient; the server-side re-evaluation is what actually gates money movement.

### 5.8 Pricing models

Campaigns choose one of three pricing models at creation (`NewCampaignModal`, §4.11):
- **Fixed duration** — flat fee for a time-boxed placement, no per-impression/click metering.
- **CPM** — billed per 1,000 valid (viewability-gated) impressions.
- **CPC** — billed per valid (fraud-filtered) click.

### 5.9 Social-follow-promotion campaigns

Covered in §4.11a — a special campaign subtype (`promotionKind`) with real verified-follow rewards for Telegram/YouTube only, and honest (non-verifiable) click-recording for Instagram/X/Facebook.

### 5.10 App-wrapper ad safety gate

`installState.ts`'s `isRunningAsInstalledApp()` detection (see §13 for its full mechanism) is also used as a safety gate for ad rendering in certain contexts — an inline comment references an "`appSafe`" gate for ads tied to this same detection function, ensuring ad behavior can differ appropriately between the installed WebView app and the open web (e.g. certain ad-network scripts or interstitial behaviors that would violate app-store ad policy if shown inside the wrapped native app).

---

## 6. Wallet & Payments

### 6.1 The four balance fields (critical — do not conflate)

Every `User` document carries four **distinct** monetary fields, and the Kotlin data model must keep them equally distinct:

| Field | Meaning | Spendable? | Withdrawable? |
|---|---|---|---|
| `walletBalance` | Funds the user has deposited themselves | Yes (ads, unlocking articles, subscriptions) | No — deposits are not earnings, not withdrawable as "payout" |
| `pendingEarnings` | Earnings recorded but still inside the 30-day hold | No | No — frozen until hold expires |
| `availableBalance` | Earnings that have cleared the 30-day hold and been released by an admin | No (this is the withdrawable pool) | Yes |
| `lifetimeEarnings` | Cumulative, monotonically-increasing stat of all earnings ever recorded (for display/stats only) | N/A | N/A — never decreases, not a spendable pool |

### 6.2 Earnings hold/release cycle

`EARNINGS_HOLD_DAYS = 30`. New earnings (from ad revenue splits or locked-article sales) are written into `pendingEarnings`, timestamped. After 30 days have elapsed, they become eligible to be released by an admin (via the Finance tab, §4.22) into `availableBalance`, at which point they become withdrawable via a payout request.

### 6.3 Minimum payout

`MIN_PAYOUT_USD` — a minimum withdrawal-request amount (referenced live in `LegalPages`/`PoliciesModal` as $10, and enforced as the `minAmount` floor in `MoneyRequestModal`'s amount field).

### 6.4 Manual (always-available) flow

Both deposits and withdrawals can always be requested manually regardless of whether automated payment rails are configured: `MoneyRequestModal` (§4.9) collects amount + method + a transfer reference (deposit) or receiving details (withdrawal), creating a pending request document. An admin reviews it in the Finance tab and approves/rejects — approval is what actually moves the balance, performed server-side via Firebase Admin SDK (bypassing client Firestore security rules) inside an atomic transaction, guarded against double-processing both client-side (`processingRequestIdsRef` Set, blocks a second click on the same request id before the UI has re-rendered) and server-side (transaction-level idempotency).

### 6.5 Optional automated rails

- **Stripe** — deposit via Stripe Checkout; payout via Stripe Connect Express (creator onboarding + payout). Availability is checked client-side via `GET /api/payments/status`; if not configured, the UI simply doesn't show the automated buttons and falls back to the manual flow — no broken/dead buttons are shown.
- **NOWPayments** — crypto deposit via a generated invoice, and a direct USDT-TRC20 receiving address option for withdrawals. Availability checked via `GET /api/payments/nowpayments/status`.
- Both integrations use webhook-based confirmation for deposits, with **webhook deduplication** enforced via `paymentWebhookEvents` marker documents in Firestore (each incoming webhook event id is checked/recorded so a retried webhook delivery cannot double-credit a balance).

### 6.6 KYC's role in payments (see also §12.4)

KYC is not required to deposit or spend `walletBalance`. It is a **mandatory prerequisite for monetized-earnings eligibility** — i.e., without KYC verification, an account's ad/article-sale activity does not credit `pendingEarnings` at all, regardless of how the other 4 eligibility stats look. `SmartAiGuidanceCard`'s `wallet_payout` context and `CreatorEligibilityCard` both surface this clearly to the user.

---

## 7. Messaging (Direct Messages)

`DirectMessagesModal` (888 lines) is the full DM system.

- **Inbox**: list of `Conversation` records, each showing the other participant, last message preview, unread indicator, and last-active/online-now presence status.
- **Presence**: a heartbeat is sent roughly every 25 seconds while a tab is visible/foregrounded; elsewhere in the app a **60-second staleness window** is used to decide whether to display a user as "online now" vs. "last seen [time]" — i.e., if the last heartbeat is older than 60 seconds, the user is shown as offline/last-seen rather than online.
- **Thread view**: message history for a `DirectMessage` conversation, with typing indicators, and support for **stickers** (`ChatStickers.tsx` — a picker of predefined sticker images sendable as message content, distinct from plain text).
- **Actions available per conversation/user**: block, mute, and **report** (creates a `MessageReport` record, reviewable in the admin Chats tab, §4.27).
- **Video** inside DMs (e.g., a sent video message) is rendered through the shared `VideoPlayer` component (Cloudinary-optimized `q_auto,f_auto` transform applied automatically when the source is a Cloudinary URL, metadata-only preload).

---

## 8. Tweets

A lightweight short-post layer sharing the same user base and much of the same social graph (follows) as articles, but with its own content type and its own feed:

- **`Tweet`** — short text post (with optional media), belonging to a user, with `likesCount`, and its own comment thread (`TweetComment`, a flatter/simpler structure than the article `Comment`/`CommentReply` nesting).
- **Retweets** are supported (part of the `Tweet` type's fields, per `types.ts`).
- **`TweetComposer`** — the authoring UI (text input, optional media attach, post button) — reachable from the same compose entry point as the article editor, disambiguated by the `HomeFeedModeSwitcher` mode or an explicit compose-type choice.
- **`TweetFeed`** — the reverse-chronological (or algorithmic — exact ordering lives in the data-loading logic in `App.tsx`) list of tweets, rendered via **`TweetCard`** units (avatar, name, verified badge, timestamp, text, media if present, like/comment/retweet action row).
- Tweets participate in the **publishing-bots** daily cycle (§1.1/§12.6) — each bot account publishes exactly one tweet per day alongside its one article.

This entire subsystem was one of the specific features the task brief calls out as previously silently dropped in the failed native rewrite — it is a first-class, fully-functional feature, not an afterthought, and must be built with full parity (composition, feed, likes, comments, retweets) in the Kotlin app.

---

## 9. Notifications

`AppNotification` records are created by numerous handler functions across `App.tsx` (the ~80 mutation handlers referenced in this research) whenever a relevant event occurs. Based on the full read of `App.tsx`'s handlers and `types.ts`'s notification-related fields, notification-triggering events include (non-exhaustive but representative of the pattern used consistently):

- A user's article/tweet receives a like or comment.
- A user gains a new follower.
- A followed writer publishes a new article.
- A direct message is received.
- A KYC submission is approved or rejected.
- A deposit or withdrawal request is approved, rejected, or paid.
- An ad campaign's status changes (e.g., budget exhausted, paused by admin).
- A social-follow-verification reward is credited (§4.11a).
- Admin actions that directly affect a user's account (balance adjustment, ban).

`NotificationsModal` (§4.16) is the read surface for regular users; admins additionally see a header-bell badge (§2.1) since admin-relevant notifications (e.g., new pending KYC review, new pending finance request) need higher visibility than the bottom-nav-buried modal provides for an operationally-critical role. Notifications support a read/unread boolean and mark-all-read.

---

## 10. Data Model Reference

Source: `src/types.ts` (503 lines), read in full. This section reproduces every interface and every field. Arabic inline comments from the source are translated/preserved as explanatory notes where they clarify intent (especially around the wallet fields, which are otherwise easy to conflate).

> **Note on fidelity:** the interfaces below are transcribed field-for-field from `types.ts`. Optional fields are marked `?`. Where the source used a union/enum type inline, the full set of literal values is given.

### 10.1 `LanguageCode`
```ts
type LanguageCode = 'ar' | 'en' | 'fr' | 'es' | 'zh';
```

### 10.2 `UserRole`
```ts
type UserRole = 'reader' | 'writer' | 'admin';
```
Note (§1.3, §3.2): this field is largely a display/legacy label; it does not by itself gate write/publish/advertise actions, which are available to any authenticated account.

### 10.3 `User`
Key fields (grouped by concern):

**Identity & profile:**
- `id: string`
- `username: string` (unique)
- `displayName: string`
- `email: string`
- `avatar: string` (URL)
- `bio?: string`
- `role: UserRole`
- `isVerified?: boolean` (blue-checkmark style verification, distinct from KYC identity verification)
- `isBot?: boolean` — true only for the 8 fixed publishing-bot personas; always excluded from monetization eligibility and from most admin analytics counts regardless of any other stat.
- `createdAt` (timestamp) — account age is computed from this for the 14-day creator-eligibility threshold.
- `socialLinks?` — object of outbound social profile links (edited via `SocialLinksEditor`).

**Social graph counters:**
- `followersCount: number`
- `followingCount: number`
(Actual follow relationships are stored in a separate `follows` collection per Firestore service — these counters are denormalized for display; the *real* eligibility check recomputes from the `follows` collection rather than trusting this counter, per `creatorEligibility.ts`.)

**Wallet fields (see §6.1 for full semantics — do not conflate these four):**
- `walletBalance: number` — spendable, deposit-funded.
- `pendingEarnings: number` — frozen earnings inside the 30-day hold.
- `availableBalance: number` — earnings released after the hold, withdrawable.
- `lifetimeEarnings: number` — cumulative all-time earnings stat, monotonically increasing, not spendable.

**KYC fields:**
- `kycStatus: 'not_started' | 'pending' | 'verified' | 'rejected'` (exact literal set as used by `KycModal`/`KycReviewModal`)
- `kycDetails?: KycDetails` (see §10.10)

**AI usage:**
- Fields tracking daily/lifetime AI usage counters tied to `AiQuota` (§10.11).

### 10.4 `Article`
- `id: string`
- `title: string`
- `description: string`
- `body: string` (rich content)
- `featuredImage: string` (URL)
- `category: string` (one of the 15 category values listed in §4.1)
- `writerId: string`, `writerName: string`, `writerAvatar: string`, `writerIsVerified?: boolean` (denormalized author fields for fast card rendering without a join)
- `publishedAt` (timestamp)
- `viewsCount: number`
- `likesCount: number`
- `commentsCount: number`
- `isLocked: boolean`
- `lockedPrice?: number` (USD, only meaningful when `isLocked`)
- `videoUrl?: string` (YouTube/Vimeo embed link, not a direct file)
- Rating-related fields (aggregate rating value/count).

### 10.5 `AdCampaign`
- `id: string`
- `advertiserId: string` (any user id — no separate advertiser account type)
- `campaignName: string`
- `adText: string`
- `imageUrl: string` (and/or video creative)
- `destinationUrl: string`
- `status: 'active' | 'paused' | 'completed'`
- `pricingModel: 'fixed' | 'cpm' | 'cpc'`
- `placementType: 'platform' | ...` (writer-article placement variants)
- `promotionKind?: 'website' | 'youtube' | 'telegram' | 'instagram' | 'twitter' | 'facebook'`
- `impressionsCount: number`
- `clicksCount: number`
- `totalBudget: number`
- `totalSpent: number`
- `blockedFraudClicks?: number`

### 10.6 `Tweet` / `TweetComment`
- `Tweet`: `id`, `authorId`, denormalized author fields, `text`, optional media, `likesCount`, retweet-related fields, `createdAt`.
- `TweetComment`: `id`, `tweetId`, `authorId`, denormalized author fields, `text`, `createdAt` — a flatter structure than article comments (no nested replies layer).

### 10.7 `Comment` / `CommentReply`
- `Comment`: top-level article comment — `id`, `articleId`, `authorId`, denormalized author fields, `text`, `createdAt`, `likesCount`.
- `CommentReply`: nested reply to a `Comment` — same shape plus a parent-comment reference.

### 10.8 `DirectMessage` / `Conversation` / `MessageReport`
- `Conversation`: `id`, participant ids, last-message preview, per-participant unread counters, presence-adjacent fields.
- `DirectMessage`: `id`, `conversationId`, `senderId`, `text` and/or sticker reference and/or media, `createdAt`, read state.
- `MessageReport`: `id`, reporter id, reported user/conversation id, reason, status, timestamp — reviewed in `AdminChatsTab`.

### 10.9 `AppNotification`
- `id`, `userId` (recipient), a type/kind discriminator, a payload/target reference (article id, user id, conversation id, request id, etc., depending on type — see §9's trigger list), `createdAt`, `isRead: boolean`.

### 10.10 `ArticlePromotion`
- `id`, `articleId`, `promoterId` (the writer boosting their own article), budget/duration fields, status — distinct from `AdCampaign` (§10.5), used specifically by `PromoteArticleModal` (§4.12).

### 10.11 `KycDetails`
- Fields capturing the Gemini-vision extraction result: extracted name, confidence level (`'high' | ...` lower tiers), document image reference (pointing into the separate admin-only `kycDocuments` collection, never inline/public), review outcome/notes when a human admin reviewed it.

### 10.12 `AiQuota` / `SubscriptionPlan`
- `AiQuota`: per-user daily chat-message count and limit, lifetime image-generation count and limit, tracked server-side **in-memory** (not persisted to a database) — meaning **it resets whenever the server process restarts**, a genuine limitation to note in §13, not something to silently "fix" by assuming persistence in the Kotlin backend without discussion.
- `SubscriptionPlan`: `'free' | 'monthly' | 'annual'` with the concrete limits given in §12.5.

### 10.13 `FraudFlag`
- `id`, a reference to the flagged event (ad impression/click), the reason code (self-click / rapid-click / viewability-fail / CTR-anomaly, matching the categories in §5.7), timestamp, and resolution status — reviewed in `AdminFraudTab`.

---

## 11. Backend API Reference

Source: `server.ts` (2,851 lines, full read) plus the supporting `server/*.ts` modules (`firebaseAdmin.ts`, `mediaUpload.ts`, `nowPayments.ts`, `paymentProvider.ts`, `socialVerify.ts`), all read in full. Endpoints below are grouped by concern. All financial/privileged endpoints use the Firebase Admin SDK to bypass client Firestore security rules and perform atomic transactions with idempotency guards.

### 11.1 Payments — status/config
- `GET /api/payments/status` — reports whether Stripe is configured (used by the client to decide whether to show automated deposit/payout buttons, §6.5).
- `GET /api/payments/nowpayments/status` — same, for NOWPayments/crypto.

### 11.2 Payments — Stripe
- Deposit checkout session creation endpoint(s) — creates a Stripe Checkout session for a wallet deposit.
- Stripe Connect Express onboarding endpoint(s) — for creators to connect a payout account.
- Stripe webhook endpoint — receives payment-confirmation events; deduplicated via `paymentWebhookEvents` marker documents before crediting `walletBalance`.
- Payout-trigger endpoint — initiates a Stripe Connect payout for an approved withdrawal.

### 11.3 Payments — NOWPayments
- Crypto invoice creation endpoint — for deposits.
- Direct USDT-TRC20 address endpoint — for withdrawal payouts.
- NOWPayments webhook endpoint — deposit confirmation, deduplicated the same way as Stripe.

### 11.4 Media upload
- Upload endpoint(s) proxying to Cloudinary, with server-enforced size/type limits (image ≤8MB; ad/article video ≤50MB; ad-specific creatives additionally capped at 60 seconds duration — enforced both client-side, best-effort, in `MediaUploadInput`, and authoritatively server-side after upload).
- `GET` media-upload-configured status endpoint — lets the client know whether to show the "upload a file" UI or fall back to "paste an external URL" (`MediaUploadInput`'s dual-mode behavior).
- KYC document upload — uses Cloudinary's "authenticated" (non-public) delivery type specifically, distinct from normal media uploads, and stores its record only in the admin-only `kycDocuments` Firestore collection.
- Signed-URL endpoint for admin viewing of a stored KYC document image — mints a short-lived signed URL on demand, never a permanent public link.

### 11.5 AI
- Chat/text-generation endpoint (Gemini `gemini-3.7-flash`) — backs both `AiAssistantModal` and the article editor's writing tools; enforces the per-user daily quota (in-memory, §10.12/§13).
- Image-generation endpoint (Gemini `gemini-3.1-flash-image`, with `gemini-3.1-flash-lite-image` fallback) — backs `ImageStudioModal`; enforces the lifetime-3-free-images quota.
- KYC document analysis endpoint — Gemini vision, extracts name from an uploaded ID document and returns a confidence tier; drives the auto-verify-vs-human-queue branch in the KYC flow (§4.7).

### 11.6 Social verification
- Telegram channel-membership verification endpoint — given a Telegram widget auth payload and a campaign id, verifies real membership and, on success, credits the verified-follow reward.
- YouTube subscription verification endpoint — given a read-only YouTube OAuth token and a campaign id, verifies real subscription and credits the reward on success.
- `GET` social-verify server-support-status endpoint — reports whether Telegram/YouTube verification is actually configured server-side (bot token / OAuth client present), consumed by `SocialPromoCta` to decide whether to even offer the "verify" button.

### 11.7 Analytics
- Summary endpoint(s) under `/api/analytics/*` backing `AdminAnalyticsTab` — hourly traffic buckets (24h), device breakdown, recent-visits stream, signup log. This is the real, currently-used analytics pipeline (superseding the dead `trafficTracker.ts`, §13).

### 11.8 Publishing bots
- A cron-triggered daily-cycle endpoint, protected by a **shared-secret header check** (not normal user authentication) so it can only be invoked by the GitHub Actions workflow, not by any logged-in user or public caller. On each invocation it: selects the next bot persona in rotation, generates and publishes exactly 1 article and 1 tweet via the same Gemini text pipeline, and triggers cross-bot auto-engagement (other bot accounts auto-like/auto-comment on the newly published content) to seed initial engagement.

### 11.9 Firebase Admin-privileged financial operations
- Deposit/withdrawal request approve/reject endpoints (admin-only, verified via Firebase Admin SDK token check server-side) — perform the actual atomic balance-changing transaction, guarded against double-processing.
- Direct balance-adjustment endpoint backing `BalanceAdjustModal` — requires an admin-verified caller and a mandatory reason string, written to an audit trail.
- Earnings-hold-release endpoint — moves matured `pendingEarnings` into `availableBalance` for accounts past the 30-day hold, admin-triggered from the Finance tab.
- Ad-event-batch processing endpoint backing the Finance tab's "process ad events" action — runs `evaluateAdEventBatch` server-side and converts validated events into actual writer/platform revenue-share credits per §5.6/§12.2.

---

## 12. Business Rules & Thresholds

Consolidated numeric constants and rules, sourced from `src/constants/revenueShares.ts`, `src/constants/payoutRules.ts`, `src/constants/socialPromoRewards.ts`, `src/utils/creatorEligibility.ts`, `src/utils/aiQuota.ts`, and cross-checked against their live usages across the UI (so the numbers below are guaranteed to match what the app actually enforces, not just what a comment claims).

### 12.1 Ad-slot system
- `MAX_ADS_PER_PAGE = 3` (§5.2).
- Viewability threshold for a countable impression: **≥50% of the ad unit visible, for a continuous 1 second** (§5.4).
- Rapid-click / bot-click exclusion window: clicks within roughly the **first 1.5–2 seconds** after page load are discarded (§5.7).

### 12.2 Revenue shares (`REVENUE_SHARES`) — exact table
See §5.6 for the full table. Restated for consolidation:
- In-article ads: **55% writer / 45% platform**.
- Writer-profile ads: **50% / 50%**.
- Locked-article sales: **85% writer / 15% platform**.
- Platform-wide ads: **0% writer / 100% platform**.

### 12.3 Payout rules (`payoutRules.ts`)
- `EARNINGS_HOLD_DAYS = 30` — earnings sit in `pendingEarnings` for 30 days before an admin can release them to `availableBalance` (§6.2).
- `MIN_PAYOUT_USD` — minimum withdrawal request amount, **$10** (as stated verbatim in the live-linked legal text, §2.4/§6.3).
- Withdrawal turnaround target communicated to users: transfers processed **within 24 hours** via approved payment methods (USDT, bank wire, Stripe, PayPal), per the terms text in `PoliciesModal`.
- Deposit/withdrawal manual-review SLA communicated to users: **24–48 hours** (`MoneyRequestModal`'s inline disclosure).

### 12.4 Creator/monetization eligibility gate (`creatorEligibility.ts`) — ALL of the following must hold simultaneously
1. **≥100 followers** — computed from the real `follows` collection (not the possibly-stale denormalized `followersCount` counter on the user document).
2. **≥1,000 valid views** on the account's own published articles.
3. **≥14 days** account age.
4. **≥3 published articles.**
5. **Mandatory KYC verification** (`kycStatus === 'verified'`) — required in addition to the 4 stats above, not a substitute for any of them.

Exceptions:
- Bot accounts (`isBot === true`) are **always excluded** from eligibility regardless of how their stats look — bots never earn monetized revenue.
- Admin-role accounts are **always eligible** (bypass the stat/KYC checks entirely).

An account failing this gate can still write, publish, tweet, and use every other feature — only the *crediting of ad/sale revenue* is withheld until all 5 conditions are met (§1.3). `CreatorEligibilityCard` (§4.19) is the canonical single UI surface for this state and must be the only place these numbers are computed/shown from, to avoid the two-different-numbers-in-two-places bug class.

### 12.5 AI feature quotas & subscription tiers
- **Free tier**: 10 chat messages/day, 3 lifetime image generations (not daily — a one-time lifetime allowance).
- **Monthly subscription**: $9.99, 200 AI uses.
- **Annual subscription**: $79.99, unlimited AI uses.
- Quota tracking is **server-side, in-memory only** — it resets on every server restart (§10.12; flagged again in §13 as a genuine limitation, not a design goal to silently replicate as "correct" without at least persisting it properly in the Kotlin backend).

### 12.6 Publishing bots
- **8 fixed AI-persona bot accounts**, `isBot: true`.
- Exactly **1 article + 1 tweet published per day**, rotating which bot publishes, triggered by a **GitHub Actions cron job** hitting a **shared-secret-protected** server endpoint (not normal user auth, §11.8).
- Cross-bot **auto-engagement**: other bot accounts automatically like/comment on newly bot-published content to seed initial visible engagement.
- Bots are excluded from monetization (§12.4) and from most admin analytics counts (e.g., "publishing writers" counts typically exclude bot accounts — confirm exact exclusions per metric when porting individual admin KPI cards).

### 12.7 Presence
- Heartbeat interval: roughly **every 25 seconds** while the tab is visible/foregrounded.
- Online/offline cutoff: a **60-second staleness window** — if the last heartbeat is older than 60 seconds, the user is displayed as offline/last-seen rather than online-now (§7).

### 12.8 Social-follow-verification reward
- `SOCIAL_VERIFIED_ACTION_REWARD_USD` — a fixed USD reward credited to `pendingEarnings` when a **registered (non-anonymous)** user completes real, server-verified Telegram or YouTube follow-through on a social-promotion campaign (§4.11a, §11.6). Not available for anonymous/guest sessions, and not available (no real verification path exists) for Instagram/X/Facebook.

### 12.9 Media limits
- Images: **≤8 MB**.
- Ad/article videos: **≤50 MB**; ad-creative videos additionally capped at **≤60 seconds** duration (client-side best-effort check + authoritative server-side enforcement).

### 12.10 App-update check cadence
- The client polls `/version.json` (no-cache) every **5 minutes**, plus immediately whenever the tab regains visibility (§2.1).

---

## 13. Known Intentional Omissions & Findings

This section lists things a careful reader of the source discovered that are either (a) deliberately not implemented / dead code that should **not** be ported as if it were a live feature, or (b) genuine limitations of the current system that the Kotlin rewrite team should consciously decide how to handle rather than silently copy or silently "fix."

### 13.1 Google Sign-In is present in code but dead — do not treat it as a real feature
Corrects the original task brief's assumption. Fully covered in §3.1. `onGoogleSignIn` has zero call sites anywhere in `src/`; `AuthModal.tsx` contains an explicit comment confirming its removal. The Google OAuth plumbing that *does* run (`googleIdentity.ts`) is used only for the unrelated YouTube-subscription-verification feature (§4.11a/§5.9), not for signing into Literium.

### 13.2 `src/utils/trafficTracker.ts` is dead/legacy code
Confirmed superseded by `src/services/analyticsApi.ts` and the real server-side `/api/analytics/*` endpoints (§11.7), which is what `AdminAnalyticsTab` actually consumes. Do not port `trafficTracker.ts`'s logic as if it were the live analytics pipeline.

### 13.3 `src/data/mockData.ts` is confirmed unused/dead
Grep confirms the only reference to `mockData` in `App.tsx` is a comment explaining it was **deliberately stopped from being loaded into live state**, because doing so let any anonymous guest browsing the site appear as an already-authenticated fake writer account with full dashboard and role-switch access — a real bug that was fixed by starting `users` state empty and sourcing `currentUser` solely from the real Firebase `onAuthStateChanged` listener. Do not port any of the mock data's shape/content as if it reflects real seed data — it doesn't run at all in production.

### 13.4 AI quota tracking resets on server restart
Covered in §10.12/§12.5. This is an actual limitation of the current system (in-memory counters, no database persistence), not a deliberate design choice worth replicating as "correct" — the Kotlin backend team should decide explicitly whether to persist quota state properly or knowingly accept the same reset-on-restart behavior, rather than have this happen by accident.

### 13.5 i18n coverage is shallow
`src/data/translations.ts` exists and 5 `LanguageCode` values are modeled, but the large majority of on-screen Arabic text is hardcoded directly in JSX rather than routed through `t()`. Switching the language selector does **not** translate most of the app's actual content — only a minority of chrome strings (some menu/button labels). Do not assume full multi-language parity exists in the current web app; if the Kotlin app is meant to be genuinely multi-language, that is new scope beyond "faithful port," and should be flagged back to the user rather than assumed.

### 13.6 The current "native" app is a WebView wrapper, built specifically because a prior full-native rewrite failed
`flutter_app/README.md` documents, in the codebase's own words, that an earlier attempt at a full native (Flutter) rewrite is exactly what motivated switching to the current WebView-wrapper-only architecture — because the native attempt could not keep pace with the real site's functionality. This is strong, first-party corroborating evidence for the concern that motivated commissioning this entire specification document, and should be treated as a cautionary precedent, not merely background trivia: whatever caused that earlier native attempt to drift out of parity (most likely: treating the web app's true breadth as smaller than it is, and building screen-by-screen from assumptions/memory instead of from an exhaustive inventory like this one) is the exact failure mode this document exists to prevent from recurring.

### 13.7 Instagram/X/Facebook social-promotion "verification" is honestly unverifiable — do not silently upgrade this
§4.11a/§5.9: for these three platforms, there is no free API path to genuinely verify a follow/like, and the code deliberately avoids claiming a "strict verification system" it doesn't have — showing an honest neutral message instead. If the Kotlin team later wants a paid/authenticated verification integration for these platforms, that is new scope; porting this feature faithfully means keeping the current honest-uncertainty messaging, not inventing a fake "verified ✓" state for these three platforms.

### 13.8 `BetaTesting20Modal`'s tester counter is a local/simulated counter, not a real backend-tracked count
The "18/20 testers" progress bar increments a local component `useState` counter on each form submission within that browser session; it is not persisted server-side or aggregated across real testers. This is acceptable as-is for its actual purpose (a lightweight feedback-collection UI to satisfy a Play Store closed-testing requirement), but should not be mistaken for a real analytics feature when porting.

### 13.9 Items not fully verifiable from source alone — recommend a human/product check before Kotlin implementation
- **Exact wording/thresholds a human should re-confirm live in the running app** rather than trust only from source, since server-side feature flags (e.g., `/api/payments/status`, media-upload-configured status) mean actual behavior can differ per deployment/environment: whether Stripe and/or NOWPayments are *currently* turned on in the production environment (the code supports both being off, either, or both — the source alone can't tell you today's actual config).
- The **exact set and precedence rules of the 7 AI writing tools** inside the article editor were confirmed present and functional, but the precise UX sequencing/labels of all 7 should be re-verified against the live editor UI during Kotlin screen design, since this research inferred the "7 tools" count from the editor's feature surface rather than from an explicit enumerated list in a single source location.
- The **precise list of all notification trigger events** (§9) was built from the pattern observed across `App.tsx`'s ~80 handler functions rather than from one canonical enum with a fixed, closed list — treat §9's list as representative/thorough but re-diff against `App.tsx`'s handlers directly if a guaranteed-exhaustive trigger list is required (e.g., for a Kotlin notification-preferences screen).
- The **exact GitHub Actions cron schedule** (what time of day / how the "1 bot per day" rotation picks its bot) lives in a `.github/workflows/*.yml` file that was not part of this research pass (out of scope: it's CI config, not app source) — worth a quick separate look if the Kotlin rewrite also needs to reproduce or trigger this cron behavior itself.
- This document was produced from source-code reading only — it was **not** cross-checked against the live running production app's actual current behavior (e.g., current admin-configured theme preset, current feature-flag states). Recommend a brief live walkthrough alongside this document before Kotlin implementation begins, specifically to catch any server-side-configured behavior that differs from what a fresh/default deployment of this code would do.

---

*End of specification. Produced entirely from source-code inspection (no assumptions carried over uncorrected from the original task brief where the source contradicted it — see §13.1 in particular). All file paths referenced above are relative to the repository root `/home/user/Lena9/`.*
