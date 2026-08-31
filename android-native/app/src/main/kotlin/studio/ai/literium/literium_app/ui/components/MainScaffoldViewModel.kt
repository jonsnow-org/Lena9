package studio.ai.literium.literium_app.ui.components

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import studio.ai.literium.literium_app.data.model.User
import studio.ai.literium.literium_app.data.repository.AuthRepository
import studio.ai.literium.literium_app.data.repository.MessageRepository
import studio.ai.literium.literium_app.data.repository.NotificationRepository

/**
 * Backs [MainScaffold] — the one live-data source shared by every main-tab screen's chrome
 * (top header's admin bell badge, bottom nav's notification/message badges, drawer header). Kept
 * entirely self-contained (default-constructed repositories, no injected params) precisely so
 * [MainScaffold] can stay a drop-in `(navController, currentRoute, content)` shell per this scope's
 * brief, with no screen needing to thread user/badge state into it manually.
 *
 * Mirrors `App.tsx`'s `onAuthStateChanged` + `unreadCount`/`unreadMessagesCount` derivation (spec
 * §2.1/§9/§7): an anonymous guest session is deliberately treated the same as fully signed-out here
 * (spec §3.3 — a guest never gets a `users/{uid}` document, so there is nothing to observe/badge).
 */
class MainScaffoldViewModel(
    private val authRepository: AuthRepository = AuthRepository(),
    private val notificationRepository: NotificationRepository = NotificationRepository(),
    private val messageRepository: MessageRepository = MessageRepository()
) : ViewModel() {

    data class UiState(
        val currentUser: User? = null,
        val isGuestOrSignedOut: Boolean = true,
        val unreadNotifications: Int = 0,
        val unreadMessages: Int = 0
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.authState()
                .catch { emit(null) }
                .collectLatest { fbUser ->
                    if (fbUser == null || fbUser.isAnonymous) {
                        _uiState.value = UiState()
                        return@collectLatest
                    }
                    // coroutineScope so the three observers below are cancelled together the moment
                    // collectLatest receives the NEXT auth-state emission (e.g. logout) — none of them
                    // can outlive the uid they're keyed to.
                    coroutineScope {
                        launch {
                            authRepository.observeUser(fbUser.uid)
                                .catch { /* keep the last-known user rather than blanking the shell on a transient read error */ }
                                .collectLatest { user -> _uiState.update { it.copy(currentUser = user, isGuestOrSignedOut = false) } }
                        }
                        launch {
                            notificationRepository.observeNotifications(fbUser.uid)
                                .catch { }
                                .collectLatest { list ->
                                    _uiState.update { it.copy(unreadNotifications = list.count { n -> !n.isRead }) }
                                }
                        }
                        launch {
                            messageRepository.observeMessages(fbUser.uid)
                                .catch { }
                                .collectLatest { list ->
                                    val unread = list.count { m -> !m.isRead && m.senderId != fbUser.uid }
                                    _uiState.update { it.copy(unreadMessages = unread) }
                                }
                        }
                    }
                }
        }
    }

    fun logOut() {
        viewModelScope.launch { authRepository.logOut() }
    }
}
