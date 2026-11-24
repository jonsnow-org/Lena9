package studio.ai.literium.literium_app.data.model

/**
 * Aggregate wallet summary shape from `types.ts`'s `Wallet` interface.
 * NOTE: unlike [User]'s four wallet fields (the ones actually read/written
 * throughout the app — see spec §6.1), this particular shape does not
 * appear to be backed by any live Firestore read/write path in
 * `firestoreService.ts`; it is kept here only for field-fidelity with
 * `types.ts`. Prefer the four fields directly on [User] for real balance
 * display/logic.
 */
data class Wallet(
    var availableBalance: Double = 0.0,
    var pendingBalance: Double = 0.0,
    var totalEarned: Double = 0.0,
    var totalWithdrawn: Double = 0.0,
    var currency: String = "USD"
)

/**
 * A financial ledger line — collection `earnings` (despite the Kotlin/TS
 * type name `Transaction`; `firestoreService.ts` reads/writes this shape
 * from the `earnings` collection specifically via `subscribeToEarnings`/
 * `logTransactionToFirestore`). Admin-write-only per firestore.rules.
 */
data class Transaction(
    var id: String = "",
    /** One of [TransactionType]'s constants. */
    var type: String = TransactionType.EARNING_ADSENSE,
    var amount: Double = 0.0,
    var currency: String = "USD",
    /** One of [TransactionStatus]'s constants. */
    var status: String = TransactionStatus.COMPLETED,
    var paymentMethod: String = "",
    var referenceId: String = "",
    var description: String = "",
    var relatedArticleTitle: String? = null,
    var createdAt: String = ""
)

object TransactionType {
    const val DEPOSIT = "deposit"
    const val WITHDRAWAL = "withdrawal"
    const val EARNING_ADSENSE = "earning_adsense"
    const val EARNING_ADMOB = "earning_admob"
    const val EARNING_LOCKED = "earning_locked"
    const val EARNING_CAMPAIGN = "earning_campaign"
    const val CAMPAIGN_SPENT = "campaign_spent"
    const val AI_SUBSCRIPTION = "ai_subscription"
    const val PLATFORM_FEE = "platform_fee"
    const val MANUAL_ADJUSTMENT = "manual_adjustment"
}

object TransactionStatus {
    const val COMPLETED = "completed"
    const val PENDING = "pending"
    const val FAILED = "failed"
    const val CANCELLED = "cancelled"
}

/**
 * A single earning record inside the 30-day hold cycle — collection
 * `earnings` (a second, "raw" shape written by `adminLogEarning`/the
 * `/api/articles/unlock` server route, read back via
 * `subscribeToAllEarningsAdmin` for the admin release-earnings UI; spec
 * §6.2/§4.22). Distinct in shape from [Transaction] even though both live
 * in the same collection — the source itself is not fully consistent here.
 */
data class EarningRecord(
    var id: String = "",
    var userId: String = "",
    var amount: Double = 0.0,
    var source: String = "",
    /** "pending_hold" | "released" | "completed" (free-text status in source). */
    var status: String = "pending_hold",
    var createdAt: String = "",
    /** ISO timestamp — [EARNINGS_HOLD_DAYS] after [createdAt]; earning becomes releasable then. */
    var releasableAt: String = "",
    var articleId: String? = null,
    var campaignId: String? = null,
    var description: String? = null
)

/** A pending manual deposit request — collection `depositRequests`. */
data class DepositRequest(
    var id: String = "",
    var userId: String = "",
    var amount: Double = 0.0,
    var method: String = "",
    var reference: String? = null,
    /** One of [MoneyRequestStatus]'s constants. */
    var status: String = MoneyRequestStatus.PENDING,
    var adminNote: String? = null,
    var createdAt: String = "",
    var reviewedAt: String? = null
)

/** A pending manual withdrawal request — collection `payoutRequests`. */
data class PayoutRequest(
    var id: String = "",
    var userId: String = "",
    var amount: Double = 0.0,
    var method: String = "",
    /** Receiving account number / crypto wallet address, free text. */
    var destination: String? = null,
    var status: String = MoneyRequestStatus.PENDING,
    var adminNote: String? = null,
    var createdAt: String = "",
    var reviewedAt: String? = null
)

object MoneyRequestStatus {
    const val PENDING = "pending"
    const val APPROVED = "approved"
    const val REJECTED = "rejected"
    const val PAID = "paid"
}

/** A pending locked-article purchase request — collection `purchaseRequests` (legacy manual-approval
 *  path; the live path is the instant `POST /api/articles/unlock` server call, spec §4.4/§11). */
data class PurchaseRequest(
    var id: String = "",
    var userId: String = "",
    var buyerId: String = "",
    var articleId: String = "",
    var articleTitle: String? = null,
    var writerId: String = "",
    var amount: Double = 0.0,
    var status: String = MoneyRequestStatus.PENDING,
    var createdAt: String = ""
)

/**
 * Audit-trail entry for a manual admin balance adjustment — actually stored
 * in the `transactions` collection with `type == "manual_adjustment"`
 * (see [Transaction]); this shape documents the extra fields
 * `logManualBalanceAdjustment` attaches beyond the base [Transaction] shape.
 */
data class ManualBalanceAdjustment(
    var id: String = "",
    var userId: String = "",
    var type: String = TransactionType.MANUAL_ADJUSTMENT,
    var amount: Double = 0.0,
    var currency: String = "USD",
    var status: String = TransactionStatus.COMPLETED,
    var paymentMethod: String = "تعديل يدوي من الإدارة",
    var referenceId: String = "",
    var description: String = "",
    /** Which of the four [User] balance fields was adjusted. */
    var field: String = "walletBalance",
    var newValue: Double = 0.0,
    var reason: String = "",
    var adjustedBy: String = "",
    var createdAt: String = ""
)
