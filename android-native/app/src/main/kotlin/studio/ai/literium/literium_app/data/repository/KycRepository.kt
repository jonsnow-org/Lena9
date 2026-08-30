package studio.ai.literium.literium_app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import studio.ai.literium.literium_app.data.firebase.FirestoreCollections
import studio.ai.literium.literium_app.data.remote.KycDocumentResponse
import studio.ai.literium.literium_app.data.remote.KycSubmitResponse
import studio.ai.literium.literium_app.data.remote.LiteriumApiService
import studio.ai.literium.literium_app.data.remote.NetworkModule
import java.io.File

/**
 * Identity verification (spec §4.7/§6.6/§12.4). The actual document
 * upload + Gemini-vision analysis is server-authoritative
 * ([submitKyc] → `POST /api/kyc/submit`) — a raw client Firestore write
 * for this is impossible by design (firestore.rules: `match
 * /kycDocuments/{userId} { allow create: if false; }`), and the admin-only
 * review/approve/reject actions below are the plain client Firestore
 * writes `firestoreService.ts` actually implements for the human-review
 * fallback path.
 *
 * Failure convention: see [safeCall]'s file KDoc.
 */
class KycRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val api: LiteriumApiService = NetworkModule.api
) {
    private val usersCol get() = firestore.collection(FirestoreCollections.USERS)
    private val kycDocumentsCol get() = firestore.collection(FirestoreCollections.KYC_DOCUMENTS)

    /**
     * Uploads the identity document image + submits idType/idNumber for automatic Gemini-vision
     * verification. High-confidence name match auto-verifies immediately; anything less queues for
     * human review (spec §4.7). Requires a signed-in Firebase user.
     */
    suspend fun submitKyc(documentImage: File, idType: String, idNumber: String): Result<KycSubmitResponse> = safeCall {
        val mimeType = if (documentImage.extension.lowercase() == "png") "image/png" else "image/jpeg"
        val filePart = MultipartBody.Part.createFormData(
            "document", documentImage.name, documentImage.asRequestBody(mimeType.toMediaType())
        )
        api.submitKyc(
            authorization = NetworkModule.authorizationHeader(),
            document = filePart,
            idType = idType.toRequestBody("text/plain".toMediaType()),
            idNumber = idNumber.toRequestBody("text/plain".toMediaType())
        )
    }

    /** Admin-only. Mints a short-lived signed URL to view the stored document image — call only on an
     *  explicit admin "view document" action, never speculatively (spec §4.30). */
    suspend fun fetchKycDocument(userId: String): Result<KycDocumentResponse> = safeCall {
        api.fetchKycDocument(NetworkModule.authorizationHeader(), userId)
    }

    /** Admin approval of a manually-reviewed KYC submission (spec §4.30). Plain client Firestore write,
     *  gated by firestore.rules' `isAdmin()` on `users/{userId}`. */
    suspend fun approveKyc(userId: String): Result<Unit> = safeCall {
        usersCol.document(userId).update(
            mapOf("isKycVerified" to true, "kycDetails.status" to "verified")
        ).await()
        Unit
    }

    suspend fun rejectKyc(userId: String): Result<Unit> = safeCall {
        usersCol.document(userId).update(
            mapOf("isKycVerified" to false, "kycDetails.status" to "rejected")
        ).await()
        Unit
    }

    /**
     * Records the admin's manual decision on the audit-only `kycDocuments/{userId}` record — separate
     * from [approveKyc]/[rejectKyc] (which flip the public-facing status on `users/{userId}`). A failed
     * write here must never block the account-level approve/reject decision itself, matching source's
     * `markKycDocumentReviewed`, so this always resolves successfully.
     */
    suspend fun markKycDocumentReviewed(userId: String, approved: Boolean, reviewerId: String): Result<Unit> {
        return try {
            kycDocumentsCol.document(userId).update(
                mapOf(
                    "decision" to if (approved) "manually_approved" else "rejected",
                    "reviewedAt" to java.time.Instant.now().toString(),
                    "reviewedBy" to reviewerId
                )
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.success(Unit)
        }
    }
}
