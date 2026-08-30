package studio.ai.literium.literium_app.data.repository

import kotlinx.coroutines.CancellationException

/**
 * Project-wide failure convention (see each repository's file KDoc):
 *
 * - Every `suspend fun` that can fail (network, Firebase Auth, Firestore
 *   permission-denied, etc.) returns `Result<T>` rather than throwing —
 *   callers branch on `.isSuccess`/`.exceptionOrNull()`/`.fold { }` instead
 *   of wrapping every call site in try/catch.
 * - Every `Flow<T>` returned by a `subscribeToX`/`observeX` realtime
 *   listener does NOT wrap emissions in `Result` — Flow already has an
 *   idiomatic error channel (the flow throws, catchable via the standard
 *   `.catch { }` operator on the collector side), and forcing `Result` onto
 *   a value that already updates continuously would just relocate the same
 *   information into a less-idiomatic shape. This is a deliberate,
 *   consistently-applied split, not an inconsistency.
 *
 * [safeCall] is the one place that implements the `suspend fun` half of
 * that convention — every repository suspend function should be a thin
 * wrapper around it (or around Firestore's own `Task.await()` composed with
 * it) so failures are captured uniformly.
 */
internal suspend fun <T> safeCall(block: suspend () -> T): Result<T> {
    return try {
        Result.success(block())
    } catch (e: CancellationException) {
        // Never swallow coroutine cancellation — rethrow so structured concurrency still works.
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }
}
