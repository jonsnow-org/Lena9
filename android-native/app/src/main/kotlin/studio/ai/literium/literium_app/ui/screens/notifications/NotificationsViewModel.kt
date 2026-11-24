package studio.ai.literium.literium_app.ui.screens.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.AppNotification
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.NotificationRepository

data class NotificationsUiState(
    val isLoading: Boolean = true,
    val notifications: List<AppNotification> = emptyList(),
    val errorMessage: String? = null
)

/**
 * spec §9 / `NotificationsModal.tsx`. Every action here is a real write through
 * [NotificationRepository] (never local-only state) — this is a documented, previously-real bug in
 * source itself: its own code comment on the equivalent `<NotificationsModal>` wiring in `App.tsx`
 * says mark-as-read and delete "كانا يعدّلان الحالة المحلية فقط دون أي كتابة فعلية إلى Firestore، فيعود
 * كل شيء 'غير مقروء' فور تحديث الصفحة" (were local-only, so everything reverted to unread on refresh)
 * before being fixed to real writes. [uiState] is deliberately not a separately-held local list at all
 * — it's a direct `.stateIn()` of [NotificationRepository.observeNotifications]'s Firestore listener,
 * so a write that didn't actually persist would visibly fail to update the UI too (there is no local
 * copy that could silently drift from the server the way a hand-rolled `mutableStateListOf` could).
 *
 * Admin-only notification scoping (per [studio.ai.literium.literium_app.data.model.NotificationType.ADMIN_ONLY]):
 * that set gates who may CREATE an earning/withdrawal/system notification (`firestore.rules` requires
 * the creator to be an admin) — it is NOT a read-side visibility filter, and there is no such filter to
 * apply here. [NotificationRepository.observeNotifications] already queries
 * `whereEqualTo("userId", currentUserId)`, so this screen can only ever show notifications addressed to
 * the signed-in user's own uid; an earning/withdrawal/system notification appearing in that stream is
 * legitimately about THIS user's own wallet/account activity, not a leaked admin-only broadcast.
 */
class NotificationsViewModel(
    private val notificationRepository: NotificationRepository = NotificationRepository(),
    private val authRepository: AuthRepository = AuthRepository()
) : ViewModel() {

    private val currentUserId: String = authRepository.currentFirebaseUser?.uid.orEmpty()

    val uiState: StateFlow<NotificationsUiState> = notificationRepository.observeNotifications(currentUserId)
        .map { list -> NotificationsUiState(isLoading = false, notifications = list) }
        .catch { e -> emit(NotificationsUiState(isLoading = false, errorMessage = e.message ?: "تعذر تحميل الإشعارات.")) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), NotificationsUiState())

    fun markOneRead(notificationId: String) {
        viewModelScope.launch { notificationRepository.markNotificationRead(notificationId) }
    }

    fun markAllRead() {
        viewModelScope.launch { notificationRepository.markAllNotificationsRead(uiState.value.notifications) }
    }

    fun deleteOne(notificationId: String) {
        viewModelScope.launch { notificationRepository.deleteNotification(notificationId) }
    }

    fun clearAll() {
        viewModelScope.launch { notificationRepository.clearAllNotifications(uiState.value.notifications) }
    }
}
