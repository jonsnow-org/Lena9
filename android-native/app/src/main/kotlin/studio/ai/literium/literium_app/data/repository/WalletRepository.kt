package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.toObject
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.model.AiQuota
import studio.ai.literium.literium_app.data.model.DepositRequest
import studio.ai.literium.literium_app.data.model.EarningRecord
import studio.ai.literium.literium_app.data.model.ManualBalanceAdjustment
import studio.ai.literium.literium_app.data.model.PayoutRequest
import studio.ai.literium.literium_app.data.model.Transaction
import studio.ai.literium.literium_app.data.model.TransactionStatus
import studio.ai.literium.literium_app.data.model.TransactionType
import studio.ai.literium.literium_app.util.PayoutRules
import java.time.Duration
import java.time.Instant

/**
 * The wallet/finance domain. **Critical per spec §4.22/§6.4/§11.9**: every
 * write in this repository — deposit/withdrawal approval, manual balance
 * adjustment, earnings-hold release, purchase-request creation — is a
 * PLAIN, CLIENT-SIDE FIRESTORE WRITE gated only by firestore.rules'
 * `isAdmin()` predicate. There is no corresponding server endpoint for any
 * of these (`server.ts` has none, confirmed by an exhaustive grep of every
 * route registration — see spec §11.9), and no server-side Admin-SDK
 * transaction backs them. Do NOT invent a server call for any method in
 * this class — that would silently diverge from the real, current system.
 * The only genuinely server-authoritative money paths are locked-article
 * unlocking (`POST /api/articles/unlock`) and the automated Stripe/
 * NOWPayments rails, both of which live in
 * [studio.ai.literium.literium_app.data.remote.LiteriumApiService], not here.
 *
 * Ports `firestoreService.ts`'s "طلبات الإيداع وطلبات السحب", "عمليات
 * مشتريات المقالات المقفولة", "تعديل أرصدة المستخدمين", and "الأرباح
 * المجمَّدة" sections.
 *
 * ⚠️ Deliberately NOT ported: the legacy `updateUserWalletBalance`
 * function. Source's own comment on `adminAdjustUserBalance` states it is
 * "the only legitimate way to change any balance" — including the older,
 * simpler setter here would directly contradict that documented intent.
 *
 * Failure convention: see [safeCall]'s file KDoc. [logManualBalanceAdjustment]
 * is the documented exception, matching source: a failed audit-log write
 * must never fail the balance change it is documenting (which already
 * succeeded by the time this is called).
 */
class WalletRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val earningsCol get() = firestore.collection(FirestoreCollections.EARNINGS)
    private val transactionsCol get() = firestore.collection(FirestoreCollections.TRANSACTIONS)
    private val depositRequestsCol get() = firestore.collection(FirestoreCollections.DEPOSIT_REQUESTS)
    private val payoutRequestsCol get() = firestore.collection(FirestoreCollections.PAYOUT_REQUESTS)
    private val purchaseRequestsCol get() = firestore.collection(FirestoreCollections.PURCHASE_REQUESTS)
    private val usersCol get() = firestore.collection(FirestoreCollections.USERS)

    // ---- Deposit / payout requests (manual, always-available path — spec §6.4) ----

    suspend fun createDepositRequest(userId: String, amount: Double, method: String, reference: String? = null): Result<String> = safeCall {
        require(amount >= PayoutRules.MIN_DEPOSIT_USD) { "الحد الأدنى للإيداع ${PayoutRules.MIN_DEPOSIT_USD}$." }
        val payload = mutableMapOf<String, Any>(
            "userId" to userId, "amount" to amount, "method" to method,
            "status" to "pending", "createdAt" to Instant.now().toString()
        )
        reference?.let { payload["reference"] = it }
        depositRequestsCol.add(payload).await().id
    }

    suspend fun createPayoutRequest(userId: String, amount: Double, method: String, destination: String? = null): Result<String> = safeCall {
        require(amount >= PayoutRules.MIN_PAYOUT_USD) { "الحد الأدنى للسحب ${PayoutRules.MIN_PAYOUT_USD}$." }
        val payload = mutableMapOf<String, Any>(
            "userId" to userId, "amount" to amount, "method" to method,
            "status" to "pending", "createdAt" to Instant.now().toString()
        )
        destination?.let { payload["destination"] = it }
        payoutRequestsCol.add(payload).await().id
    }

    /** Non-admins may only see their own requests (firestore.rules); pass [isAdmin] = true to see every user's. */
    fun observeDepositRequests(userId: String?, isAdmin: Boolean): Flow<List<DepositRequest>> = callbackFlow {
        // Note: `callbackFlow` requires `awaitClose` to run before the block returns on every path
        // (it throws `IllegalStateException` otherwise) — so the "no valid caller" branch below still
        // routes through a no-op `awaitClose { }` rather than an early `return@callbackFlow`.
        if (!isAdmin && userId == null) {
            trySend(emptyList())
            awaitClose { }
        } else {
            val query: Query = if (isAdmin) depositRequestsCol else depositRequestsCol.whereEqualTo("userId", userId)
            val registration = query.addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<DepositRequest>()?.copy(id = it.id) }.orEmpty()
                    .sortedByDescending { it.createdAt }
                trySend(list)
            }
            awaitClose { registration.remove() }
        }
    }

    fun observePayoutRequests(userId: String?, isAdmin: Boolean): Flow<List<PayoutRequest>> = callbackFlow {
        if (!isAdmin && userId == null) {
            trySend(emptyList())
            awaitClose { }
        } else {
            val query: Query = if (isAdmin) payoutRequestsCol else payoutRequestsCol.whereEqualTo("userId", userId)
            val registration = query.addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<PayoutRequest>()?.copy(id = it.id) }.orEmpty()
                    .sortedByDescending { it.createdAt }
                trySend(list)
            }
            awaitClose { registration.remove() }
        }
    }

    /** Admin-only status transition (approved/rejected/paid) — see class KDoc, this is a plain client write, not a server endpoint. */
    suspend fun setDepositRequestStatus(requestId: String, status: String, adminNote: String? = null): Result<Unit> = safeCall {
        setMoneyRequestStatus(depositRequestsCol, requestId, status, adminNote)
    }

    suspend fun setPayoutRequestStatus(requestId: String, status: String, adminNote: String? = null): Result<Unit> = safeCall {
        setMoneyRequestStatus(payoutRequestsCol, requestId, status, adminNote)
    }

    private suspend fun setMoneyRequestStatus(
        col: com.google.firebase.firestore.CollectionReference,
        requestId: String,
        status: String,
        adminNote: String?
    ) {
        val payload = mutableMapOf<String, Any>("status" to status, "reviewedAt" to Instant.now().toString())
        if (!adminNote.isNullOrBlank()) payload["adminNote"] = adminNote
        col.document(requestId).update(payload).await()
    }

    // ---- Earnings ledger (the caller's own `earnings`-collection Transaction rows) ----

    fun observeEarnings(userId: String): Flow<List<Transaction>> = callbackFlow {
        if (userId.isBlank()) {
            trySend(emptyList())
            awaitClose { }
        } else {
            val registration = earningsCol.whereEqualTo("userId", userId).addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { doc ->
                    Transaction(
                        id = doc.id,
                        type = doc.getString("type") ?: TransactionType.EARNING_ADSENSE,
                        amount = doc.getDouble("amount") ?: 0.0,
                        currency = doc.getString("currency") ?: "USD",
                        status = doc.getString("status") ?: TransactionStatus.COMPLETED,
                        paymentMethod = doc.getString("paymentMethod") ?: "محفظة ليتيريوم الداخلية",
                        referenceId = doc.getString("referenceId") ?: doc.id,
                        description = doc.getString("description") ?: doc.getString("source") ?: "أرباح مشاهدات ونقرات",
                        createdAt = doc.getString("createdAt") ?: ""
                    )
                }.orEmpty().sortedByDescending { it.createdAt }
                trySend(list)
            }
            awaitClose { registration.remove() }
        }
    }

    suspend fun logTransaction(tx: Transaction, userId: String): Result<Unit> = safeCall {
        val payload = mutableMapOf<String, Any?>(
            "userId" to userId,
            "type" to tx.type,
            "amount" to tx.amount,
            "currency" to tx.currency,
            "status" to tx.status,
            "paymentMethod" to tx.paymentMethod,
            "referenceId" to tx.referenceId,
            "description" to tx.description,
            "createdAt" to Instant.now().toString()
        )
        tx.relatedArticleTitle?.let { payload["relatedArticleTitle"] = it }
        earningsCol.add(payload).await()
        Unit
    }

    // ---- Locked-article purchase requests (legacy manual path — the live path is the instant
    // server-authoritative POST /api/articles/unlock; see LiteriumApiService.unlockArticle). ----

    suspend fun createPurchaseRequest(buyerId: String, articleId: String, articleTitle: String?, writerId: String, price: Double): Result<String> = safeCall {
        val payload = mutableMapOf<String, Any>(
            "userId" to buyerId, "buyerId" to buyerId, "articleId" to articleId,
            "writerId" to writerId, "amount" to price, "status" to "pending",
            "createdAt" to Instant.now().toString()
        )
        articleTitle?.let { payload["articleTitle"] = it }
        purchaseRequestsCol.add(payload).await().id
    }

    // ---- Admin: the sole legitimate balance-mutation path ----

    /**
     * Directly credits/debits one or more of the four [studio.ai.literium.literium_app.data.model.User]
     * balance fields. [changes] keys must be one of `"walletBalance"`, `"availableBalance"`,
     * `"pendingEarnings"`, `"lifetimeEarnings"` — matching `adminAdjustUserBalance` exactly (absolute
     * new values, not deltas; the caller computes the new value). Gated by firestore.rules' `isAdmin()`.
     */
    suspend fun adminAdjustUserBalance(userId: String, changes: Map<String, Double>): Result<Unit> = safeCall {
        val clean = changes.filterValues { !it.isNaN() }
        if (clean.isEmpty()) return@safeCall Unit
        usersCol.document(userId).update(clean).await()
        Unit
    }

    /**
     * Permanent audit-trail entry for a manual balance adjustment, written into the `transactions`
     * collection with `type = "manual_adjustment"` — always resolves successfully (see class KDoc):
     * a failed audit write must never fail the balance change it documents, which has already happened
     * by the time this is called.
     */
    suspend fun logManualBalanceAdjustment(entry: ManualBalanceAdjustment): Result<Unit> {
        return try {
            val referenceId = entry.referenceId.ifBlank { "ADJ-${System.currentTimeMillis().toString().takeLast(8)}" }
            val amountText = if (entry.amount >= 0) "+${"%.2f".format(entry.amount)}" else "%.2f".format(entry.amount)
            val description = "تعديل يدوي (${entry.field}): $amountText$ ← الرصيد الجديد ${"%.2f".format(entry.newValue)}$. السبب: ${entry.reason.ifBlank { "غير مُحدَّد" }}"
            transactionsCol.add(
                mapOf(
                    "userId" to entry.userId,
                    "type" to TransactionType.MANUAL_ADJUSTMENT,
                    "amount" to entry.amount,
                    "currency" to "USD",
                    "status" to TransactionStatus.COMPLETED,
                    "paymentMethod" to "تعديل يدوي من الإدارة",
                    "referenceId" to referenceId,
                    "description" to description,
                    "field" to entry.field,
                    "newValue" to entry.newValue,
                    "reason" to entry.reason,
                    "adjustedBy" to entry.adjustedBy,
                    "createdAt" to Instant.now().toString()
                )
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }

    /** Moves `min(amountToRelease, currentPending)` from `pendingEarnings` to `availableBalance` — a thin
     *  wrapper over [adminAdjustUserBalance], matching `adminReleaseEarnings` exactly. No-ops if the release amount is ≤ 0. */
    suspend fun adminReleaseEarnings(userId: String, currentPending: Double, currentAvailable: Double, amountToRelease: Double): Result<Unit> = safeCall {
        val release = minOf(amountToRelease, currentPending)
        if (release <= 0) return@safeCall Unit
        adminAdjustUserBalance(
            userId,
            mapOf(
                "pendingEarnings" to Math.round((currentPending - release) * 100.0) / 100.0,
                "availableBalance" to Math.round((currentAvailable + release) * 100.0) / 100.0
            )
        ).getOrThrow()
    }

    /** Records a new earning into the `earnings` collection with the standard [PayoutRules.EARNINGS_HOLD_DAYS]-day hold. */
    suspend fun adminLogEarning(
        userId: String,
        amount: Double,
        source: String,
        articleId: String? = null,
        campaignId: String? = null,
        description: String? = null
    ): Result<Unit> = safeCall {
        val now = Instant.now()
        val payload = mutableMapOf<String, Any?>(
            "userId" to userId,
            "amount" to amount,
            "source" to source,
            "status" to "pending_hold",
            "createdAt" to now.toString(),
            "releasableAt" to now.plus(Duration.ofDays(PayoutRules.EARNINGS_HOLD_DAYS.toLong())).toString()
        )
        articleId?.let { payload["articleId"] = it }
        campaignId?.let { payload["campaignId"] = it }
        description?.let { payload["description"] = it }
        earningsCol.add(payload).await()
        Unit
    }

    // ---- Admin: reviewing the hold cycle ----

    fun observeAllEarningsAdmin(): Flow<List<EarningRecord>> = callbackFlow {
        val registration = earningsCol.addSnapshotListener { snap, error ->
            if (error != null) { close(error); return@addSnapshotListener }
            val list = snap?.documents?.mapNotNull { it.toObject<EarningRecord>()?.copy(id = it.id) }.orEmpty()
                .sortedByDescending { it.createdAt }
            trySend(list)
        }
        awaitClose { registration.remove() }
    }

    fun observeManualBalanceAdjustments(): Flow<List<ManualBalanceAdjustment>> = callbackFlow {
        val registration = transactionsCol.whereEqualTo("type", TransactionType.MANUAL_ADJUSTMENT)
            .addSnapshotListener { snap, error ->
                if (error != null) { close(error); return@addSnapshotListener }
                val list = snap?.documents?.mapNotNull { it.toObject<ManualBalanceAdjustment>()?.copy(id = it.id) }.orEmpty()
                    .sortedByDescending { it.createdAt }
                trySend(list)
            }
        awaitClose { registration.remove() }
    }

    suspend fun markEarningReleased(earningId: String): Result<Unit> = safeCall {
        earningsCol.document(earningId).update("status", "released").await()
        Unit
    }

    /** Legacy/secondary path — marks an `earnings` document `status = "completed"`. Distinct from
     *  [setPayoutRequestStatus] (which operates on the `payoutRequests` collection); both exist in
     *  source and are ported faithfully rather than merged. */
    suspend fun approvePayout(transactionId: String): Result<Unit> = safeCall {
        earningsCol.document(transactionId).update("status", "completed").await()
        Unit
    }

    // ---- AI quota (admin-approved subscription updates) ----

    /** Non-financial field, writable by the account owner per firestore.rules — used here on behalf of
     *  the user after an admin manually approves a subscription purchase. */
    suspend fun updateUserAiQuota(userId: String, aiQuota: AiQuota): Result<Unit> = safeCall {
        usersCol.document(userId).update("aiQuota", aiQuota).await()
        Unit
    }
}
