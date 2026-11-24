package studio.ai.literium.literium_app.util

import studio.ai.literium.literium_app.data.model.Presence
import studio.ai.literium.literium_app.data.model.PresenceState
import java.time.Instant
import java.time.format.DateTimeParseException

/**
 * Presence heartbeat/staleness thresholds — ported from the constants
 * documented in spec §7/§12.7 and `firestoreService.ts`'s `updateMyPresence`.
 * Not a dedicated TS source file (the web app inlines these numbers at call
 * sites), but they are load-bearing product behavior, so they are
 * centralized here rather than left as magic numbers at each call site.
 */
object PresenceRules {

    /** How often a foregrounded session writes a presence heartbeat. */
    const val HEARTBEAT_INTERVAL_SECONDS = 25

    /** If the last heartbeat is older than this, the user is shown offline/last-seen, not "online now". */
    const val STALE_AFTER_SECONDS = 60

    /**
     * True if [presence] should be displayed as "online now" — i.e. its `state` is
     * [PresenceState.ONLINE] AND `lastHeartbeatAt` is fresher than [STALE_AFTER_SECONDS].
     */
    fun isOnlineNow(presence: Presence?, nowMillis: Long = System.currentTimeMillis()): Boolean {
        if (presence == null || presence.state != PresenceState.ONLINE) return false
        val heartbeat = presence.lastHeartbeatAt ?: return false
        val heartbeatMillis = try {
            Instant.parse(heartbeat).toEpochMilli()
        } catch (e: DateTimeParseException) {
            return false
        }
        return (nowMillis - heartbeatMillis) < STALE_AFTER_SECONDS * 1000L
    }

    /**
     * True if a typing-indicator ISO timestamp (`Conversation.typing[uid]`) should currently be shown
     * as "typing…" — fresh means under ~4 seconds old, matching `types.ts`'s doc comment on
     * `Conversation.partnerTypingAt`.
     */
    fun isTypingFresh(typingAtIso: String?, nowMillis: Long = System.currentTimeMillis()): Boolean {
        if (typingAtIso.isNullOrBlank()) return false
        val millis = try {
            Instant.parse(typingAtIso).toEpochMilli()
        } catch (e: DateTimeParseException) {
            return false
        }
        return (nowMillis - millis) < 4000
    }
}
