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
- **Custom backend:** A single Express server (`server.ts`, 2,851 lines) handles AI (Gemini) calls, Stripe/NOWPayments integration, Cloudinary media upload signing, KYC document analysis, social-verification (Telegram/YouTube) callbacks, and analytics aggregation. **Note:** admin financial approvals and balance adjustments (deposit/withdrawal approval, manual balance adjustment, earnings-hold release, ad-event-batch processing) are *not* among the things this server does — see §4.22/§11.9 for the corrected, verified picture: those remain plain client-side Firestore writes gated by `firestore.rules`, not server-side Admin-SDK operations.
- **Media/storage:** Cloudinary (not Firebase Storage) for all uploaded images/videos/KYC documents, because Firebase Storage is not available on the project's plan.
- **AI:** Google Gemini — `gemini-3.7-flash` for text/chat/SEO/bot content, `gemini-3.1-flash-image` (with `gemini-3.1-flash-lite-image` fallback) for image generation, and Gemini vision for KYC document analysis.

### 1.3 The unified capability-based account model (critical concept)

There is **no rigid "reader vs. writer vs. advertiser" role split** in the sense of separate apps or separate registration flows. Any registered account can, at any time and without needing "upgrade" approval:

- Read and comment on articles and tweets.
- **Write and publish articles** (the article editor is available to every logged-in account, not gated behind a "become a writer" application).
- **Post tweets.**
- **Create ad campaigns** (become an "advertiser" for that campaign) — again, no separate application process; anyone with wallet balance can fund a campaign.
- Message other users, follow/be followed, bookmark, etc.

The stored `role` field on the `User` document (`'reader' | 'writer' | 'advertiser' | 'admin'`) does **not by itself gate** these actions — every capability above is available to any authenticated account regardless of its current `role` value. What *does* gate real monetized earnings is a separate, independently-computed **monetization/creator eligibility** gate (see §12.4) — an account can write and publish freely, but its article-ad and locked-article earnings are only actually credited once it passes 5 concrete criteria including mandatory KYC. This decoupling — "anyone can do everything, but only eligible+verified accounts get paid" — is the single most important architectural fact to preserve in the Kotlin rewrite. Do NOT model capabilities as gated by three separate app modes/roles; model the capability surface as one unified account with an eligibility flag.

That said, `role` is not merely inert storage — see §1.3a below: the UI does let a user declare an active persona (reader/writer/advertiser) that live-updates some labels/icons app-wide, even though it never gates what the account is allowed to do.

### 1.3a Role-switching (active persona, not a capability gate)

`UserProfileView` exposes an `onSwitchUserRole` callback wired to `handleSwitchRole` in `App.tsx` (`App.tsx:3051`), which lets the current user pick an active persona — `reader`, `writer`, or `advertiser` (never `admin`; the handler explicitly blocks self-assigning `admin` client-side) — and writes it to the `role` field on their own `User` document. This is a pure presentation/labeling switch, not a capability change (per §1.3, capabilities are never gated by `role`), but it does live-update several surfaces immediately:
- **`DrawerMenu`**'s member-status label (`DrawerMenu.tsx:113`, `getRoleLabel`) — shows "👑 مالك المنصة" for admin, "📢 معلن وشريك أعمال" for advertiser, and for writer/reader shows either "✍️ كاتب شريك ومعتمد" or "📖 قارئ مسجل" depending on actual monetization-eligibility status (§12.4), not on the raw role value.
- **`EditProfileModal`**'s single name-field label (`EditProfileModal.tsx:25`) — switches between "الاسم المستعار (اسم الكاتب)" (pen name) for `writer`, "اسم الجهة أو الشركة" (company name) for `advertiser`, and "الاسم الكامل" (full name) otherwise, and edits the corresponding underlying field (`penName` / `companyName` / `fullName`).
- **`WalletModal`** and **`KycModal`** both accept a `userRole` prop and use it to adjust role-conditional copy in their UI.

`handleSwitchRole` also switches the active bottom-nav tab as a side effect (`writer` → profile tab, `advertiser` → campaigns tab, otherwise → feed). The Kotlin app should replicate this as a lightweight, user-chosen "active persona" setting on the profile — cosmetic and label-only, never wired to any permission check.

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

`AuthModal` is a single modal with a login/register mode toggle.

**⚠️ Corrections, verified against `AuthModal.tsx`:**
- **No username field is collected at signup.** A grep of `AuthModal.tsx` confirms there is no `username` input anywhere in the registration form. The `username` is instead auto-derived server-side from the email prefix (`src/firebase.ts`, e.g. `data.email.split('@')[0]`), with a fallback to a generated `user_xxxxx` id if no email is available — it is never a value the user types in during registration.
- **New accounts do NOT default to `role: 'reader'`.** Every registration call actually hardcodes `registerWithEmail(email, password, 'writer', {...})` (`AuthModal.tsx:168`) — new accounts are created with **`role: 'writer'`**, not `'reader'`. (This is consistent with §1.3/§1.3a: the role value is a display label, not a capability gate — a brand-new `'writer'`-role account still cannot earn monetized revenue until it passes the full eligibility gate in §12.4.)

The actual fields collected at signup (per `AuthModal.tsx:168-173`) are: `fullName`, `penName`, `specialties` (selected interest/topic tags), a preset `avatarUrl` (chosen from a fixed gallery, not uploaded), and `bio` (falls back to a default placeholder bio if left blank) — plus, separately, `email` and `password` for the Firebase Auth account itself. There is **no separate "register as a writer" vs "register as a reader" flow** — one registration form for everyone, consistent with the unified capability model in §1.3.

New accounts start with:
- `walletBalance: 0`, `pendingEarnings: 0`, `availableBalance: 0`, `lifetimeEarnings: 0` (explicitly written at registration, per `firebase.ts`) — though note per §10.3 these fields are optional on the `User` type in general (older/other code paths may leave them absent), so the Kotlin model should still treat them as nullable even though fresh registrations do populate them with `0`.
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
- **High-confidence match → auto-approved immediately** (`kycDetails.status` — see §10.3 — flips to `'verified'` without human involvement).
- **Anything less than high confidence → queued for human admin review** (appears in `KycReviewModal` inside the admin panel, §4.19).
- The modal communicates current status (`KycDetails.status`: `'none' | 'pending' | 'verified' | 'rejected'` — note the not-yet-started value is `'none'`, not `'not_started'`) and next steps at each stage.

### 4.8 Wallet Modal (`WalletModal`, 871 lines)

The financial hub — see full detail in §6. Screen shows: current `walletBalance` (spendable), `availableBalance` (withdrawable, post-hold), `pendingEarnings` (frozen, in the 30-day hold), `lifetimeEarnings` (cumulative stat, never decreases); deposit action; withdrawal/payout request action; transaction history; and, when Stripe/NOWPayments are configured, one-click automated deposit/payout buttons alongside the manual-request fallback.

### 4.9 Money Request Modal (`MoneyRequestModal`, 347 lines)

The manual deposit/withdrawal request form used when automated payment rails are not available/chosen (always available as a fallback even when they are). Fields: amount (min enforced via a `minAmount` floor that differs by mode — `MoneyRequestModal.tsx:66`: `isDeposit ? MIN_DEPOSIT_USD : MIN_PAYOUT_USD`, i.e. deposits use the separate, lower **`MIN_DEPOSIT_USD = 20`** constant (`payoutRules.ts:13`) while withdrawals use `MIN_PAYOUT_USD = 50` (§6.3/§12.3) — these are two distinct constants and must not be conflated), method selector (grid of method chips — bank wire / USDT / Stripe / PayPal-style options depending on context), and either:
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

### 4.19 User Profile View (`UserProfileView`, 1,690 lines — the largest and structurally most important screen) — the SELF profile

This single component takes only a `currentUser` prop (`App.tsx:3458`) — it has no target-user parameter, so it can only ever render the *current, logged-in* user's own profile. It is not used to view someone else's profile (that is `WriterProfileView`, §4.19b). It serves **both** the normal self-profile screen **and**, for admin accounts, embeds the entire admin dashboard as an internal tab set. Structure:
- **Header**: cover/avatar, display name, verified badge, bio, follower/following counts (tap-through to `FollowListModal`), join date, Edit-profile button.
- **Tabs**: Articles authored, Tweets posted, Liked content, Saved/bookmarked.
- **Creator eligibility card** (`CreatorEligibilityCard`) — shown on the self-profile / writer-studio context. If not yet eligible, shows a 2×2 grid of the 4 stat requirements (followers, valid views, account age, published articles) each with a met/unmet checkmark and a live "X/threshold" counter, plus a separate KYC row with a "Verify now" shortcut — all sourced from one shared `getCreatorEligibility()` computation so no screen can show conflicting numbers. If eligible, shows a single congratulatory "Verified Content Creator" card instead.
- **Admin dashboard tabs** (visible only when `currentUser.role === 'admin'`, rendered inline within this same view rather than as a separate route): Overview, Finance, Ads, Content, Fraud, Users, Chats, Bots, Settings — see §4.20 onward.
- **Role-switching**: surfaces the active-persona switcher described in §1.3a via its `onSwitchUserRole` prop.

### 4.19a Edit Profile Modal (`EditProfileModal`) & Social Links Editor (`SocialLinksEditor`)

Standard profile editing (name, bio, avatar upload) plus a dedicated editor for the user's public social links, which is what powers their own outbound social presence on their profile (separate from the ad-campaign social-promotion feature in §4.11a).

### 4.19b Writer Profile View (`WriterProfileView`, 476 lines) — viewing ANOTHER user's profile

The counterpart to §4.19: this is the screen shown when viewing *someone else's* profile. It is gated by the `viewingWriterProfile` state in `App.tsx` (set when the user taps through to another account) and rendered in place of the normal view/tab router (`App.tsx:3436`, `App.tsx:3179`) whenever that state is non-null. It takes the target `writer: User` as a required prop, distinct from `UserProfileView`'s self-only `currentUser` prop. Structure:
- **Header**: cover photo, avatar (with a verified-checkmark overlay if `writer.isVerified`), full name, a `KYC موثق` badge if `writer.isKycVerified`, a single member-status badge computed via `getMemberStatusLabel(writer.role, creatorEligibility.isEligible)` (never a raw role label — same "reader by default, auto-upgrades to writer once eligible" logic as elsewhere), and `@username`.
- **Action buttons**: "رسالة مباشرة" (opens a direct-message thread with this writer) and a Follow/Following toggle button, plus a small "يتابعك" (follows you) indicator when applicable.
- **Stats bar**: real followers/following counts (tappable through to `FollowListModal` via `onShowFollowers`/`onShowFollowing`), published-article count, total views, and an aggregate reader star-rating computed live from the writer's own articles' `ratingsSum`/`ratingsCount` (not a hardcoded placeholder).
- **Two tabs**: "المقالات المنشورة" (published articles — a filterable list of the writer's own articles, each row tappable through to the `ArticleReader`) and "عن الكاتب والروابط" (About/links — specialties chips and the writer's public social links from `socialLinks`, e.g. website, YouTube, WhatsApp, Telegram, X/Twitter, LinkedIn, Instagram).
- **Ad slots embedded in the articles tab**: `writer_profile_top` (below the header card) and `writer_profile_feed` (inserted after the 6th article row) — both writer-profile-beneficiary slots at the 50%/50% writer/platform split (§5.6).
- No "creator-eligibility card" (the full stat grid from §4.19) appears here — only the compact member-status badge in the header, since detailed eligibility stats are self-profile-only information.

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

The financial control center: lists all pending deposit and withdrawal requests with approve/reject actions, the manual "process ad events" trigger (runs `evaluateAdEventBatch` fraud filtering over recently logged ad impressions/clicks and converts valid ones into actual revenue splits per §12.2), and the 30-day earnings-hold release mechanism (admin can review and release matured `pendingEarnings` into `availableBalance` for eligible accounts once `EARNINGS_HOLD_DAYS` have elapsed). Also embeds `BalanceAdjustModal` for direct manual balance corrections (with mandatory reason/audit note).

**⚠️ Correction — these are plain client-side Firestore writes, not server-authoritative endpoints.** Despite how this might read at first glance, none of the four actions above (deposit/withdrawal approval, ad-event-batch processing, earnings release, manual balance adjustment) call a backend endpoint or run inside a Firebase-Admin-SDK transaction. They are ordinary `updateDoc`/`addDoc` calls made directly from the admin's browser against Firestore (`setMoneyRequestStatus`, `adminAdjustUserBalance`, `logManualBalanceAdjustment`, `adminReleaseEarnings` in `firestoreService.ts`; `evaluateAdEventBatch` is invoked directly in `App.tsx`'s `handleProcessAdEvents`). The real, current security boundary for all of this is `firestore.rules`' `isAdmin()` predicate (owner email OR `role == 'admin'` on the caller's own user document) — see §11.9 for the full picture and a note on what this means for the Kotlin rewrite.

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

There are **13 named ad slots** (`AdSlotId` type), each with a configuration entry (`beneficiary`, `writerShare`, `sponsorOnly`, `internalPriority`) describing: who financially benefits from a fill in that slot (the platform globally, vs. whichever writer's article/profile the slot is embedded in), what share of revenue goes to the writer for that slot type, and whether the slot only accepts internally-sold Literium campaigns (vs. also accepting external ad-network fills). This is implemented by **`AdSlot.tsx`** (442 lines) — the full-card ad-unit component used at each of the 13 named positions.

### 5.1a Ad ticker bar (`AdTickerBar.tsx`, 131 lines) — a second, lightweight ad surface

Alongside `AdSlot`, a second, distinct ad-rendering component exists: **`AdTickerBar`**, a slim, single-line rotating ad strip meant for places where a full ad card would be too heavy (lists, otherwise-empty inline spaces) but the surface should stay ad-monetized in the background. Key behavior:
- Rotates automatically through all currently-active eligible campaigns (`campaign.status === 'active'`, excluding `category_sponsor` placements) every `rotateMs` (default 5000ms), with a brief fade transition between ads.
- Falls back to an external ad-network snippet (rendered via the same sandboxed `ExternalAdScript` used by `AdSlot`, §5.5) when no internal campaign is available and an external network is configured/eligible.
- Takes an `externalPriority` prop: when `true`, internal campaigns are excluded entirely from rotation as long as a qualifying external network is available (external ads take priority); when `false` (the default), internal campaigns rotate first and the external network is only a fallback when none are available. The component's own inline comment notes this flag is meant to be alternated across different ticker placements on the site so that neither internal advertisers nor external networks are permanently excluded from every ticker.
- Still respects the platform's `MAX_ADS_PER_PAGE` cap: it calls the same `claimAdSlotIndex()` function `AdSlot.tsx` uses to claim a page-level slot index, and renders nothing (`return null`) once that shared counter is exhausted — so `AdTickerBar` instances count against the same per-page ad budget as `AdSlot` instances, not a separate budget.
- Logs impressions (once per distinct campaign shown, via a `Set` of already-logged ids) and click events (`logAdEvent`) the same way `AdSlot` does, and opens `destinationUrl` in a new tab on click.
- Has its own free-text `slotId` (not one of the 13 `AdSlotId` enum values) used purely to tag the ad-event log entries with where on the site the ticker appeared.

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
2. **`evaluateAdEventBatch`** (`src/utils/fraudFilters.ts`) — a second, independent pass triggered from the admin Finance tab's manual "process ad events" action, re-evaluating logged raw events in batch before converting them into actual credited revenue.

**⚠️ Correction:** despite its name and role, `evaluateAdEventBatch` is **not** a server-side or "cannot-be-bypassed-by-a-modified-client" layer. It is a plain client-side/browser function, invoked directly from `App.tsx`'s `handleProcessAdEvents` (running in the admin's own browser, not on `server.ts`), which then writes the resulting balance changes to Firestore the same way the other admin financial actions do (§4.22, §11.9) — ordinary client `updateDoc`/`addDoc` calls gated only by `firestore.rules`' `isAdmin()` check. There is no server endpoint anywhere in `server.ts` that runs ad-event evaluation or converts events into revenue. The real security boundary is the Firestore rules engine, not a backend process — see §11.9 for the full accounting and its implication for the Kotlin rewrite.

Both layers check for the same broad categories (self-click, rapid-click, viewability, CTR anomalies) but are implemented independently and both must be ported — do not assume the client-side engine alone is sufficient, since it can be bypassed by a modified client; but also do not assume `evaluateAdEventBatch`'s "batch" pass is running anywhere more trustworthy than the admin's own browser today.

### 5.8 Pricing models

Campaigns choose one of three pricing models at creation (`NewCampaignModal`, §4.11):
- **Fixed duration** — flat fee for a time-boxed placement, no per-impression/click metering.
- **CPM** — billed per 1,000 valid (viewability-gated) impressions. Default/pre-filled rate in the campaign wizard: **$1.00** per 1,000 impressions (`NewCampaignModal.tsx:90`, `cpmRate` initial state).
- **CPC** — billed per valid (fraud-filtered) click. Default/pre-filled rate in the campaign wizard: **$0.08** per click (`NewCampaignModal.tsx:89`, `cpcRate` initial state).

Both rates are editable by the advertiser at campaign-creation time — the values above are the wizard's defaults, not hard floors/ceilings.

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

`MIN_PAYOUT_USD = 50` (`src/constants/payoutRules.ts:8`) — the minimum withdrawal-request amount, enforced as the `minAmount` floor in `MoneyRequestModal`'s amount field. The constants file's own comment explains why this is centralized here: this value used to be duplicated and inconsistent across the codebase (`MoneyRequestModal` actually enforced $50 while other UI text elsewhere showed $20 or $10), which confused users seeing different numbers for the same rule; any future change to this number must go through this one constant. See also §4.9 for the separate, lower minimum that applies to deposits.

### 6.4 Manual (always-available) flow

Both deposits and withdrawals can always be requested manually regardless of whether automated payment rails are configured: `MoneyRequestModal` (§4.9) collects amount + method + a transfer reference (deposit) or receiving details (withdrawal), creating a pending request document. An admin reviews it in the Finance tab and approves/rejects.

**⚠️ Correction:** approval is **not** a server-side, Admin-SDK-backed, atomically-transacted operation. `setMoneyRequestStatus` (`firestoreService.ts`) is a plain client-side `updateDoc(...)` call on the request document made directly from the admin's browser, and the balance change itself is a separate plain client-side write (`adminAdjustUserBalance` → `updateDoc` on the user document). The only guard against double-processing is client-side (`processingRequestIdsRef`, which blocks a second click on the same request id before the UI has re-rendered) — there is no server-side transaction or idempotency check backing this. The real authorization boundary is `firestore.rules`' `isAdmin()` predicate, which only the admin's own authenticated Firestore session needs to satisfy. See §11.9 for the full picture and its implication for the Kotlin rewrite.

### 6.5 Optional automated rails

- **Stripe** — deposit via Stripe Checkout; payout via Stripe Connect Express (creator onboarding + payout). Availability is checked client-side via `GET /api/payments/status`; if not configured, the UI simply doesn't show the automated buttons and falls back to the manual flow — no broken/dead buttons are shown.
- **NOWPayments — confirmed LIVE and active in production** (ground truth from the app owner, not source-derived: verified via live screenshots). Direct crypto deposit works today end-to-end: the user chooses an asset (e.g. BTC), the app generates a real payment address/QR via a NOWPayments invoice, the USD amount is auto-converted to the chosen crypto's amount, and the wallet balance credits automatically once the network confirms the payment. Availability is checked client-side via `GET /api/payments/nowpayments/status`.
- **"Instant card payment via external intermediary" — a second, real, currently-live deposit path, distinct from the crypto flow above and not previously documented in this spec.** Implemented in `WalletModal.tsx` (the "Guardarian" / card-bridge block, near the NOWPayments deposit UI). Flow:
  1. The user taps a button to generate a receiving address (same underlying mechanism as the crypto deposit: a real USDT-TRC20 address minted via NOWPayments), rendered with a copy button.
  2. The user copies the address, then taps a link that opens **Guardarian** (`guardarian.com`) — an external, third-party site, **not part of this codebase** — in a new tab.
  3. On Guardarian, the user pastes the copied address, selects USDT on the TRC20/TRON network, and completes a card purchase (Visa/Mastercard) of USDT, which Guardarian sends to the pasted address.
  4. Guardarian may require its own KYC step before a user's first transaction there — this is Guardarian's own requirement, separate from Literium's KYC (§6.6/§12.4).
  5. Once the USDT arrives at the generated address, it is picked up the same way as any other NOWPayments-confirmed crypto deposit.
  This path is explicitly **not fully automated** — the code comment describing it notes that a fully automated card→address flow would require an official Guardarian `partner_api_token` that is not currently available, so the manual copy/paste bridge is the real, intentional design, not a stub or placeholder. The Kotlin app should implement this as its own distinct deposit method (generate address → copy → open Guardarian externally → user completes the card purchase there → balance credits on the same webhook-confirmed-deposit path as regular crypto deposits), not omit it as "coming soon."
  - **Three additional "coming soon" deposit method chips (PayPal, manual-USDT, bank wire) have been REMOVED from the app.** An inline code comment in `WalletModal.tsx` confirms these three were left disabled/non-functional ("قيد التطوير" / "in development") with no working submit action, and the app owner has confirmed they were deliberately removed. **Do not build these three as placeholder/disabled deposit options in the Kotlin rewrite** — they are not live features and are not planned to become one; the only two working deposit paths today are the direct NOWPayments crypto flow and the Guardarian card-bridge flow above (plus the manual admin-reviewed request flow in §6.4, and Stripe when configured).
- Both the Stripe and NOWPayments integrations use webhook-based confirmation for deposits, with **webhook deduplication** enforced via `paymentWebhookEvents` marker documents in Firestore (each incoming webhook event id is checked/recorded so a retried webhook delivery cannot double-credit a balance).

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
type UserRole = 'reader' | 'writer' | 'advertiser' | 'admin';
```
(`types.ts:1`.) `'advertiser'` is a real, live value — not a legacy leftover — actively filtered/counted in admin UI (`AdminUsersTab.tsx:178/295`, `AdminOverviewTab.tsx:354`, `AdminAnalyticsTab.tsx:138/689`) and read to drive role-conditional copy in `WalletModal.tsx:51`, `KycModal.tsx:20`, and `EditProfileModal.tsx:25` (see §1.3a). Note (§1.3, §3.2): this field does not by itself gate write/publish/advertise actions, which are available to any authenticated account — but see §1.3a for the real, live role-switching UI that does let a user set this field as a chosen "active persona."

### 10.3 `User`
Key fields (grouped by concern):

**Identity & profile:**
- `id: string`
- `username: string` (unique)
- `fullName: string` (`types.ts:51`) — **not** `displayName`; used as `user.fullName` across 14+ files. Note the `EditProfileModal` name field actually edits `penName`/`companyName`/`fullName` depending on the active role, per §1.3a.
- `email: string`
- `avatarUrl: string` (URL, `types.ts:53`) — **not** `avatar`.
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

**Wallet fields (see §6.1 for full semantics — do not conflate these four):** all four are **optional** on `User` (`types.ts:88-94` — `?:`, not required fields; a freshly-created or legacy user document may simply lack them, so Kotlin data classes should model these as nullable, not non-null with a default):
- `walletBalance?: number` — spendable, deposit-funded.
- `pendingEarnings?: number` — frozen earnings inside the 30-day hold.
- `availableBalance?: number` — earnings released after the hold, withdrawable.
- `lifetimeEarnings?: number` — cumulative all-time earnings stat, monotonically increasing, not spendable.

**KYC fields:** there is **no `kycStatus` field on `User`** anywhere in the codebase (confirmed by a repo-wide grep — no match at all). The real mechanism is two-part:
- `isKycVerified?: boolean` — a direct boolean flag.
- `kycDetails?: KycDetails` (see §10.11), whose own `status: 'none' | 'pending' | 'verified' | 'rejected'` field (`types.ts:15-21`) carries the granular state — note the not-yet-started value is literally **`'none'`**, not `'not_started'`.
- The actual verified-check used by the eligibility gate (`creatorEligibility.ts:58`) is `user.isKycVerified || user.kycDetails?.status === 'verified'` — either signal is sufficient; the Kotlin model should carry both fields and replicate this same OR check rather than inventing a single unified `kycStatus` enum.

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
- `AiQuota`: tracks per-user AI usage across three separate quota mechanisms, which have **different** persistence behavior — do not describe the whole system as uniformly in-memory:
  - **Daily chat-message quota** (`userQuotas` Map, `server.ts:82`) — server-side, **in-memory only**, resets whenever the server process restarts.
  - **Subscriber daily image bonus** (`subscriberDailyImageQuotas` Map, `server.ts:463`) — also server-side, **in-memory only**, same reset-on-restart behavior. An inline comment at this line explains it stays in-memory deliberately for now (it's an additional perk on top of the base free quota, and the base quota was the one with the actual bug — see next bullet).
  - **Lifetime 3-free-images quota** — by contrast, this one **is persisted**, in the `freeImagesUsedTotal` field on the user's Firestore document (`server.ts:499-514`). A code comment at that location explicitly documents this as a deliberate fix: this counter used to live in server memory too, which meant it reset (and granted effectively-unlimited free images) on every server restart — moving it into Firestore closed that gap.
- `SubscriptionPlan`: `'free' | 'monthly' | 'annual'` with the concrete limits given in §12.5.

### 10.13 `FraudFlag`
- `id`, a reference to the flagged event (ad impression/click), the reason code (self-click / rapid-click / viewability-fail / CTR-anomaly, matching the categories in §5.7), timestamp, and resolution status — reviewed in `AdminFraudTab`.

---

## 11. Backend API Reference

Source: `server.ts` (2,851 lines, full read) plus the supporting `server/*.ts` modules (`firebaseAdmin.ts`, `mediaUpload.ts`, `nowPayments.ts`, `paymentProvider.ts`, `socialVerify.ts`), all read in full. Endpoints below are grouped by concern. A full grep of every route registration in `server.ts` confirms the list below is exhaustive — notably, it contains **no** deposit/withdrawal-approval, balance-adjustment, earnings-release, or ad-event-processing route; those admin financial actions are client-side Firestore writes instead, gated by `firestore.rules` — see §11.9 for the corrected accounting (this replaces an earlier, incorrect draft of this section that described those four operations as Admin-SDK-backed atomic endpoints).

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

### 11.9 Financial operations — ⚠️ NOT server endpoints; client-side Firestore writes gated by `firestore.rules`

**Major correction to this section.** An earlier draft of this document described deposit/withdrawal approval, balance adjustment, earnings-hold release, and ad-event-batch processing as server-side, Firebase-Admin-SDK-backed, atomic-transaction-protected endpoints. **This is not what the code does.** A full grep of every `app.get/post/put/patch/delete` registration in `server.ts` (list in §11, confirmed exhaustive) turns up **no route at all** for deposit/withdrawal approval, balance adjustment, earnings release, or ad-event processing. All four are, today, plain **client-side Firestore writes** made directly from the admin's browser:

- **Deposit/withdrawal approve/reject** — `setMoneyRequestStatus` (`firestoreService.ts`) → a plain `updateDoc(...)` on the request document.
- **Direct balance adjustment** (backing `BalanceAdjustModal`) — `logManualBalanceAdjustment` (writes an audit-trail entry via `addDoc`) plus `adminAdjustUserBalance` (`updateDoc` on the user document) — both `firestoreService.ts`.
- **Earnings-hold release** — `adminReleaseEarnings` (`firestoreService.ts`), which itself just wraps `adminAdjustUserBalance` above (moves an amount from `pendingEarnings` to `availableBalance` via the same client `updateDoc`).
- **Ad-event-batch processing** ("process ad events" in the Finance tab) — `evaluateAdEventBatch` is invoked directly in `App.tsx`'s `handleProcessAdEvents` (client code, not a server route), which then writes the resulting balance/spend changes to Firestore the same way as the other three.

All four are authorized **only** by `firestore.rules`' `isAdmin()` predicate (`firestore.rules:14-22`): `request.auth.token.email` matches the hardcoded owner email, **or** the caller's own `users/{uid}` document has `role == 'admin'`. There is no server-issued token check and no atomic transaction anywhere in this path — the security boundary is entirely the Firestore rules engine evaluated against the authenticated client's own request.

**Design consideration worth flagging for the Kotlin rewrite:** because these writes are just normal authenticated Firestore calls gated by rules (not a backend that independently re-verifies the caller), a native Android client could in principle attempt the exact same writes directly against Firestore, using an admin-role account and the same rules that gate the web client today. The security boundary the Kotlin app inherits is the rules engine, not a backend endpoint — this is a real property of the current system to design around (e.g., whether to keep relying on Firestore rules as-is, or to introduce a genuine server-verified endpoint for these operations), not something to silently assume is already server-enforced.

---

## 12. Business Rules & Thresholds

Consolidated numeric constants and rules, sourced from `src/constants/revenueShares.ts`, `src/constants/payoutRules.ts`, `src/constants/socialPromoRewards.ts`, `src/utils/creatorEligibility.ts`, `src/utils/aiQuota.ts`, and cross-checked against their live usages across the UI (so the numbers below are guaranteed to match what the app actually enforces, not just what a comment claims).

### 12.1 Ad-slot system
- `MAX_ADS_PER_PAGE = 3` (§5.2).
- Viewability threshold for a countable impression: **≥50% of the ad unit visible, for a continuous 1 second** (§5.4).
- Rapid-click / bot-click exclusion window: clicks within roughly the **first 1.5–2 seconds** after page load are discarded (§5.7).
- Default pricing-model rates pre-filled in the campaign-creation wizard (§5.8): **CPM $1.00** per 1,000 impressions, **CPC $0.08** per click (`NewCampaignModal.tsx:89-90`) — editable by the advertiser, not fixed floors.

### 12.2 Revenue shares (`REVENUE_SHARES`) — exact table
See §5.6 for the full table. Restated for consolidation:
- In-article ads: **55% writer / 45% platform**.
- Writer-profile ads: **50% / 50%**.
- Locked-article sales: **85% writer / 15% platform**.
- Platform-wide ads: **0% writer / 100% platform**.

### 12.3 Payout rules (`payoutRules.ts`)
- `EARNINGS_HOLD_DAYS = 30` — earnings sit in `pendingEarnings` for 30 days before an admin can release them to `availableBalance` (§6.2).
- `MIN_PAYOUT_USD = 50` (`payoutRules.ts:8`) — minimum withdrawal request amount. The constant's own comment states it exists because this value used to drift inconsistently across the UI (`MoneyRequestModal` actually enforced $50 while other in-app text showed $20 or $10 for the same rule) — see §6.3.
- `MIN_DEPOSIT_USD = 20` (`payoutRules.ts:13`) — a separate, lower minimum that applies specifically to deposits (`MoneyRequestModal.tsx:66`: `isDeposit ? MIN_DEPOSIT : MIN_PAYOUT`). The constant's comment explains this was raised from an earlier $10 because $10 fell below NOWPayments' actual minimum for several supported cryptocurrencies (which varies by each coin's network fees), causing the payment page to reject or demand a higher amount even though the app itself had accepted the original request — see §4.9.
- Withdrawal turnaround target communicated to users: transfers processed **within 24 hours** via approved payment methods (USDT, bank wire, Stripe, PayPal), per the terms text in `PoliciesModal`.
- Deposit/withdrawal manual-review SLA communicated to users: **24–48 hours** (`MoneyRequestModal`'s inline disclosure).

### 12.4 Creator/monetization eligibility gate (`creatorEligibility.ts`) — ALL of the following must hold simultaneously
1. **≥100 followers** — computed from the real `follows` collection (not the possibly-stale denormalized `followersCount` counter on the user document).
2. **≥1,000 valid views** on the account's own published articles.
3. **≥14 days** account age.
4. **≥3 published articles.**
5. **Mandatory KYC verification** (`user.isKycVerified || user.kycDetails?.status === 'verified'`, per `creatorEligibility.ts:58` — see §10.3 for why there is no single `kycStatus` field) — required in addition to the 4 stats above, not a substitute for any of them.

Exceptions:
- Bot accounts (`isBot === true`) are **always excluded** from eligibility regardless of how their stats look — bots never earn monetized revenue.
- Admin-role accounts are **always eligible** (bypass the stat/KYC checks entirely).

An account failing this gate can still write, publish, tweet, and use every other feature — only the *crediting of ad/sale revenue* is withheld until all 5 conditions are met (§1.3). `CreatorEligibilityCard` (§4.19) is the canonical single UI surface for this state and must be the only place these numbers are computed/shown from, to avoid the two-different-numbers-in-two-places bug class.

### 12.5 AI feature quotas & subscription tiers
- **Free tier**: 10 chat messages/day, 3 lifetime image generations (not daily — a one-time lifetime allowance).
- **Monthly subscription**: $9.99, 200 AI uses.
- **Annual subscription**: $79.99, unlimited AI uses.
- Quota tracking is **not uniformly in-memory** — see §10.12 for the full breakdown. The daily chat-message quota and the subscriber daily image bonus are server-side, in-memory only, and reset on every server restart (a genuine limitation, flagged again in §13 — not a design goal to silently replicate as "correct" without at least persisting it properly in the Kotlin backend). The lifetime 3-free-images quota, however, is already persisted server-side in Firestore (`freeImagesUsedTotal` on the user document) specifically because the earlier in-memory version of that counter was a confirmed bug (it effectively granted unlimited free images across restarts) — the Kotlin backend should match this field's persisted behavior, not treat it as unsolved.

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

### 13.4 Two of the three AI quota mechanisms reset on server restart — the third is already persisted
Covered in full in §10.12/§12.5. This limitation applies specifically to the **daily chat-message quota** and the **subscriber daily image bonus** (both server-side `Map` objects in `server.ts`, no database persistence) — not to all AI quota tracking. The **lifetime 3-free-images quota** (`freeImagesUsedTotal` on the user's Firestore document) is already persisted, and a code comment at its implementation (`server.ts:499-514`) documents this as a deliberate fix of exactly the same reset-on-restart bug class, applied to that one counter after it caused a real problem (effectively-unlimited free images across restarts). The Kotlin backend team should decide explicitly whether to persist the remaining two in-memory counters properly or knowingly accept the same reset-on-restart behavior for those two specifically, rather than have this happen by accident — and should replicate the third counter's already-persisted behavior rather than re-introducing the bug it fixed.

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
