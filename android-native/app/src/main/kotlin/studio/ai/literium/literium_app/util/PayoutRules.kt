package studio.ai.literium.literium_app.util

/**
 * Single source of truth for withdrawal/deposit thresholds and the
 * earnings-hold period. Ported verbatim from `src/constants/payoutRules.ts`.
 *
 * These two minimums are deliberately separate constants and must never be
 * conflated — the source file's own comment explains they used to drift
 * inconsistently across the UI ($50 enforced in one place, $20/$10 shown
 * elsewhere for "the same" rule) until centralized here (spec §6.3/§4.9).
 */
object PayoutRules {
    /** Minimum withdrawal-request amount, USD. `payoutRules.ts:8`. */
    const val MIN_PAYOUT_USD = 50.0

    /**
     * Minimum deposit amount, USD — separate from [MIN_PAYOUT_USD]. Raised
     * from an earlier $10 because that fell below NOWPayments' actual
     * per-coin minimum for several supported cryptocurrencies. `payoutRules.ts:13`.
     */
    const val MIN_DEPOSIT_USD = 20.0

    /** Days a newly-recorded earning sits in `pendingEarnings` before an admin can release it to `availableBalance`. */
    const val EARNINGS_HOLD_DAYS = 30
}
